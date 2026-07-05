// Skeleton — loading placeholder.
//
// Use whenever content is fetched. Consistent shimmer, consistent
// colour. No spinners for content — spinners are for actions.

export type SkeletonProps = {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  className?: string;
};

export function Skeleton({
  width = "100%",
  height = 16,
  circle,
  className = ""
}: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-neutral-200 ${circle ? "rounded-full" : "rounded-md"} ${className}`.trim()}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height
      }}
    />
  );
}

/** Pre-composed card skeleton. */
export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 md:rounded-2xl md:p-5">
      <div className="flex items-start gap-3">
        <Skeleton width={40} height={40} circle />
        <div className="flex-1 space-y-2">
          <Skeleton height={14} width="60%" />
          <Skeleton height={12} width="40%" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton height={12} />
        <Skeleton height={12} width="80%" />
      </div>
    </div>
  );
}
