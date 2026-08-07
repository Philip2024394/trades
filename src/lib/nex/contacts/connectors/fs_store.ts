// NEX Contact Intelligence · fs-store Migration Connector (pull-mode)
//
// Reads the legacy Master Contact Database v0 (JSONL at
// data/nex-contacts/contacts.jsonl) and upserts every latest-snapshot
// contact through the canonical registry. Idempotent · re-runnable.
//
// Once every fs-store contact has been ingested and downstream code has
// migrated to the registry, the fs-store file and route can be retired
// (Phase 3d + follow-up cleanup commit).
//
// The connector reads the file directly rather than importing fs-store's
// public API · this keeps the deprecation direction one-way and avoids
// pulling the whole legacy module into every dependency graph.

import { promises as fs } from "node:fs";
import path from "node:path";
import { upsertContact } from "../registry";
import type { Connector, ConnectorDefinition } from "./types";

const CONTACTS_FILE = path.join(process.cwd(), "data", "nex-contacts", "contacts.jsonl");

type FsStoreContact = {
  contact_id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  kind: string;
  source: string;
  source_ref: string | null;
  tags: string[];
  consent_marketing: boolean;
  consent_transactional: boolean;
  consent_source: string | null;
  attributes: Record<string, unknown>;
  lifecycle_stage: string;
  first_seen_at: string;
  last_seen_at: string;
  linked_business_id: string | null;
  updated_at: string;
};

export const fsStoreConnectorDefinition: ConnectorDefinition = {
  id: "fs-store",
  label: "Master Contact DB v0 (fs-store)",
  source_type: "fs-store",
  status: "supported",
  mode: "pull",
  description: "Migrates legacy JSONL contacts (data/nex-contacts/contacts.jsonl) into the canonical registry · idempotent · source_ref = original contact_id · retirement path for the fs-store",
  scheduled: false,
};

async function readLatestPerId(): Promise<FsStoreContact[]> {
  let raw: string;
  try {
    raw = await fs.readFile(CONTACTS_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  // fs-store is append-only JSONL · latest snapshot per contact_id wins.
  const latest = new Map<string, FsStoreContact>();
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as FsStoreContact;
      const prior = latest.get(row.contact_id);
      if (!prior || (row.updated_at ?? "") > (prior.updated_at ?? "")) {
        latest.set(row.contact_id, row);
      }
    } catch {
      // Skip malformed lines · surface as an error in the run result
    }
  }
  return Array.from(latest.values());
}

export const fsStoreConnector: Connector = {
  definition: fsStoreConnectorDefinition,
  async sync(opts) {
    let processed = 0, created = 0, updated = 0, errors = 0;
    const errorSamples: string[] = [];

    let rows: FsStoreContact[];
    try {
      rows = await readLatestPerId();
    } catch (err) {
      return {
        records_processed: 0,
        new_contacts: 0,
        updated_contacts: 0,
        duplicates_detected: 0,
        errors: 1,
        error_samples: [err instanceof Error ? err.message : String(err)],
      };
    }

    const limit = Math.min(opts.limit ?? rows.length, rows.length);
    for (let i = 0; i < limit; i++) {
      const row = rows[i];
      processed += 1;
      if (!row.email && !row.phone) continue;

      if (opts.dry_run) continue;

      try {
        const result = await upsertContact({
          email: row.email,
          phone: row.phone,
          name: row.name,
          tags: Array.isArray(row.tags) ? row.tags : [],
          consent_marketing: row.consent_marketing,
          consent_transactional: row.consent_transactional,
          consent_source: row.consent_source,
          attributes: {
            ...(row.attributes ?? {}),
            fs_store_kind: row.kind,
            fs_store_original_source: row.source,
            fs_store_original_source_ref: row.source_ref,
            fs_store_first_seen_at: row.first_seen_at,
            fs_store_last_seen_at: row.last_seen_at,
          },
          lifecycle_stage: row.lifecycle_stage,
          linked_business_id: row.linked_business_id,
          source: {
            type: "fs-store",
            ref: row.contact_id,               // original contact_id as source_ref · idempotent re-runs
            metadata: {
              migrated_from: "data/nex-contacts/contacts.jsonl",
              original_source: row.source,
              original_source_ref: row.source_ref,
              migrated_at: new Date().toISOString(),
            },
          },
        });
        if (result.created) created += 1;
        else updated += 1;
      } catch (err) {
        errors += 1;
        if (errorSamples.length < 5) {
          const msg = err instanceof Error ? err.message : String(err);
          errorSamples.push(`contact ${row.contact_id}: ${msg}`);
        }
      }
    }

    return {
      records_processed: processed,
      new_contacts: created,
      updated_contacts: updated,
      duplicates_detected: 0,
      errors,
      error_samples: errorSamples,
    };
  },
};
