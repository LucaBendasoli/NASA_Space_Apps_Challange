import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(resolve(root, 'upstream/files.json'), 'utf8'));
let failed = 0;
for (const file of manifest) {
  try {
    const bytes = await readFile(resolve(root, 'upstream/aladin-lite', file.path));
    const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (sha !== file.sha) throw new Error('hash diferente do original');
  } catch (error) { console.error(file.path, error.message); failed++; }
}
console.log(`${manifest.length - failed}/${manifest.length} arquivos idênticos aos blobs originais do GitHub.`);
if (failed) process.exitCode = 1;
