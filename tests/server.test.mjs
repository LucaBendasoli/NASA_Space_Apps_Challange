import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { makeServer } from '../scripts/serve.mjs';
test('servidor entrega aplicação e fontes, trata erros e bloqueia escrita e escape de pasta', async () => {
  const server = makeServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const index = await fetch(base);
    assert.equal(index.status, 200);
    const html = await index.text();
    assert.match(html, /Órbita — Sky atlas/);
    assert.match(html, /<html lang="en"/);
    const js = await fetch(base + '/src/app.js');
    assert.match(js.headers.get('content-type'), /javascript/);
    assert.equal(js.status, 200);
    assert.equal((await fetch(base + '/upstream/aladin-lite/LICENSE')).status, 200);
    assert.equal((await fetch(base + '/inexistente')).status, 404);
    assert.equal((await fetch(base + '/%zz')).status, 400);
    assert.equal((await fetch(base + '/index.html', { method: 'POST' })).status, 405);
    assert.equal((await fetch(base + '/index.html', { method: 'HEAD' })).status, 200);
    assert.equal(await (await fetch(base + '/index.html', { method: 'HEAD' })).text(), '');
    assert.equal((await fetch(base + '/..%5cfrontend%5cpackage.json')).status, 403);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
