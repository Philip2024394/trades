// AvatarCluster — overlapped circle stack + optional trailing count.
//
// Reference: shadcn/ui Avatar composition. Uses -ml overlap + white
// ring for depth; trailing slot for text ("+ 42 customers").
//
// Falls back to initials if `src` is absent.

import type { ComponentType } from "react";

export type ClusterAvatar = {
  src?: string;
  alt?: string;
  /** Fallback initials — 1-2 chars. Auto-derived from alt if absent. */
  initials?: string;
};

export type AvatarClusterProps = {
  avatars: readonly ClusterAvatar[];
  /** Max avatars to show — remainder becomes "+N". */
  max?: number;
  /** Trailing text like "+ 42 customers" or "reviewers". */
  trailingLabel?: string;
  /** Size preset. */
  size?: "xs" | "sm" | "md";
  /** Optional decorative leading icon (Star for reviews, Users for team). */
  leadingIcon?: ComponentType<{ className?: string }>;
};

const SIZE = {
  xs: { avatar: "h-6 w-6 text-[10px]", overlap: "-ml-1.5", ring: "ring-2" },
  sm: { avatar: "h-8 w-8 text-[11px]", overlap: "-ml-2", ring: "ring-2" },
  md: { avatar: "h-10 w-10 text-[13px]", overlap: "-ml-2.5", ring: "ring-4" }
} as const;

function initialsFromAlt(alt?: string): string {
  if (!alt) return "?";
  const words = alt.trim().split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

export function AvatarCluster({
  avatars,
  max = 4,
  trailingLabel,
  size = "sm",
  leadingIcon: Leading
}: AvatarClusterProps) {
  const cls = SIZE[size];
  const visible = avatars.slice(0, max);
  const overflow = Math.max(0, avatars.length - max);
  return (
    <div className="inline-flex items-center gap-2">
      {Leading ? (
        <Leading className="h-4 w-4 fill-amber-400 text-amber-400" />
      ) : null}
      <div className="flex items-center">
        {visible.map((a, i) => (
          <span
            key={i}
            title={a.alt}
            className={`inline-flex ${cls.avatar} items-center justify-center overflow-hidden rounded-full bg-neutral-200 font-semibold text-neutral-700 ${cls.ring} ring-white ${i > 0 ? cls.overlap : ""}`}
          >
            {a.src ? (
              <img
                src={a.src}
                alt={a.alt ?? ""}
                className="h-full w-full object-cover"
              />
            ) : (
              a.initials ?? initialsFromAlt(a.alt)
            )}
          </span>
        ))}
        {overflow > 0 ? (
          <span
            className={`inline-flex ${cls.avatar} items-center justify-center rounded-full bg-neutral-900 font-semibold text-white ${cls.ring} ring-white ${cls.overlap}`}
          >
            +{overflow}
          </span>
        ) : null}
      </div>
      {trailingLabel ? (
        <span className="text-[13px] font-medium text-neutral-700">
          {trailingLabel}
        </span>
      ) : null}
    </div>
  );
}
