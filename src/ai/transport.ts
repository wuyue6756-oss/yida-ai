// 浏览器只发送业务输入，不读取或保存任何 API Key。
import { isPublicDemo } from '../config';
export type Provider = 'openai' | 'anthropic' | 'glm' | 'qwen' | 'mock';
export const resolveProvider = (value?: string): Provider => ['openai', 'anthropic', 'glm', 'qwen'].includes(value ?? '') ? value as Provider : 'mock';
export const provider = isPublicDemo ? 'mock' : resolveProvider(import.meta.env.VITE_AI_PROVIDER);
export const providerLabel: Record<Provider, string> = {
  mock: 'Mock 演示模式', openai: 'OpenAI', anthropic: 'Anthropic', glm: '智谱 GLM', qwen: '通义千问 Qwen',
};

export const requestProvider = async (prompt: string, imageBase64?: string): Promise<string> => {
  if (isPublicDemo) throw new Error('公开演示不连接真实模型服务');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, prompt, imageBase64 }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const messages: Record<number, string> = { 401: 'API Key 无效，请检查本机服务端配置', 403: '服务未获授权', 409: '前端与服务端 provider 配置不一致', 413: '图片过大，请选择更小的图片', 429: '请求过于频繁，请稍后再试', 503: '尚未配置本机 AI 服务或 API Key', 504: 'AI 请求超时（15 秒）' };
      throw new Error(messages[response.status] ?? `AI 服务暂不可用（${response.status}）`);
    }
    const result = await response.json() as { text?: unknown };
    if (typeof result.text !== 'string' || !result.text.trim()) throw new Error('AI 服务返回空内容或格式错误');
    return result.text;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('AI 请求超时（15 秒）');
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
