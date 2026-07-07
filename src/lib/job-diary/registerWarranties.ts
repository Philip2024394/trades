// Warranty registration on sign-off (lightweight v1).
//
// Full Warranty Ledger with per-manufacturer signed registrations is
// App #004 territory. For now we do the honest, useful thing:
//
//   For every material line on the quote's BOM, we insert an
//   os_documents row (kind='warranty') on the property that:
//     • names the item
//     • sets an expiry (default 5 years — merchants can adjust later)
//     • records provenance (which job, which quote, which merchant)
//     • fires warranty.registered on the Home Timeline
//
// Homeowners see warranties on /home. Merchants can prove sign-off
// evidence with the timeline. Manufacturers plug in properly with
// signed feeds in the Warranty Ledger app.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordTimelineEvent } from "@/lib/os/timeline";

export type RegisterWarrantiesResult = {
  registeredCount: number;
  documentIds: string[];
};

export async function registerWarrantiesForJob(input: {
  jobId: string;
  quoteId: string | null;
  propertyId: string;
  projectId: string;
  merchantId: string;
  ownerPartyId: string | null;
  defaultYears?: number;
}): Promise<RegisterWarrantiesResult> {
  const years = input.defaultYears ?? 5;

  if (!input.quoteId) {
    return { registeredCount: 0, documentIds: [] };
  }

  const { data: items } = await supabaseAdmin
    .from("app_quote_workspace_quote_items")
    .select("id, kind, label, description, qty, unit_price_pence, total_pence, sku")
    .eq("quote_id", input.quoteId)
    .in("kind", ["material", "fee"]);

  if (!items || items.length === 0) {
    return { registeredCount: 0, documentIds: [] };
  }

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + years);
  const expiresIso = expiresAt.toISOString();

  const rows = items.map((i) => ({
    property_id: input.propertyId,
    project_id: input.projectId,
    owning_party_id: input.ownerPartyId,
    kind: "warranty" as const,
    title: i.label,
    file_url: `/api/os/warranties/certificate/${input.jobId}/${i.id}`, // generated on demand
    provenance: {
      app_slug: "job-diary",
      job_id: input.jobId,
      quote_id: input.quoteId,
      quote_item_id: i.id,
      merchant_id: input.merchantId,
      sku: i.sku ?? null,
      total_pence: i.total_pence
    },
    consent: {
      visible_to: ["owner", "merchant"],
      shareable_at_sale: true
    },
    expires_at: expiresIso
  }));

  const { data: inserted, error } = await supabaseAdmin
    .from("os_documents")
    .insert(rows)
    .select("id, title");
  if (error || !inserted) {
    console.error("[job-diary.warranties] insert failed", error);
    return { registeredCount: 0, documentIds: [] };
  }

  // One timeline event per registered warranty (idempotent per subject)
  await Promise.all(
    inserted.map((doc) =>
      recordTimelineEvent({
        propertyId: input.propertyId,
        projectId: input.projectId,
        actorBusinessListingId: input.merchantId,
        actorPartyId: input.ownerPartyId,
        verb: "warranty.registered",
        subjectType: "warranty",
        subjectId: doc.id,
        headline: `Warranty registered: ${doc.title}`,
        payload: { expires_at: expiresIso, years }
      })
    )
  );

  return {
    registeredCount: inserted.length,
    documentIds: inserted.map((d) => d.id)
  };
}
