// 衣橱与首页共用同一套利用率和闲置统计口径，避免页面间数字不一致。
import type { Garment } from '../types';

export interface WardrobeStats {
  totalCount: number;
  weeklyWornCount: number;
  utilization: number;
  idleCount: number;
  idleValue: number;
}

const daysSince = (dateText: string, referenceDate: Date): number => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateText);
  target.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - target.getTime()) / 86_400_000);
};

export const getWardrobeStats = (
  garments: Garment[],
  referenceDate = new Date(),
): WardrobeStats => {
  const weeklyWornCount = garments.filter((garment) => {
    if (!garment.lastWorn) return false;
    const elapsedDays = daysSince(garment.lastWorn, referenceDate);
    return elapsedDays >= 0 && elapsedDays <= 7;
  }).length;
  const idleCount = garments.filter(
    (garment) => !garment.lastWorn || daysSince(garment.lastWorn, referenceDate) > 30,
  ).length;

  return {
    totalCount: garments.length,
    weeklyWornCount,
    utilization: garments.length
      ? Math.round((weeklyWornCount / garments.length) * 100)
      : 0,
    idleCount,
    idleValue: idleCount * 200,
  };
};
