// ThingsToFixCard — compact right-rail card listing open snag items.
//
// Answers ONE question: "What still needs fixing?" (Rule 1)
// Replaces the paper snagging list + "did I tell the plumber about
// the drip?" mental load (Rule 2)
// Advanced ledger with history stays hidden until earned (Rule 3)
//
// Each item: thumbnail photo (or icon fallback) · one-line title ·
// assignee chip (if set) · status pill.
//
// Blueprint: docs/SITEBOOK_BLUEPRINT_v2_2_FINAL.md · Phase 1 · Slot 5.

import Link from "next/link";
import { AlertCircle, Camera, Check, ChevronRight, Wrench } from "lucide-react";
import type { ThingToFix, ThingStatus } from "@/lib/homeowners/thingsToFix";

const BRAND_YELLOW = "#FFB300";

const STATUS_STYLE: Record<ThingStatus, { bg: string; fg: string; label: string }> = {
  open:        { bg: "#FEF3C7", fg: "#92400E", label: "Open" },
  in_progress: { bg: "#DBEAFE", fg: "#1D4ED8", label: "On it" },
  fixed:       { bg: "#DCFCE7", fg: "#166534", label: "Fixed" },
  confirmed:   { bg: "#DCFCE7", fg: "#166534", label: "Done" },
  dismissed:   { bg: "#F3F4F6", fg: "#525252", label: "Dismissed" }
};

export function ThingsToFixCard({ items }: { items: ThingToFix[] }) {
  return (
    <div
      className="rounded-2xl border-2 bg-white p-4 shadow-sm"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div className="mb-3">
        <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
          Things to fix
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl bg-neutral-50 px-3 py-4 text-center">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500"
            style={{ backgroundColor: "rgba(0,0,0,0.04)" }}
          >
            <Check size={16} strokeWidth={2.4}/>
          </span>
          <p className="mt-2 text-[12.5px] font-black text-neutral-900">
            Nothing to fix
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-neutral-600">
            Snapped an issue? Add it from any post card — a photo and one line is enough.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((t) => {
            const st = STATUS_STYLE[t.status];
            return (
              <li key={t.id}>
                <div
                  className="flex items-start gap-2.5 rounded-xl border bg-white p-2 shadow-sm"
                  style={{ borderColor: "rgba(0,0,0,0.06)" }}
                >
                  {/* Thumbnail — 44×44 square */}
                  <div
                    className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg"
                    style={{
                      backgroundColor: t.photo_url ? "transparent" : "rgba(255,179,0,0.15)"
                    }}
                  >
                    {t.photo_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={t.photo_url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center" style={{ color: "#B45309" }}>
                        <AlertCircle size={16} strokeWidth={2.4}/>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <p className="truncate text-[12.5px] font-black text-neutral-900">{t.title}</p>
                      <span
                        className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                        style={{ backgroundColor: st.bg, color: st.fg }}
                      >
                        {st.label}
                      </span>
                    </div>
                    {t.assignee_name && (
                      <p className="mt-0.5 truncate text-[10.5px] font-bold text-neutral-500">
                        <Wrench size={9} strokeWidth={2.5} className="inline -mt-0.5 mr-1"/>
                        {t.assignee_name}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 && (
        <Link
          href="/sitebook/things-to-fix"
          className="mt-3 inline-flex w-full items-center justify-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
        >
          See all
          <ChevronRight size={11} strokeWidth={2.5}/>
        </Link>
      )}

      {/* Small hint for empty-state cards showing how to add — kept
          out of the way for populated cards to reduce visual noise. */}
      {items.length === 0 && (
        <p className="mt-3 flex items-center justify-center gap-1 text-[10px] text-neutral-400">
          <Camera size={10} strokeWidth={2.4}/>
          Add via any post card
        </p>
      )}
      {/* Small yellow accent to visually match Home Care card */}
      <span className="hidden" style={{ color: BRAND_YELLOW }}/>
    </div>
  );
}
