interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-pulse rounded-xl bg-[#EFE9E0] ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg px-5 pb-10">
      <Skeleton className="mb-5 h-11 w-full" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}
