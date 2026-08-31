// 公开发布专用：完全不读取本机 .env，也不运行本机 AI 代理。
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
await build({
  root,
  configFile: false,
  envDir: false,
  base: './',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_PUBLIC_DEMO': JSON.stringify('true'),
    'import.meta.env.VITE_AI_PROVIDER': JSON.stringify('mock'),
  },
  build: { outDir: 'docs/demo', emptyOutDir: true, sourcemap: false },
});
