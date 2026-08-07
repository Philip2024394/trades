// GET /api/nex/contacts/connectors — connector roster + per-connector last run
//
// Feeds the Connectors section of the Communications Centre panel.
// For each connector we return:
//   · definition (id · label · status · description · scheduled)
//   · built (true = actually implemented, false = planned)
//   · last_run (most recent contacts.connector.sync event from nex.events)
//   · total_runs (all-time count)
//   · total_records_processed (all-time · from audit events)
//
// Uses the storage layer for aggregate reads (works on jsonl and postgres).

import { NextResponse } from "next/server";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { allDefinitions } from "@/lib/nex/contacts/connectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncEvent = {
  event_id?: string;
  event_type?: string;
  timestamp?: string;
  outcome?: string;
  payload?: {
    connector?: string;
    triggered_by?: string;
    records_processed?: number;
    new_contacts?: number;
    updated_contacts?: number;
    duplicates_detected?: number;
    errors?: number;
    error_samples?: string[];
    duration_ms?: number;
    dry_run?: boolean;
  };
};

export async function GET() {
  const store = getStorage();
  // Oversample recent events; filter to connector-sync events in memory.
  // (Storage query interface doesn't expose prefix filters yet.)
  const rawEvents = await store.query<SyncEvent>(COLLECTIONS.events, {
    limit: 2000,
    order_dir: "desc",
  });
  const syncEvents = rawEvents.filter((e) => e.event_type === "contacts.connector.sync");

  const perConnector: Record<string, { last: SyncEvent | null; total_runs: number; total_records: number }> = {};
  for (const e of syncEvents) {
    const id = e.payload?.connector;
    if (!id) continue;
    if (!perConnector[id]) perConnector[id] = { last: null, total_runs: 0, total_records: 0 };
    perConnector[id].total_runs += 1;
    perConnector[id].total_records += Number(e.payload?.records_processed ?? 0);
    if (!perConnector[id].last || (e.timestamp ?? "") > (perConnector[id].last!.timestamp ?? "")) {
      perConnector[id].last = e;
    }
  }

  const connectors = allDefinitions().map((def) => {
    const s = perConnector[def.id];
    return {
      ...def,
      last_run: s?.last ?? null,
      total_runs: s?.total_runs ?? 0,
      total_records_processed: s?.total_records ?? 0,
    };
  });

  return NextResponse.json({
    ok: true,
    connectors,
    generated_at: new Date().toISOString(),
  });
}
