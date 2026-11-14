import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameUpdater, setTextIfChanged } from '../src/frame-updater.js';

function clock() {
  let time = 0, next = 0, hidden = false;
  const frames = new Map(), timers = new Map();
  return {
    options: {
      now: () => time,
      requestFrame: cb => { frames.set(++next, cb); return next; },
      cancelFrame: id => frames.delete(id),
      setTimer: (cb, delay) => { timers.set(++next, {cb, at: time + delay}); return next; },
      clearTimer: id => timers.delete(id),
      isHidden: () => hidden,
    },
    frame() {
      const pending = [...frames.values()]; frames.clear();
      for (const cb of pending) cb();
    },
    advance(ms) {
      time += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.cb(); }
    },
    hide(value) { hidden = value; },
    pending: () => frames.size + timers.size,
  };
}
test('rajada de eventos atualiza uma vez com o estado mais recente e não mantém loop ocioso', () => {
  const c = clock();
  let state = 0;
  const values = [];
  const updater = createFrameUpdater(() => values.push(state), c.options);
  for (let i = 1; i <= 1000; i++) { state = i; updater.request(); }
  assert.equal(c.pending(), 1);
  c.frame();
  assert.deepEqual(values, [1000]);
  assert.equal(c.pending(), 0);
});
test('eventos contínuos limitam a interface a 10 Hz e preservam o último valor após parar', () => {
  const c = clock();
  const values = [];
  let state = 0;
  const updater = createFrameUpdater(() => values.push(state), c.options);
  updater.request(); c.frame();
  for (let i = 1; i <= 245; i++) {
    c.advance(4); state = i; updater.request(); c.frame();
  }
  assert.equal(values.length, 10); // t=0,100,...900 ms
  c.advance(20); c.frame();
  assert.equal(values.length, 11);
  assert.equal(values.at(-1), 245);
  assert.equal(c.pending(), 0);
});
test('aba oculta e cancelamento removem trabalho pendente; retomada lê o estado atual', () => {
  const c = clock();
  let calls = 0;
  const updater = createFrameUpdater(() => calls++, c.options);
  updater.request(); updater.cancel(); c.frame();
  assert.equal(calls, 0);
  c.hide(true); updater.request();
  assert.equal(c.pending(), 0);
  c.hide(false); updater.request(); c.frame();
  assert.equal(calls, 1);
  updater.request(); // timer pendente dentro dos 100 ms
  updater.cancel(); c.advance(100); c.frame();
  assert.equal(calls, 1);
  assert.equal(c.pending(), 0);
});
test('indicador sem mudança não produz outra escrita no DOM', () => {
  let value = '0.100″', writes = 0;
  const element = { get textContent() { return value; }, set textContent(v) { value = v; writes++; } };
  for (let i = 0; i < 1000; i++) setTextIfChanged(element, '0.100″');
  assert.equal(writes, 0);
  setTextIfChanged(element, '0.200″');
  assert.equal(writes, 1);
});
