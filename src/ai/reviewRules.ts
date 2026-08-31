import type { Garment } from '../types';
import { validateOutfitReview } from './parsers';

// 缺鞋是可判定事实，不能只靠提示词。失败沿用一次重试及明确降级。
export const validateReviewForGarments = (value: unknown, garments: Garment[]) => {
  const result = validateOutfitReview(value);
  if (!result.ok) return result;
  if (!garments.some((item) => item.category === '鞋') &&
      !/(?:缺|补|少|没有|未|需要)[^。！？；\n]{0,20}鞋/.test(result.data.comment)) {
    return { ok: false as const, reason: '所选单品缺鞋：comment 必须以“还缺一双鞋，”开头，再简短点评已有单品；不要省略缺鞋提醒' };
  }
  return result;
};
