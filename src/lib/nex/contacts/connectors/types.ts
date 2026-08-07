// NEX Contact Intelligence · Connector shared types
//
// A connector is a long-lived sync surface — never a one-time bulk import.
// Every connector calls only registry.upsertContact(). No connector writes
// directly to the contacts tables. The registry remains the single authority.
//
// Doctrine: constitution_nex_contact_intelligence_registry_2026_08_07.md

export type ConnectorStatus =
  | "supported"                  // fully wired · admin can trigger syncs
  | "planned"                    // roadmap item · not yet built
  | "disabled";                  // temporarily off (e.g. rate-limited by source)

export type ConnectorDefinition = {
  id: string;                    // "trades" · "newsletter" · "contact-form" · "manual" · "csv" · "crm"
  label: string;                 // "Trades Directory" · human-facing name
  source_type: string;           // matches the value written to contact_sources.source_type
  status: ConnectorStatus;
  description: string;
  scheduled: false | { cron: string };   // false = admin-triggered only · future: cron support
};

export type ConnectorRunResult = {
  connector_id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  triggered_by: "manual" | "cron" | "webhook";
  records_processed: number;
  new_contacts: number;              // registry.upsertContact returned created=true
  updated_contacts: number;          // registry.upsertContact returned created=false (matched existing)
  duplicates_detected: number;       // TODO Phase 3c: registry surfaces dedup suggestions
  errors: number;
  error_samples: string[];           // first N error messages · never a full stack
  outcome: "ok" | "partial" | "failed";
};

/**
 * Every connector implements this. `sync()` returns the run result;
 * the shared runner in `_runner.ts` wraps timing + audit logging.
 */
export interface Connector {
  readonly definition: ConnectorDefinition;
  sync(input: { triggered_by: ConnectorRunResult["triggered_by"]; limit?: number; dry_run?: boolean }): Promise<Omit<ConnectorRunResult, "connector_id" | "started_at" | "finished_at" | "duration_ms" | "triggered_by" | "outcome">>;
}
