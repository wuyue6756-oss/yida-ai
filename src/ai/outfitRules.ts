// 真实 AI、演示组合和页面按钮共用衣橱完整性规则。
import type { Garment } from '../types';

export const getOutfitAvailability = (wardrobe: Garment[], temperature: number): string | undefined => {
  if (!Number.isFinite(temperature)) return '温度无效，请重新设置温度。';
  const count = (category: Garment['category']) => wardrobe.filter((item) => item.category === category).length;
  if (count('鞋') === 0) return '衣橱里还没有鞋，请先添加一双鞋，才能组成完整搭配。';
  if (temperature < 18 && count('外套') === 0) return '当前低于 18°C，请先添加一件外套，再生成保暖搭配。';
  const hasSeparates = count('上装') > 0 && count('下装') > 0;
  const hasDress = count('连衣裙') > 0 && count('包') + count('配饰') > 0;
  if (!hasSeparates && !hasDress) return '还需要“上装＋下装”或“连衣裙＋包/配饰”，才能与鞋组成完整搭配。';
  return undefined;
};

export const getPlanSignature = (itemIds: string[]): string => [...itemIds].sort().join('|');

// 只枚举合法结构；缺少某类单品时绝不用其他类别凑数。
export const getCompleteCombinations = (wardrobe: Garment[], temperature: number): string[][] => {
  if (getOutfitAvailability(wardrobe, temperature)) return [];
  const byCategory = (category: Garment['category']) => wardrobe.filter((item) => item.category === category);
  const bases: string[][] = [];
  for (const shoe of byCategory('鞋')) {
    for (const top of byCategory('上装')) {
      for (const bottom of byCategory('下装')) bases.push([top.id, bottom.id, shoe.id]);
    }
    for (const dress of byCategory('连衣裙')) {
      for (const accessory of [...byCategory('包'), ...byCategory('配饰')]) bases.push([dress.id, shoe.id, accessory.id]);
    }
  }
  const results = temperature < 18 ? [] : [...bases];
  if (temperature <= 28) {
    for (const outerwear of byCategory('外套')) {
      for (const base of bases) results.push([outerwear.id, ...base]);
    }
  }
  return results;
};
