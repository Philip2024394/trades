"use client";

// DesignPreviewCard — one component card in the Design System browser.
//
// Renders a LIVE preview using the passed theme. The preview is the
// actual component (not a screenshot) so palette changes update every
// card instantly.

import { useState } from "react";
import { DesignPreview } from "@/platform/design/preview/harness";
import type { FrozenDesignComponent } from "@/platform/design/types";
import type { DesignTheme } from "@/platform/design/theme/types";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const GREEN = "#10B981";

export function DesignPreviewCard({
  registration,
  theme,
  onUse
}: {
  registration: FrozenDesignComponent;
  theme: DesignTheme;
  onUse?: (registration: FrozenDesignComponent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition"
      style={{
        borderColor: hovered ? BLACK : "#E5E5E5",
        boxShadow: hovered
          ? "0 8px 24px rgba(0,0,0,0.10)"
          : "0 1px 2px rgba(0,0,0,0.04)"
      }}
    >
      {/* Live preview */}
      <div
        className="relative flex min-h-[160px] items-center justify-center overflow-hidden p-6"
        style={{ background: theme.color.subtle }}
      >
        <div
          style={{
            transform: "scale(0.9)",
            transformOrigin: "center center",
            width: "100%",
            display: "flex",
            justifyContent: "center"
          }}
        >
          <DesignPreview registration={registration} theme={theme} />
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className="text-[9px] font-extrabold uppercase tracking-widest"
              style={{ color: YELLOW }}
            >
              {registration.category}
            </p>
            <h3 className="mt-0.5 truncate text-[14px] font-extrabold text-neutral-900">
              {registration.name}
            </h3>
            <p className="mt-0.5 truncate font-mono text-[10px] text-neutral-400">
              {registration.id}
            </p>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-neutral-500"
            style={{ background: "#F5F5F5" }}
          >
            v{registration.version}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-neutral-600 line-clamp-2">
          {registration.description}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {registration.themeTokensUsed.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full px-2 py-0.5 font-mono text-[9px] text-neutral-500"
              style={{ background: "#F5F5F5" }}
            >
              {t}
            </span>
          ))}
          {registration.themeTokensUsed.length > 3 && (
            <span className="rounded-full px-2 py-0.5 font-mono text-[9px] text-neutral-400">
              +{registration.themeTokensUsed.length - 3}
            </span>
          )}
        </div>
        {onUse && (
          <button
            type="button"
            onClick={() => onUse(registration)}
            className="mt-2 inline-flex h-9 items-center justify-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
            style={{ background: YELLOW }}
          >
            Use this →
          </button>
        )}
      </div>
    </article>
  );
}

// Small helper — mostly cosmetic — exposed so the browser + future
// picker can share the "Installed" chip pattern.
export function InstalledPill() {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
      style={{ background: GREEN }}
    >
      In use
    </span>
  );
}

export { BLACK as _BLACK };
