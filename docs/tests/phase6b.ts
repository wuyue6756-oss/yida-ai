// 仅覆盖本次缺陷；不重跑 Phase6a 已通过的 300 批组合，不请求真实服务。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { seedGarments, seedProfile } from '../../src/data/seed';
import { reviewOutfit } from '../../src/ai/client';
import { validateReviewForGarments } from '../../src/ai/reviewRules';
import { buildOutfitPrompt, buildReviewPrompt } from '../../src/ai/prompts';
const { buildProviderRequest } = await import(/* @vite-ignore */ pathToFileURL(resolve('docs/scripts/server.mjs')).href);
let passed = 0;
const test = async (name: string, run: () => unknown) => { await run(); console.log('通过 ' + (++passed) + '：' + name); };
const missingIds = ['g_013', 'g_015'];
const missing = seedGarments.filter((g) => missingIds.includes(g.id));
const complete = seedGarments.filter((g) => [...missingIds, 'g_010'].includes(g.id));
const missingRecord = JSON.parse(await readFile('docs/dev-log/Phase6b-case-review-missing-shoes-2026-08-31T12-57-39-339Z.json', 'utf8'));
const corrected = { score: 8.1, comment: '还缺一双鞋，白色衬衫和黑色烟管裤配色协调。', tags: ['通勤'] };
await test('GLM视觉1024上限，文本与其他服务维持原参数', () => {
  assert.equal(buildProviderRequest('glm', 'test', '测试', 'data:image/jpeg;base64,AAAA').body.max_tokens, 1024);
  assert.equal(buildProviderRequest('glm', 'test', '测试').body.max_tokens, 2400);
  for (const provider of ['qwen', 'openai', 'anthropic']) assert.equal(buildProviderRequest(provider, 'test', '测试', 'data:image/jpeg;base64,AAAA').body.max_tokens, 2400);
});
await test('回放真实失败输出：漏掉缺鞋提醒必须拒绝', () => {
  assert.equal(validateReviewForGarments(missingRecord.data, missing).ok, false);
  assert.equal(validateReviewForGarments(corrected, missing).ok, true);
  assert.equal(validateReviewForGarments(missingRecord.data, complete).ok, true);
});
await test('非法基础schema仍拒绝，不被语义检查覆盖', () => {
  assert.equal(validateReviewForGarments({ ...corrected, score: 12 }, missing).ok, false);
  assert.equal(validateReviewForGarments(null, missing).ok, false);
});
await test('真实失败输出触发一次带原因重试', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (_url, init) => {
      calls++;
      const body = JSON.parse(init!.body as string);
      if (calls === 2) assert.match(body.prompt, /所选单品缺鞋/);
      return new Response(JSON.stringify({ text: JSON.stringify(calls === 1 ? missingRecord.data : corrected) }));
    };
    const result = await reviewOutfit(missingIds);
    assert.equal(calls, 2); assert.equal(result.source, 'ai'); assert.match(result.data.comment, /缺一双鞋/);
  } finally { globalThis.fetch = originalFetch; }
});
await test('连续漏报后明确降级，mock保留缺鞋提醒', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ text: JSON.stringify(missingRecord.data) })); };
    const result = await reviewOutfit(missingIds);
    assert.equal(calls, 2); assert.equal(result.source, 'mock'); assert.match(result.error!, /缺鞋/); assert.match(result.data.comment, /缺一双鞋/);
  } finally { globalThis.fetch = originalFetch; }
});
await test('完整组合不触发不必要重试', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ text: JSON.stringify(missingRecord.data) })); };
    assert.equal((await reviewOutfit(complete.map((g) => g.id))).source, 'ai'); assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});
await test('搭配请求不含昵称头像，保留全部衣物和必要偏好', () => {
  const prompt = buildOutfitPrompt({ scene: '面试', wardrobe: seedGarments, profile: { ...seedProfile, name: 'private-name-sentinel', avatar: 'private-avatar-sentinel' }, weather: { temp: 15, condition: '多云' } });
  assert.ok(!prompt.includes('private-name-sentinel')); assert.ok(!prompt.includes('private-avatar-sentinel'));
  for (const garment of seedGarments) assert.ok(prompt.includes(garment.id));
  assert.ok(prompt.includes('梨形')); assert.ok(prompt.includes('高饱和撞色'));
});
await test('完整组合的提示词保持一致，缺鞋提示只注入缺鞋案例', () => {
  assert.ok(!buildReviewPrompt(complete, seedProfile).includes('程序核对：'));
  assert.match(buildReviewPrompt(missing, seedProfile), /程序核对：.*没有鞋/);
});
console.log('新增 ' + passed + ' 项增量回归通过；没有使用真实 Key。');
