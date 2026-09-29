// src/lib/nex-native/intelligence/evidence-context.ts
//
// Bridge 91 · Format an EvidenceBundle into the structured prompt block
// the model sees. Deterministic · same bundle → same string.
//
// The formatting deliberately separates:
//   · NEX_KNOWLEDGE     — retrieved from authoritative business data (with provenance)
//   · KNOWN_LIMITATIONS — categories the bundle deliberately did NOT retrieve
//   · RESPONSE_RULES    — explicit constraints for the model
//
// The model MUST answer only from NEX_KNOWLEDGE. Anything factual that
// isn't in NEX_KNOWLEDGE must either be omitted or explicitly framed as
// "I don't have that information" — enforced downstream by the validator
// (fabricated_figure / fabricated_url checks whitelist evidence tokens).

import "server-only";
import type { EvidenceBundle, EvidenceItem } from "./business-evidence-retriever";

export function formatEvidenceForPrompt(bundle: EvidenceBundle): string {
  if (bundle.items.length === 0) {
    return [
      "NEX_KNOWLEDGE:",
      "  (no matching authoritative business data found)",
      "",
      "RESPONSE_RULES:",
      "- You have no verified information to answer this question from.",
      "- Do not guess. Do not invent facts, prices, hours, or availability.",
      "- Reply with a short honest acknowledgement · say you'll need the business owner to answer this personally.",
      "- Do not fabricate URLs, prices, or account state.",
    ].join("\n");
  }

  const lines: string[] = ["NEX_KNOWLEDGE (retrieved from this business's authoritative data):"];
  for (const item of bundle.items) {
    lines.push("");
    lines.push(`[${item.id}] source=${item.provenance} · updated_at=${shortDate(item.updated_at)}`);
    lines.push(`Title: ${item.title}`);
    lines.push(`Content: ${item.content}`);
  }
  lines.push("");
  lines.push("RESPONSE_RULES:");
  lines.push("- Answer the customer's question using ONLY the NEX_KNOWLEDGE above.");
  lines.push("- If NEX_KNOWLEDGE contains a price, an hour, an address, or a status, use it verbatim.");
  lines.push("- If the customer asks about something NEX_KNOWLEDGE does not cover, say honestly that you'll need the business owner to answer.");
  lines.push("- Never invent prices, URLs, dates, or business policies.");
  lines.push("- Never claim to have taken an action (payment, order, refund, activation) — you can only answer questions.");
  lines.push("- Keep the reply short · one paragraph · plain UK English.");
  return lines.join("\n");
}

function shortDate(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "?";
  }
}

/** Convenience: itemize evidence for the audit log · gives ops a
 *  human-readable record of what the model was allowed to see. */
export function evidenceSummary(bundle: EvidenceBundle): {
  item_ids: string[];
  provenances: string[];
  figures: string[];
  urls: string[];
} {
  const item_ids = bundle.items.map((i) => i.id);
  const provenances = Array.from(new Set(bundle.items.map((i) => i.provenance)));
  const figures = Array.from(new Set(bundle.items.flatMap((i) => i.figures)));
  const urls = Array.from(new Set(bundle.items.flatMap((i) => i.urls)));
  return { item_ids, provenances, figures, urls };
}

export type { EvidenceItem };
