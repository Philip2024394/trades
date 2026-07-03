"use client";

// Universal Smart Section Engine — merchant-facing swap UI.
//
// Given a source section instance and a chosen target variant, runs the
// swap engine, shows a diff preview (carried / defaulted / orphaned),
// then commits when the merchant confirms. Cancel restores nothing —
// the source instance is untouched until commit.
//
// This component is UI-only. All logic lives in `smartSwap.ts`. All
// mutations flow through the standard Studio bus so autosave + undo /
// redo integrate for free.

import { useMemo, useState } from "react";
import { smartSwap, type SmartSwapResult } from "@/lib/studio/smartSwap";
import type { SectionRegistration } from "@/lib/studio/sectionTypes";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const GREEN = "#10B981";
const AMBER = "#F59E0B";
const RED = "#DC2626";

export type SmartSwapCommit = {
  targetSectionId: string;
  targetConfig: Record<string, unknown>;
  /** Orphans get stashed under `_orphaned` on the instance so a
   *  future "swap back" can restore them. Keep this simple for v1 —
   *  the modal returns them; the caller decides where to persist. */
  orphanedFields: SmartSwapResult["orphaned"];
};

type SectionOption = Pick<
  SectionRegistration,
  "id" | "name" | "description" | "editableFields" | "defaultConfig"
>;

export function SmartSwapModal({
  sourceInstanceId,
  source,
  candidates,
  onCancel,
  onCommit
}: {
  sourceInstanceId: string;
  source: {
    registration: Pick<SectionRegistration, "id" | "name" | "editableFields">;
    config: Record<string, unknown>;
  };
  /** Compatible target sections (usually every section in the same
   *  library except the source). */
  candidates: SectionOption[];
  onCancel: () => void;
  onCommit: (commit: SmartSwapCommit) => void;
}) {
  const [targetId, setTargetId] = useState<string | null>(
    candidates[0]?.id ?? null
  );

  const target = useMemo(
    () => candidates.find((c) => c.id === targetId) ?? null,
    [targetId, candidates]
  );

  const swap = useMemo<SmartSwapResult | null>(() => {
    if (!target) return null;
    return smartSwap({
      source: {
        registration: source.registration,
        config: source.config
      },
      target: { registration: target }
    });
  }, [source, target]);

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Swap ${source.registration.name}`}
      onClick={onCancel}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-neutral-200 px-6 py-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            Smart Swap · instance {sourceInstanceId.slice(0, 8)}
          </p>
          <h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">
            Turn “{source.registration.name}” into something else
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">
            Your content carries over automatically. Preview the swap
            below, then confirm — nothing changes until you do.
          </p>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[280px_1fr]">
          <aside className="min-h-0 overflow-y-auto border-b border-neutral-200 bg-neutral-50 p-3 md:border-b-0 md:border-r">
            <p className="mb-2 px-2 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              Swap to
            </p>
            <ul className="flex flex-col gap-1">
              {candidates.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setTargetId(c.id)}
                    className="flex w-full flex-col items-start rounded-lg border px-3 py-2 text-left transition"
                    style={{
                      background: targetId === c.id ? BLACK : "#FFFFFF",
                      color: targetId === c.id ? "#FFFFFF" : BLACK,
                      borderColor: targetId === c.id ? BLACK : "#E5E5E5"
                    }}
                  >
                    <span className="text-[12px] font-extrabold">
                      {c.name}
                    </span>
                    <span
                      className="mt-0.5 line-clamp-2 text-[11px] leading-snug"
                      style={{
                        color:
                          targetId === c.id ? "rgba(255,255,255,0.7)" : "#737373"
                      }}
                    >
                      {c.description}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="min-h-0 overflow-y-auto p-5">
            {!swap || !target ? (
              <p className="text-[13px] text-neutral-500">
                Pick a target on the left to preview the swap.
              </p>
            ) : (
              <SwapDiffPanel
                targetName={target.name}
                swap={swap}
                sourceRegistration={source.registration}
              />
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-neutral-200 px-6 py-4">
          <div className="text-[11px] font-bold text-neutral-500">
            {swap
              ? `${swap.summary.carriedCount} fields carry over · ${swap.summary.defaultedCount} get target defaults · ${swap.summary.orphanedCount} archived`
              : "No target selected"}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!swap || !target}
              onClick={() => {
                if (!swap || !target) return;
                onCommit({
                  targetSectionId: target.id,
                  targetConfig: swap.targetConfig,
                  orphanedFields: swap.orphaned
                });
              }}
              className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: YELLOW,
                color: BLACK
              }}
            >
              Confirm swap →
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function SwapDiffPanel({
  targetName,
  swap,
  sourceRegistration
}: {
  targetName: string;
  swap: SmartSwapResult;
  sourceRegistration: Pick<SectionRegistration, "editableFields">;
}) {
  const sourceLabelByKey = new Map(
    sourceRegistration.editableFields.map((f) => [f.key, f.label])
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Preview
        </p>
        <h3 className="mt-1 text-[16px] font-extrabold text-neutral-900">
          Swapping into {targetName}
        </h3>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round(swap.summary.carryRate * 100)}%`,
              background: GREEN
            }}
          />
        </div>
        <p className="mt-1.5 text-[11px] font-bold text-neutral-500">
          {Math.round(swap.summary.carryRate * 100)}% of the target's
          fields inherit your existing content.
        </p>
      </header>

      <DiffBlock
        title="Carried over"
        tint={GREEN}
        items={swap.carried.map((c) => ({
          label: `${sourceLabelByKey.get(c.sourceKey) ?? c.sourceKey} → ${c.targetKey}`,
          value: previewValue(c.value),
          detail: c.via === "role" ? `matched by role: ${c.role}` : "matched by field key"
        }))}
        emptyLabel="Nothing to carry — no matching roles between the two sections."
      />

      <DiffBlock
        title="Filled with target defaults"
        tint={AMBER}
        items={swap.defaulted.map((d) => ({
          label: d.targetKey,
          value: previewValue(d.value),
          detail: d.role ? `role: ${d.role} · seeded from target` : "seeded from target"
        }))}
        emptyLabel="Every target field received your content — no defaults needed."
      />

      <DiffBlock
        title="Archived (no home on target)"
        tint={RED}
        items={swap.orphaned.map((o) => ({
          label: sourceLabelByKey.get(o.sourceKey) ?? o.sourceKey,
          value: previewValue(o.value),
          detail: o.role
            ? `role: ${o.role} · restored if you swap back`
            : "restored if you swap back"
        }))}
        emptyLabel="Nothing archived — every field has a home on the target."
      />
    </div>
  );
}

function DiffBlock({
  title,
  tint,
  items,
  emptyLabel
}: {
  title: string;
  tint: string;
  items: { label: string; value: string; detail: string }[];
  emptyLabel: string;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: tint }}
        />
        <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-700">
          {title}
        </h4>
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-extrabold"
          style={{ background: `${tint}20`, color: tint }}
        >
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-3 text-[11px] italic text-neutral-500">
          {emptyLabel}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((it, i) => (
            <li
              key={i}
              className="rounded-lg border border-neutral-200 bg-white p-3"
            >
              <p className="text-[11px] font-extrabold text-neutral-800">
                {it.label}
              </p>
              <p className="mt-0.5 line-clamp-1 text-[12px] text-neutral-600">
                {it.value}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                {it.detail}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function previewValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") {
    if (v.trim().length === 0) return "(empty)";
    if (v.length > 90) return v.slice(0, 88) + "…";
    return v;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v).slice(0, 90);
  } catch {
    return "[unserializable]";
  }
}
