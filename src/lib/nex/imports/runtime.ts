// NEX Data Import Wizard · session runtime
//
// In-memory session store · pipeline orchestration. Every import flows:
//
//   createSession(file) → uploaded
//   updateMapping(id, overrides) → mapped
//   dryRun(id) → dry_ran (returns DryRunSummary)
//   commit(id) → committing → committed (returns ImportReport)
//
// Sessions live in-process (Phase 3b.6b.1 · dies with server restart).
// Phase 3b.6c persists to nex.import_sessions for durable resume.
//
// Doctrine invariants:
//   · upsertContact() is the only write path · no bulk shortcut
//   · registry compliance ratchet still applies at commit time
//   · dry-run is available always · commit does not require it (headless CLI)
//     but the panel enforces preview-then-commit
//
// Doctrine: constitution_nex_data_import_wizard_2026_08_07.md

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { upsertContact } from "@/lib/nex/contacts/registry";
import { detectFormat, parse } from "./formats";
import { applyMappingToRow, autoMapping, headerSignature, overrideMapping } from "./mapping";
import { predictAgainstRegistry } from "./predictions";
import { validateRows } from "./validation";
import { bumpProfileUsage, createMappingProfile } from "./profiles";
import type {
  ColumnMapping, DryRunSummary, FileFormat, ImportReport, ImportSession, MappingTarget,
} from "./types";

// ── Session store ──────────────────────────────────────────────────
const SESSIONS = new Map<string, ImportSession>();
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;     // 2 hours idle → GC

function gc(): void {
  const now = Date.now();
  for (const [id, s] of SESSIONS.entries()) {
    if (now - new Date(s.updated_at).getTime() > SESSION_TTL_MS) SESSIONS.delete(id);
  }
}

/** Public session view: strips internal `_raw_rows`. */
function view(s: ImportSession): Omit<ImportSession, "_raw_rows"> {
  const { _raw_rows: _drop, ...rest } = s;
  void _drop;
  return rest;
}

// ── Session lifecycle ──────────────────────────────────────────────

export type CreateSessionInput = {
  content: string;
  file_name?: string | null;
  admin_actor?: string | null;
  format_hint?: FileFormat;                    // optional override of auto-detection
};

export function createSession(input: CreateSessionInput): Omit<ImportSession, "_raw_rows"> {
  gc();
  const session_id = randomUUID();
  const now = new Date().toISOString();
  const format = input.format_hint ?? detectFormat(input.content, input.file_name);
  let rows: string[][];
  try {
    rows = parse(input.content, format);
  } catch (err) {
    const failed: ImportSession = {
      session_id,
      admin_actor: input.admin_actor ?? null,
      created_at: now,
      updated_at: now,
      file_name: input.file_name ?? null,
      format,
      header: [],
      header_signature: "",
      row_count: 0,
      mapping: {},
      mapping_source: "auto",
      state: "failed",
      dry_run: null,
      final_report: null,
      error: err instanceof Error ? err.message : String(err),
    };
    SESSIONS.set(session_id, failed);
    return view(failed);
  }
  if (rows.length < 2) {
    const failed: ImportSession = {
      session_id, admin_actor: input.admin_actor ?? null,
      created_at: now, updated_at: now,
      file_name: input.file_name ?? null,
      format, header: [], header_signature: "", row_count: 0,
      mapping: {}, mapping_source: "auto",
      state: "failed", dry_run: null, final_report: null,
      error: "file needs a header row + at least one data row",
    };
    SESSIONS.set(session_id, failed);
    return view(failed);
  }

  const header = rows[0].map((h) => h.trim());
  const mapping = autoMapping(header);
  const sig = headerSignature(header);

  const session: ImportSession = {
    session_id,
    admin_actor: input.admin_actor ?? null,
    created_at: now, updated_at: now,
    file_name: input.file_name ?? null,
    format,
    header,
    header_signature: sig,
    row_count: rows.length - 1,
    mapping,
    mapping_source: "auto",
    state: "uploaded",
    dry_run: null,
    final_report: null,
    error: null,
    _raw_rows: rows,
  };
  SESSIONS.set(session_id, session);
  return view(session);
}

export function getSession(session_id: string): Omit<ImportSession, "_raw_rows"> | null {
  const s = SESSIONS.get(session_id);
  return s ? view(s) : null;
}

export function updateMapping(session_id: string, overrides: Partial<Record<string, MappingTarget>>, sourceLabel?: "manual" | { profile_id: string }): Omit<ImportSession, "_raw_rows"> | null {
  const s = SESSIONS.get(session_id);
  if (!s) return null;
  s.mapping = overrideMapping(s.mapping, overrides as ColumnMapping);
  s.mapping_source = sourceLabel ?? "manual";
  s.state = "mapped";
  s.updated_at = new Date().toISOString();
  s.dry_run = null;                              // invalidate stale dry-run
  return view(s);
}

// ── Dry-run · combines validation + predictions ───────────────────

export async function dryRun(session_id: string): Promise<DryRunSummary | null> {
  const s = SESSIONS.get(session_id);
  if (!s || !s._raw_rows) return null;
  const started = Date.now();
  const header = s.header;
  const dataRows = s._raw_rows.slice(1);

  const validation = validateRows(header, dataRows, s.mapping);
  const predictions = await predictAgainstRegistry(header, dataRows, s.mapping);

  // Estimated duration: measure the per-row prediction cost + upsert overhead.
  // Naive: 8ms per would_create + 12ms per would_update (empirically ~ what
  // we see against local postgres); refined once telemetry lands.
  const estimated = predictions.would_create * 8 + predictions.would_update * 12;

  // Preview: first 5 mapped rows.
  const preview: Record<string, string>[] = [];
  for (let i = 0; i < Math.min(5, dataRows.length); i++) {
    const { mapped, attributes } = applyMappingToRow(header, dataRows[i], s.mapping);
    const rec: Record<string, string> = {};
    for (const [k, v] of Object.entries(mapped)) rec[k] = String(v);
    for (const [k, v] of Object.entries(attributes)) rec[`attr:${k}`] = v;
    preview.push(rec);
  }

  const summary: DryRunSummary = {
    records_processed: dataRows.length,
    would_create: predictions.would_create,
    would_update: predictions.would_update,
    duplicate_predictions: predictions.duplicate_predictions,
    invalid_rows: validation.invalid_rows,
    in_file_duplicates: validation.in_file_duplicates,
    empty_rows: validation.empty_rows,
    compliance_warnings: predictions.compliance_warnings,
    unknown_columns: validation.unknown_columns,
    estimated_duration_ms: estimated,
    preview_rows: preview,
  };
  s.dry_run = summary;
  s.state = "dry_ran";
  s.updated_at = new Date().toISOString();
  void started;
  return summary;
}

// ── Commit · real import through upsertContact() ──────────────────

export type CommitOptions = {
  save_as_profile?: { label: string; description?: string | null };
  apply_profile_id?: string;                     // if this session used a saved profile · bump usage
};

export async function commit(session_id: string, opts: CommitOptions = {}): Promise<ImportReport | null> {
  const s = SESSIONS.get(session_id);
  if (!s || !s._raw_rows) return null;
  s.state = "committing";
  s.updated_at = new Date().toISOString();
  const startedAt = new Date();
  const startedMs = Date.now();

  const header = s.header;
  const dataRows = s._raw_rows.slice(1);
  let created = 0, updated = 0, skipped = 0, errors = 0;
  const errorSamples: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const rowIndex = i + 1;
    const { mapped, attributes } = applyMappingToRow(header, dataRows[i], s.mapping);
    const email = mapped.email ?? null;
    const phone = mapped.phone ?? null;
    if (!email && !phone) { skipped += 1; continue; }

    const tags = mapped.tags ? mapped.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
    const tradeCategories = mapped.trade_categories ? mapped.trade_categories.split(",").map((t) => t.trim()).filter(Boolean) : undefined;

    try {
      const r = await upsertContact({
        email, phone,
        name: mapped.name ?? null,
        company: mapped.company ?? null,
        country: mapped.country ?? null,
        region: mapped.region ?? null,
        lifecycle_stage: mapped.lifecycle_stage ?? undefined,
        tags,
        trade_categories: tradeCategories,
        attributes,
        source: {
          type: s.format,                       // "csv" | "tsv" · Registry-visible source type
          ref: `${s.session_id}:${rowIndex}`,   // unique per import · not row-hash (we allow re-imports)
          metadata: {
            wizard_session_id: s.session_id,
            file_name: s.file_name,
            row_index: rowIndex,
            admin_actor: s.admin_actor,
            imported_at: new Date().toISOString(),
          },
        },
      });
      if (r.created) created += 1;
      else updated += 1;
    } catch (err) {
      errors += 1;
      if (errorSamples.length < 10) {
        errorSamples.push(`row ${rowIndex}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const finishedAt = new Date();
  const report: ImportReport = {
    import_id: s.session_id,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: Date.now() - startedMs,
    file_name: s.file_name,
    format: s.format,
    admin_actor: s.admin_actor,
    records_processed: dataRows.length,
    created, updated,
    skipped_no_identifier: skipped,
    errors,
    error_samples: errorSamples,
    duplicate_suggestions_written: 0,           // Phase 3c: surface from upsertContact
    mapping_used: s.mapping,
    mapping_profile_id: opts.apply_profile_id ?? null,
  };
  s.final_report = report;
  s.state = "committed";
  s.updated_at = finishedAt.toISOString();

  // Persist mapping-profile usage bump
  if (opts.apply_profile_id) {
    await bumpProfileUsage(opts.apply_profile_id).catch(() => {});
  }
  // Save as new mapping profile if requested
  if (opts.save_as_profile) {
    await createMappingProfile({
      label: opts.save_as_profile.label,
      description: opts.save_as_profile.description ?? null,
      header_signature: s.header_signature,
      mapping: s.mapping,
      format_hint: s.format,
      created_by: s.admin_actor,
    }).catch(() => {});
  }

  // Audit event · same shape as connector.sync so the panel's History surface picks it up
  try {
    const store = getStorage();
    await store.save(COLLECTIONS.events, {
      event_id: randomUUID(),
      event_type: "contacts.connector.sync",
      source: "nex-imports-runtime",
      actor_id: s.admin_actor ?? null,
      timestamp: finishedAt.toISOString(),
      business_id: null,
      related_department: "contact-intelligence",
      related_brain: null,
      related_job: null,
      related_contact: null,
      outcome: errors === 0 ? "ok" : (errors < dataRows.length ? "partial" : "failed"),
      payload: {
        connector: s.format,                    // "csv" · "tsv" · UI can filter
        triggered_by: "manual",
        records_processed: report.records_processed,
        new_contacts: report.created,
        updated_contacts: report.updated,
        duplicates_detected: report.duplicate_suggestions_written,
        errors: report.errors,
        error_samples: errorSamples.slice(0, 5),
        duration_ms: report.duration_ms,
        dry_run: false,
        source_label: s.file_name,
        skipped_no_email: skipped,
        wizard_session_id: s.session_id,
        mapping_profile_id: opts.apply_profile_id ?? null,
      },
      reversible: false,
      reverse_of: null,
      supersedes: null,
    });
  } catch {
    // never mask commit result
  }

  return report;
}
