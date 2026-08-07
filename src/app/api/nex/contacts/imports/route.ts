// GET /api/nex/contacts/imports — recent import runs
//
// Feeds the Imports section of the Communications Centre panel. Reads
// contacts.connector.sync events from nex.events (via storage layer),
// returns the last N with the fields Philip's spec calls out:
//   file name · import source · started · completed · duration ·
//   records processed · created · updated · skipped · failed ·
//   duplicate suggestions
//
// Query params:
//   limit    · default 25 · max 200
//   connector · optional filter (id) — e.g. "csv" or "trades"

import { NextResponse } from "next/server";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";

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
    source_label?: string | null;
    skipped_no_email?: number;
    admin_actor?: string;
  };
};

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(1, Number(q.get("limit") ?? 25)), 200);
  const connectorFilter = q.get("connector");

  const store = getStorage();
  const raw = await store.query<SyncEvent>(COLLECTIONS.events, {
    limit: 2000,
    order_dir: "desc",
  });
  const rows = raw
    .filter((e) => e.event_type === "contacts.connector.sync")
    .filter((e) => !connectorFilter || e.payload?.connector === connectorFilter)
    .slice(0, limit);

  return NextResponse.json({
    ok: true,
    total_returned: rows.length,
    imports: rows.map((e) => ({
      event_id: e.event_id ?? null,
      connector: e.payload?.connector ?? "unknown",
      file_name: e.payload?.source_label ?? null,
      admin_actor: e.payload?.admin_actor ?? null,
      triggered_by: e.payload?.triggered_by ?? null,
      dry_run: !!e.payload?.dry_run,
      started_at: e.timestamp ?? null,
      duration_ms: e.payload?.duration_ms ?? 0,
      records_processed: e.payload?.records_processed ?? 0,
      created: e.payload?.new_contacts ?? 0,
      updated: e.payload?.updated_contacts ?? 0,
      skipped_no_email: e.payload?.skipped_no_email ?? 0,
      errors: e.payload?.errors ?? 0,
      duplicate_suggestions: e.payload?.duplicates_detected ?? 0,
      outcome: e.outcome ?? "unknown",
      error_samples: e.payload?.error_samples ?? [],
    })),
    generated_at: new Date().toISOString(),
  });
}
