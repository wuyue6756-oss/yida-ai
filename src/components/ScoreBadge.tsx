// AI 评分徽章在社区与工作室共用同一套三档判断与语义色。
interface ScoreBadgeProps {
  score: number;
}

function ScoreBadge({ score }: ScoreBadgeProps) {
  const tone = score >= 9
    ? 'bg-mint-light text-mint'
    : score >= 8
      ? 'bg-sky-light text-sky-deep'
      : 'bg-coral-light text-coral-deep';

  return (
    <span className={`rounded-full px-3 py-1.5 text-xs font-bold shadow-card ${tone}`}>
      AI {score.toFixed(1)}
    </span>
  );
}

export default ScoreBadge;
