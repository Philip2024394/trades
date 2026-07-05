// VideoThumb — thumbnail card for a video with centred play badge.
//
// Reference: https://preline.co — cards / video preview. Rewritten
// with Lucide's Play icon and our tokens (kit rule: Lucide only).

import { Play } from "lucide-react";
import type { ReactNode } from "react";
import { AspectRatio } from "./AspectRatio";
import { CARD_RADIUS } from "../tokens";

export type VideoThumbProps = {
  /** Poster image or fallback node — any valid ReactNode. */
  poster?: ReactNode;
  title?: string;
  /** Duration display — "1:24". */
  duration?: string;
  /** Fires when the play button is clicked. */
  onPlay?: () => void;
  /** Optional href — when set the whole card becomes an anchor. */
  href?: string;
  /** Aspect ratio. */
  aspect?: "video" | "landscape" | "portrait" | "square";
};

const ASPECT_MAP = {
  video: "video",
  landscape: "landscape",
  portrait: "portrait",
  square: "square"
} as const;

export function VideoThumb({
  poster,
  title,
  duration,
  onPlay,
  href,
  aspect = "video"
}: VideoThumbProps) {
  const inner = (
    <div
      className={`group relative overflow-hidden ${CARD_RADIUS} bg-neutral-900 text-white`}
    >
      <AspectRatio preset={ASPECT_MAP[aspect]}>
        {poster ?? (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
            <Play className="h-8 w-8 text-neutral-600" />
          </div>
        )}
      </AspectRatio>
      {/* Play badge */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-neutral-900 shadow-lg transition group-hover:ring-4 group-hover:ring-amber-400/50">
          <Play className="ml-0.5 h-5 w-5 fill-current" />
        </span>
      </div>
      {/* Duration chip */}
      {duration ? (
        <span className="absolute bottom-2 right-2 rounded bg-neutral-900/80 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white backdrop-blur">
          {duration}
        </span>
      ) : null}
      {/* Title bar */}
      {title ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-neutral-900/85 via-neutral-900/30 to-transparent p-3">
          <div className="text-[13px] font-semibold leading-tight">{title}</div>
        </div>
      ) : null}
    </div>
  );
  if (href) {
    return (
      <a href={href} className="block">
        {inner}
      </a>
    );
  }
  if (onPlay) {
    return (
      <button
        type="button"
        onClick={onPlay}
        className="block w-full text-left"
      >
        {inner}
      </button>
    );
  }
  return inner;
}
