// NEX Predictive · global controls · invariant #15
//
// Singleton row in nex.predictive_controls. Read-cached per request; every
// write invalidates the cache. When paused, the engine still produces
// recommendations (mode='shadow') but never emits optimisation commands.

import { withClient } from "@/lib/nex/db";
import type { PredictiveControls } from "./types";

function isoOf(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v); const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString();
}

function rowToControls(r: Record<string, unknown>): PredictiveControls {
  return {
    paused: Boolean(r.paused),
    paused_at: isoOf(r.paused_at),
    paused_by: (r.paused_by as string | null) ?? null,
    paused_reason: (r.paused_reason as string | null) ?? null,
    confidence_threshold: Number(r.confidence_threshold ?? 0.6),
    updated_at: isoOf(r.updated_at) ?? new Date().toISOString(),
  };
}

const DEFAULT: PredictiveControls = {
  paused: false,
  paused_at: null,
  paused_by: null,
  paused_reason: null,
  confidence_threshold: 0.6,
  updated_at: new Date(0).toISOString(),
};

export async function getControls(): Promise<PredictiveControls> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.predictive_controls WHERE singleton = TRUE LIMIT 1`);
    return res.rows[0] ? rowToControls(res.rows[0]) : DEFAULT;
  });
  return r ?? DEFAULT;
}

export interface SetControlsInput {
  paused?: boolean;
  paused_by?: string;
  paused_reason?: string;
  confidence_threshold?: number;
}

export async function setControls(input: SetControlsInput): Promise<PredictiveControls> {
  const r = await withClient(async (c) => {
    // Ensure the singleton row exists (idempotent).
    await c.query(
      `INSERT INTO nex.predictive_controls (singleton) VALUES (TRUE) ON CONFLICT (singleton) DO NOTHING`,
    );
    const parts: string[] = [];
    const params: unknown[] = [];
    if (input.paused !== undefined) {
      parts.push(`paused = $${parts.length + 1}`);
      params.push(input.paused);
      if (input.paused) {
        parts.push(`paused_at = NOW()`);
        parts.push(`paused_by = $${parts.length + 1 - (params.length - params.length)}`);
        // Rework to keep param order simple:
      }
    }
    // Simpler: rebuild the SET clause deterministically.
    const setSql: string[] = [];
    const p: unknown[] = [];
    if (input.paused !== undefined) {
      p.push(input.paused); setSql.push(`paused = $${p.length}`);
      if (input.paused) {
        setSql.push(`paused_at = NOW()`);
        p.push(input.paused_by ?? null); setSql.push(`paused_by = $${p.length}`);
        p.push(input.paused_reason ?? null); setSql.push(`paused_reason = $${p.length}`);
      } else {
        setSql.push(`paused_at = NULL`);
        setSql.push(`paused_by = NULL`);
        setSql.push(`paused_reason = NULL`);
      }
    }
    if (input.confidence_threshold !== undefined) {
      p.push(input.confidence_threshold); setSql.push(`confidence_threshold = $${p.length}`);
    }
    setSql.push(`updated_at = NOW()`);
    const res = await c.query(
      `UPDATE nex.predictive_controls SET ${setSql.join(", ")} WHERE singleton = TRUE RETURNING *`,
      p,
    );
    return res.rows[0] ? rowToControls(res.rows[0]) : DEFAULT;
  });
  return r ?? DEFAULT;
}
