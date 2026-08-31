// 使用已有 Vite 编译测试入口，Node 执行断言，不新增测试框架依赖。
import { build } from 'vite';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const outDir = resolve(root, 'node_modules/.tmp/yida-tests');
await build({
  root, configFile: false, publicDir: false, logLevel: 'warn',
  define: { 'import.meta.env.VITE_AI_PROVIDER': JSON.stringify('glm') },
  build: { target: 'node22', ssr: resolve(root, 'docs/tests/regression.ts'), outDir, emptyOutDir: true, minify: false, rollupOptions: { output: { entryFileNames: 'regression.mjs' } } },
});
const result = spawnSync(process.execPath, [resolve(outDir, 'regression.mjs')], { cwd: root, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
