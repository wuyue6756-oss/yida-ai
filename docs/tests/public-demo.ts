import assert from 'node:assert/strict';
import { provider, requestProvider } from '../../src/ai/transport';

// 用故意冲突的 provider=glm 构建，验证公开开关仍强制 Mock。
assert.equal(provider, 'mock');
let networkCalls = 0;
globalThis.fetch = async () => { networkCalls++; throw new Error('unexpected network'); };
await assert.rejects(requestProvider('public demo'), /公开演示不连接真实模型服务/);
assert.equal(networkCalls, 0);

const data = new Map([['yida_garments', 'private-local-sentinel']]);
Object.defineProperty(globalThis, 'window', { value: { localStorage: {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => data.set(key, value),
  removeItem: (key: string) => data.delete(key),
} }, configurable: true });
const { useStore } = await import('../../src/store/useStore');
useStore.getState().updateProfile({ nickname: '公开演示检查' });
assert.ok(data.has('yida_public_demo_profile'));
assert.equal(data.get('yida_garments'), 'private-local-sentinel');
useStore.getState().clearAll();
assert.equal(data.get('yida_garments'), 'private-local-sentinel');
assert.ok(!data.has('yida_public_demo_profile'));
console.log('公开演示安全检查通过：强制 Mock、零模型请求、存储隔离及重置不影响本机数据。');
