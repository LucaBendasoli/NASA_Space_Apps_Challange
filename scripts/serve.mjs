import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.ttf': 'font/ttf' };
export function makeServer() {
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cache-Control', 'no-cache');
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Método não permitido'); return; }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname.includes('\0')) { res.writeHead(400); res.end(); return; }
      const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      const inside = path => path.startsWith(root + sep);
      if (!inside(file) || !inside(await realpath(file))) { res.writeHead(403); res.end('Acesso negado'); return; }
      const bytes = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'text/plain; charset=utf-8', 'Content-Length': bytes.length });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      const status = error instanceof URIError ? 400 : ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code) ? 404 : 500;
      res.writeHead(status); res.end(status === 404 ? 'Arquivo não encontrado' : 'Não foi possível atender a solicitação');
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 4174);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida');
  const server = makeServer();
  server.on('error', error => { console.error(`Não foi possível abrir a porta ${port}: ${error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Órbita · http://127.0.0.1:${port}\nCtrl+C para encerrar. Arquivos: ${root}`));
}
