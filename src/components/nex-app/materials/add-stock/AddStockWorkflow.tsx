"use client";
// AddStockWorkflow — the entire "Add Stock with NEX" surface.
//
// State machine:
//   idle       → user hasn't submitted anything
//   parsing    → text sent to /nex/parse
//   extracting → file sent to /nex/extract
//   ready      → intent + memory_match returned · confirmation form visible
//   applying   → /nex/apply in flight
//   done       → success · redirecting
//   error      → last op failed · retry available
//
// Kept mobile-first (single column, ≤ 480px container) per the design
// direction. Grows to a wider layout on tablet/desktop.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Send, Upload, Camera, Sparkles, Check, X, Pencil, RefreshCcw, AlertCircle,
} from "lucide-react";
import { MT } from "../_tokens";
import { EntryHero } from "./EntryHero";
import { ThinkingBar } from "./ThinkingBar";
import { InterpretationCard } from "./InterpretationCard";
import { MemoryMatchCard } from "./MemoryMatchCard";
import { ConfirmationForm } from "./ConfirmationForm";
import { ActionsCard } from "./ActionsCard";
import { StockChangesCard } from "./StockChangesCard";
import { ErrorCard } from "./ErrorCard";
import { DoneView } from "./DoneView";
import type {
  NexIntent, NexAddStockIntent, MemoryMatch, NexAddStockDraft,
  MemoryCategory,
} from "@/apps/materials/_schema/memory_types";
import type { SpeciesRow } from "@/apps/materials/_schema/types";

type Phase = "idle" | "parsing" | "extracting" | "ready" | "applying" | "done" | "error";

type DoneResult = {
  memory_id: string | null;
  pack_id: string;
  boards_created: number;
  redirect_url: string;
  form_snapshot: AddStockFormValues;
  material_name: string;
  memory_action: NexAddStockDraft["memory_action"];
};

type WorkflowState = {
  phase: Phase;
  intent?: NexIntent;
  memory_match?: MemoryMatch;
  error?: string;
  done?: DoneResult;
};

export function AddStockWorkflow() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const seededQuery  = searchParams?.get("q") ?? "";
  const [state, setState] = useState<WorkflowState>({ phase: "idle" });
  const [species, setSpecies] = useState<SpeciesRow[]>([]);
  const speciesLoaded = useRef(false);
  const autoSubmitted = useRef(false);

  const loadSpeciesOnce = useCallback(async () => {
    if (speciesLoaded.current) return;
    speciesLoaded.current = true;
    try {
      const res = await fetch("/api/materials/species", { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload.ok) setSpecies(payload.data as SpeciesRow[]);
    } catch (e) {
      console.error("[add-stock] species load failed", e);
    }
  }, []);

  // Auto-run parse when the user arrived from the landing-page Ask NEX bar
  // with a pre-filled query. Runs once, on mount, if ?q= is set.
  useEffect(() => {
    if (autoSubmitted.current || !seededQuery.trim()) return;
    autoSubmitted.current = true;
    submitText(seededQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seededQuery]);

  const submitText = useCallback(async (text: string) => {
    setState({ phase: "parsing" });
    try {
      const res = await fetch("/api/materials/nex/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        setState({ phase: "error", error: payload?.error ?? "NEX couldn't process that." });
        return;
      }
      const { intent, memory_match } = payload.data as { intent: NexIntent; memory_match: MemoryMatch };
      setState({ phase: "ready", intent, memory_match });
      loadSpeciesOnce();
    } catch (e) {
      setState({ phase: "error", error: (e as Error).message });
    }
  }, [loadSpeciesOnce]);

  const submitFile = useCallback(async (file: File) => {
    setState({ phase: "extracting" });
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/materials/nex/extract", { method: "POST", body: form });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        setState({ phase: "error", error: payload?.error ?? "NEX couldn't extract from that document." });
        return;
      }
      const { intent, memory_match } = payload.data as { intent: NexIntent; memory_match: MemoryMatch };
      setState({ phase: "ready", intent, memory_match });
      loadSpeciesOnce();
    } catch (e) {
      setState({ phase: "error", error: (e as Error).message });
    }
  }, [loadSpeciesOnce]);

  const apply = useCallback(async (draft: NexAddStockDraft, snapshot: AddStockFormValues) => {
    setState(s => ({ ...s, phase: "applying" }));
    try {
      const res = await fetch("/api/materials/nex/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        setState(s => ({ ...s, phase: "error", error: payload?.error ?? "Apply failed." }));
        return;
      }
      // Don't auto-redirect. Show the owner what NEX just did so they
      // finish the workflow with confidence, then let them choose to
      // open the pack or return to the Materials home.
      setState({
        phase: "done",
        done: {
          memory_id:      payload.data.memory_id       ?? null,
          pack_id:        payload.data.pack_id,
          boards_created: payload.data.boards_created,
          redirect_url:   payload.data.redirect_url,
          form_snapshot:  snapshot,
          material_name:  snapshot.material_name,
          memory_action:  draft.memory_action,
        },
      });
    } catch (e) {
      setState(s => ({ ...s, phase: "error", error: (e as Error).message }));
    }
  }, []);

  const reset = () => setState({ phase: "idle" });

  return (
    <div
      className="relative mx-auto flex min-h-screen w-full flex-col"
      style={{ background: MT.bg, color: MT.darkGrey, maxWidth: 720, fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}
    >
      <Header />

      <main className="flex-1 px-4 pb-24 sm:px-6">
        {(state.phase === "idle" || state.phase === "error") && (
          <EntryHero
            onSubmitText={submitText}
            onSubmitFile={submitFile}
            disabled={false}
          />
        )}
        {state.phase === "error" && <ErrorCard message={state.error ?? "Unknown error"} onRetry={reset} />}

        {(state.phase === "parsing" || state.phase === "extracting") && (
          <ThinkingBar label={state.phase === "parsing" ? "NEX is reading what you asked…" : "NEX is looking at your document…"} />
        )}

        {state.phase === "ready" && state.intent && state.memory_match && (
          <ReadyView
            intent={state.intent}
            memoryMatch={state.memory_match}
            species={species}
            onApply={apply}
            onCancel={reset}
          />
        )}

        {state.phase === "applying" && <ThinkingBar label="NEX is creating your pack…" />}

        {state.phase === "done" && state.done && (
          <DoneView done={state.done} onReset={reset} />
        )}
      </main>
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────

function Header() {
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 px-4 pt-4 pb-3 sm:px-6"
      style={{ background: MT.bg, borderBottom: `1px solid ${MT.borderLight}` }}
    >
      <Link
        href="/nex-app/materials"
        aria-label="Back to Materials"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform active:scale-95"
        style={{ background: MT.card, border: `1px solid ${MT.borderLight}`, boxShadow: MT.shadowSoft }}
      >
        <ArrowLeft size={18} strokeWidth={2.25} style={{ color: MT.primary }} />
      </Link>
      <div className="min-w-0">
        <h1 className="text-[19px] font-extrabold leading-tight tracking-tight" style={{ color: MT.darkGrey, letterSpacing: -0.4 }}>
          NEX Materials
        </h1>
        <p className="mt-0.5 text-[12.5px]" style={{ color: MT.secondaryGrey }}>
          What have you received today?
        </p>
      </div>
      <span
        className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider"
        style={{ background: MT.primarySoft, color: MT.primary, border: `1px solid ${MT.primaryBorder}` }}
      >
        <Sparkles size={12} strokeWidth={2.25} />
        NEX
      </span>
    </header>
  );
}

// ── ReadyView — orchestrates the four confirmation cards ─────────

function ReadyView({
  intent, memoryMatch, species, onApply, onCancel,
}: {
  intent: NexIntent;
  memoryMatch: MemoryMatch;
  species: SpeciesRow[];
  onApply: (draft: NexAddStockDraft, snapshot: AddStockFormValues) => void;
  onCancel: () => void;
}) {
  if (intent.action !== "add_stock") {
    return (
      <div className="mt-6 flex items-start gap-3 rounded-2xl px-5 py-4" style={{ background: MT.card, border: `1px solid ${MT.borderLight}`, boxShadow: MT.shadowSoft }}>
        <AlertCircle size={22} strokeWidth={2} style={{ color: MT.primary, flexShrink: 0 }} />
        <div>
          <div className="text-[14px] font-bold" style={{ color: MT.darkGrey }}>Not supported yet</div>
          <p className="mt-1 text-[13px]" style={{ color: MT.secondaryGrey }}>{intent.message}</p>
          <button
            type="button"
            onClick={onCancel}
            className="mt-3 rounded-lg px-3 py-1.5 text-[12px] font-bold"
            style={{ background: MT.primary, color: "#fff" }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <ReadyForm intent={intent} memoryMatch={memoryMatch} species={species} onApply={onApply} onCancel={onCancel} />
  );
}

function ReadyForm({
  intent, memoryMatch, species, onApply, onCancel,
}: {
  intent: NexAddStockIntent;
  memoryMatch: MemoryMatch;
  species: SpeciesRow[];
  onApply: (draft: NexAddStockDraft, snapshot: AddStockFormValues) => void;
  onCancel: () => void;
}) {
  // Initial form values pre-filled from the memory match (if any) then
  // overridden by the intent. Owner edits from there.
  const initial = useMemo(() => {
    const m = memoryMatch.kind !== "none" ? memoryMatch.row : null;
    return {
      material_name:   m?.name                                    ?? intent.material_query,
      category:        (m?.category ?? "hardwood") as MemoryCategory,
      species_id:      m?.species_id ?? guessSpeciesId(intent.species_hint ?? intent.material_query, species),
      length_mm:       intent.dimensions?.length_mm    ?? m?.default_length_mm    ?? null,
      width_mm:        intent.dimensions?.width_mm     ?? m?.default_width_mm     ?? null,
      thickness_mm:    intent.dimensions?.thickness_mm ?? m?.default_thickness_mm ?? null,
      typical_grade:   intent.grade                    ?? m?.typical_grade        ?? null,
      supplier_name:   intent.supplier_name                                       ?? null,
      price_per_unit:  intent.price_per_unit           ?? m?.typical_price_per_unit ?? null,
      price_currency:  intent.price_currency           ?? m?.price_currency        ?? "GBP",
      quantity:        intent.quantity,
      reference:       intent.reference                                            ?? null,
    };
  }, [intent, memoryMatch, species]);

  const [form, setForm] = useState(initial);
  // Default action strategy:
  //   · no match          → propose to add to Memory
  //   · exact / synonym   → use existing
  //   · fuzzy ≥ 0.65      → use existing (confident)
  //   · fuzzy < 0.65      → LEAVE UNSET so the owner must pick before applying.
  //     Never silently reuse a low-confidence guess, never silently create
  //     a duplicate. Owner stays in control per Philip 2026-07-28.
  const initialAction: NexAddStockDraft["memory_action"] | null =
    memoryMatch.kind === "none"                                             ? "create_new"   :
    memoryMatch.kind === "exact" || memoryMatch.kind === "synonym"          ? "use_existing" :
    memoryMatch.kind === "fuzzy" && memoryMatch.similarity >= 0.65          ? "use_existing" :
    null;
  const [memoryAction, setMemoryAction] = useState<NexAddStockDraft["memory_action"] | null>(initialAction);

  const canApply =
    form.material_name.trim().length > 0 &&
    form.species_id != null &&
    form.quantity > 0 &&
    memoryAction != null;

  const submit = () => {
    if (!canApply || memoryAction == null) return;
    const draft: NexAddStockDraft = {
      intent,
      memory_match: memoryMatch,
      memory_action: memoryAction,
      overrides: {
        material_name:   form.material_name,
        category:        form.category,
        species_id:      form.species_id,
        length_mm:       form.length_mm,
        width_mm:        form.width_mm,
        thickness_mm:    form.thickness_mm,
        typical_grade:   form.typical_grade,
        supplier_name:   form.supplier_name,
        price_per_unit:  form.price_per_unit,
        price_currency:  form.price_currency,
        quantity:        form.quantity,
        reference:       form.reference,
      },
    };
    onApply(draft, form);
  };

  // Only show the edit form by default if a required field is missing.
  // Otherwise NEX's confirmation reads as a summary; owner opts into
  // the form via "Edit details" — feels less like paperwork.
  const requiresEditByDefault = form.species_id == null
    || form.length_mm == null || form.width_mm == null || form.thickness_mm == null;
  const [editOpen, setEditOpen] = useState(requiresEditByDefault);

  return (
    <div className="mt-4 flex flex-col gap-3">
      {/* Memory decision — always visible so the owner sees the choice
          NEX has made (or needs from them) before scrolling further. */}
      <MemoryMatchCard
        memoryMatch={memoryMatch}
        action={memoryAction}
        onActionChange={setMemoryAction}
        proposedName={form.material_name}
      />

      {/* The three-part confirmation Philip loves */}
      <InterpretationCard intent={intent} />
      <ActionsCard         form={form} memoryAction={memoryAction} />
      <StockChangesCard    form={form} />

      {/* Edit details — collapsible so the confirmation reads as a
          summary, not a form. Auto-opens when required data is missing. */}
      <EditToggle open={editOpen} onToggle={() => setEditOpen(o => !o)} />
      {editOpen && (
        <ConfirmationForm value={form} onChange={setForm} species={species} />
      )}

      {/* Actions */}
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 text-[13.5px] font-bold transition-transform active:scale-95"
          style={{ background: MT.card, color: MT.darkGrey, border: `1px solid ${MT.border}`, borderRadius: MT.radiusMd }}
        >
          <X size={16} strokeWidth={2.25} />
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canApply}
          className="inline-flex h-12 flex-[2] items-center justify-center gap-1.5 text-[14.5px] font-extrabold uppercase tracking-wider transition-transform active:scale-95 disabled:opacity-50"
          style={{
            background: MT.primary,
            color: "#FFFFFF",
            borderRadius: MT.radiusMd,
            boxShadow: "0 8px 20px -8px rgba(245,130,32,0.60)",
            letterSpacing: 0.6,
          }}
        >
          <Check size={17} strokeWidth={2.75} />
          Confirm
        </button>
      </div>
      {!canApply && memoryAction == null && (
        <div className="text-center text-[11.5px] font-semibold" style={{ color: MT.secondaryGrey }}>
          Pick a Materials Memory action above to enable Confirm.
        </div>
      )}
    </div>
  );
}

function EditToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex h-10 items-center justify-center gap-2 text-[12.5px] font-semibold transition-colors"
      style={{
        background: "transparent",
        color: MT.secondaryGrey,
        border: `1px dashed ${MT.border}`,
        borderRadius: MT.radiusMd,
      }}
    >
      <Pencil size={13} strokeWidth={2} />
      {open ? "Hide edit fields" : "Edit details before confirming"}
    </button>
  );
}

// ── Species heuristic ─────────────────────────────────────────────

function guessSpeciesId(hint: string | null | undefined, species: SpeciesRow[]): string | null {
  if (!hint || species.length === 0) return null;
  const lower = hint.toLowerCase();
  // Simple substring match against display name
  const hit = species.find(s => lower.includes(s.display_name.toLowerCase().split(" ")[0]))
           ?? species.find(s => s.id.split("_").some(t => lower.includes(t)));
  return hit?.id ?? null;
}

// Types the sub-components consume
export type AddStockFormValues = {
  material_name:   string;
  category:        MemoryCategory;
  species_id:      string | null;
  length_mm:       number | null;
  width_mm:        number | null;
  thickness_mm:    number | null;
  typical_grade:   string | null;
  supplier_name:   string | null;
  price_per_unit:  number | null;
  price_currency:  string;
  quantity:        number;
  reference:       string | null;
};
