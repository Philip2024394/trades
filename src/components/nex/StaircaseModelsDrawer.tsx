"use client";

// StaircaseModelsDrawer — right-side drawer for /staircase-chat.
//
// Navigation: shell-type list → variant grid.
//   Level 1: pick a shell type (e.g. "Straight flight — closed string")
//   Level 2: pick a variant ("1 step", "2 steps", … "15 steps")
// Selecting a variant fires onSelectVariant with a payload the chat
// posts to the feed as a shared-model card. Rise/going are the England
// Approved Document K dwelling limits sourced from jurisdictions.ts.
//
// No .glb / thumbnail files exist yet — tiles render metadata-only.
// Add a `thumbnail_url` field to ShellCatalogVariant when real
// previews land; the tile renderer here will pick it up automatically.

import { useState } from "react";
import {
  SHELL_CATALOG,
  type ShellCatalogFamily,
  type ShellCatalogVariant,
} from "@/lib/nex/staircase-components/catalog";
import { JURISDICTIONS } from "@/lib/nex/staircase-geometry/jurisdictions";

// Payload posted to the chat feed when a variant is selected. The chat
// component owns the Message shape — this is just the model half.
export interface SharedModelCard {
  component_id: string;
  family_id: string;
  family_name: string;
  layout_label: string;
  construction_label: string;
  treads: number;
  risers: number;
  regulation: {
    jurisdiction_display: string;
    document: string;
    building_type: string;
    rise_mm: {
      min: number;
      max: number;
      min_source: string;
      max_source: string;
      min_citation: string;
      max_citation: string;
    };
    going_mm: {
      min: number;
      max: number;
      min_source: string;
      max_source: string;
      min_citation: string;
      max_citation: string;
    };
  };
}

// England / dwelling is the default surface because the trades platform is
// UK-first (see CLAUDE.md · Rule "single domain thenetworkers.app UK").
// Switch on a jurisdiction picker inside the drawer later if / when the
// customer's location is captured in the conversation.
const DEFAULT_JURISDICTION = "england" as const;
const DEFAULT_BUILDING_TYPE = "dwelling" as const;

function buildRegulation(): SharedModelCard["regulation"] {
  const j = JURISDICTIONS[DEFAULT_JURISDICTION];
  const rules = j.building_types[DEFAULT_BUILDING_TYPE];
  if (!rules) {
    // Should never happen — england/dwelling is populated in jurisdictions.ts.
    throw new Error("England dwelling rules missing from JURISDICTIONS");
  }
  return {
    jurisdiction_display: j.display_name,
    document: j.primary_regulation_document,
    building_type: DEFAULT_BUILDING_TYPE,
    rise_mm: {
      min: rules.rise_mm.min.value,
      max: rules.rise_mm.max.value,
      min_source: rules.rise_mm.min.source,
      max_source: rules.rise_mm.max.source,
      min_citation: rules.rise_mm.min.citation,
      max_citation: rules.rise_mm.max.citation,
    },
    going_mm: {
      min: rules.going_mm.min.value,
      max: rules.going_mm.max.value,
      min_source: rules.going_mm.min.source,
      max_source: rules.going_mm.max.source,
      min_citation: rules.going_mm.min.citation,
      max_citation: rules.going_mm.max.citation,
    },
  };
}

export interface StaircaseModelsDrawerProps {
  open: boolean;
  onClose: () => void;
  onSelectVariant: (card: SharedModelCard) => void;
}

export function StaircaseModelsDrawer({
  open,
  onClose,
  onSelectVariant,
}: StaircaseModelsDrawerProps) {
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);

  const selectedFamily = selectedFamilyId
    ? SHELL_CATALOG.find((f) => f.family_id === selectedFamilyId) ?? null
    : null;

  function handleClose() {
    // Reset navigation so re-opening starts at the shell-type list.
    setSelectedFamilyId(null);
    onClose();
  }

  function handleVariantPick(family: ShellCatalogFamily, variant: ShellCatalogVariant) {
    onSelectVariant({
      component_id: variant.component_id,
      family_id: family.family_id,
      family_name: family.family_name,
      layout_label: family.layout_label,
      construction_label: family.construction_label,
      treads: variant.treads,
      risers: variant.risers,
      regulation: buildRegulation(),
    });
    handleClose();
  }

  return (
    <>
      {/* Scrim */}
      {open && (
        <div
          onClick={handleClose}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        />
      )}

      {/* Drawer panel — slides in from the right */}
      <aside
        role="dialog"
        aria-label="3D staircase models"
        aria-hidden={!open}
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-[#FBF6EC] border-l border-[#e6ddc7] shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4 border-b border-[#e6ddc7] bg-white">
          <div className="flex items-center gap-2 min-w-0">
            {selectedFamily && (
              <button
                onClick={() => setSelectedFamilyId(null)}
                aria-label="Back to shell types"
                className="w-9 h-9 rounded-full hover:bg-[#f0e8d0] flex items-center justify-center flex-shrink-0"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-[#166534]">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[#166534] truncate">
                {selectedFamily ? selectedFamily.family_name : "3D staircase models"}
              </h2>
              <p className="text-xs text-[#8a9585] truncate">
                {selectedFamily
                  ? `${selectedFamily.layout_label} · ${selectedFamily.construction_label}`
                  : "Pick a shell type, then a step count"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close models drawer"
            className="w-9 h-9 rounded-full hover:bg-[#f0e8d0] flex items-center justify-center flex-shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-[#5a6b5a]">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {!selectedFamily ? (
            <ShellTypeList onPick={setSelectedFamilyId} />
          ) : (
            <VariantGrid family={selectedFamily} onPick={handleVariantPick} />
          )}
        </div>
      </aside>
    </>
  );
}

function ShellTypeList({ onPick }: { onPick: (family_id: string) => void }) {
  return (
    <div className="p-4 space-y-3">
      <div className="text-xs uppercase tracking-wide text-[#8a9585] px-1">Shell types</div>
      {SHELL_CATALOG.map((family) => (
        <button
          key={family.family_id}
          onClick={() => onPick(family.family_id)}
          className="w-full text-left rounded-2xl bg-white border border-[#e6ddc7] px-4 py-3 hover:border-[#166534] hover:shadow-sm transition-all flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[#2a2a2a]">{family.family_name}</div>
            <div className="text-xs text-[#5a6b5a] mt-0.5">
              {family.layout_label} · {family.construction_label}
            </div>
            <div className="text-[11px] text-[#8a9585] mt-1">
              {family.variants.length} variant{family.variants.length === 1 ? "" : "s"} · 1–{family.variants.length} step{family.variants.length === 1 ? "" : "s"}
            </div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[#8a9585] flex-shrink-0">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      ))}
      <p className="text-[11px] text-[#8a9585] px-1 pt-2 leading-relaxed">
        Only shell families locked in the component library appear here. Quarter-turn, winder, open-string and other shells will list themselves automatically as Philip locks each family.
      </p>
    </div>
  );
}

function VariantGrid({
  family,
  onPick,
}: {
  family: ShellCatalogFamily;
  onPick: (family: ShellCatalogFamily, variant: ShellCatalogVariant) => void;
}) {
  const regulation = buildRegulation();

  return (
    <div className="p-4 space-y-4">
      {/* Regulation strip — homeowner-visible source of every share caption */}
      <div className="rounded-xl bg-white border border-[#e6ddc7] p-3">
        <div className="text-[11px] uppercase tracking-wide text-[#8a9585]">
          {regulation.jurisdiction_display} · {regulation.building_type}
        </div>
        <div className="text-xs text-[#166534] font-medium mt-0.5">{regulation.document}</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-[#FBF6EC] px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wide text-[#8a9585]">Rise</div>
            <div className="text-sm font-semibold text-[#2a2a2a]">
              {regulation.rise_mm.min}–{regulation.rise_mm.max} mm
            </div>
          </div>
          <div className="rounded-lg bg-[#FBF6EC] px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wide text-[#8a9585]">Going (run)</div>
            <div className="text-sm font-semibold text-[#2a2a2a]">
              {regulation.going_mm.min}–{regulation.going_mm.max} mm
            </div>
          </div>
        </div>
      </div>

      {/* Variant grid */}
      <div>
        <div className="text-xs uppercase tracking-wide text-[#8a9585] px-1 mb-2">
          Pick a step count to share
        </div>
        <div className="grid grid-cols-3 gap-2">
          {family.variants.map((variant) => (
            <button
              key={variant.component_id}
              onClick={() => onPick(family, variant)}
              className="rounded-xl bg-white border border-[#e6ddc7] hover:border-[#166534] hover:shadow-sm transition-all p-2 text-center flex flex-col items-center gap-1"
              title={variant.component_id}
            >
              {/* Metadata-only tile: honest step-count marker in place of a
                  render (no .glb files yet · adding thumbnail_url later
                  swaps this glyph for the real preview). */}
              <div className="w-full aspect-square rounded-lg bg-[#FBF6EC] border border-[#f0e8d0] flex items-center justify-center">
                <div className="text-2xl font-semibold text-[#166534]">{variant.treads}</div>
              </div>
              <div className="text-xs font-medium text-[#2a2a2a] leading-tight">
                {variant.treads} step{variant.treads === 1 ? "" : "s"}
              </div>
              <div className="text-[10px] text-[#8a9585] leading-tight">
                {variant.risers} risers
              </div>
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-[#8a9585] px-1 leading-relaxed">
        3D previews land here once each variant has a locked model file. Tapping a tile shares the model type + regulation limits to the chat.
      </p>
    </div>
  );
}
