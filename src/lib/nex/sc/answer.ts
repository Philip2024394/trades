// Supply-chain answer router.
//
// Handles the SC-specific question families:
//   • Shopping list  — "what materials do I need for next week?"
//   • Suppliers      — "compare suppliers", "who's my top supplier?"
//   • Waste          — "where am I wasting materials?"
//   • Alternatives   — "any alternatives for X?"
//   • What's unavailable — "why can't you tell me stock?"
//
// Everything else falls through so it can hit MD / FI / knowledge.

import { findAlternatives } from "./alternatives";
import type { SupplyChainSnapshot } from "./types";

export type SCQuestion =
  | { kind: "shopping_list" }
  | { kind: "compare_suppliers" }
  | { kind: "waste" }
  | { kind: "alternatives"; query: string }
  | { kind: "unavailable" }
  | { kind: "none" };

export function classifySCQuestion(text: string): SCQuestion {
  const t = text.toLowerCase().trim();
  if (!t) return { kind: "none" };

  if (/\bwhat\s+materials?\s+do\s+i\s+need\b|\bmaterials?\s+for\s+(next\s+week|upcoming\s+jobs?|this\s+week)\b|\bwhat'?s\s+on\s+the\s+shopping\s+list\b/.test(t)) return { kind: "shopping_list" };
  if (/\bcompare\s+suppliers?\b|\bwhich\s+supplier\s+(is\s+)?best\b|\bwho\s+is\s+my\s+top\s+supplier\b/.test(t)) return { kind: "compare_suppliers" };
  if (/\bwhere\s+am\s+i\s+wasting\s+materials?\b|\bmaterials?\s+waste\b|\bwaste\s+report\b/.test(t)) return { kind: "waste" };

  const altMatch = t.match(/\balternatives?\s+(for|to)\s+([a-z][\w\s-]{1,40})/i);
  if (altMatch) return { kind: "alternatives", query: altMatch[2].trim() };
  const findMatch = t.match(/\bfind\s+(?:an?\s+)?alternative\s+(?:for\s+|to\s+)?([a-z][\w\s-]{1,40})/i);
  if (findMatch) return { kind: "alternatives", query: findMatch[1].trim() };

  if (/\bwhy\s+can'?t\s+you\s+(tell|see|track)\s+stock\b|\bwhat'?s\s+missing\b/.test(t) && /\bstock|inventor|purchas/.test(t)) return { kind: "unavailable" };

  return { kind: "none" };
}

export async function answerSC(q: SCQuestion, snapshot: SupplyChainSnapshot): Promise<string> {
  switch (q.kind) {
    case "shopping_list":     return shoppingListReply(snapshot);
    case "compare_suppliers": return suppliersReply(snapshot);
    case "waste":             return wasteReply(snapshot);
    case "alternatives":      return alternativesReply(await findAlternatives({ query: q.query }));
    case "unavailable":       return unavailableReply(snapshot);
    case "none":              return "";
  }
}

// ─── Reply builders ────────────────────────────────────────────

const gbp = (p: number): string => `£${(p / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function shoppingListReply(s: SupplyChainSnapshot): string {
  const sl = s.shopping_list;
  const lines: string[] = [];
  lines.push(`Materials needed for ${sl.jobs_count} job${sl.jobs_count === 1 ? "" : "s"} scheduled in the next ${sl.window_days} days (total ${gbp(sl.total_pence)}):`);
  if (sl.lines.length === 0) {
    for (const w of sl.warnings) lines.push(`- ${w}`);
    return lines.join("\n");
  }
  lines.push("");
  for (const l of sl.lines.slice(0, 15)) {
    const jobBits = l.jobs.length === 1
      ? `for ${l.jobs[0].title}`
      : `across ${l.jobs.length} jobs`;
    lines.push(`- ${l.qty_needed} ${l.unit ?? "each"} · ${l.label} — ${gbp(l.est_cost_pence)} ${jobBits}`);
  }
  if (sl.warnings.length > 0) {
    lines.push("");
    for (const w of sl.warnings) lines.push(`- ${w}`);
  }
  return lines.join("\n");
}

function suppliersReply(s: SupplyChainSnapshot): string {
  const sp = s.suppliers;
  if (sp.suppliers.length === 0) return "No supplier spend recorded — nothing to compare yet.";
  const lines: string[] = [`Suppliers by spend (last ${sp.window_days} days):`];
  for (const sup of sp.suppliers.slice(0, 8)) {
    const reliability = sup.paid_on_time_pct === null
      ? "reliability not enough history"
      : `${sup.paid_on_time_pct}% paid on time`;
    lines.push(`- ${sup.supplier_key} — ${gbp(sup.spend_pence)} across ${sup.cost_count} cost${sup.cost_count === 1 ? "" : "s"} · ${reliability}`);
  }
  if (sp.warnings.length > 0) {
    lines.push("");
    for (const w of sp.warnings) lines.push(`- ${w}`);
  }
  return lines.join("\n");
}

function wasteReply(s: SupplyChainSnapshot): string {
  const w = s.waste;
  if (w.projects.length === 0) return "No projects with both estimated + actual material costs to compare yet.";
  const lines: string[] = [
    `Materials variance across ${w.projects.length} project${w.projects.length === 1 ? "" : "s"} (last ${w.window_days} days):`
  ];
  if (w.average_variance_pct !== null) lines.push(`Average variance: ${w.average_variance_pct}% (positive = spent more than estimated).`);
  const worst = w.projects.filter((p) => p.variance_pence > 0).slice(0, 5);
  if (worst.length > 0) {
    lines.push("");
    lines.push("Worst offenders:");
    for (const p of worst) {
      const pct = p.variance_pct === null ? "" : ` (${p.variance_pct}%)`;
      lines.push(`- ${p.project_title} — estimated ${gbp(p.estimated_materials_pence)}, actual ${gbp(p.actual_materials_pence)}, over by ${gbp(p.variance_pence)}${pct}`);
    }
  }
  if (w.warnings.length > 0) {
    lines.push("");
    for (const warn of w.warnings) lines.push(`- ${warn}`);
  }
  return lines.join("\n");
}

function alternativesReply(a: Awaited<ReturnType<typeof findAlternatives>>): string {
  const lines: string[] = [];
  lines.push(a.alternatives.length > 0 ? `Alternatives to "${a.query}":` : a.note);
  for (const alt of a.alternatives) {
    lines.push(`- ${alt.label}${alt.reason ? ` — ${alt.reason}` : ""}`);
  }
  if (a.alternatives.length > 0 && a.note) {
    lines.push("");
    lines.push(a.note);
  }
  return lines.join("\n");
}

function unavailableReply(s: SupplyChainSnapshot): string {
  const lines = ["Here's what Trade OS can't tell you yet — no source data on the platform:"];
  for (const u of s.unavailable) lines.push(`- ${u}`);
  lines.push("");
  lines.push("Add those sources and I'll fold them in without any code change.");
  return lines.join("\n");
}
