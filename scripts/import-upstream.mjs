import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..');
const entries = [];
for (const name of (await readdir(root)).filter(n => /^\.upstream-transfer-\d+\.json$/.test(n))) {
  for (const file of JSON.parse(await readFile(resolve(root, name), 'utf8'))) {
    const bytes = Buffer.from(file.content, 'base64');
    const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (sha !== file.sha) throw new Error(`Hash incorreto: ${file.path}`);
    const dest = resolve(root, 'upstream/aladin-lite', file.path);
    if (!dest.startsWith(resolve(root, 'upstream/aladin-lite') + '/'.replace('/', process.platform === 'win32' ? '\\' : '/'))) throw new Error('Caminho inválido');
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, bytes);
    entries.push({path: file.path, sha: file.sha, bytes: bytes.length});
  }
  await unlink(resolve(root, name));
}
const manifestPath = resolve(root, 'upstream/files.json');
let previous = [];
try { previous = JSON.parse(await readFile(manifestPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await writeFile(manifestPath, JSON.stringify([...previous, ...entries].sort((a,b) => a.path.localeCompare(b.path)), null, 2) + '\n');
console.log(`Importados e verificados: ${entries.length} arquivos originais.`);
