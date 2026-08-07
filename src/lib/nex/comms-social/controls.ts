// NEX Comms Centre · Social · global kill-switch controls.
//
// Singleton row in nex.social_controls · Charter §S-V global admin
// kill switch. When paused, ALL autopublish across all tenants halts
// within ≤30 s. Manual/Assisted flows remain available. Every toggle
// is auditable (audit-event row emitted alongside).

import { withClient } from "@/lib/nex/db";
import type { SocialControls } from "./types";

function isoOf(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v); const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString();
}

function rowToControls(r: Record<string, unknown>): SocialControls {
  return {
    global_pause:        Boolean(r.global_pause),
    global_pause_at:     isoOf(r.global_pause_at),
    global_pause_by:     (r.global_pause_by as string | null) ?? null,
    global_pause_reason: (r.global_pause_reason as string | null) ?? null,
    updated_at:          isoOf(r.updated_at) ?? new Date().toISOString(),
  };
}

const DEFAULT: SocialControls = {
  global_pause:        false,
  global_pause_at:     null,
  global_pause_by:     null,
  global_pause_reason: null,
  updated_at:          new Date(0).toISOString(),
};

/**
 * Read the singleton controls row. Public read (RLS policy allows SELECT
 * to anyone) so any subsystem can consult the kill switch cheaply.
 */
export async function getSocialControls(): Promise<SocialControls> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      "SELECT * FROM nex.social_controls WHERE singleton = TRUE LIMIT 1",
    );
    return res.rows[0] ? rowToControls(res.rows[0]) : DEFAULT;
  });
  return r ?? DEFAULT;
}
