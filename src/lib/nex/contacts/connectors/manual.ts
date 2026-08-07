// NEX Contact Intelligence · Manual Contact Connector (push-mode)
//
// Admin-added contacts via HQ · every call routes through the registry
// with source_type = "manual". Every field the admin provides overrides
// the registry state EXCEPT compliance state (the registry's one-way
// ratchet still applies — a manual create cannot un-unsubscribe someone).
//
// Push-mode: no admin sync trigger. Callers (HQ form · admin scripts ·
// future CLI) invoke `recordContactManually(...)` directly.

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { upsertContact } from "../registry";
import type { ContactUpsertInput } from "../types";
import type { ConnectorDefinition } from "./types";

export const manualConnectorDefinition: ConnectorDefinition = {
  id: "manual",
  label: "Manual Contact Entry",
  source_type: "manual",
  status: "supported",
  mode: "push",
  description: "Admin-added contacts via HQ · every insert routes through upsertContact() with the admin actor id captured in source metadata · compliance ratchet still applies",
  scheduled: false,
};

export type ManualEntryInput = Omit<ContactUpsertInput, "source"> & {
  admin_actor?: string;              // opt · id / name of the admin who added the contact
  entry_note?: string;               // opt · human-authored note about why this contact was added
};

export type ManualEntryResult =
  | { ok: true; contact_id: string; created: boolean; source_ref: string }
  | { ok: false; error: string };

/**
 * Add or update a contact from the admin surface.
 * The admin_actor and note become part of the source_metadata trail.
 */
export async function recordContactManually(input: ManualEntryInput): Promise<ManualEntryResult> {
  if (!input.email && !input.phone) return { ok: false, error: "email or phone required" };
  const sourceRef = randomUUID();                       // one source row per admin insert
  const startedMs = Date.now();

  let ok = true;
  let contactId = "";
  let created = false;
  let errorMsg: string | null = null;

  try {
    const result = await upsertContact({
      ...input,
      source: {
        type: "manual",
        ref: sourceRef,
        metadata: {
          admin_actor: input.admin_actor ?? "unknown",
          entry_note: input.entry_note ?? null,
          entered_at: new Date().toISOString(),
        },
      },
    });
    contactId = result.contact_id;
    created = result.created;
  } catch (err) {
    ok = false;
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  // Audit event · same shape as other connector runs
  try {
    const store = getStorage();
    await store.save(COLLECTIONS.events, {
      event_id: randomUUID(),
      event_type: "contacts.connector.sync",
      source: "nex-contacts-runtime",
      actor_id: input.admin_actor ?? null,
      timestamp: new Date().toISOString(),
      business_id: null,
      related_department: "contact-intelligence",
      related_brain: null,
      related_job: null,
      related_contact: contactId || null,
      outcome: ok ? "ok" : "failed",
      payload: {
        connector: "manual",
        triggered_by: "manual",
        records_processed: 1,
        new_contacts: ok && created ? 1 : 0,
        updated_contacts: ok && !created ? 1 : 0,
        duplicates_detected: 0,
        errors: ok ? 0 : 1,
        error_samples: errorMsg ? [errorMsg] : [],
        duration_ms: Date.now() - startedMs,
        dry_run: false,
        admin_actor: input.admin_actor ?? null,
      },
      reversible: false,
      reverse_of: null,
      supersedes: null,
    });
  } catch {
    // never mask upsert result
  }

  if (!ok) return { ok: false, error: errorMsg ?? "upsert_failed" };
  return { ok: true, contact_id: contactId, created, source_ref: sourceRef };
}
