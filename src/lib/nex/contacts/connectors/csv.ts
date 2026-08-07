// NEX Contact Intelligence · CSV Connector (upload-mode)
//
// Admin uploads a CSV. The parser is header-aware and RFC-4180-compatible
// enough for the common cases (quoted values · escaped double-quotes ·
// LF or CRLF line endings · no line-continuations). Column mapping is
// convention-based:
//
//   Standard columns (recognised · mapped to canonical fields):
//     email         (required · rows without email are skipped)
//     name
//     phone
//     company
//     country
//     region
//     lifecycle_stage
//     tags          (comma-separated in the cell)
//     trade_categories (comma-separated in the cell)
//
//   Any other column becomes an entry in attributes[column_name].
//
// dry_run: parse + count without upserting. Same shape of result so the
// panel can preview a run before committing.
//
// Every row upsert goes through registry.upsertContact() · the CSV
// connector never touches contacts tables directly.

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { upsertContact } from "../registry";
import type { ConnectorDefinition } from "./types";

export const csvConnectorDefinition: ConnectorDefinition = {
  id: "csv",
  label: "CSV Import (Wizard foundation)",
  source_type: "csv",
  status: "supported",
  mode: "upload",
  description: "Foundation of the NEX Data Import Runtime · header + email required · standard columns auto-mapped · unknown columns → attributes · dry-run counts · source_ref = row-hash for per-file idempotency. Wizard v1 (format detect · column mapping UI · duplicate + compliance predictions in dry-run · TSV/XLSX/JSON support) lands as Phase 3b.6b. Doctrine: constitution_nex_data_import_wizard_2026_08_07.md",
  scheduled: false,
};

// ── CSV parser (small, dependency-free) ──────────────────────────────
// Handles: quoted values, escaped double-quotes ("" inside a quoted field),
// LF or CRLF line endings. Does NOT support: line continuations, custom
// quoting chars, escape sequences beyond "".

export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === ",") { row.push(field); field = ""; i += 1; continue; }
    if (ch === "\r") { i += 1; continue; }        // ignore CR · newline handled by LF
    if (ch === "\n") {
      row.push(field); field = "";
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // Flush trailing field / row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.length > 0)) rows.push(row);
  }
  return rows;
}

const STANDARD_COLUMNS = new Set([
  "email", "name", "phone", "company", "country", "region",
  "lifecycle_stage", "tags", "trade_categories",
]);

/**
 * Row-hash produces a stable source_ref per row so re-uploads of the same
 * CSV don't create duplicate source_history rows.
 */
function rowHash(header: string[], values: string[]): string {
  // Simple concatenation · admin CSVs typically don't need cryptographic
  // uniqueness; a stable id per (header sequence, values) is enough for
  // the source_ref idempotency contract.
  const parts = header.map((h, i) => `${h}=${(values[i] ?? "").trim()}`);
  return parts.join("|").slice(0, 500);   // cap length
}

export type CsvImportResult = {
  records_processed: number;
  new_contacts: number;
  updated_contacts: number;
  skipped_no_email: number;
  errors: number;
  error_samples: string[];
  duration_ms: number;
  dry_run: boolean;
  source_label: string | null;
  header: string[];
  preview: Array<Record<string, string>>;  // first 5 mapped rows for admin sanity-check
};

export async function processCsv(input: {
  csv: string;
  dry_run?: boolean;
  source_label?: string | null;             // e.g. filename · gets written into source_metadata
  admin_actor?: string;
}): Promise<CsvImportResult> {
  const started = Date.now();
  const rows = parseCsv(input.csv);
  const result: CsvImportResult = {
    records_processed: 0, new_contacts: 0, updated_contacts: 0,
    skipped_no_email: 0, errors: 0, error_samples: [],
    duration_ms: 0, dry_run: !!input.dry_run,
    source_label: input.source_label ?? null,
    header: [], preview: [],
  };

  if (rows.length < 2) {
    result.errors = 1;
    result.error_samples.push("CSV needs a header row + at least one data row");
    result.duration_ms = Date.now() - started;
    await writeAudit(result, input.admin_actor);
    return result;
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  result.header = header;
  const emailIdx = header.indexOf("email");
  if (emailIdx < 0) {
    result.errors = 1;
    result.error_samples.push("CSV must include an `email` column · other columns are optional");
    result.duration_ms = Date.now() - started;
    await writeAudit(result, input.admin_actor);
    return result;
  }

  for (let rIdx = 1; rIdx < rows.length; rIdx++) {
    const values = rows[rIdx];
    result.records_processed += 1;

    // Build a keyed object from header
    const mapped: Record<string, string> = {};
    for (let cIdx = 0; cIdx < header.length; cIdx++) {
      mapped[header[cIdx]] = (values[cIdx] ?? "").trim();
    }
    if (result.preview.length < 5) result.preview.push(mapped);

    const email = mapped.email;
    if (!email) { result.skipped_no_email += 1; continue; }

    if (result.dry_run) continue;

    // Split standard vs unknown columns · unknown → attributes
    const attributes: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(mapped)) {
      if (!STANDARD_COLUMNS.has(k) && v) attributes[k] = v;
    }

    const tags = mapped.tags ? mapped.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
    const tradeCategories = mapped.trade_categories ? mapped.trade_categories.split(",").map((t) => t.trim()).filter(Boolean) : undefined;

    try {
      const upsert = await upsertContact({
        email,
        phone: mapped.phone || null,
        name: mapped.name || null,
        company: mapped.company || null,
        country: mapped.country || null,
        region: mapped.region || null,
        lifecycle_stage: mapped.lifecycle_stage || undefined,
        tags,
        trade_categories: tradeCategories,
        attributes,
        source: {
          type: "csv",
          ref: rowHash(header, values),
          metadata: {
            source_label: input.source_label ?? "csv-upload",
            admin_actor: input.admin_actor ?? "unknown",
            row_index: rIdx,
            imported_at: new Date().toISOString(),
          },
        },
      });
      if (upsert.created) result.new_contacts += 1;
      else result.updated_contacts += 1;
    } catch (err) {
      result.errors += 1;
      if (result.error_samples.length < 5) {
        const msg = err instanceof Error ? err.message : String(err);
        result.error_samples.push(`row ${rIdx}: ${msg}`);
      }
    }
  }

  result.duration_ms = Date.now() - started;
  await writeAudit(result, input.admin_actor);
  return result;
}

async function writeAudit(r: CsvImportResult, adminActor: string | undefined): Promise<void> {
  try {
    const store = getStorage();
    await store.save(COLLECTIONS.events, {
      event_id: randomUUID(),
      event_type: "contacts.connector.sync",
      source: "nex-contacts-runtime",
      actor_id: adminActor ?? null,
      timestamp: new Date().toISOString(),
      business_id: null,
      related_department: "contact-intelligence",
      related_brain: null,
      related_job: null,
      related_contact: null,
      outcome: r.errors === 0 ? "ok" : (r.errors < r.records_processed ? "partial" : "failed"),
      payload: {
        connector: "csv",
        triggered_by: "manual",
        records_processed: r.records_processed,
        new_contacts: r.new_contacts,
        updated_contacts: r.updated_contacts,
        duplicates_detected: 0,
        errors: r.errors,
        error_samples: r.error_samples,
        duration_ms: r.duration_ms,
        dry_run: r.dry_run,
        source_label: r.source_label,
        skipped_no_email: r.skipped_no_email,
      },
      reversible: false,
      reverse_of: null,
      supersedes: null,
    });
  } catch {
    // never mask the CSV result
  }
}
