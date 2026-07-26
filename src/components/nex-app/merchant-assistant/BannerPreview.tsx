"use client";

// BannerPreview — renders inline with NEX's chat reply when the last
// turn generated a promotional banner. Actions: Activate the version,
// ask NEX for a different style, or dismiss.
//
// Phase 7 · Increment 4. Minimal styling — Increment 7 polish pass
// will match the NEX design language properly.

import { useState } from "react";
import type {
  BannerVisualStyle,
  MerchantAssistantBanner,
} from "@/lib/nex/merchant-assistant/types";

type Props = {
  banner: MerchantAssistantBanner;
  onActivated?: () => void;
  onRegenerateRequested?: (nextStyle: BannerVisualStyle) => void;
};

const STYLE_LABEL: Record<BannerVisualStyle, string> = {
  premium: "Premium",
  utility: "Trade",
  seasonal: "Seasonal",
  minimal: "Minimal",
};

const STYLE_TINT: Record<BannerVisualStyle, string> = {
  premium: "from-neutral-900 via-neutral-800 to-neutral-900 text-white",
  utility: "from-orange-600 via-orange-500 to-orange-600 text-white",
  seasonal: "from-emerald-800 via-emerald-700 to-emerald-800 text-white",
  minimal: "from-white via-white to-white text-black border border-black/10",
};

export function BannerPreview({ banner, onActivated, onRegenerateRequested }: Props) {
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(banner.isActive);
  const [error, setError] = useState<string | null>(null);
  const style = banner.visualStyle ?? "premium";

  async function handleActivate() {
    setError(null);
    setActivating(true);
    try {
      const res = await fetch("/api/nex/merchant-assistant/banner/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banner_id: banner.id }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Activation failed");
        setActivating(false);
        return;
      }
      setActivated(true);
      setActivating(false);
      onActivated?.();
    } catch {
      setError("Network error — try again.");
      setActivating(false);
    }
  }

  return (
    <div className="my-3 max-w-[80%] rounded-2xl border border-black/10 bg-white shadow-sm">
      {/* Meta strip */}
      <div className="flex items-center justify-between px-4 py-2 text-[10px]">
        <span className="font-semibold uppercase tracking-wider text-black/50">
          Banner draft · v{banner.version} · {STYLE_LABEL[style]}
        </span>
        {activated ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
            ✓ Live
          </span>
        ) : (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-700">
            Draft — not public
          </span>
        )}
      </div>

      {/* Rendered banner preview */}
      <div
        className={`bg-gradient-to-r ${STYLE_TINT[style]} px-5 py-6`}
      >
        <div className="text-lg font-semibold leading-tight">
          {banner.headline}
        </div>
        {banner.body && (
          <div className="mt-2 text-sm opacity-90">{banner.body}</div>
        )}
        {banner.cta && (
          <div className="mt-3 inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/20">
            {banner.cta}
          </div>
        )}
      </div>

      {/* Actions */}
      {!activated && (
        <div className="flex items-center justify-between gap-2 border-t border-black/10 px-3 py-2">
          <div className="flex gap-1 overflow-x-auto text-[10px] text-black/50">
            {(["premium", "utility", "seasonal", "minimal"] as BannerVisualStyle[])
              .filter((s) => s !== style)
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-full px-2 py-1 hover:bg-black/5"
                  onClick={() => onRegenerateRequested?.(s)}
                >
                  Try {STYLE_LABEL[s].toLowerCase()}
                </button>
              ))}
          </div>
          <button
            type="button"
            onClick={handleActivate}
            disabled={activating}
            className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white disabled:bg-black/30"
          >
            {activating ? "Activating…" : "Make it live"}
          </button>
        </div>
      )}

      {error && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
