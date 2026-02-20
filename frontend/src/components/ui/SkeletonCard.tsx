export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="glass-card p-5 space-y-3">
      <div className="skeleton h-4 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-3"
          style={{ width: `${70 + Math.random() * 30}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="glass-card p-5">
      <div className="skeleton h-4 w-1/4 mb-4" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="skeleton h-3 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
