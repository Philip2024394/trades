// Finish The Job (R04) — the AI Materials Completer surface.
//
// Reads the current materials list, detects the closest archetype,
// surfaces likely-forgotten items. Rock-solid rule: this is a nudge,
// not a block. Every trade knows their own job better than any
// suggestion engine.

"use client";

import { useMemo } from "react";
import {
  Wand2,
  AlertCircle,
  CheckCircle2,
  Plus,
  Package,
  Info,
  ShoppingBag,
  ShieldAlert,
  Hammer,
  Layers,
  HardHat
} from "lucide-react";
import { analyseJob, type MissingMaterialWithReason } from "../lib/analyseJob";
import type { ArchetypeMaterial } from "../data/jobArchetypes";

type Props = {
  /** Names of materials the trade already has for this job. Drawn from
   *  Job Cost lines / Notebook / Site queue depending on the mount. */
  existingMaterialNames: string[];
  /** Job tags (e.g. from Job.tags on R01). */
  tags?: string[];
  /** Called when the trade taps "Add" on a missing material. */
  onAddMaterial: (name: string) => void;
  /** Compact = single-column, tighter — used inside a job sidebar. */
  compact?: boolean;
};

function iconForCategory(cat: ArchetypeMaterial["category"]) {
  switch (cat) {
    case "primary":     return Package;
    case "backing":     return Layers;
    case "consumable":  return ShoppingBag;
    case "fixing":      return Hammer;
    case "safety":      return HardHat;
    case "tool":        return Hammer;
  }
}

function pillForCriticality(c: ArchetypeMaterial["criticality"]) {
  switch (c) {
    case "essential":    return { label: "Essential",    bg: "#FEE2E2", fg: "#B91C1C", Icon: ShieldAlert };
    case "recommended":  return { label: "Recommended",  bg: "#FEF3C7", fg: "#B45309", Icon: AlertCircle };
    case "situational":  return { label: "Sometimes",    bg: "#DBEAFE", fg: "#1E40AF", Icon: Info };
  }
}

export function FinishTheJobPanel({
  existingMaterialNames,
  tags = [],
  onAddMaterial,
  compact
}: Props) {
  const analysis = useMemo(
    () => analyseJob(existingMaterialNames, tags),
    [existingMaterialNames, tags]
  );

  if (!analysis.archetype) {
    return null;
  }

  if (analysis.missing.length === 0) {
    return (
      <section
        className="flex items-start gap-3 rounded-2xl border p-4 shadow-sm"
        style={{ borderColor: "rgba(22,101,52,0.35)", backgroundColor: "#F0FDF4" }}
      >
        <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-[#166534]" strokeWidth={2.5}/>
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[#166534]">
            Finish The Job · R04
          </div>
          <div className="mt-0.5 text-[13px] font-black text-neutral-900">
            You&apos;ve got everything for a {analysis.archetype.label.toLowerCase()}
          </div>
          <p className="mt-0.5 text-[11.5px] leading-snug text-neutral-600">
            No small-item gaps we can spot. Trust the trade in your hands.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border bg-white p-5 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Wand2 size={14} className="text-amber-700"/>
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">
          Finish The Job · R04
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[15px] font-black text-neutral-900">
          Looks like a {analysis.archetype.label.toLowerCase()}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[10.5px] font-bold">
          {analysis.essentialMissing > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
              style={{ backgroundColor: "#FEE2E2", color: "#B91C1C" }}
            >
              {analysis.essentialMissing} essential
            </span>
          )}
          {analysis.recommendedMissing > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
              style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}
            >
              {analysis.recommendedMissing} usual
            </span>
          )}
          {analysis.situationalMissing > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
              style={{ backgroundColor: "#DBEAFE", color: "#1E40AF" }}
            >
              {analysis.situationalMissing} sometimes
            </span>
          )}
        </div>
      </div>
      <p className="mt-1 text-[11.5px] leading-snug text-neutral-600">
        The small things that stop the job. Add any you might have missed — or ignore, you know
        your job best.
      </p>

      {/* Missing items list */}
      <ul className={`mt-4 grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
        {analysis.missing.map((m) => (
          <MissingRow
            key={m.name}
            material={m}
            onAdd={() => onAddMaterial(m.name)}
          />
        ))}
      </ul>

      {/* Provenance */}
      <div className="mt-4 flex items-start gap-2 rounded-md bg-neutral-50 p-3">
        <Info size={13} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
        <p className="text-[10.5px] leading-snug text-neutral-500">
          Suggestions come from a curated archetype ({analysis.archetype.discipline} ·{" "}
          {analysis.archetype.expectedMaterials.length} typical materials), not from a scraped
          catalogue. Trade Center never adds materials to your order without your tap.
        </p>
      </div>
    </section>
  );
}

function MissingRow({
  material,
  onAdd
}: {
  material: MissingMaterialWithReason;
  onAdd: () => void;
}) {
  const Icon = iconForCategory(material.category);
  const pill = pillForCriticality(material.criticality);

  return (
    <li
      className="flex flex-col gap-2 rounded-lg border bg-neutral-50 p-3"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="flex items-start gap-2">
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
          aria-hidden
        >
          <Icon size={13} strokeWidth={2}/>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="text-[12.5px] font-black text-neutral-900">{material.name}</div>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider"
              style={{ backgroundColor: pill.bg, color: pill.fg }}
            >
              <pill.Icon size={9} strokeWidth={2.5}/>
              {pill.label}
            </span>
          </div>
          <p className="mt-0.5 text-[10.5px] leading-snug text-neutral-600">
            {material.description}
          </p>
          <p className="mt-0.5 text-[9.5px] italic text-neutral-500">
            {material.reason}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex min-h-[36px] items-center justify-center gap-1 self-start rounded-full border bg-white px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-800 shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <Plus size={11}/>
        Add
      </button>
    </li>
  );
}
