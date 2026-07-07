// Universal contact upsert. Every app that "meets" a customer calls
// this — AI Visualiser register, Quote Workspace draft, walk-in
// manual entry. Idempotent by (merchant_id, party_id) or fallback
// (merchant_id, email_hash).
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  hashEmail,
  hashWhatsapp
} from "@/lib/os/hashing";

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
};

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
      return { contactId: existing.id, created: false };
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
      return { contactId: existing.id, created: false };
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

  return { contactId: created.id, created: true };
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
