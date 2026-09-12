// src/lib/nex/founder-window/emit.ts
//
// Founder 2026-09-10 · Founder's Window · unified event emitter.
//
// Every subsystem calls emitFounderWindowEvent() to log a signal that the
// dashboard will surface. Fire-and-forget · never blocks the caller ·
// swallows Postgres errors (the dashboard is a lens, not a gate).
//
// Golden rule: NEVER fabricate an event. Only emit when a real thing
// happened. If a subsystem is broken, EMIT the failure instead of hiding.

import type { PoolClient } from "pg";
import { getPool } from "../db";

export type FounderWindowSubsystem =
  | "chat" | "lab_harvest" | "lab_verify" | "lab_promotion"
  | "master_ai" | "programmer" | "voice" | "ocr" | "mcp"
  | "storage" | "scheduler" | "notification" | "authorization"
  | "knowledge" | "memory" | "truth_engine" | "gap_engine"
  | "email_enricher" | "gov_harvester" | "instagram_enricher"
  | "directory_crawler" | "categoriser";

export type FounderWindowEventKind =
  | "data_received"
  | "input_sanitized" | "input_rejected"
  | "intent_classified"
  | "research_started" | "research_completed"
  | "evidence_discovered" | "evidence_rejected"
  | "claim_verified" | "claim_rejected"
  | "knowledge_stored" | "knowledge_updated"
  | "gap_created" | "gap_resolved"
  | "agent_started" | "agent_completed" | "agent_failed"
  | "scheduled_task_triggered" | "scheduled_task_completed"
  | "notification_generated"
  | "action_authorized" | "action_rejected"
  | "subsystem_probe" | "pipeline_stage_tick";

export type FounderWindowStatus = "info" | "ok" | "warning" | "error" | "critical";

export interface FounderWindowEventInput {
  subsystem: FounderWindowSubsystem;
  event_kind: FounderWindowEventKind;
  status?: FounderWindowStatus;              // defaults to "info"
  request_id?: string | null;                // correlation across pipeline stages
  actor?: string | null;                     // agent_id, user_id, or 'system'
  subject_ref?: string | null;               // dedupe_hash, url, business_id, etc.
  message?: string | null;                   // one-line summary
  reference?: Record<string, unknown> | null;
  duration_ms?: number | null;
}

/**
 * Emit a Founder's Window event. Fire-and-forget · returns immediately.
 * The write is scheduled via microtask so the caller never blocks.
 */
export function emitFounderWindowEvent(input: FounderWindowEventInput): void {
  // Fire-and-forget · Promise floats · errors swallowed (with console warn)
  void (async () => {
    try {
      const pool = await getPool();
      if (!pool) return;
      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO nex.founder_window_event
             (subsystem, event_kind, status, request_id, actor, subject_ref, message, reference, duration_ms)
           VALUES ($1, $2, $3, $4::uuid, $5, $6, $7, $8::jsonb, $9)`,
          [
            input.subsystem,
            input.event_kind,
            input.status ?? "info",
            input.request_id ?? null,
            input.actor ?? null,
            input.subject_ref ?? null,
            input.message ?? null,
            input.reference ? JSON.stringify(input.reference) : null,
            input.duration_ms ?? null,
          ],
        );
      } finally {
        client.release();
      }
    } catch (err) {
      // Dashboard failures never break the caller
      // eslint-disable-next-line no-console
      console.warn("[founder-window] emit failed:", String(err).slice(0, 200));
    }
  })();
}

/**
 * Synchronous emit for scripts that maintain their own pg client (avoid
 * pool-based emission from long-running scheduled tasks).
 */
export async function emitFounderWindowEventWithClient(
  client: PoolClient | { query: (t: string, p?: unknown[]) => Promise<unknown> },
  input: FounderWindowEventInput,
): Promise<void> {
  try {
    await client.query(
      `INSERT INTO nex.founder_window_event
         (subsystem, event_kind, status, request_id, actor, subject_ref, message, reference, duration_ms)
       VALUES ($1, $2, $3, $4::uuid, $5, $6, $7, $8::jsonb, $9)`,
      [
        input.subsystem, input.event_kind, input.status ?? "info",
        input.request_id ?? null, input.actor ?? null, input.subject_ref ?? null,
        input.message ?? null,
        input.reference ? JSON.stringify(input.reference) : null,
        input.duration_ms ?? null,
      ],
    );
  } catch {
    /* swallow · never break caller */
  }
}

/**
 * Upsert a subsystem's current status. Called by probes (see probes.ts).
 */
export async function upsertSubsystemStatus(
  subsystem: string,
  status: "green" | "yellow" | "red" | "unknown" | "not_implemented",
  reason: string,
  metrics: Record<string, unknown> = {},
  probeReference: Record<string, unknown> = {},
): Promise<void> {
  try {
    const pool = await getPool();
    if (!pool) return;
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO nex.founder_window_subsystem_status
           (subsystem, status, status_reason, last_ok_at, last_probe_at, probe_reference, metrics)
         VALUES ($1, $2, $3, $4, now(), $5::jsonb, $6::jsonb)
         ON CONFLICT (subsystem) DO UPDATE SET
           status = EXCLUDED.status,
           status_reason = EXCLUDED.status_reason,
           last_ok_at = CASE WHEN EXCLUDED.status = 'green' THEN now() ELSE nex.founder_window_subsystem_status.last_ok_at END,
           last_probe_at = now(),
           probe_reference = EXCLUDED.probe_reference,
           metrics = EXCLUDED.metrics`,
        [
          subsystem, status, reason,
          status === "green" ? new Date() : null,
          JSON.stringify(probeReference),
          JSON.stringify(metrics),
        ],
      );
    } finally {
      client.release();
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[founder-window] upsert-status failed:", String(err).slice(0, 200));
  }
}
