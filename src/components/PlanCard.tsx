// 工作室方案卡通过 itemIds 实时关联衣橱，兼容单品被删除后的异常状态。
import { BookmarkCheck, RefreshCw, ScanLine } from 'lucide-react';
import type { Garment, OutfitPlan } from '../types';
import ScoreBadge from './ScoreBadge';

interface PlanCardProps {
  plan: OutfitPlan;
  garments: Garment[];
  index: number;
  isSaved: boolean;
  isBusy: boolean;
  onSave: (plan: OutfitPlan) => void;
  onRegenerate: () => void;
  readOnly?: boolean;
}

function PlanCard({
  plan,
  garments,
  index,
  isSaved,
  isBusy,
  onSave,
  onRegenerate,
  readOnly = false,
}: PlanCardProps) {
  const garmentById = new Map(garments.map((garment) => [garment.id, garment]));
  const itemGrid = plan.itemIds.length === 4 ? 'grid-cols-4' : 'grid-cols-3';

  return (
    <article
      className="plan-enter rounded-card bg-white p-4 shadow-card"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-mint">{plan.scene}</p>
          <h3 className="mt-1 text-lg font-bold text-ink">{plan.title}</h3>
        </div>
        <ScoreBadge score={plan.score} />
      </div>

      <div className={`mt-4 grid gap-2 ${itemGrid}`}>
        {plan.itemIds.map((itemId) => {
          const garment = garmentById.get(itemId);
          return (
            <div key={itemId} className={`min-w-0 rounded-control p-2 text-center ${garment ? 'bg-cream-light' : 'bg-coral-light'}`}>
              <div className="text-3xl" aria-hidden="true">{garment?.emoji ?? '❔'}</div>
              <p className="mt-2 line-clamp-2 text-[9px] font-bold leading-4 text-ink">
                {garment?.name ?? '单品已删除'}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-sm leading-6 text-ink">{plan.review}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {plan.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-sky-light px-2.5 py-1 text-[10px] font-bold text-ink">#{tag}</span>
        ))}
      </div>

      <div className="mt-3 grid gap-2">
        {plan.pros.map((pro) => (
          <p key={pro} className="rounded-control bg-mint-light px-3 py-2 text-xs leading-5 text-ink">✅ {pro}</p>
        ))}
        {plan.cons.map((con) => (
          <p key={con} className="rounded-control bg-coral-light px-3 py-2 text-xs leading-5 text-coral-deep">⚠️ {con}</p>
        ))}
      </div>

      {!readOnly ? <div className="mt-4 grid grid-cols-3 gap-2">
        <button type="button" disabled className="flex flex-col items-center justify-center rounded-control bg-bg px-2 py-2.5 text-[10px] font-bold text-ink-soft">
          <ScanLine size={16} />
          <span className="mt-1">虚拟试穿</span>
          <span className="font-normal">即将上线</span>
        </button>
        <button
          type="button"
          onClick={() => onSave(plan)}
          disabled={isSaved || isBusy}
          className={`flex flex-col items-center justify-center rounded-control px-2 py-2.5 text-[10px] font-bold ${isSaved ? 'bg-mint-light text-mint' : 'bg-mint text-white'}`}
        >
          <BookmarkCheck size={16} />
          <span className="mt-1">{isSaved ? '已保存' : '存入我的方案'}</span>
        </button>
        <button type="button" onClick={onRegenerate} disabled={isBusy} className="flex flex-col items-center justify-center rounded-control bg-sky-light px-2 py-2.5 text-[10px] font-bold text-sky-deep disabled:opacity-50">
          <RefreshCw size={16} />
          <span className="mt-1">换一批</span>
        </button>
      </div> : null}
    </article>
  );
}

export default PlanCard;
