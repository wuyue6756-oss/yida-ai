// 可复用骨架屏用于数据水合和 AI 请求等待，避免页面只显示旋转图标。
interface LoadingSkeletonProps {
  rows?: number;
  label?: string;
}

function LoadingSkeleton({ rows = 3, label = '正在加载内容…' }: LoadingSkeletonProps) {
  return (
    <div className="animate-pulse space-y-3" role="status" aria-label={label}>
      <div className="h-5 w-2/5 rounded-control bg-mint-light" />
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="rounded-card bg-white p-3 shadow-card"
        >
          <div className="h-20 rounded-control bg-sky-light" />
          <div className="mt-3 h-3 w-4/5 rounded-full bg-mint-light" />
          <div className="mt-2 h-3 w-3/5 rounded-full bg-cream-light" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export default LoadingSkeleton;
