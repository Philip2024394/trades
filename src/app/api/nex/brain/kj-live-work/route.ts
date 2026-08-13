// GET /api/nex/brain/kj-live-work
//
// G6 · Truth Contract 2026-08-10 · Worker ↔ KJ live correlation.
//
// Answers: "which actual worker is working on which actual KJ right now?"
//
// The answer must come from POSITIVE evidence · never from
// "process is alive" or "worker_pool has a heartbeat". This endpoint
// does a JOIN between two authoritative sources:
//
//   1 · nex.knowledge_dump_jobs   (local Postgres · G1-truthful KJ lifecycle)
//         → tells us WHICH KJs are currently in production
//         → status IN ('claimed','processing')
//         → excludes the 10 preserved fixture KJs
//
//   2 · Supabase audit_log        (via brainStore().listAudit)
//         → tells us WHICH WORKER most recently touched each KJ
//         → filter by entity_id = kj.inbox_item_id
//         → the latest event's `actor` = the responsible worker
//         → freshness of the event age → is the worker actively working?
//
// Per-KJ freshness rules (mirror §5 R12 semantics):
//   · latest event age ≤ 60 s AND KJ still active
//        → state='working'   · known worker · fresh evidence
//   · latest event age > 60 s AND KJ still active
//        → state='stalled'   · known worker · evidence stale · KJ likely stuck
//   · no audit event ever seen for this inbox_item_id
//        → state='unknown_worker' · cannot say · evidence absent
//   · audit source unreachable
//        → state='unknown'   · source failure · never guess
//
// Never returns "worker X is working on KJ Y" without a matching
// audit_log row within the freshness window.

import { NextResponse } from "next/server";
import { withBrainRole } from "@/lib/nex/db/with-brain-role";
import { brainStore } from "@/lib/nex/brain/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FRESHNESS_MS = 60_000;   // ≤ 60 s = "working" · matches worker cycle stages

// G6 · The 10 preserved fixture KJs. Duplicated intentionally from
// scripts/prove-supervisor-review.ts, scripts/burnin-snapshot.mjs,
// src/app/api/nex/brain/warehouse/route.ts. Every drift makes this
// endpoint expose fixture KJs · keep all four lists aligned.
const PRESERVED_KJIDS: readonly string[] = [
  "46a8eb51-617c-404b-8237-6a515ad6125a",
  "56e1da78-6a97-461a-bc38-cc505d25e00a",
  "ab5835b8-05c8-485e-b1ef-399fe9a48b0a",
  "47e0cf43-5e4c-4d69-a509-59e232e141f1",
  "7fc668ef-cbbc-42a4-b2ef-16e1cde41680",
  "270865e6-f2ca-4fc0-8648-151417c85f64",
  "b1772902-7348-49cd-aed4-48d221ea2d69",
  "1e09c119-f9ed-4400-9dc7-722fc7ae223d",
  "6381641c-eb29-4007-8f3c-2942933cb62d",
  "7e1fc4f9-efb5-4892-8d55-51b347babe1c",
];

type LiveWorkItem = {
  kj_job_id:            string;
  inbox_item_id:        string | null;
  kj_status:            "queued" | "claimed" | "processing";
  kj_updated_at:        string;
  current_worker:       string | null;   // worker_type + host suffix · from actor
  current_actor:        string | null;   // exact actor string from audit
  last_event_action:    string | null;
  last_event_at:        string | null;
  last_event_age_ms:    number | null;
  state:                "working" | "stalled" | "unknown_worker" | "unknown";
  evidence_source:      string;
};

type ActiveKjRow = { job_id: string; inbox_item_id: string | null; status: string; updated_at: Date | string | null };

async function listActiveKjs(): Promise<{ ok: true; rows: ActiveKjRow[] } | { ok: false; error: string }> {
  try {
    const result = await withBrainRole(async (c) => {
      const r = await c.query(
        `SELECT job_id, inbox_item_id, status, updated_at
           FROM nex.knowledge_dump_jobs
          WHERE status IN ('queued','claimed','processing')
            AND job_id <> ALL($1::text[])
          ORDER BY updated_at DESC`,
        [PRESERVED_KJIDS as unknown as string[]],
      );
      return r.rows as ActiveKjRow[];
    });
    if (result === null) return { ok: false, error: "NEX_POSTGRES_URL not configured" };
    return { ok: true, rows: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET() {
  const nowMs = Date.now();
  const active = await listActiveKjs();
  if (!active.ok) {
    return NextResponse.json({
      ok: false,
      error: `active_kj_query_failed: ${active.error}`,
      generated_at: new Date(nowMs).toISOString(),
      freshness_budget_ms: FRESHNESS_MS,
      items: [],
    }, { status: 500 });
  }

  // For each active KJ · fetch the latest audit event by entity_id
  // (which is the inbox_item_id for the worker-stage events). One
  // audit call per KJ · read-only · fires in parallel.
  const store = brainStore();
  const items: LiveWorkItem[] = await Promise.all(
    active.rows.map(async (kj): Promise<LiveWorkItem> => {
      const updatedAt = kj.updated_at instanceof Date
        ? kj.updated_at.toISOString()
        : (kj.updated_at ?? new Date().toISOString());
      // No inbox_item_id · we cannot correlate to an audit event by
      // that key. Honest report: unknown_worker.
      if (!kj.inbox_item_id) {
        return {
          kj_job_id:         String(kj.job_id),
          inbox_item_id:     null,
          kj_status:         kj.status as LiveWorkItem["kj_status"],
          kj_updated_at:     updatedAt,
          current_worker:    null,
          current_actor:     null,
          last_event_action: null,
          last_event_at:     null,
          last_event_age_ms: null,
          state:             "unknown_worker",
          evidence_source:   "no inbox_item_id on KJ · cannot join to audit",
        };
      }
      try {
        const events = await store.listAudit({
          entity_id: kj.inbox_item_id,
          limit: 1,
        });
        if (!events || events.length === 0) {
          return {
            kj_job_id:         String(kj.job_id),
            inbox_item_id:     kj.inbox_item_id,
            kj_status:         kj.status as LiveWorkItem["kj_status"],
            kj_updated_at:     updatedAt,
            current_worker:    null,
            current_actor:     null,
            last_event_action: null,
            last_event_at:     null,
            last_event_age_ms: null,
            state:             "unknown_worker",
            evidence_source:   "no audit event for inbox_item_id · cannot say",
          };
        }
        const ev = events[0];
        const eventAt = ev.created_at ?? null;
        const eventAgeMs = eventAt ? nowMs - new Date(eventAt).getTime() : null;
        // Extract worker_type from actor (formats: "worker_type@pid" or
        // "worker:worker_type@pid"). Manager events use "manager" ·
        // report those as null current_worker · they are not a worker.
        const actor = ev.actor ?? "";
        let currentWorker: string | null = null;
        if (actor && actor !== "manager") {
          const stripped = actor.startsWith("worker:") ? actor.slice(7) : actor;
          const atIdx = stripped.indexOf("@");
          currentWorker = atIdx > 0 ? stripped.slice(0, atIdx) : stripped;
        }
        const isFresh = eventAgeMs !== null && eventAgeMs <= FRESHNESS_MS;
        return {
          kj_job_id:         String(kj.job_id),
          inbox_item_id:     kj.inbox_item_id,
          kj_status:         kj.status as LiveWorkItem["kj_status"],
          kj_updated_at:     updatedAt,
          current_worker:    currentWorker,
          current_actor:     actor || null,
          last_event_action: ev.action ?? null,
          last_event_at:     eventAt,
          last_event_age_ms: eventAgeMs,
          state:             isFresh ? "working" : "stalled",
          evidence_source:   "supabase.audit_log via brainStore().listAudit",
        };
      } catch (err) {
        return {
          kj_job_id:         String(kj.job_id),
          inbox_item_id:     kj.inbox_item_id,
          kj_status:         kj.status as LiveWorkItem["kj_status"],
          kj_updated_at:     updatedAt,
          current_worker:    null,
          current_actor:     null,
          last_event_action: null,
          last_event_at:     null,
          last_event_age_ms: null,
          state:             "unknown",
          evidence_source:   `audit source failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }),
  );

  // Roll-up · counts per state for HQ header consumption.
  const counts = {
    working:         items.filter((i) => i.state === "working").length,
    stalled:         items.filter((i) => i.state === "stalled").length,
    unknown_worker:  items.filter((i) => i.state === "unknown_worker").length,
    unknown:         items.filter((i) => i.state === "unknown").length,
  };

  return NextResponse.json({
    ok: true,
    generated_at:              new Date(nowMs).toISOString(),
    freshness_budget_ms:       FRESHNESS_MS,
    excludes_preserved_kjids:  PRESERVED_KJIDS.length,
    active_kj_count:           items.length,
    counts,
    items,
    sources: {
      active_kjs: "local_postgres_knowledge_dump_jobs",
      workers:    "supabase.audit_log via brainStore().listAudit",
    },
  });
}
