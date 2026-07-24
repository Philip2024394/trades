// Building Passport — the exportable dossier per property.
//
// Composes a PropertySnapshot into the shape a customer or new owner
// gets when the property changes hands or when the homeowner exports
// their SiteBook. Everything visible has evidence + a disclaimer.

import type { BuildingPassport, PropertySnapshot } from "./types";

const DISCLAIMER =
  "This passport summarises the Trade OS record. It is a working document — always verify certificates, guarantees and product details with the original supplier before relying on them.";

export function buildBuildingPassport(s: PropertySnapshot): BuildingPassport {
  const warranties = s.assets
    .filter((a) => a.warranty_expires_at || a.next_maintenance_at)
    .map((a) => ({
      title:      a.label,
      expires_at: a.warranty_expires_at,
      trade:      a.trade_name
    }));

  const recommendations: string[] = [];
  for (const f of s.forecast.slice(0, 5)) {
    if (f.status === "overdue")   recommendations.push(`${f.asset_label} is past its scheduled maintenance date — book it in.`);
    else if (f.status === "due_soon") recommendations.push(`${f.asset_label} is due in ${f.days_until} days.`);
  }
  if (recommendations.length === 0 && s.forecast.length === 0) {
    recommendations.push("No scheduled maintenance items yet. Add care items as work completes so future owners inherit the history.");
  }

  const summary = writeSummary(s);

  return {
    property:         s.property,
    generated_at:     s.computed_at,
    summary,
    projects:         s.projects,
    assets:           s.assets,
    photos_count:     s.photos_count,
    documents_count:  s.documents_count,
    warranties,
    maintenance:      s.forecast,
    future_recommendations: recommendations,
    disclaimer:       DISCLAIMER
  };
}

function writeSummary(s: PropertySnapshot): string {
  const p = s.property;
  const parts: string[] = [];
  parts.push(`${p.address_line ?? "(unknown address)"}${p.address_postcode ? `, ${p.address_postcode}` : ""}${p.address_city ? `, ${p.address_city}` : ""}.`);
  parts.push(`${s.projects_count} project${s.projects_count === 1 ? "" : "s"} on record, first seen ${p.first_seen_at.slice(0, 10)}.`);
  if (s.assets.length > 0)      parts.push(`${s.assets.length} tracked asset${s.assets.length === 1 ? "" : "s"}.`);
  if (s.photos_count > 0)       parts.push(`${s.photos_count} photo${s.photos_count === 1 ? "" : "s"} on file.`);
  if (s.documents_count > 0)    parts.push(`${s.documents_count} document${s.documents_count === 1 ? "" : "s"} on file.`);
  return parts.join(" ");
}

/** Plain-text render for chat / email attachment. */
export function buildingPassportToText(p: BuildingPassport): string {
  const lines: string[] = [];
  lines.push(`Building Passport — ${p.property.address_line ?? "unknown"} ${p.property.address_postcode ?? ""}`.trim());
  lines.push(`Generated ${p.generated_at.slice(0, 10)}`);
  lines.push("");
  lines.push(p.summary);
  if (p.projects.length > 0) {
    lines.push(""); lines.push("Projects:");
    for (const pr of p.projects) lines.push(`- ${pr.title} — ${pr.status}${pr.started_at ? ` (started ${pr.started_at.slice(0, 10)}${pr.completed_at ? `, completed ${pr.completed_at.slice(0, 10)}` : ""})` : ""}`);
  }
  if (p.assets.length > 0) {
    lines.push(""); lines.push("Assets installed:");
    for (const a of p.assets.slice(0, 15)) lines.push(`- [${a.kind}] ${a.label}${a.trade_name ? ` — ${a.trade_name}` : ""}${a.installed_at ? ` (installed ${a.installed_at.slice(0, 10)})` : ""}`);
  }
  if (p.warranties.length > 0) {
    lines.push(""); lines.push("Warranties / care:");
    for (const w of p.warranties) lines.push(`- ${w.title}${w.expires_at ? ` — expires ${w.expires_at.slice(0, 10)}` : ""}${w.trade ? ` (${w.trade})` : ""}`);
  }
  if (p.maintenance.length > 0) {
    lines.push(""); lines.push("Upcoming maintenance:");
    for (const m of p.maintenance.slice(0, 8)) lines.push(`- [${m.status}] ${m.asset_label} — ${m.next_due_at.slice(0, 10)} (${m.days_until} days)`);
  }
  if (p.future_recommendations.length > 0) {
    lines.push(""); lines.push("Recommendations:");
    for (const r of p.future_recommendations) lines.push(`- ${r}`);
  }
  lines.push(""); lines.push(p.disclaimer);
  return lines.join("\n");
}
