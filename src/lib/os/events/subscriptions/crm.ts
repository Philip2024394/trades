// CRM event subscriptions.
//
// CRM listens to every "someone did something" event and mirrors it
// onto the (merchant × party) contact. Before the Event Bus these
// mirrors were inline calls from the publishing route into CRM — a
// Constitution violation. Now every one runs through publish().
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logCrmActivity, upsertCrmContact } from "@/lib/crm/upsertContact";
import { register } from "../registry";
import type { PublishedEvent } from "../types";

async function withMerchantAndContact(
  event: PublishedEvent,
  merchantId: string | null | undefined,
  partyId: string | null | undefined
): Promise<string | null> {
  if (!merchantId || !partyId) return null;
  // Look up (merchant, party) contact — upsert so a late-firing event
  // that predates the CRM install still creates the contact.
  const { data: existing } = await supabaseAdmin
    .from("app_crm_contacts")
    .select("id, display_name, email, whatsapp_e164, postcode")
    .eq("merchant_id", merchantId)
    .eq("party_id", partyId)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: party } = await supabaseAdmin
    .from("os_parties")
    .select("display_name, email, whatsapp_e164")
    .eq("id", partyId)
    .maybeSingle();
  if (!party) return null;
  const created = await upsertCrmContact({
    merchantId,
    partyId,
    displayName: party.display_name,
    email: party.email,
    whatsappE164: party.whatsapp_e164,
    source: `event:${event.eventType}`
  });
  return created.contactId;
}

// lead.captured → create-or-touch contact + set stage to 'engaged'
register({
  subscriberSlug: "crm.lead_captured",
  eventType: "lead.captured",
  handler: async (event) => {
    const merchantId = event.actorBusinessId;
    const partyId = event.actorPartyId;
    if (!merchantId) return { ok: false, error: "missing-merchant", retryable: false };
    const stage =
      (event.payload.initial_lifecycle_stage as
        | "new"
        | "engaged"
        | "quoted"
        | "won"
        | "active"
        | "signed_off"
        | "silent"
        | "lost"
        | "archived") || "engaged";
    await upsertCrmContact({
      merchantId,
      partyId,
      displayName: (event.payload.display_name as string) || "Homeowner",
      email: (event.payload.email as string) || null,
      whatsappE164: (event.payload.whatsapp_e164 as string) || null,
      postcode: (event.payload.postcode as string) || null,
      source: (event.payload.source as string) || `event:${event.eventType}`,
      initialLifecycleStage: stage
    });
    return { ok: true };
  }
});

// render.completed → log 'render' activity on the contact
register({
  subscriberSlug: "crm.render_completed",
  eventType: "render.completed",
  handler: async (event) => {
    const merchantId = event.actorBusinessId;
    const partyId = event.actorPartyId;
    const contactId = await withMerchantAndContact(event, merchantId, partyId);
    if (!contactId || !merchantId) return { ok: true }; // nothing to do
    const summary =
      (event.payload.summary as string) ||
      (event.payload.leaf_display_name as string) ||
      "Render";
    await logCrmActivity({
      contactId,
      merchantId,
      kind: "render",
      headline: `${summary}`,
      sourceApp: "ai-visualiser",
      sourceId: event.subjectId ?? undefined
    });
    return { ok: true };
  }
});

// quote.sent → log 'quote_sent' activity
register({
  subscriberSlug: "crm.quote_sent",
  eventType: "quote.sent",
  handler: async (event) => {
    const merchantId = event.actorBusinessId;
    const partyId = event.actorPartyId;
    const contactId = await withMerchantAndContact(event, merchantId, partyId);
    if (!contactId || !merchantId) return { ok: true };
    await logCrmActivity({
      contactId,
      merchantId,
      kind: "quote_sent",
      headline: `Quote sent · ${event.payload.total_gbp ?? ""}`.trim(),
      sourceApp: "quote-workspace",
      sourceId: event.subjectId ?? undefined
    });
    return { ok: true };
  }
});

// quote.accepted → log + advance lifecycle to 'won'
register({
  subscriberSlug: "crm.quote_accepted",
  eventType: "quote.accepted",
  handler: async (event) => {
    const merchantId = event.actorBusinessId;
    const partyId = event.actorPartyId;
    const contactId = await withMerchantAndContact(event, merchantId, partyId);
    if (!contactId || !merchantId) return { ok: true };
    await logCrmActivity({
      contactId,
      merchantId,
      kind: "quote_accepted",
      headline: "Quote accepted",
      sourceApp: "quote-workspace",
      sourceId: event.subjectId ?? undefined
    });
    await supabaseAdmin
      .from("app_crm_contacts")
      .update({ lifecycle_stage: "won" })
      .eq("id", contactId);
    return { ok: true };
  }
});

// job.signed_off → log + lifecycle to 'signed_off'
register({
  subscriberSlug: "crm.job_signed_off",
  eventType: "job.signed_off",
  handler: async (event) => {
    const merchantId = event.actorBusinessId;
    const partyId = event.actorPartyId;
    const contactId = await withMerchantAndContact(event, merchantId, partyId);
    if (!contactId || !merchantId) return { ok: true };
    await logCrmActivity({
      contactId,
      merchantId,
      kind: "job_signed_off",
      headline: "Job signed off",
      sourceApp: "job-diary",
      sourceId: event.subjectId ?? undefined
    });
    await supabaseAdmin
      .from("app_crm_contacts")
      .update({ lifecycle_stage: "signed_off" })
      .eq("id", contactId);
    return { ok: true };
  }
});

// review.posted → log
register({
  subscriberSlug: "crm.review_posted",
  eventType: "review.posted",
  handler: async (event) => {
    const merchantId = event.actorBusinessId;
    const partyId = event.actorPartyId;
    const contactId = await withMerchantAndContact(event, merchantId, partyId);
    if (!contactId || !merchantId) return { ok: true };
    await logCrmActivity({
      contactId,
      merchantId,
      kind: "review_posted",
      headline: `${event.payload.rating ?? "★"}★ review`,
      sourceApp: "reviews",
      sourceId: event.subjectId ?? undefined
    });
    return { ok: true };
  }
});
