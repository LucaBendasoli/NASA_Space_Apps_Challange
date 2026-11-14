// Opcional: obtém o bundle compilado do mesmo endereço de contingência oferecido pelo CDS.
// O bundle é um artefato de distribuição, distinto dos fontes em upstream/.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const url = 'https://aladin.cds.unistra.fr/aladin_3.9.0-beta.js';
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 100000 || !bytes.toString('utf8').includes('Aladin')) throw new Error('Resposta não reconhecida como bundle Aladin Lite');
  const root = resolve(import.meta.dirname, '../vendor');
  await mkdir(root, { recursive: true });
  await writeFile(resolve(root, 'aladin.js'), bytes);
  await writeFile(resolve(root, 'runtime.json'), JSON.stringify({ url, version: '3.9.0-beta', downloadedAt: new Date().toISOString(), sha256: createHash('sha256').update(bytes).digest('hex'), note: 'Hash registrado no download, não é uma assinatura do fornecedor.' }, null, 2) + '\n');
  console.log('Bundle oficial salvo em vendor/aladin.js. Imagens e buscas continuam precisando de rede.');
} catch (error) { console.error(`Download não concluído: ${error.message} (${error.cause?.code || 'sem código adicional'}). A interface ainda pode carregar o bundle diretamente no navegador.`); process.exitCode = 1; }
