// Materials · Recent Activity
//
// Reads the last N audit rows for the current owner and shapes them
// into humanised, day-grouped activity items. Zero new tables — feeds
// entirely off `nex_materials_audit_log` which every mutation already
// writes to.
//
// Design principle applied: never expose internal event names like
// `nex_add_stock_applied` — narrate what happened in owner language
// ("Recorded a delivery of 20 European Oak PAR boards").

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { MaterialsError, type AuditLogRow } from "../_schema/types";

export type ActivityItem = {
  id: string;
  occurred_at: string;
  headline: string;
  detail?: string | null;
  href?: string | null;
  emphasis?: "success" | "info" | "warn";
};

export type ActivityGroup = {
  label: string;    // "Today" · "Yesterday" · "Wednesday" · "2 weeks ago"
  items: ActivityItem[];
};

export async function loadRecentActivity(ownerId: string, limit = 20): Promise<ActivityGroup[]> {
  const { data, error } = await supabaseAdmin
    .from("nex_materials_audit_log")
    .select("*")
    .eq("actor_ref", ownerId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw new MaterialsError("internal", error.message, 500);

  const rows = (data ?? []) as AuditLogRow[];
  const items = rows.map(rowToActivityItem).filter((x): x is ActivityItem => x != null);

  return groupByDay(items);
}

function rowToActivityItem(row: AuditLogRow): ActivityItem | null {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;

  // The high-value events. Everything else (board created, defect
  // observed, etc.) is noise on this feed — we filter those out and
  // let the pack detail page show them per-board.
  switch (row.event_type) {
    case "nex_add_stock_applied": {
      const quantity = toNum(meta.boards_created) ?? 0;
      const originalQuery = typeof meta.original_query === "string" ? meta.original_query : "";
      const headline = quantity > 0
        ? `Recorded a delivery — ${quantity} board${quantity === 1 ? "" : "s"}`
        : "Recorded a delivery";
      return {
        id: row.id,
        occurred_at: row.occurred_at,
        headline,
        detail: originalQuery ? `You said: “${originalQuery}”` : undefined,
        href: `/nex-app/materials/packs/${row.entity_id}`,
        emphasis: "success",
      };
    }
    case "created":
      if (row.entity_type === "pack") {
        return {
          id: row.id,
          occurred_at: row.occurred_at,
          headline: "New pack registered",
          href: `/nex-app/materials/packs/${row.entity_id}`,
          emphasis: "success",
        };
      }
      if (row.entity_type === "worker_link") {
        return {
          id: row.id,
          occurred_at: row.occurred_at,
          headline: "Shared a pack link with the workshop",
          emphasis: "info",
        };
      }
      return null;
    case "allocated":
    case "released":
    case "revoked":
    case "measurement_recorded":
    case "memory_created":
    case "memory_updated":
      return {
        id: row.id,
        occurred_at: row.occurred_at,
        headline: humaniseEventType(row.event_type),
        emphasis: row.event_type === "revoked" ? "warn" : "info",
      };
    case "recorded":
      if (row.entity_type === "measurement") {
        return {
          id: row.id,
          occurred_at: row.occurred_at,
          headline: "Recorded a board measurement",
          emphasis: "info",
        };
      }
      return null;
    default:
      return null;
  }
}

function humaniseEventType(t: string): string {
  switch (t) {
    case "allocated":           return "Reserved a board for a project";
    case "released":            return "Released a reservation";
    case "revoked":             return "Revoked a worker link";
    case "measurement_recorded":return "Recorded a board measurement";
    case "memory_created":      return "Remembered a new material";
    case "memory_updated":      return "Updated a saved material";
    default:                    return t.replace(/_/g, " ");
  }
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function groupByDay(items: ActivityItem[]): ActivityGroup[] {
  const now = new Date();
  const today  = ymd(now);
  const yestD  = new Date(now); yestD.setDate(yestD.getDate() - 1);
  const yest   = ymd(yestD);

  const buckets = new Map<string, ActivityItem[]>();

  for (const it of items) {
    const d = new Date(it.occurred_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = dayLabel(d, today, yest);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(it);
  }

  // Preserve original chronological grouping order.
  const groups: ActivityGroup[] = [];
  for (const [label, items] of buckets) {
    groups.push({ label, items });
  }
  return groups;
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function dayLabel(d: Date, todayKey: string, yestKey: string): string {
  const key = ymd(d);
  if (key === todayKey) return "Today";
  if (key === yestKey)  return "Yesterday";

  const daysAgo = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo < 7) {
    return d.toLocaleDateString(undefined, { weekday: "long" });
  }
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
