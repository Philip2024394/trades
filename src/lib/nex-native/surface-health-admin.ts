// src/lib/nex-native/surface-health-admin.ts
//
// §12 Item 3 · HQ-side read helpers for nex_surface_health_event.
//
// Read-only wrapper around the Item 1 table so the HQ UI never needs
// to import supabase-admin directly. All MUTATIONS still go through
// Item 1's surface-health-service.ts#transitionLifecycle — this file
// does not expose any write primitive.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexSurfaceHealthEventRow } from "./surface-health-service";
import type { LifecycleState } from "./surface-health/lifecycle";

export type { NexSurfaceHealthEventRow };

/** Return the N most recent events ordered newest-first.
 *  No private conversation content exists in the table (sealed §7.4). */
export async function listRecentSurfaceHealthEvents(
  limit = 50,
): Promise<NexSurfaceHealthEventRow[]> {
  const capped = Math.min(Math.max(limit, 1), 500);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_surface_health_event")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(capped);
  if (error) {
    throw new Error(
      `surface-health-admin.listRecentSurfaceHealthEvents: ${error.message}`,
    );
  }
  return (data as NexSurfaceHealthEventRow[] | null) ?? [];
}

/** Return events currently in any of the given lifecycle states.
 *  Powers the HQ lifecycle kanban. */
export async function listByLifecycleState(
  states: readonly LifecycleState[],
  limit = 100,
): Promise<NexSurfaceHealthEventRow[]> {
  if (states.length === 0) return [];
  const capped = Math.min(Math.max(limit, 1), 500);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_surface_health_event")
    .select("*")
    .in("lifecycle_state", states as readonly string[])
    .order("occurred_at", { ascending: false })
    .limit(capped);
  if (error) {
    throw new Error(
      `surface-health-admin.listByLifecycleState: ${error.message}`,
    );
  }
  return (data as NexSurfaceHealthEventRow[] | null) ?? [];
}
