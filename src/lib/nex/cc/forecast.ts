// Maintenance forecast — upcoming work per property, sorted by
// urgency. Derived from AssetItem.next_maintenance_at.

import { evidenceFor, type AssetItem, type MaintenanceForecastItem } from "./types";

const DAY_MS = 86_400_000;

export function buildMaintenanceForecast(assets: AssetItem[], now = new Date()): MaintenanceForecastItem[] {
  const evidence = evidenceFor("derived from asset next_maintenance_at", ["hammerex_sitebook_home_care_items"]);
  const out: MaintenanceForecastItem[] = [];
  for (const a of assets) {
    if (!a.next_maintenance_at) continue;
    const nextMs = new Date(a.next_maintenance_at).getTime();
    if (!isFinite(nextMs)) continue;
    const days = Math.round((nextMs - now.getTime()) / DAY_MS);
    let status: MaintenanceForecastItem["status"];
    if (days < 0)  status = "overdue";
    else if (days <= 30) status = "due_soon";
    else status = "upcoming";
    out.push({
      asset_key:      a.key,
      asset_label:    a.label,
      next_due_at:    a.next_maintenance_at,
      days_until:     days,
      cadence_days:   a.cadence_days,
      status,
      suggested_action: status === "overdue"
        ? "Book this in — it's past its scheduled date."
        : status === "due_soon"
          ? "Book this in the next few weeks."
          : "On the horizon — no action needed yet.",
      evidence
    });
  }
  // Overdue first, then due_soon, then upcoming (sooner first).
  const bucket: Record<MaintenanceForecastItem["status"], number> = { overdue: 0, due_soon: 1, upcoming: 2 };
  out.sort((a, b) => bucket[a.status] - bucket[b.status] || a.days_until - b.days_until);
  return out;
}
