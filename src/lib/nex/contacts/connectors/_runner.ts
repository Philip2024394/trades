// NEX Contact Intelligence · connector runner
//
// Wraps every connector.sync() with:
//   · start / finish timing
//   · outcome classification (ok · partial · failed)
//   · audit event to nex.events (contacts.connector.sync)
//
// Every consumer (API route · cron · webhook) should call runConnector(...)
// rather than the connector's `.sync()` directly · this keeps the audit
// trail consistent.

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import type { Connector, ConnectorRunResult } from "./types";

export async function runConnector(
  connector: Connector,
  opts: { triggered_by?: ConnectorRunResult["triggered_by"]; limit?: number; dry_run?: boolean } = {},
): Promise<ConnectorRunResult> {
  const startedAt = new Date();
  const triggeredBy = opts.triggered_by ?? "manual";
  let result: ConnectorRunResult;

  try {
    const inner = await connector.sync({
      triggered_by: triggeredBy,
      limit: opts.limit,
      dry_run: opts.dry_run,
    });
    const finishedAt = new Date();
    result = {
      connector_id: connector.definition.id,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      triggered_by: triggeredBy,
      records_processed: inner.records_processed,
      new_contacts: inner.new_contacts,
      updated_contacts: inner.updated_contacts,
      duplicates_detected: inner.duplicates_detected,
      errors: inner.errors,
      error_samples: inner.error_samples,
      outcome: inner.errors === 0 ? "ok" : (inner.errors < inner.records_processed ? "partial" : "failed"),
    };
  } catch (err) {
    const finishedAt = new Date();
    const message = err instanceof Error ? err.message : String(err);
    result = {
      connector_id: connector.definition.id,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      triggered_by: triggeredBy,
      records_processed: 0,
      new_contacts: 0,
      updated_contacts: 0,
      duplicates_detected: 0,
      errors: 1,
      error_samples: [message],
      outcome: "failed",
    };
  }

  // Audit event · same pattern as email runtime
  try {
    const store = getStorage();
    await store.save(COLLECTIONS.events, {
      event_id: randomUUID(),
      event_type: "contacts.connector.sync",
      source: "nex-contacts-runtime",
      actor_id: null,
      timestamp: result.finished_at,
      business_id: null,
      related_department: "contact-intelligence",
      related_brain: null,
      related_job: null,
      related_contact: null,
      outcome: result.outcome,
      payload: {
        connector: result.connector_id,
        triggered_by: result.triggered_by,
        records_processed: result.records_processed,
        new_contacts: result.new_contacts,
        updated_contacts: result.updated_contacts,
        duplicates_detected: result.duplicates_detected,
        errors: result.errors,
        error_samples: result.error_samples.slice(0, 5),
        duration_ms: result.duration_ms,
        dry_run: !!opts.dry_run,
      },
      reversible: false,
      reverse_of: null,
      supersedes: null,
    });
  } catch {
    // Audit write shouldn't mask the connector result · swallow.
  }

  return result;
}
