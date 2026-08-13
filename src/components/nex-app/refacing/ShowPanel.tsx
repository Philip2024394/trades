"use client";

// ShowPanel — SEE UI · SHOW stage (spec §A).
//
// Renders after the customer has uploaded a photo. Shows:
//   1. Their existing staircase photo
//   2. What NEX can see (from visible_components)
//   3. What isn't confirmed from a photo (from unknown_items)
//   4. [ Looks right ] · [ Something's off ] actions
//
// PR-16: never surface confidence values or internal enum names.
// Homeowner language only via friendlyRole().

import { useState } from "react";
import { CheckCircle2, Info, Loader2 } from "lucide-react";
import type { RefacingCase } from "@/lib/nex/refacing/case-schema";
import { confirmBase } from "@/lib/nex/refacing/use-case";

type Props = {
  refacingCase: RefacingCase;
  token: string;
  onConfirmed: (updated: RefacingCase) => void;
};

export function ShowPanel({ refacingCase, token, onConfirmed }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);

  const photos = refacingCase.existing_staircase.photos;
  const visibleComponents = refacingCase.existing_staircase.visible_components ?? [];
  const unknownItems = refacingCase.unknown_items;
  const heroPhotoSrc = photos[0]
    ? `/api/nex/refacing/cases/${encodeURIComponent(
        refacingCase.refacing_case_id
      )}/photo/${encodeURIComponent(photos[0].image_id)}?token=${encodeURIComponent(token)}`
    : null;

  async function handleConfirm() {
    setBusy(true);
    setErr(null);
    try {
      const { case: updated } = await confirmBase(refacingCase.refacing_case_id, token);
      onConfirmed(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-5 pb-6">
      {/* 1 · Your existing staircase */}
      <SectionCard title="Your existing staircase">
        {heroPhotoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroPhotoSrc}
            alt="Your staircase"
            className="max-h-[45vh] w-full rounded-lg object-contain"
          />
        ) : (
          <div className="text-[13px]" style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}>
            Photo pending.
          </div>
        )}
      </SectionCard>

      {/* 2 · What NEX has noted */}
      <SectionCard title="Here's what we can see">
        {visibleComponents.length === 0 ? (
          <div className="text-[13px]" style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}>
            NEX is still looking at your photo.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {visibleComponents.map((c, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[13px]"
                style={{ color: "var(--nex-neutral-700, #3d3d3d)" }}
              >
                <CheckCircle2
                  size={14}
                  className="mt-0.5 flex-shrink-0"
                  style={{ color: "var(--nex-accent-500, #8B7355)" }}
                />
                <span>{friendlyRole(c.component_role)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* 3 · What isn't confirmed from a photo (PR-16 truthfulness) */}
      {unknownItems.length > 0 && (
        <SectionCard title="A few things can't be confirmed from a photo">
          <ul className="ml-4 list-disc space-y-1 text-[12px]"
              style={{ color: "var(--nex-neutral-700, #3d3d3d)" }}>
            {unknownItems.map((u, i) => (
              <li key={i}>{u.reason}</li>
            ))}
          </ul>
          <div
            className="mt-3 text-[11px] italic"
            style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
          >
            A local staircase professional will confirm these during survey.
          </div>
        </SectionCard>
      )}

      {/* 4 · Actions */}
      {!correcting && (
        <div className="mt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold transition active:scale-95"
            style={{
              background: "var(--nex-neutral-900, #1a1a1a)",
              color: "var(--nex-cream, #F7F2E8)",
            }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {busy ? "Confirming…" : "Looks right"}
          </button>
          <button
            type="button"
            onClick={() => setCorrecting(true)}
            disabled={busy}
            className="rounded-xl px-4 py-3 text-[13px] font-semibold transition active:scale-95"
            style={{
              background: "var(--nex-cream-elev, #FFFFFF)",
              color: "var(--nex-neutral-900, #1a1a1a)",
              border: "1px solid var(--nex-neutral-200, #E7E1D2)",
            }}
          >
            Something&apos;s off
          </button>
        </div>
      )}

      {correcting && (
        <div
          className="rounded-2xl p-4"
          style={{
            background: "var(--nex-cream-elev, #FFFFFF)",
            border: "1px dashed var(--nex-neutral-200, #E7E1D2)",
          }}
        >
          <div
            className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
          >
            <Info size={12} />
            Fix later
          </div>
          <p className="text-[13px]" style={{ color: "var(--nex-neutral-700, #3d3d3d)" }}>
            You can take a fresh photo, or a professional will confirm the details
            during survey. Continue for now?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className="flex-1 rounded-xl px-4 py-2 text-[13px] font-semibold transition active:scale-95"
              style={{
                background: "var(--nex-neutral-900, #1a1a1a)",
                color: "var(--nex-cream, #F7F2E8)",
              }}
            >
              Continue anyway
            </button>
            <button
              type="button"
              onClick={() => setCorrecting(false)}
              disabled={busy}
              className="flex-1 rounded-xl px-4 py-2 text-[13px] font-semibold transition active:scale-95"
              style={{
                background: "var(--nex-cream, #F7F2E8)",
                color: "var(--nex-neutral-700, #3d3d3d)",
                border: "1px solid var(--nex-neutral-200, #E7E1D2)",
              }}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {err && (
        <div className="rounded-lg px-3 py-2 text-[12px]"
             style={{ background: "#FEECEC", color: "#7A1F1F", border: "1px solid #F1BFBF" }}>
          {err}
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "var(--nex-cream-elev, #FFFFFF)",
        border: "1px solid var(--nex-neutral-200, #E7E1D2)",
      }}
    >
      <div
        className="mb-2 text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function friendlyRole(role: string): string {
  const map: Record<string, string> = {
    baluster:        "Balusters visible",
    newel:           "Newel post visible",
    handrail:        "Handrail visible",
    tread:           "Treads visible",
    riser:           "Risers visible",
    stringer:        "Stringer visible",
    whole_staircase: "Full staircase in view",
    step_unit:       "Step details visible",
    feature_step:    "Feature step visible",
    in_situ_room:    "Staircase in room context",
    detail_joinery:  "Joinery detail visible",
    material_swatch: "Material sample",
  };
  return map[role] ?? role;
}
