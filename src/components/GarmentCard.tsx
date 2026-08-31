// 单品卡片统一承载图片占位、AI 来源徽章与穿着次数信息。
import type { Garment } from '../types';

interface GarmentCardProps {
  garment: Garment;
  onClick: (garment: Garment) => void;
}

function GarmentCard({ garment, onClick }: GarmentCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(garment)}
      className="relative min-w-0 rounded-card bg-white p-2 text-left shadow-card transition active:scale-[0.98]"
      aria-label={`查看${garment.name}详情`}
    >
      {garment.source === 'ai' ? (
        <span className="absolute left-2 top-2 z-10 rounded-full bg-cream px-2 py-0.5 text-[9px] font-bold text-ink">
          AI识别
        </span>
      ) : null}

      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-control bg-cream-light">
        {garment.imageUri ? (
          <img
            src={garment.imageUri}
            alt={garment.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-[42px] leading-none" aria-hidden="true">
            {garment.emoji ?? '👚'}
          </span>
        )}
      </div>

      <p className="mt-2 truncate text-xs font-bold text-ink">{garment.name}</p>
      <p className="mt-1 text-[10px] text-ink-soft">穿过 {garment.wearCount} 次</p>
    </button>
  );
}

export default GarmentCard;
