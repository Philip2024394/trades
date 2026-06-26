// Xrated Trades — floating identity card that overlaps the cover bottom.
// Mobile shows just an avatar + name row (no card chrome) per the brief.
// `placement` controls horizontal alignment + a small vertical nudge.

import type { ProfilePlacement } from "@/lib/xratedTrades";

export function ProfileInfoCard({
  avatar,
  name,
  verified = false,
  city,
  country,
  rating,
  rightSlot,
  placement
}: {
  avatar: React.ReactNode;
  name: string;
  verified?: boolean;
  city: string;
  country: string;
  rating?: number;
  rightSlot?: React.ReactNode;
  placement: ProfilePlacement;
}) {
  const horizontal =
    placement === "center" ? "mx-auto" : "mr-auto";
  // bottom-left placement nudges the whole card 16px lower.
  const verticalNudge =
    placement === "bottom-left" ? "translate-y-4" : "";

  return (
    <div
      className={`relative z-20 -mt-12 px-4 ${horizontal} ${verticalNudge}`.trim()}
      style={{ maxWidth: 720 }}
    >
      {/* Mobile: bare row, no card chrome */}
      <div className="flex items-end gap-3 sm:hidden">
        <div className="shrink-0">{avatar}</div>
        <div className="min-w-0 flex-1 pb-1">
          <p className="truncate text-lg font-bold text-brand-text">
            {name}
            {verified && (
              <span
                className="ml-1 inline-block align-middle"
                title="Hammerex Standard verified"
                aria-label="Verified"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#facc15" aria-hidden="true">
                  <path d="m12 1 3 5 6 1-4.5 4.5L18 18l-6-3-6 3 1.5-6.5L3 7l6-1Z" />
                </svg>
              </span>
            )}
          </p>
          <p className="truncate text-xs text-brand-muted">
            {city} · {country}
            {typeof rating === "number" && rating > 0 && (
              <> · {rating.toFixed(1)}★</>
            )}
          </p>
        </div>
        {rightSlot && <div className="shrink-0 pb-1">{rightSlot}</div>}
      </div>

      {/* Desktop: card chrome */}
      <div className="hidden rounded-2xl border border-brand-line bg-brand-surface px-4 py-3 shadow-xl sm:flex sm:items-center sm:gap-4">
        <div className="shrink-0">{avatar}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold text-brand-text">
            {name}
            {verified && (
              <span
                className="ml-1 inline-block align-middle"
                title="Hammerex Standard verified"
                aria-label="Verified"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#facc15" aria-hidden="true">
                  <path d="m12 1 3 5 6 1-4.5 4.5L18 18l-6-3-6 3 1.5-6.5L3 7l6-1Z" />
                </svg>
              </span>
            )}
          </p>
          <p className="truncate text-xs text-brand-muted">
            {city} · {country}
            {typeof rating === "number" && rating > 0 && (
              <> · {rating.toFixed(1)}★</>
            )}
          </p>
        </div>
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>
    </div>
  );
}

export default ProfileInfoCard;
