// Universal contact upsert. Every app that "meets" a customer calls
// this — AI Visualiser register, Quote Workspace draft, walk-in
// manual entry. Idempotent by (merchant_id, party_id) or fallback
// (merchant_id, email_hash).
//
// Phase 3d.3 · Contact Registry adoption.
// Every successful CRM upsert (create OR update) also writes through
// the canonical Contact Registry via registry.upsertContact() with
// source_type = "crm" and source_ref = crm_contact_id. This ensures:
//   · Every CRM contact has a canonical identity
//   · Merges made in the Merge Centre are visible to CRM via alias
//   · Every downstream consumer (Email · Notifications · AI) resolves
//     the same canonical contact regardless of which merchant "owns" it
// Best-effort: registry unreachable → CRM operation still succeeds ·
// registry linkage happens on the next sync.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  hashEmail,
  hashWhatsapp
} from "@/lib/os/hashing";
import { upsertContact as registryUpsertContact } from "@/lib/nex/contacts/registry";

export type UpsertContactInput = {
  merchantId: string;
  partyId?: string | null;
  displayName: string;
  email?: string | null;
  whatsappE164?: string | null;
  postcode?: string | null;
  source?: string | null;
  initialLifecycleStage?:
    | "new"
    | "engaged"
    | "quoted"
    | "won"
    | "active"
    | "signed_off"
    | "silent"
    | "lost"
    | "archived";
};

export type UpsertContactResult = {
  contactId: string;
  created: boolean;
  /** Phase 3d.3 · canonical Contact Registry linkage.
   *  Null when the registry is unreachable · CRM operation still succeeded. */
  registry?: {
    canonical_contact_id: string;
    created_in_registry: boolean;
  } | null;
};

/**
 * Phase 3d.3 · write-through to the canonical registry.
 * Fires after every successful CRM upsert · never throws · returns null
 * on failure so callers get backward-compatible behavior.
 */
async function writeThroughToRegistry(input: UpsertContactInput, crmContactId: string): Promise<UpsertContactResult["registry"]> {
  if (!input.email && !input.whatsappE164) return null;
  try {
    const r = await registryUpsertContact({
      email: input.email ?? null,
      phone: input.whatsappE164 ?? null,
      name: input.displayName,
      region: input.postcode ?? null,
      lifecycle_stage: (() => {
        // Match the CRM's initial stage into the registry's canonical vocabulary.
        // Same mapping as the CRM Connector (Phase 3b.7).
        const s = input.initialLifecycleStage;
        if (!s) return undefined;
        if (s === "new") return "lead";
        if (s === "engaged" || s === "quoted" || s === "silent") return "prospect";
        if (s === "won" || s === "active" || s === "signed_off") return "customer";
        return "archived";
      })(),
      linked_business_id: input.merchantId,
      consent_marketing: null,                      // CRM contact opted in with the merchant, not with NEX
      consent_transactional: true,                   // implicit for merchant-initiated interaction
      consent_source: `crm:${input.source ?? "unknown"}`,
      attributes: {
        crm_contact_id: crmContactId,
        crm_source: input.source ?? null,
        crm_write_through: "phase-3d.3",
      },
      source: {
        type: "crm",
        ref: crmContactId,                            // per-CRM-row idempotent · matches Connector pattern
        metadata: {
          merchant_id: input.merchantId,
          crm_source: input.source ?? null,
          upserted_at: new Date().toISOString(),
        },
      },
    });
    return { canonical_contact_id: r.contact_id, created_in_registry: r.created };
  } catch {
    return null;
  }
}

export async function upsertCrmContact(
  input: UpsertContactInput
): Promise<UpsertContactResult> {
  const emailHash = input.email ? hashEmail(input.email) : null;
  const whatsappHash = input.whatsappE164
    ? hashWhatsapp(input.whatsappE164)
    : null;

  // 1. Party-id match (strongest)
  if (input.partyId) {
    const { data: existing } = await supabaseAdmin
      .from("app_crm_contacts")
      .select("id, last_activity_at")
      .eq("merchant_id", input.merchantId)
      .eq("party_id", input.partyId)
      .maybeSingle();
    if (existing) {
      await touchExisting(existing.id);
      const registry = await writeThroughToRegistry(input, existing.id);
      return { contactId: existing.id, created: false, registry };
    }
  }

  // 2. Email-hash fallback
  if (emailHash) {
    const { data: existing } = await supabaseAdmin
      .from("app_crm_contacts")
      .select("id, party_id")
      .eq("merchant_id", input.merchantId)
      .eq("email_hash", emailHash)
      .maybeSingle();
    if (existing) {
      // Backfill party_id if we now have it
      if (input.partyId && !existing.party_id) {
        await supabaseAdmin
          .from("app_crm_contacts")
          .update({ party_id: input.partyId })
          .eq("id", existing.id);
      }
      await touchExisting(existing.id);
      const registry = await writeThroughToRegistry(input, existing.id);
      return { contactId: existing.id, created: false, registry };
    }
  }

  // 3. Create
  const now = new Date().toISOString();
  const { data: created, error } = await supabaseAdmin
    .from("app_crm_contacts")
    .insert({
      merchant_id: input.merchantId,
      party_id: input.partyId ?? null,
      display_name: input.displayName,
      email: input.email ?? null,
      email_hash: emailHash,
      whatsapp_e164: input.whatsappE164 ?? null,
      whatsapp_hash: whatsappHash,
      postcode: input.postcode ?? null,
      source: input.source ?? null,
      lifecycle_stage: input.initialLifecycleStage ?? "new",
      last_activity_at: now
    })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(`Failed to create contact: ${error?.message}`);
  }

  // Log a contact_created activity (idempotent via source-key rule; no
  // source_app so the unique index doesn't fire).
  await supabaseAdmin.from("app_crm_activities").insert({
    contact_id: created.id,
    merchant_id: input.merchantId,
    kind: "contact_created" as const,
    headline: `${input.displayName} added`,
    body: input.source ? `Source: ${input.source}` : null,
    occurred_at: now
  });

  const registry = await writeThroughToRegistry(input, created.id);
  return { contactId: created.id, created: true, registry };
}

async function touchExisting(contactId: string): Promise<void> {
  await supabaseAdmin
    .from("app_crm_contacts")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", contactId);
}

// Convenience: log a source-projected activity onto a contact. Called by
// event bridges (e.g. render.completed → activity). Idempotent via the
// unique (source_app, source_id, kind) index.
export async function logCrmActivity(input: {
  contactId: string;
  merchantId: string;
  kind: string;
  headline: string;
  body?: string | null;
  sourceApp?: string | null;
  sourceId?: string | null;
  occurredAt?: string;
}): Promise<void> {
  await supabaseAdmin.from("app_crm_activities").insert({
    contact_id: input.contactId,
    merchant_id: input.merchantId,
    kind: input.kind,
    headline: input.headline,
    body: input.body ?? null,
    source_app: input.sourceApp ?? null,
    source_id: input.sourceId ?? null,
    occurred_at: input.occurredAt ?? new Date().toISOString()
  });

  await supabaseAdmin
    .from("app_crm_contacts")
    .update({
      last_activity_at: input.occurredAt ?? new Date().toISOString()
    })
    .eq("id", input.contactId);
}

// Bump lifecycle stage — merchants can set manually, but events also
// suggest transitions.
export async function setLifecycleStage(input: {
  contactId: string;
  merchantId: string;
  stage: UpsertContactInput["initialLifecycleStage"];
}): Promise<void> {
  if (!input.stage) return;
  await supabaseAdmin
    .from("app_crm_contacts")
    .update({
      lifecycle_stage: input.stage,
      quiet_since: input.stage === "silent" ? new Date().toISOString() : null
    })
    .eq("id", input.contactId)
    .eq("merchant_id", input.merchantId);
}
