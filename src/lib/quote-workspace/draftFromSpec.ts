// Draft a Quote from a Specification.
//
// The merchant sees a lead land (from AI Visualiser render.completed).
// They tap "Draft quote" — this helper does the work:
//   1. Loads the Specification (choices + BOM if present)
//   2. Composes line items (materials + labour placeholder)
//   3. Applies merchant defaults (VAT rate, labour day-rate, expiry days)
//   4. Inserts quote + items in one transaction
//   5. Records quote.drafted timeline event on the property
//
// Anything the merchant needs to override happens post-draft in the
// editor. This helper aims for "good enough starting point in 500ms."
import "server-only";
import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordTimelineEvent } from "@/lib/os/timeline";
import { loadOffersByIds } from "@/lib/products/read";

export type DraftFromSpecInput = {
  merchantId: string;
  projectId: string;
  specificationId?: string | null;
  homeownerId?: string | null;         // app_ai_visualiser_homeowners id
  homeownerPartyId?: string | null;
  propertyId: string;
  title?: string;
  labourEstimatePence?: number;
  vatRate?: number;                    // 0.20 for 20%; null skips VAT
  expiresInDays?: number;
};

export type DraftedQuote = {
  id: string;
  shareToken: string;
  materialsPence: number;
  labourPence: number;
  vatPence: number;
  totalPence: number;
};

export async function draftQuoteFromSpec(
  input: DraftFromSpecInput
): Promise<DraftedQuote> {
  const vatRate = input.vatRate ?? 0.2;
  const expiresInDays = input.expiresInDays ?? 30;

  // Load spec (may be null — we still draft a shell)
  let specTitle = input.title || "Quote";
  const items: Array<{
    position: number;
    kind: "material" | "labour" | "fee";
    label: string;
    qty: number;
    unit: string | null;
    unit_price_pence: number | null;
    total_pence: number;
  }> = [];

  // BOM lines can now cite `product_offer_id` — we resolve those into
  // fresh price + label at draft time so the merchant never sends a
  // stale quote. This is how App #002 consumes App #006 through the
  // shared read helper (never a direct join).
  type ProductBackedLineItem = {
    position: number;
    kind: "material" | "labour" | "fee";
    label: string;
    qty: number;
    unit: string | null;
    unit_price_pence: number | null;
    total_pence: number;
    product_offer_id: string | null;
  };
  const specItems: ProductBackedLineItem[] = [];

  if (input.specificationId) {
    const { data: spec } = await supabaseAdmin
      .from("os_specifications")
      .select("leaf_slug, choices, bom")
      .eq("id", input.specificationId)
      .maybeSingle();
    if (spec) {
      const leafLabel = spec.leaf_slug.replace(/_/g, " ");
      specTitle =
        input.title || `${leafLabel.charAt(0).toUpperCase()}${leafLabel.slice(1)} — quote`;
      const bom = Array.isArray(spec.bom) ? spec.bom : [];

      // Collect offer ids referenced by the BOM so we can batch load
      // fresh prices in one round trip.
      const offerIds = bom
        .map((line: Record<string, unknown>) =>
          typeof line.product_offer_id === "string"
            ? (line.product_offer_id as string)
            : null
        )
        .filter((v): v is string => Boolean(v));
      const offers = await loadOffersByIds(offerIds);

      if (bom.length > 0) {
        bom.forEach((line: Record<string, unknown>, idx: number) => {
          const qty = typeof line.qty === "number" ? line.qty : 1;
          const offerId =
            typeof line.product_offer_id === "string"
              ? (line.product_offer_id as string)
              : null;
          const offer = offerId ? offers.get(offerId) : null;

          // Fresh price wins over stored line price when offer is known
          const price =
            offer?.pricePence != null
              ? offer.pricePence
              : typeof line.unit_price_pence === "number"
                ? line.unit_price_pence
                : null;
          const label = offer
            ? `${offer.canonical.brandName} · ${offer.canonical.name}`
            : typeof line.label === "string"
              ? line.label
              : typeof line.sku === "string"
                ? (line.sku as string)
                : "Material line";
          const total = price != null ? Math.round(price * qty) : 0;
          specItems.push({
            position: idx + 1,
            kind: "material",
            label,
            qty,
            unit: typeof line.unit === "string" ? line.unit : "each",
            unit_price_pence: price,
            total_pence: total,
            product_offer_id: offerId
          });
        });
      } else {
        // No merchant BOM yet — emit choice-derived shell items the
        // merchant can price up manually.
        const choices = (spec.choices as Record<string, unknown>) || {};
        const summary = [
          typeof choices.style === "string" ? choices.style : null,
          typeof choices.material === "string" ? choices.material : null,
          typeof choices.colour === "string" ? choices.colour : null
        ]
          .filter(Boolean)
          .join(" · ");
        specItems.push({
          position: 1,
          kind: "material",
          label: `${leafLabel} — ${summary || "materials to price"}`,
          qty: 1,
          unit: "each",
          unit_price_pence: null,
          total_pence: 0,
          product_offer_id: null
        });
      }
    }
  }

  // Push resolved spec items (with optional product_offer_id) into
  // the base items list used for totals.
  for (const s of specItems) {
    items.push({
      position: s.position,
      kind: s.kind,
      label: s.label,
      qty: s.qty,
      unit: s.unit,
      unit_price_pence: s.unit_price_pence,
      total_pence: s.total_pence
    });
  }

  // Labour line — always add a placeholder for the merchant to adjust
  items.push({
    position: items.length + 1,
    kind: "labour",
    label: "Labour (install)",
    qty: 1,
    unit: "days",
    unit_price_pence: input.labourEstimatePence ?? null,
    total_pence: input.labourEstimatePence ?? 0
  });

  const materialsPence = items
    .filter((i) => i.kind === "material" || i.kind === "fee")
    .reduce((acc, i) => acc + i.total_pence, 0);
  const labourPence = items
    .filter((i) => i.kind === "labour")
    .reduce((acc, i) => acc + i.total_pence, 0);
  const subtotal = materialsPence + labourPence;
  const vatPence = Math.round(subtotal * vatRate);
  const totalPence = subtotal + vatPence;

  const shareToken = randomBytes(24).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { data: quote, error } = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .insert({
      project_id: input.projectId,
      specification_id: input.specificationId ?? null,
      merchant_id: input.merchantId,
      homeowner_id: input.homeownerId ?? null,
      homeowner_party_id: input.homeownerPartyId ?? null,
      property_id: input.propertyId,
      title: specTitle,
      status: "draft" as const,
      materials_pence: materialsPence,
      labour_pence: labourPence,
      vat_pence: vatPence,
      total_pence: totalPence,
      expires_at: expiresAt.toISOString(),
      share_token: shareToken
    })
    .select("id")
    .single();

  if (error || !quote) {
    throw new Error(`Failed to draft quote: ${error?.message}`);
  }

  // Insert items — carry product_offer_id when the spec item was
  // resolved from a Products merchant offer.
  if (items.length > 0) {
    const specItemById = new Map<number, ProductBackedLineItem>();
    for (const s of specItems) specItemById.set(s.position, s);
    await supabaseAdmin.from("app_quote_workspace_quote_items").insert(
      items.map((i) => ({
        quote_id: quote.id,
        position: i.position,
        kind: i.kind,
        label: i.label,
        qty: i.qty,
        unit: i.unit,
        unit_price_pence: i.unit_price_pence,
        total_pence: i.total_pence,
        product_offer_id: specItemById.get(i.position)?.product_offer_id ?? null
      }))
    );
  }

  // Quote event
  await supabaseAdmin.from("app_quote_workspace_quote_events").insert({
    quote_id: quote.id,
    verb: "drafted" as const,
    actor_kind: "merchant" as const,
    actor_business_listing_id: input.merchantId
  });

  // Home Timeline
  await recordTimelineEvent({
    propertyId: input.propertyId,
    projectId: input.projectId,
    actorBusinessListingId: input.merchantId,
    verb: "quote.drafted",
    subjectType: "quote",
    subjectId: quote.id,
    headline: `Quote drafted: ${specTitle}`,
    payload: {
      total_pence: totalPence,
      materials_pence: materialsPence,
      labour_pence: labourPence
    }
  });

  return {
    id: quote.id,
    shareToken,
    materialsPence,
    labourPence,
    vatPence,
    totalPence
  };
}
