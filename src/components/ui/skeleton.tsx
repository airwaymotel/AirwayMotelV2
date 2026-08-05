import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-shimmer rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function RoomCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-6 w-12" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

export default Skeleton;
