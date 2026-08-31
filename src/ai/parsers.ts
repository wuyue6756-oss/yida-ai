// 本文件负责清洗模型输出、严格校验三种 AI 返回结构，并在校验失败时重试一次。
import type { Garment, OutfitPlan } from '../types';
import type { GarmentRecognition, OutfitReview } from './client';

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

export type GeneratedOutfitPlan = Pick<
  OutfitPlan,
  'title' | 'itemIds' | 'score' | 'review' | 'tags' | 'pros' | 'cons'
>;

const categories = ['外套', '上装', '下装', '连衣裙', '鞋', '包', '配饰'];
const seasons = ['春', '夏', '秋', '冬'];
const styles = ['通勤', '温柔', '运动', '甜美', '复古', '简约', '学院', '街头'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (
  value: unknown,
  minimumLength = 0,
  maximumLength = Number.POSITIVE_INFINITY,
): value is string[] =>
  Array.isArray(value) &&
  value.length >= minimumLength &&
  value.length <= maximumLength &&
  value.every((item) => typeof item === 'string' && item.trim().length > 0);

const fail = <T>(reason: string): ValidationResult<T> => ({ ok: false, reason });

export const safeParseJSON = (text: string): unknown => {
  const trimmedText = text.trim();
  const fencedMatch = trimmedText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonText = (fencedMatch?.[1] ?? trimmedText).trim();

  if (!jsonText) throw new Error('模型返回内容为空');
  return JSON.parse(jsonText) as unknown;
};

export const validateGarmentRecognition = (
  value: unknown,
): ValidationResult<GarmentRecognition> => {
  if (!isRecord(value)) return fail('识别结果必须是 JSON 对象');
  if (typeof value.error === 'string') return fail(value.error);
  if (typeof value.name !== 'string' || !value.name.trim()) return fail('缺少有效的 name');
  if (typeof value.category !== 'string' || !categories.includes(value.category)) {
    return fail('category 不在允许枚举中');
  }
  if (!isStringArray(value.colors, 1, 3)) return fail('colors 必须是 1-3 个中文颜色');
  if (!isStringArray(value.seasons, 1) || !value.seasons.every((item) => seasons.includes(item))) {
    return fail('seasons 包含无效值');
  }
  if (
    !isStringArray(value.styles, 1, 3) ||
    !value.styles.every((item) => styles.includes(item))
  ) {
    return fail('styles 必须是 1-3 个允许的风格');
  }
  if (typeof value.material !== 'string' || !value.material.trim()) {
    return fail('缺少有效的 material');
  }
  if (
    typeof value.confidence !== 'number' ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1
  ) {
    return fail('confidence 必须是 0-1 的数字');
  }

  return { ok: true, data: value as unknown as GarmentRecognition };
};

export const validateOutfitPlans = (
  value: unknown,
  wardrobe: Garment[],
  temperature: number,
): ValidationResult<GeneratedOutfitPlan[]> => {
  if (!isRecord(value) || !Array.isArray(value.plans)) {
    return fail('搭配结果必须包含 plans 数组');
  }
  if (value.plans.length !== 3) return fail('plans 必须恰好包含 3 套方案');

  const garmentById = new Map(wardrobe.map((garment) => [garment.id, garment]));
  const allowedIds = new Set(garmentById.keys());
  const isCold = temperature < 18;
  const isHot = temperature > 28;
  if (!Number.isFinite(temperature)) return fail('温度必须是有限数字');
  const plans: GeneratedOutfitPlan[] = [];

  for (const [index, plan] of value.plans.entries()) {
    if (!isRecord(plan)) return fail(`第 ${index + 1} 套方案不是对象`);
    if (typeof plan.title !== 'string' || !plan.title.trim()) {
      return fail(`第 ${index + 1} 套方案缺少 title`);
    }
    const hasValidItemCount = isCold
      ? isStringArray(plan.itemIds, 4, 4)
      : isHot
        ? isStringArray(plan.itemIds, 3, 3)
        : isStringArray(plan.itemIds, 3, 4);
    if (!hasValidItemCount) {
      return fail(
        `第 ${index + 1} 套方案在 ${temperature}°C 时件数无效：低温必须 4 件，18–28°C 可为 3–4 件，高温必须 3 件，且 id 不得重复`,
      );
    }
    const itemIds = plan.itemIds as string[];
    if (new Set(itemIds).size !== itemIds.length) {
      return fail(`第 ${index + 1} 套方案的 itemIds 不得重复`);
    }
    if (!itemIds.every((id) => allowedIds.has(id))) {
      return fail(`第 ${index + 1} 套方案使用了衣橱中不存在的 itemId`);
    }
    const selectedGarments = itemIds.map((id) => garmentById.get(id)!);
    const categoryCount = (category: Garment['category']): number =>
      selectedGarments.filter((garment) => garment.category === category).length;
    if (categoryCount('鞋') !== 1) {
      return fail(`第 ${index + 1} 套方案必须包含且仅包含一件鞋`);
    }
    const outerwearCount = categoryCount('外套');
    if (isCold && outerwearCount !== 1) {
      return fail(`第 ${index + 1} 套方案在低温时必须包含且仅包含一件外套`);
    }
    if (!isCold && !isHot && outerwearCount > 1) {
      return fail(`第 ${index + 1} 套方案在 18–28°C 时最多包含一件外套`);
    }
    if (isHot && outerwearCount !== 0) {
      return fail(`第 ${index + 1} 套方案在高温时不得包含外套`);
    }

    const isTopBottomOutfit =
      categoryCount('上装') === 1 &&
      categoryCount('下装') === 1 &&
      categoryCount('连衣裙') === 0 &&
      categoryCount('包') === 0 &&
      categoryCount('配饰') === 0;
    const isDressOutfit =
      categoryCount('上装') === 0 &&
      categoryCount('下装') === 0 &&
      categoryCount('连衣裙') === 1 &&
      categoryCount('包') + categoryCount('配饰') === 1;

    if (!isTopBottomOutfit && !isDressOutfit) {
      return fail(
        `第 ${index + 1} 套方案必须包含“上装 + 下装 + 鞋”或“连衣裙 + 鞋 + 一件包/配饰”，外套按温度规则增减`,
      );
    }
    if (
      typeof plan.score !== 'number' ||
      !Number.isFinite(plan.score) ||
      plan.score < 0 ||
      plan.score > 10 ||
      Math.abs(plan.score * 10 - Math.round(plan.score * 10)) > 1e-8
    ) {
      return fail(`第 ${index + 1} 套方案的 score 无效`);
    }
    if (typeof plan.review !== 'string' || !plan.review.trim()) {
      return fail(`第 ${index + 1} 套方案缺少 review`);
    }
    if (!isStringArray(plan.tags, 1)) return fail(`第 ${index + 1} 套方案缺少 tags`);
    if (!isStringArray(plan.pros, 1)) return fail(`第 ${index + 1} 套方案缺少 pros`);
    if (!isStringArray(plan.cons, 1)) return fail(`第 ${index + 1} 套方案缺少 cons`);

    plans.push(plan as unknown as GeneratedOutfitPlan);
  }

  if (new Set(plans.map((plan) => plan.score)).size < 2) {
    return fail('三套方案的 score 缺少区分度');
  }
  if (new Set(plans.map((plan) => [...plan.itemIds].sort().join('|'))).size !== 3) {
    return fail('三套方案的单品组合必须各不相同');
  }

  return { ok: true, data: plans };
};

export const validateOutfitReview = (value: unknown): ValidationResult<OutfitReview> => {
  if (!isRecord(value)) return fail('点评结果必须是 JSON 对象');
  if (
    typeof value.score !== 'number' ||
    !Number.isFinite(value.score) ||
    value.score < 0 ||
    value.score > 10
  ) {
    return fail('点评 score 必须是 0-10 的数字');
  }
  if (typeof value.comment !== 'string' || !value.comment.trim()) {
    return fail('点评缺少有效的 comment');
  }
  if (!isStringArray(value.tags, 1, 3)) return fail('点评 tags 必须包含 1-3 项');

  return { ok: true, data: value as unknown as OutfitReview };
};

export const parseWithRetry = async <T>(
  request: (retryReason?: string) => Promise<string>,
  validate: (value: unknown) => ValidationResult<T>,
): Promise<T> => {
  let lastReason = '未知校验错误';

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const responseText = await request(attempt === 0 ? undefined : lastReason);

    try {
      const parsedValue = safeParseJSON(responseText);
      const result = validate(parsedValue);
      if (result.ok) return result.data;
      lastReason = result.reason;
    } catch (error) {
      lastReason = `JSON 解析失败：${error instanceof Error ? error.message : '未知错误'}`;
    }
  }

  throw new Error(`模型返回连续两次校验失败：${lastReason}`);
};
