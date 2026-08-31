// 已保存方案沿用工作室卡片，删除衣物后仍能安全查看历史搭配。
import { Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../store/useStore';
import EmptyState from './EmptyState';
import PlanCard from './PlanCard';

export default function SavedPlansSheet({ onClose }: { onClose: () => void }) {
  const plans = useStore((state) => state.plans);
  const garments = useStore((state) => state.garments);
  const deletePlan = useStore((state) => state.deletePlan);
  const [notice, setNotice] = useState('');
  const savedPlans = plans.filter((plan) => plan.saved).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-ink/30 p-[10px]" role="dialog" aria-modal="true" aria-label="我的方案">
      <section className="phone-scrollbar max-h-[calc(100%_-_38px)] w-full overflow-y-auto rounded-card bg-bg p-4 shadow-card">
        <header className="mb-4 flex items-center justify-between">
          <div><h2 className="text-lg font-bold text-ink">我的方案</h2><p className="mt-1 text-xs text-ink-soft">已保存 {savedPlans.length} 套 · 保存在本机</p></div>
          <button type="button" onClick={onClose} aria-label="关闭我的方案" className="rounded-full bg-white p-2 text-ink"><X size={18} /></button>
        </header>
        {notice ? <p role="status" className="mb-3 rounded-control bg-mint-light p-3 text-xs text-ink">{notice}</p> : null}
        {savedPlans.length ? <div className="space-y-4">{savedPlans.map((plan, index) => (
          <section key={plan.id}>
            <PlanCard plan={plan} garments={garments} index={index} isSaved isBusy={false} readOnly onSave={() => undefined} onRegenerate={() => undefined} />
            <button type="button" className="mt-2 flex items-center gap-1 rounded-control bg-coral-light px-3 py-2 text-xs text-coral-deep" onClick={() => {
              if (window.confirm(`确定删除“${plan.title}”吗？衣橱单品不受影响。`)) { deletePlan(plan.id); setNotice('已删除该方案，衣橱单品仍保留。'); }
            }}><Trash2 size={14} />删除这套方案</button>
          </section>
        ))}</div> : <EmptyState emoji="🔖" title="还没有保存的搭配" description="在工作室生成后点击“存入我的方案”，下次就能在这里找到。" ctaLabel="知道啦" onAction={onClose} />}
      </section>
    </div>
  );
}
