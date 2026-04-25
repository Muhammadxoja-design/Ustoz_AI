interface SkeletonProps { className?: string; }

function Sk({ className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`} />;
}

export function QuizSkeleton() {
  return (
    <div className="flex flex-col gap-5 px-5 pt-4 pb-8">
      <div className="flex items-center justify-between mb-1">
        <Sk className="h-4 w-28" />
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => <Sk key={i} className="h-2 w-2 rounded-full" />)}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Sk className="h-8 w-24 rounded-full" />
        <Sk className="h-2 flex-1 rounded-full" />
      </div>
      <Sk className="h-32 w-full rounded-3xl" />
      {[...Array(4)].map((_, i) => (
        <Sk key={i} className="h-[60px] w-full rounded-[18px]" />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-5 pt-4">
      <Sk className="h-28 w-full rounded-3xl" />
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <Sk key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => <Sk key={i} className="h-40 rounded-2xl" />)}
      </div>
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <Sk className="h-36 rounded-3xl" />
      {[...Array(6)].map((_, i) => <Sk key={i} className="h-[72px] rounded-[18px]" />)}
    </div>
  );
}
