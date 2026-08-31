// 所有网络响应均为本地测试桩；通过不代表真实智谱模型质量已验收。
import assert from 'node:assert/strict';
import { seedGarments, seedProfile } from '../../src/data/seed';
import { buildMockPlans, generateOutfits, recognizeGarment, reviewOutfit } from '../../src/ai/client';
import { buildOutfitPrompt, buildReviewPrompt } from '../../src/ai/prompts';
import { parseWithRetry, safeParseJSON, validateGarmentRecognition, validateOutfitPlans, validateOutfitReview } from '../../src/ai/parsers';
import { getCompleteCombinations, getOutfitAvailability, getPlanSignature } from '../../src/ai/outfitRules';
import { providerLabel, requestProvider, resolveProvider } from '../../src/ai/transport';
import { useStore } from '../../src/store/useStore';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const { createAppServer, buildProviderRequest } = await import(/* @vite-ignore */ pathToFileURL(resolve('docs/scripts/server.mjs')).href);

let passed = 0;
const test = async (name: string, run: () => unknown) => {
  await run(); passed += 1; console.log(`通过 ${passed}：${name}`);
};
const baseInput = { scene: '面试', wardrobe: seedGarments, profile: seedProfile, weather: { temp: 22, condition: '多云' }, seed: 0 };
const signature = (plans: ReturnType<typeof buildMockPlans>) => plans.map((plan) => getPlanSignature(plan.itemIds)).sort().join('::');
const originalFetch = globalThis.fetch;

await test('22 件衣橱、全部真实 id 与唯一 emoji', () => {
  assert.equal(seedGarments.length, 22); assert.equal(new Set(seedGarments.map((g) => g.id)).size, 22); assert.equal(new Set(seedGarments.map((g) => g.emoji)).size, 22);
});
for (const scene of ['上课', '约会', '运动', '面试', '旅行', '聚会']) {
  for (const temp of [15, 18, 22, 28, 30]) {
    for (const mood of [undefined, '想舒服', '想正式', '想亮眼', '想显瘦']) {
      await test(`${scene} / ${temp}°C / ${mood ?? '无心情'}：两批完整搭配`, () => {
        const batches = [0, 1].map((seed) => buildMockPlans({ ...baseInput, scene, mood, seed, weather: { temp, condition: '多云' } }));
        for (const plans of batches) {
          const valid = validateOutfitPlans({ plans }, seedGarments, temp);
          assert.equal(valid.ok, true, JSON.stringify(valid));
          assert.ok(plans.every((plan) => plan.title.startsWith(scene)));
          assert.equal(new Set(plans.map((plan) => plan.title)).size, 3);
        }
        assert.notEqual(signature(batches[0]), signature(batches[1]));
      });
    }
  }
}
await test('心情影响单品选择，而不只是文案', () => {
  assert.notEqual(signature(buildMockPlans(baseInput)), signature(buildMockPlans({ ...baseInput, mood: '想舒服' })));
});
for (const category of ['鞋', '外套', '上装', '下装', '连衣裙', '包', '配饰']) {
  await test(`删除全部${category}后的安全行为`, () => {
    const wardrobe = seedGarments.filter((item) => item.category !== category);
    const input = { ...baseInput, wardrobe, weather: { temp: 15, condition: '多云' } };
    if (getOutfitAvailability(wardrobe, 15)) assert.throws(() => buildMockPlans(input));
    else assert.equal(validateOutfitPlans({ plans: buildMockPlans(input) }, wardrobe, 15).ok, true);
  });
}
await test('自定义衣橱 id，不依赖 seed id', () => {
  const wardrobe = seedGarments.map((item, index) => ({ ...item, id: `custom_${index}` }));
  assert.equal(validateOutfitPlans({ plans: buildMockPlans({ ...baseInput, wardrobe }) }, wardrobe, 22).ok, true);
});
await test('只有一套可穿组合时明确拒绝伪造三套', () => {
  const wardrobe = seedGarments.filter((item) => ['g_005', 'g_006', 'g_009'].includes(item.id));
  assert.equal(getCompleteCombinations(wardrobe, 30).length, 1);
  assert.throws(() => buildMockPlans({ ...baseInput, wardrobe, weather: { temp: 30, condition: '晴' } }));
});
await test('JSON 围栏剥离及非法 JSON', () => {
  assert.deepEqual(safeParseJSON('  ```json\n{"ok":true}\n```  '), { ok: true }); assert.throws(() => safeParseJSON('bad'));
});
await test('校验失败仅重试一次，并携带错误原因', async () => {
  let calls = 0;
  const data = await parseWithRetry(async (reason) => { calls++; if (calls === 2) assert.match(reason!, /comment/); return calls === 1 ? '{"score":8}' : '{"score":8.1,"comment":"白衬衫搭烟管裤利落","tags":["通勤"]}'; }, validateOutfitReview);
  assert.equal(calls, 2); assert.equal(data.score, 8.1);
  calls = 0;
  await assert.rejects(parseWithRetry(async () => { calls++; return '{}'; }, validateOutfitReview));
  assert.equal(calls, 2);
});
await test('严格校验重复组合、缺鞋、非法分数和高温外套', () => {
  const plans = buildMockPlans(baseInput);
  assert.equal(validateOutfitPlans({ plans: [plans[0], plans[0], plans[0]] }, seedGarments, 22).ok, false);
  assert.equal(validateOutfitPlans({ plans: plans.map((p) => ({ ...p, score: 9.333 })) }, seedGarments, 22).ok, false);
  assert.equal(validateOutfitPlans({ plans: plans.map((p) => ({ ...p, itemIds: p.itemIds.filter((id) => id !== 'g_010') })) }, seedGarments, 22).ok, false);
  assert.equal(validateOutfitPlans({ plans }, seedGarments, 30).ok, false);
  assert.equal(validateGarmentRecognition({}).ok, false);
});
await test('提示词不再含无鞋错误示例；点评包含真实衣物字段', () => {
  assert.ok(!buildOutfitPrompt(baseInput).includes('"g_001","g_003","g_006"'));
  const prompt = buildReviewPrompt(seedGarments.slice(12, 15), seedProfile);
  assert.match(prompt, /白色挺括长袖衬衫/); assert.match(prompt, /梨形/); assert.match(prompt, /colors/);
});
await test('GLM 与 Qwen 标签正确，未知配置回退 mock', () => {
  assert.equal(resolveProvider('glm'), 'glm'); assert.equal(resolveProvider('oops'), 'mock'); assert.match(providerLabel.glm, /智谱/); assert.match(providerLabel.qwen, /千问/);
});
await test('真实来源标记与重试（本地模拟响应，非真实 API）', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ text: calls === 1 ? '{}' : JSON.stringify({ plans: buildMockPlans(baseInput) }) })); };
  const result = await generateOutfits(baseInput);
  assert.equal(calls, 2); assert.equal(result.source, 'ai'); assert.equal(result.data.length, 3);
});
await test('缺 Key 自动降级、非法 schema 自动降级', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 503 });
  const missing = await generateOutfits(baseInput); assert.equal(missing.source, 'mock'); assert.match(missing.error!, /Key/);
  globalThis.fetch = async () => new Response(JSON.stringify({ text: '{}' }));
  const invalid = await generateOutfits(baseInput); assert.equal(invalid.source, 'mock'); assert.ok(invalid.error);
});
await test('点评发送真实衣物信息，已删除 id 拒绝', async () => {
  globalThis.fetch = async (_url, init) => {
    assert.match(String(init?.body), /白色挺括长袖衬衫/);
    return new Response(JSON.stringify({ text: '{"score":8.7,"comment":"衬衫与烟管裤搭配整洁","tags":["通勤"]}' }));
  };
  assert.equal((await reviewOutfit(['g_013', 'g_015', 'g_010'])).source, 'ai');
  await assert.rejects(reviewOutfit(['deleted_id']));
});
await test('识别请求经过代理，不携带前端 Key', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/ai'); assert.equal(new Headers(init?.headers).has('Authorization'), false);
    return new Response(JSON.stringify({ text: '{"name":"白色衬衫","category":"上装","colors":["白色"],"seasons":["春"],"styles":["通勤"],"material":"棉","confidence":0.9}' }));
  };
  assert.equal((await recognizeGarment('data:image/png;base64,AAAA')).source, 'ai');
});
await test('超时有明确提示', async () => {
  const originalTimer = globalThis.setTimeout;
  globalThis.setTimeout = ((callback, delay, ...args) => originalTimer(callback, delay === 15_000 ? 1 : delay, ...args)) as typeof setTimeout;
  globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
  try { await assert.rejects(requestProvider('测试'), /超时/); } finally { globalThis.setTimeout = originalTimer; }
});
globalThis.fetch = originalFetch;

await test('保存、重新读取与删除方案的数据闭环', async () => {
  const plan = buildMockPlans(baseInput)[0];
  const before = useStore.getState().plans.length;
  useStore.getState().savePlan({ ...plan, saved: true });
  const stored = useStore.getState().plans.at(-1)!;
  assert.equal(useStore.getState().plans.length, before + 1); assert.equal(stored.saved, true);
  useStore.getState().deletePlan(stored.id); assert.equal(useStore.getState().plans.length, before);
});
await test('四个 key 的持久化与重新水合（隔离内存存储）', async () => {
  const memory = new Map<string, string>();
  const previousWindow = globalThis.window;
  globalThis.window = { localStorage: { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) } } as unknown as Window & typeof globalThis;
  try {
    useStore.getState().savePlan({ ...buildMockPlans(baseInput)[0], saved: true });
    assert.deepEqual([...memory.keys()].sort(), ['yida_garments', 'yida_plans', 'yida_posts', 'yida_profile']);
    const savedStorage = new Map(memory);
    const savedId = useStore.getState().plans.at(-1)!.id;
    useStore.setState({ plans: [] });
    for (const [key, value] of savedStorage) memory.set(key, value);
    await useStore.persist.rehydrate();
    assert.ok(useStore.getState().plans.some((plan) => plan.id === savedId));
    useStore.getState().deletePlan(savedId);
    await useStore.persist.rehydrate();
    assert.ok(!useStore.getState().plans.some((plan) => plan.id === savedId));
    useStore.getState().clearAll(); assert.equal(memory.size, 0);
  } finally { if (previousWindow) globalThis.window = previousWindow; else delete globalThis.window; }
});
await test('四家服务模型与鉴权仅存在于服务端', () => {
  for (const provider of ['glm', 'qwen', 'openai', 'anthropic']) {
    const text = buildProviderRequest(provider, 'test-key-not-real', '测试');
    const vision = buildProviderRequest(provider, 'test-key-not-real', '测试', 'data:image/png;base64,AAAA');
    assert.ok(text.body.model); assert.ok(vision.body.model);
    assert.equal(provider === 'anthropic' ? text.headers['x-api-key'] : text.headers.Authorization, provider === 'anthropic' ? 'test-key-not-real' : 'Bearer test-key-not-real');
  }
  assert.throws(() => buildProviderRequest('glm', 'test', '测试', 'https://evil.test/image.png'));
});
await test('代理限流、来源限制、缺 Key、不泄露密钥与静态路由', async () => {
  const env = { AI_PROVIDER: 'glm', AI_KEY: '' };
  let upstreamCalls = 0;
  const server = createAppServer({ env, fetchImpl: async () => { upstreamCalls++; return new Response('{"choices":[{"message":{"content":"{}"}}]}'); } });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const call = (extra = {}) => originalFetch(`${base}/api/ai`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify({ provider: 'glm', prompt: '测试' }) });
  try {
    assert.equal((await originalFetch(`${base}/studio`)).status, 200);
    assert.equal((await originalFetch(`${base}/.env`)).status, 404);
    assert.equal((await call()).status, 503); assert.equal(upstreamCalls, 0);
    env.AI_KEY = 'test-key-not-real';
    assert.equal((await call({ Origin: 'https://evil.test' })).status, 403);
    assert.ok(!(await (await originalFetch(`${base}/api/ai/status`)).text()).includes(env.AI_KEY));
    for (let i = 0; i < 12; i++) assert.equal((await call()).status, 200);
    assert.equal((await call()).status, 429);
  } finally { await new Promise<void>((done) => server.close(() => done())); }
});
console.log(`\n共 ${passed} 项回归全部通过；未使用任何真实 API Key，未验证真实模型输出质量。`);
