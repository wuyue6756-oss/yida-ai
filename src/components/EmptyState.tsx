// 空状态提供统一的情绪化提示与单一行动入口。
interface EmptyStateProps {
  emoji: string;
  title: string;
  description: string;
  ctaLabel: string;
  onAction: () => void;
}

function EmptyState({ emoji, title, description, ctaLabel, onAction }: EmptyStateProps) {
  return (
    <div className="rounded-card bg-white px-5 py-8 text-center shadow-card">
      <div className="text-5xl" aria-hidden="true">{emoji}</div>
      <h2 className="mt-4 text-lg font-bold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 rounded-control bg-mint px-5 py-3 text-sm font-bold text-white transition active:scale-[0.98]"
      >
        {ctaLabel}
      </button>
    </div>
  );
}

export default EmptyState;
