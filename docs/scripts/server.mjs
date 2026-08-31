// 仅供本机联调：静态预览与 AI 代理共用端口，密钥绝不进入前端。
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PROJECT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BUILD_DIR = resolve(PROJECT_DIR, 'dist');
const CONFIG = {
  glm: { url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', text: 'glm-4-flash', vision: 'glm-4v-flash' },
  qwen: { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', text: 'qwen-plus', vision: 'qwen-vl-max' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', text: 'gpt-4o', vision: 'gpt-4o' },
  anthropic: { url: 'https://api.anthropic.com/v1/messages', text: 'claude-sonnet-4-20250514', vision: 'claude-sonnet-4-20250514' },
};
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const PAGE_ROUTES = new Set(['/', '/studio', '/wardrobe', '/community', '/me']);
const LIMIT = 6 * 1024 * 1024;

const reply = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
};

// 不接受任意目标地址或模型，避免成为开放转发代理。
export const buildProviderRequest = (provider, key, prompt, imageBase64) => {
  const config = CONFIG[provider];
  if (!config) throw new Error('不支持的服务');
  const image = imageBase64?.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (imageBase64 && !image) throw new Error('图片必须为 JPEG、PNG 或 WebP 的 base64');
  const model = image ? config.vision : config.text;
  // GLM-4V-Flash 上限为 1024，文本请求继续使用 2400。
  const maxTokens = provider === 'glm' && image ? 1024 : 2400;
  if (provider === 'anthropic') return {
    url: config.url,
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: { model, max_tokens: 2400, messages: [{ role: 'user', content: image ? [{ type: 'image', source: { type: 'base64', media_type: image[1], data: image[2] } }, { type: 'text', text: prompt }] : prompt }] },
  };
  return {
    url: config.url,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: { model, max_tokens: maxTokens, temperature: 0.4, messages: [{ role: 'user', content: image ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageBase64 } }] : prompt }], ...(!image ? { response_format: { type: 'json_object' } } : {}) },
  };
};

export const createAppServer = ({ env = process.env, fetchImpl = fetch } = {}) => {
  let windowStart = Date.now();
  let requestCount = 0;
  return createServer(async (req, res) => {
    try {
      // 限定本机 Host 和 Origin，防止其他网页借用本机密钥。
      const host = req.headers.host ?? '';
      if (!/^(localhost|127\.0\.0\.1):\d+$/.test(host)) return reply(res, 403, { error: '仅限本机访问' });
      const origin = req.headers.origin;
      if (origin && ![`http://${host}`, 'http://localhost:5174', 'http://127.0.0.1:5174'].includes(origin)) return reply(res, 403, { error: '来源不允许' });
      const pathname = new URL(req.url, `http://${host}`).pathname;
      const activeProvider = env.AI_PROVIDER || env.VITE_AI_PROVIDER || 'mock';
      if (pathname === '/api/ai/status' && req.method === 'GET') return reply(res, 200, { provider: activeProvider, configured: Boolean(env.AI_KEY?.trim()), localOnly: true });
      if (pathname === '/api/ai') {
        if (req.method !== 'POST') return reply(res, 405, { error: '仅支持 POST' });
        if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return reply(res, 415, { error: '请求格式必须为 JSON' });
        if (!env.AI_KEY?.trim() || !CONFIG[activeProvider]) return reply(res, 503, { error: '尚未配置 AI_KEY' });
        if (Date.now() - windowStart > 60_000) { windowStart = Date.now(); requestCount = 0; }
        if (++requestCount > 12) return reply(res, 429, { error: '本机每分钟最多 12 次请求' });
        const chunks = [];
        let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > LIMIT) { reply(res, 413, { error: '图片过大' }); return; }
          chunks.push(chunk);
        }
        let payload;
        try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply(res, 400, { error: 'JSON 无效' }); }
        if (!payload || typeof payload !== 'object' || typeof payload.prompt !== 'string' || !payload.prompt.trim() || payload.prompt.length > 60_000 || (payload.imageBase64 !== undefined && typeof payload.imageBase64 !== 'string')) return reply(res, 400, { error: '输入格式错误或过长' });
        if (payload.provider !== activeProvider) return reply(res, 409, { error: '服务配置不一致' });
        let request;
        try { request = buildProviderRequest(activeProvider, env.AI_KEY.trim(), payload.prompt, payload.imageBase64); } catch { return reply(res, 400, { error: '图片或服务格式无效' }); }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 14_500);
        const cancel = () => { if (!res.writableEnded) controller.abort(); };
        res.once('close', cancel);
        try {
          const upstream = await fetchImpl(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(request.body), signal: controller.signal });
          if (!upstream.ok) return reply(res, [401, 403, 429].includes(upstream.status) ? upstream.status : 502, { error: '供应商请求失败' });
          const result = await upstream.json();
          const text = activeProvider === 'anthropic' ? result.content?.filter((part) => part.type === 'text').map((part) => part.text).join('') : result.choices?.[0]?.message?.content;
          if (typeof text !== 'string' || !text.trim()) return reply(res, 502, { error: '供应商返回空内容' });
          return reply(res, 200, { text });
        } catch (error) {
          return reply(res, error.name === 'AbortError' ? 504 : 502, { error: 'AI 请求失败' });
        } finally { clearTimeout(timer); res.removeListener('close', cancel); }
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return reply(res, 405, { error: '方法不支持' });
      let relative = decodeURIComponent(pathname).replace(/^\/+/, '');
      if (PAGE_ROUTES.has(pathname.replace(/\/$/, '') || '/')) relative = 'index.html';
      if (!relative || relative.split(/[\\/]/).some((part) => part.startsWith('.'))) return reply(res, 404, { error: '未找到' });
      const target = resolve(BUILD_DIR, relative);
      if (!target.startsWith(BUILD_DIR + sep) || !MIME[extname(target)] || !(await stat(target).catch(() => null))?.isFile()) return reply(res, 404, { error: '未找到' });
      res.writeHead(200, { 'Content-Type': MIME[extname(target)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(target));
    } catch { if (!res.headersSent) reply(res, 500, { error: '本机服务发生错误' }); else res.end(); }
  });
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  for (const filename of ['.env.local', '.env']) {
    const path = resolve(PROJECT_DIR, filename);
    if (existsSync(path)) process.loadEnvFile(path);
  }
  const app = createAppServer();
  app.requestTimeout = 20_000;
  app.headersTimeout = 10_000;
  app.listen(5173, '127.0.0.1', () => console.log('衣搭 AI 本机服务：http://localhost:5173（Key 仅在服务端读取）'));
}
