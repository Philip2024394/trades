// src/app/api/nex/agent/capability/attestations/route.ts
//
// NEX1 · MASTER CODE AI · attestation reader.
//
// Reads competency_events with evidence_kind='mentor_promotion' from the existing
// nex_agent.competency_events ledger. Returns any independent evaluations Master AI
// Engineer + Claude have written into the ledger while grading NEX1's real work.
//
// This route READS ONLY. Attestation events are written via the existing
// competency grantCompetency() path when a mentor grades a real NEX1 attempt.
// The Capability Ladder UI (LEFT workstation panel) consumes this endpoint to
// populate the "MASTER CODE AI · CONFIRMED / AWAITING" slots.

import { NextResponse } from "next/server";
import { Client } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL
      ?? process.env.NEX_POSTGRES_URL
      ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

interface AttestationEvent {
  event_id: string;
  recorded_by: string;
  recorded_at: string;
  reason: string;
  competency_id: string;
  domain_key: string | null;
}

interface AttestationSummary {
  master_ai: {
    attested: boolean;
    latest_at: string | null;
    events_count: number;
    latest_reason: string | null;
  };
  claude: {
    attested: boolean;
    latest_at: string | null;
    events_count: number;
    latest_reason: string | null;
  };
  raw: AttestationEvent[];
}

export async function GET() {
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  try {
    await c.connect();
    const r = await c.query<AttestationEvent>(
      `SELECT ev.event_id, ev.recorded_by, ev.recorded_at::text, ev.reason,
              ev.competency_id, cp.domain_key
         FROM nex_agent.competency_events ev
         LEFT JOIN nex_agent.competencies cp ON cp.competency_id = ev.competency_id
        WHERE ev.evidence_kind = 'mentor_promotion'
        ORDER BY ev.recorded_at DESC
        LIMIT 100`,
    );
    const events = r.rows;

    const masterAiEvents = events.filter((e) =>
      /master[-_ ]?ai|master ai engineer/i.test(e.recorded_by),
    );
    const claudeEvents = events.filter((e) =>
      /^claude|claude reviewer|independent reviewer/i.test(e.recorded_by),
    );

    const summary: AttestationSummary = {
      master_ai: {
        attested: masterAiEvents.length > 0,
        latest_at: masterAiEvents[0]?.recorded_at ?? null,
        events_count: masterAiEvents.length,
        latest_reason: masterAiEvents[0]?.reason ?? null,
      },
      claude: {
        attested: claudeEvents.length > 0,
        latest_at: claudeEvents[0]?.recorded_at ?? null,
        events_count: claudeEvents.length,
        latest_reason: claudeEvents[0]?.reason ?? null,
      },
      raw: events,
    };

    return NextResponse.json(
      { ok: true, attestations: summary },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: (err as Error).message.slice(0, 200),
        attestations: {
          master_ai: { attested: false, latest_at: null, events_count: 0, latest_reason: null },
          claude: { attested: false, latest_at: null, events_count: 0, latest_reason: null },
          raw: [],
        },
      },
      { status: 200 },
    );
  } finally {
    try { await c.end(); } catch { /* ignore */ }
  }
}
