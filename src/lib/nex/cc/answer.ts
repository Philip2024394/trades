// CC answer router.
//
// Property-scoped questions:
//   "tell me everything about number 14"  → property_overview
//   "when should the boiler be serviced?" → asset_forecast
//   "find every property with X"          → search
//   "build the Building Passport"         → passport
//   "show all photos at this address"     → photo_count

import { buildingPassportToText, buildBuildingPassport } from "./passport";
import { searchProperties } from "./search";
import type { BuildPropertySnapshotResult } from "./snapshot";
import type { PropertySnapshot } from "./types";
import { opportunitySlot, resolveResultLimit } from "../util/limit";

export type CCQuestion =
  | { kind: "property_overview"; hint: string }
  | { kind: "asset_forecast";    asset: string }
  | { kind: "search";            query: string }
  | { kind: "passport";          hint?: string }
  | { kind: "none" };

export function classifyCCQuestion(text: string): CCQuestion {
  const t = text.toLowerCase().trim();
  if (!t) return { kind: "none" };

  const passportInline = t.match(/\b(?:build|generate|export)\s+(?:the\s+|a\s+)?(?:building\s+)?passport\s+for\s+(.+)/);
  if (passportInline) return { kind: "passport", hint: passportInline[1].replace(/[.?!]+$/, "").trim() };
  if (/\bbuild(ing)?\s+passport\b|\bgenerate\s+(the\s+)?passport\b|\bexport\s+passport\b/.test(t)) return { kind: "passport" };
  const searchMatch = t.match(/\bfind\s+every\s+property\s+(with|using)\s+(.+)/);
  if (searchMatch) return { kind: "search", query: searchMatch[2].replace(/[.?!]+$/, "").trim() };
  const forecastMatch = t.match(/\bwhen\s+(should|does|is)\s+(the\s+|my\s+)?(boiler|roof|kitchen|bathroom|windows|doors|flooring|solar|heating|plumbing|electrical)\s+(be\s+)?(serviced|maintained|inspected|due)/);
  if (forecastMatch) return { kind: "asset_forecast", asset: forecastMatch[3] };
  const tellMatch = t.match(/\btell\s+me\s+everything\s+about\s+(.+)/) || t.match(/\bshow\s+everything\s+about\s+(.+)/);
  if (tellMatch) return { kind: "property_overview", hint: tellMatch[1].replace(/[.?!]+$/, "").trim() };
  const addressMatch = t.match(/\bshow\s+every\s+(project|photo)\s+(at|for)\s+(.+)/);
  if (addressMatch) return { kind: "property_overview", hint: addressMatch[3].replace(/[.?!]+$/, "").trim() };

  return { kind: "none" };
}

// ─── Formatters ───────────────────────────────────────────────

export function formatPropertyOverview(res: BuildPropertySnapshotResult): string {
  if (!res.ok) {
    if (res.reason === "ambiguous") {
      const matches = (res.matches as Array<{ address_line: string | null; address_postcode: string | null }>) ?? [];
      const lines = ["I found more than one property matching that hint:"];
      for (const m of matches) lines.push(`- ${m.address_line ?? "(no address)"}${m.address_postcode ? `, ${m.address_postcode}` : ""}`);
      lines.push("Say the full address or postcode.");
      return lines.join("\n");
    }
    if (res.reason === "not_yours") return "That property isn't in your Trade OS scope.";
    return "No property matches that hint.";
  }
  const s = res.snapshot;
  const p = s.property;
  const lines: string[] = [];
  const gbp = (pen: number) => `£${(pen / 100).toLocaleString("en-GB")}`;
  lines.push(`${p.address_line ?? "(no address)"}${p.address_postcode ? `, ${p.address_postcode}` : ""}${p.address_city ? `, ${p.address_city}` : ""}`);
  if (p.homeowner_name) lines.push(`Owner: ${p.homeowner_name}`);
  lines.push("");
  lines.push(`- ${s.projects_count} project${s.projects_count === 1 ? "" : "s"} on record.`);
  lines.push(`- ${s.photos_count} photo${s.photos_count === 1 ? "" : "s"} · ${s.documents_count} document${s.documents_count === 1 ? "" : "s"}.`);
  if (s.viewer === "homeowner") {
    lines.push(`- Costs: ${gbp(s.costs_total_pence)} agreed, ${gbp(s.costs_paid_pence)} paid, ${gbp(s.costs_outstanding_pence)} outstanding.`);
  }
  if (s.assets.length > 0) {
    lines.push("");
    lines.push("Tracked assets:");
    for (const a of s.assets.slice(0, 6)) lines.push(`- [${a.kind}] ${a.label}${a.installed_at ? ` (${a.installed_at.slice(0, 10)})` : ""}`);
  }
  if (s.forecast.length > 0) {
    lines.push("");
    lines.push("Upcoming maintenance:");
    for (const m of s.forecast.slice(0, 4)) lines.push(`- [${m.status}] ${m.asset_label} — ${m.next_due_at.slice(0, 10)} (${m.days_until} days)`);
  }
  return lines.join("\n");
}

export function formatAssetForecast(res: BuildPropertySnapshotResult, assetKeyword: string): string {
  if (!res.ok) return formatPropertyOverview(res);   // reuse the not-found/ambiguous path
  const s = res.snapshot;
  const kw = assetKeyword.toLowerCase();
  const matches = s.forecast.filter((f) => f.asset_label.toLowerCase().includes(kw));
  if (matches.length === 0) return `No ${kw} maintenance scheduled on this property yet.`;
  const lines: string[] = [];
  for (const m of matches) lines.push(`- ${m.asset_label} — ${m.next_due_at.slice(0, 10)} (${m.days_until} days, ${m.status}) · ${m.suggested_action}`);
  return lines.join("\n");
}

export function formatPassport(res: BuildPropertySnapshotResult): string {
  if (!res.ok) return formatPropertyOverview(res);
  const passport = buildBuildingPassport(res.snapshot);
  return buildingPassportToText(passport);
}

export function formatSearch(results: Array<{ address_line: string | null; address_postcode: string | null; homeowner_name: string | null; matched_reason: string }>, query: string): string {
  const limit = resolveResultLimit(query);
  if (results.length === 0) {
    const lines: string[] = [`No properties on record matching "${query}".`];
    for (let i = 0; i < limit; i++) lines.push(`- ${opportunitySlot("property")}`);
    return lines.join("\n");
  }
  const lines: string[] = [`Top ${limit} propert${limit === 1 ? "y" : "ies"} matching "${query}" (${results.length} found):`];
  const shown = results.slice(0, limit);
  for (const r of shown) {
    const addr = `${r.address_line ?? "(no address)"}${r.address_postcode ? `, ${r.address_postcode}` : ""}`;
    const owner = r.homeowner_name ? ` — ${r.homeowner_name}` : "";
    lines.push(`- ${addr}${owner} · ${r.matched_reason}`);
  }
  for (let i = shown.length; i < limit; i++) lines.push(`- ${opportunitySlot("property")}`);
  return lines.join("\n");
}

// Re-export search for the chat wire-up.
export { searchProperties };
export type { PropertySnapshot };
