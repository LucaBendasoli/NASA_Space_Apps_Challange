// Agenda somente a interface auxiliar. O loop de desenho do Aladin fica intacto.
export function createFrameUpdater(update, {
  interval = 100,
  now = () => performance.now(),
  requestFrame = callback => requestAnimationFrame(callback),
  cancelFrame = id => cancelAnimationFrame(id),
  setTimer = (callback, delay) => setTimeout(callback, delay),
  clearTimer = id => clearTimeout(id),
  isHidden = () => document.hidden,
} = {}) {
  let frame = null, timer = null, lastUpdate = -Infinity;
  function queueFrame() {
    timer = null;
    if (isHidden()) return;
    frame = requestFrame(() => {
      frame = null;
      if (isHidden()) return;
      lastUpdate = now();
      update(); // Lê o estado atual, em vez de reproduzir eventos antigos.
    });
  }
  return {
    request() {
      if (frame !== null || timer !== null || isHidden()) return;
      const delay = interval - (now() - lastUpdate);
      if (delay > 0) timer = setTimer(queueFrame, delay);
      else queueFrame();
    },
    cancel() {
      if (frame !== null) cancelFrame(frame);
      if (timer !== null) clearTimer(timer);
      frame = timer = null;
    },
  };
}

export function setTextIfChanged(element, value) {
  if (element.textContent !== value) element.textContent = value;
}
