import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

await build({
  absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
  entryPoints: ['src/components/spectrum/index.tsx'],
  outfile: 'assets/spectrum/spectrum.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  jsx: 'automatic',
  loader: { '.css': 'text' },
  target: 'es2022',
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
  legalComments: 'linked',
  logLevel: 'info',
});

// Preserve também os textos completos das licenças das bibliotecas distribuídas.
const require = createRequire(import.meta.url);
const licenses = [];
for (const name of ['react', 'react-dom', 'scheduler', 'lucide-react']) {
  const packageRoot = dirname(require.resolve(`${name}/package.json`));
  const { version } = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
  const license = await readFile(resolve(packageRoot, 'LICENSE'), 'utf8');
  licenses.push(`${name} ${version}\n${'='.repeat(60)}\n${license.trim()}\n`);
}
await writeFile(new URL('../assets/spectrum/THIRD_PARTY_LICENSES.txt', import.meta.url), licenses.join('\n'));
