"use client";

// LockConfirmation — SEE UI · terminal screen for the homeowner flow
// (spec §F.3).
//
// Shown after the customer taps "Choose this direction" and status becomes
// DESIGN_SELECTED. Summarises the chosen direction + tells the customer what
// NEX will hand to the local staircase professional.
//
// Primary CTA "Request a professional assessment" transitions Case status to
// READY_FOR_ASSESSMENT via the existing attach-contact flow (Stage 8 · not
// re-implemented here · this component just triggers the parent's handler).

import { useState } from "react";
import { ArrowLeft, MessageSquareQuote } from "lucide-react";
import type { RefacingCase } from "@/lib/nex/refacing/case-schema";

type Props = {
  refacingCase: RefacingCase;
  onRequestAssessment: () => void;
  onChangeDirection: () => void;
};

export function LockConfirmation({
  refacingCase,
  onRequestAssessment,
  onChangeDirection,
}: Props) {
  const [busy, setBusy] = useState(false);
  const design = refacingCase.selected_design;
  if (!design) return null;

  // Reference hero image from the selected design (first entry is the hero).
  const heroSrc = deriveHeroSrc(refacingCase, design.reference_image_ids[0]);

  return (
    <div className="flex flex-col gap-4 px-5 pb-8">
      {/* Header */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-widest"
             style={{ color: "var(--nex-accent-500, #8B7355)" }}>
          You&apos;ve chosen
        </div>
        <h2 className="mt-1 text-[22px] font-semibold leading-tight"
            style={{ color: "var(--nex-neutral-900, #1a1a1a)" }}>
          {design.name}
        </h2>
        <p className="mt-1 text-[13px]"
           style={{ color: "var(--nex-neutral-700, #3d3d3d)" }}>
          {design.reason_for_existing}
        </p>
        {design.key_materials_description && (
          <p className="mt-1 text-[12px] italic"
             style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}>
            {design.key_materials_description}
          </p>
        )}
      </div>

      {/* Chosen direction hero */}
      {heroSrc && (
        <div className="overflow-hidden rounded-2xl"
             style={{
               background: "var(--nex-cream-elev, #FFFFFF)",
               border: "1px solid var(--nex-accent-500, #8B7355)",
             }}>
          <div className="aspect-video w-full"
               style={{ background: "var(--nex-cream, #F7F2E8)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroSrc} alt="Your chosen direction"
                 className="h-full w-full object-contain" />
          </div>
        </div>
      )}

      {/* What NEX will send */}
      <div className="rounded-2xl p-4"
           style={{
             background: "var(--nex-cream-elev, #FFFFFF)",
             border: "1px solid var(--nex-neutral-200, #E7E1D2)",
           }}>
        <div className="text-[10px] font-semibold uppercase tracking-widest"
             style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}>
          What NEX will send
        </div>
        <p className="mt-2 text-[13px]"
           style={{ color: "var(--nex-neutral-700, #3d3d3d)" }}>
          A local staircase professional will receive:
        </p>
        <ul className="mt-2 space-y-1 pl-4 text-[13px]"
            style={{ color: "var(--nex-neutral-700, #3d3d3d)", listStyle: "disc" }}>
          <li>Your existing staircase (photos + what NEX has noted)</li>
          <li>What you&apos;d like to change</li>
          <li>The design direction you chose</li>
          <li>What still needs surveying</li>
        </ul>
      </div>

      {/* Actions */}
      <div className="mt-2 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => { setBusy(true); onRequestAssessment(); }}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold transition active:scale-95"
          style={{
            background: "var(--nex-neutral-900, #1a1a1a)",
            color: "var(--nex-cream, #F7F2E8)",
          }}
        >
          <MessageSquareQuote size={16} />
          Request a professional assessment
        </button>
        <button
          type="button"
          onClick={onChangeDirection}
          disabled={busy}
          className="flex items-center justify-center gap-1 rounded-xl px-4 py-2 text-[12px] transition active:scale-95"
          style={{
            background: "transparent",
            color: "var(--nex-neutral-500, #6b6b6b)",
          }}
        >
          <ArrowLeft size={13} />
          Change direction
        </button>
        <p className="text-center text-[11px] italic"
           style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}>
          No obligation.
        </p>
      </div>
    </div>
  );
}

/**
 * Reference hero images live in the images_v3 library · we don't have an
 * inline way to look up src from image_id on the client. For MVP we accept
 * that the hero_image.src is written into the selected_design at LOCK (see
 * select-direction route · reference_image_ids[0] = the hero). We derive the
 * `/staircase-renovations/...` public URL by matching against a lightweight
 * hint on the design object · or fall back to a data-URL placeholder if the
 * matching fails.
 *
 * For MVP: we render a placeholder if we can't resolve. Client-side manifest
 * fetch to lookup image_id → src is a future enhancement.
 */
function deriveHeroSrc(_refacingCase: RefacingCase, imageId?: string): string | null {
  if (!imageId) return null;
  // The image_id follows the migration pattern "img_<slug>_<filename>".
  // For MVP · attempt a heuristic mapping to /staircase-renovations/<slug>/<filename>.png
  const m = imageId.match(/^img_([^_]+)_(.+)$/);
  if (!m) return null;
  const slug = m[1];
  const bare = m[2];
  return `/staircase-renovations/${slug}/${bare}.png`;
}
