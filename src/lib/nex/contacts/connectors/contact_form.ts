// NEX Contact Intelligence · Contact Form Connector (push-mode)
//
// Push-mode connectors are event-driven · callers fire records as events
// happen (form submission · webhook · worker output) rather than the
// connector polling a source. There is no sync() method — the runner's
// admin-trigger surface refuses to invoke a push connector.
//
// The /api/contact route calls `recordContactFromForm(...)` on each
// submission. That helper upserts the contact through the registry and
// writes a single `contacts.connector.sync` audit event so the panel
// shows the same shape of stats as pull-mode connectors.

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { upsertContact } from "../registry";
import type { ConnectorDefinition } from "./types";

export const contactFormConnectorDefinition: ConnectorDefinition = {
  id: "contact-form",
  label: "Contact Form",
  source_type: "form",
  status: "supported",
  mode: "push",
  description: "Every /api/contact submission upserts a contact · source_ref = submission_id (UUID per submission) · realtime · no admin trigger",
  scheduled: false,
};

export type FormSubmissionInput = {
  email: string;
  name?: string | null;
  phone?: string | null;               // whatsapp digits accepted
  country?: string | null;
  reason?: string | null;
  message?: string | null;
  account_ref?: string | null;
  submission_id?: string;              // opt · UUID auto-generated when omitted
};

export type FormSubmissionResult =
  | { ok: true; submission_id: string; contact_id: string; created: boolean }
  | { ok: false; error: string };

/**
 * Called by /api/contact on every submission. Non-blocking of the primary
 * response — the caller can `void recordContactFromForm(...)` if the reply
 * shouldn't wait, but by default we await so the audit trail is complete
 * before the response returns (~single-digit ms overhead).
 */
export async function recordContactFromForm(input: FormSubmissionInput): Promise<FormSubmissionResult> {
  if (!input.email) return { ok: false, error: "email required" };
  const submissionId = input.submission_id ?? randomUUID();
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();

  let upsertOk = true;
  let contactId = "";
  let created = false;
  let errorMsg: string | null = null;

  try {
    const result = await upsertContact({
      email: input.email,
      phone: input.phone ?? null,
      name: input.name ?? null,
      country: input.country ?? null,
      lifecycle_stage: "lead",
      consent_marketing: null,               // form submission ≠ marketing opt-in
      consent_transactional: true,           // implicit consent to reply to their enquiry
      consent_source: "contact_form_submission",
      attributes: {
        contact_form_reason: input.reason ?? null,
        contact_form_message_len: input.message?.length ?? 0,
        contact_form_account_ref: input.account_ref ?? null,
      },
      source: {
        type: "form",
        ref: submissionId,
        metadata: {
          reason: input.reason ?? null,
          country: input.country ?? null,
          submitted_at: startedAt,
        },
      },
    });
    contactId = result.contact_id;
    created = result.created;
  } catch (err) {
    upsertOk = false;
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  // Audit event · same shape as pull-mode connector runs · records_processed = 1
  try {
    const store = getStorage();
    await store.save(COLLECTIONS.events, {
      event_id: randomUUID(),
      event_type: "contacts.connector.sync",
      source: "nex-contacts-runtime",
      actor_id: null,
      timestamp: new Date().toISOString(),
      business_id: null,
      related_department: "contact-intelligence",
      related_brain: null,
      related_job: null,
      related_contact: contactId || null,
      outcome: upsertOk ? "ok" : "failed",
      payload: {
        connector: "contact-form",
        triggered_by: "webhook",              // treat form submission as a webhook-style trigger
        records_processed: 1,
        new_contacts: upsertOk && created ? 1 : 0,
        updated_contacts: upsertOk && !created ? 1 : 0,
        duplicates_detected: 0,
        errors: upsertOk ? 0 : 1,
        error_samples: errorMsg ? [errorMsg] : [],
        duration_ms: Date.now() - startedMs,
        dry_run: false,
        submission_id: submissionId,
      },
      reversible: false,
      reverse_of: null,
      supersedes: null,
    });
  } catch {
    // Audit failure must not mask the upsert result.
  }

  if (!upsertOk) return { ok: false, error: errorMsg ?? "upsert_failed" };
  return { ok: true, submission_id: submissionId, contact_id: contactId, created };
}
