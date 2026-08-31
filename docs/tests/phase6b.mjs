import { build } from 'vite';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const outDir = resolve(root, 'node_modules/.tmp/yida-phase6b');
await build({ root, configFile: false, publicDir: false, logLevel: 'warn', define: { 'import.meta.env.VITE_AI_PROVIDER': JSON.stringify('glm') },
  build: { target: 'node22', ssr: resolve(root, 'docs/tests/phase6b.ts'), outDir, emptyOutDir: true, minify: false, rollupOptions: { output: { entryFileNames: 'phase6b.mjs' } } } });
const result = spawnSync(process.execPath, [resolve(outDir, 'phase6b.mjs')], { cwd: root, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
