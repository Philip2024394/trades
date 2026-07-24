"use client";

// QuickActionsGrid — 6-10 tile grid per Design Language v1.1 §6.4 +
// Master Trade Template v1.1 §3.4. Each tile is a state-transition
// intent, not a link.

import {
  Box, PencilRuler, Calculator, Layers, Puzzle, ClipboardCheck, FileText,
  Lightbulb, MessageSquare, ShoppingCart, type LucideIcon
} from "lucide-react";
import { useConversationState } from "../state/ConversationStateProvider";
import type { QuickAction } from "@/lib/nex-apps/_types";

// Icon mapping — deterministic lookup by tile label. Chosen to match
// the canonical Staircase home mockup icons as closely as Lucide allows.
const ICON_MAP: Record<string, LucideIcon> = {
  "3D Design":          Box,
  "Plan & Calculate":   PencilRuler,      // matches the ruler+pencil in mockup
  "Cost Estimator":     Calculator,
  "Materials":          Layers,
  "Components":         Puzzle,
  "Building Codes":     ClipboardCheck,   // clipboard with tick, per mockup
  "Installation Guide": FileText,          // document with lines, not open book
  "Inspiration":        Lightbulb,
  "AI Assistant":       MessageSquare,     // speech bubble
  "Suppliers":          ShoppingCart      // cart, not storefront
};

function iconFor(label: string): LucideIcon {
  return ICON_MAP[label] ?? MessageSquare;
}

// Short two-line description per tile — matches mockup copy where
// possible; auto-derived from the target state otherwise.
const DESCRIPTION_MAP: Record<string, string> = {
  "3D Design":          "Visualize in 3D",
  "Plan & Calculate":   "Dimensions, rise, run & more",
  "Cost Estimator":     "Get instant estimates",
  "Materials":          "Wood, metal, glass & more",
  "Components":         "Stringers, treads, balusters & more",
  "Building Codes":     "Regulations & safety standards",
  "Installation Guide": "Step-by-step instructions",
  "Inspiration":        "Design ideas & styles",
  "AI Assistant":       "Ask anything about staircases",
  "Suppliers":          "Find trusted suppliers"
};

function descriptionFor(label: string): string {
  return DESCRIPTION_MAP[label] ?? "Tap to explore";
}

export function QuickActionsGrid() {
  const { config, activateQuickAction } = useConversationState();
  const actions = config.quick_actions;
  const cols = actions.length >= 10 ? 5 : actions.length >= 8 ? 4 : 3;

  // Split into rows so a divider can sit between them (per canonical
  // Staircase mockup which shows a subtle horizontal line between
  // row 1 and row 2 of tiles).
  const rows: typeof actions[] = [];
  for (let i = 0; i < actions.length; i += cols) {
    rows.push(actions.slice(i, i + cols));
  }

  return (
    <section className="mx-5">
      <div
        className="rounded-2xl px-3 pt-3 pb-3"
        style={{
          background: "var(--nex-cream-elev)",
          boxShadow: "var(--nex-shadow-sm)",
          border: "1px solid var(--nex-neutral-200)"
        }}
      >
        {rows.map((rowActions, rowIdx) => (
          <div key={rowIdx}>
            <div
              className="grid gap-x-1 py-1"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {rowActions.map((action) => (
                <QuickActionTile
                  key={action.label}
                  action={action}
                  onActivate={() => activateQuickAction(action)}
                />
              ))}
            </div>
            {rowIdx < rows.length - 1 && (
              <div className="my-1 flex justify-center" aria-hidden>
                <div
                  className="h-px w-[70%]"
                  style={{ background: "var(--nex-neutral-200)" }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function QuickActionTile({
  action, onActivate
}: {
  action: QuickAction;
  onActivate: () => void;
}) {
  const Icon = iconFor(action.label);
  const description = descriptionFor(action.label);

  return (
    <button
      type="button"
      onClick={onActivate}
      className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-center transition-transform active:scale-95"
      aria-label={action.label}
    >
      <span
        className="grid h-9 w-9 place-items-center rounded-lg"
        style={{
          background: "var(--nex-accent-50)",
          color: "var(--nex-accent-500)"
        }}
      >
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <span
        className="text-[11px] font-semibold leading-tight"
        style={{ color: "var(--nex-neutral-900)" }}
      >
        {action.label}
      </span>
      <span
        className="text-[10px] leading-tight"
        style={{ color: "var(--nex-neutral-500)" }}
      >
        {description}
      </span>
    </button>
  );
}
