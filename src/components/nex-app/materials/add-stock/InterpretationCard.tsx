// InterpretationCard — what NEX understood from the input.
// Rendered as a card that the owner reads before touching the form.

import { Quote } from "lucide-react";
import { MT } from "../_tokens";
import type { NexAddStockIntent } from "@/apps/materials/_schema/memory_types";

export function InterpretationCard({ intent }: { intent: NexAddStockIntent }) {
  const bits: string[] = [];
  bits.push(`${intent.quantity} × ${intent.material_query}`);
  if (intent.dimensions?.length_mm && intent.dimensions?.width_mm && intent.dimensions?.thickness_mm) {
    bits.push(`${intent.dimensions.length_mm} × ${intent.dimensions.width_mm} × ${intent.dimensions.thickness_mm} mm`);
  }
  if (intent.supplier_name) bits.push(`from ${intent.supplier_name}`);
  if (intent.price_per_unit != null) {
    bits.push(`${symbol(intent.price_currency)}${intent.price_per_unit.toFixed(2)} each`);
  }
  if (intent.grade) bits.push(`grade ${intent.grade}`);

  return (
    <div
      className="flex gap-3 px-4 py-3.5"
      style={{
        background: MT.card,
        border: `1px solid ${MT.borderLight}`,
        borderRadius: MT.radiusLg,
        boxShadow: MT.shadowSoft,
      }}
    >
      <Quote size={18} strokeWidth={2} style={{ color: MT.primary, flexShrink: 0, marginTop: 2 }} />
      <div className="min-w-0">
        <div className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: MT.secondaryGrey }}>
          1 · This is what I understood
        </div>
        <div className="mt-1 text-[14px] font-bold leading-snug" style={{ color: MT.darkGrey }}>
          {bits.join(" · ")}
        </div>
        {intent.raw && intent.raw !== intent.material_query && (
          <div className="mt-2 text-[11.5px] italic" style={{ color: MT.secondaryGrey }}>
            You said: &ldquo;{intent.raw}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}

function symbol(currency?: string | null): string {
  switch ((currency ?? "GBP").toUpperCase()) {
    case "GBP": return "£";
    case "USD": return "$";
    case "EUR": return "€";
    default:    return `${currency} `;
  }
}
