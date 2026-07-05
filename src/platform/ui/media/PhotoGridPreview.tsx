// PhotoGridPreview — compact 2×2 photo grid with "+N more" tile.
//
// Reference: arhamkhnz/next-shadcn-admin-dashboard — media gallery
// tiles. Rewritten with our Grid + Chip primitives.

import { ImagePlus } from "lucide-react";
import type { ReactNode } from "react";
import { AspectRatio } from "./AspectRatio";

export type PhotoGridPreviewProps = {
  /** Ordered image nodes — <img> or any node. */
  photos: readonly ReactNode[];
  /** Total number of photos in the collection. If greater than
   *  the visible slots, the last slot shows "+N more". */
  totalCount?: number;
  /** How many slots to show (2 or 4). */
  slots?: 2 | 4;
  /** Fired when the "+N more" tile is clicked. */
  onSeeMore?: () => void;
  href?: string;
};

export function PhotoGridPreview({
  photos,
  totalCount,
  slots = 4,
  onSeeMore,
  href
}: PhotoGridPreviewProps) {
  const total = totalCount ?? photos.length;
  const visible = photos.slice(0, slots);
  const overflow = total > slots ? total - slots + 1 : 0;
  const gridCls = slots === 2 ? "grid grid-cols-2 gap-1" : "grid grid-cols-2 gap-1";
  return (
    <div className={gridCls}>
      {visible.slice(0, slots - (overflow > 0 ? 1 : 0)).map((photo, i) => (
        <div key={i} className="overflow-hidden rounded-lg bg-neutral-100">
          <AspectRatio preset="square">{photo}</AspectRatio>
        </div>
      ))}
      {overflow > 0 ? (
        <MoreTile
          count={overflow}
          onClick={onSeeMore}
          href={href}
        />
      ) : null}
    </div>
  );
}

function MoreTile({
  count,
  onClick,
  href
}: {
  count: number;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white">
      <AspectRatio preset="square">
        <div className="flex h-full flex-col items-center justify-center gap-0.5">
          <ImagePlus className="h-4 w-4" />
          <span className="text-[14px] font-bold">+{count}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide">
            more
          </span>
        </div>
      </AspectRatio>
    </div>
  );
  if (href) {
    return (
      <a href={href} className="block">
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full">
        {inner}
      </button>
    );
  }
  return inner;
}
