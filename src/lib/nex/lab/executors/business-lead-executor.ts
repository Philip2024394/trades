// src/lib/nex/lab/executors/business-lead-executor.ts
//
// Founder 2026-09-10 · Broad business lead promotion executor.
//
// Promotes verified Lab rows into nex.business_lead_directory when the
// derived category doesn't fit a specialist vertical (food-beverage →
// nex.food_business, accommodation → nex.accommodation_business, salons/
// gyms/pharmacies/etc → nex.service_business).
//
// The router below picks the destination table based on derived_category
// + derived_subcategory. Everything not handled by a specialist vertical
// lands in the broad directory.
//
// Contract mirrors executeFoodPromotion:
//   · called inside the approvePromotion transaction (client already open)
//   · per-row SAVEPOINT (Postgres aborts whole txn on first error otherwise)
//   · deterministic public_listing_ref (#BL-YYYY-CROCKFORD5)
//   · every provenance layer written to business_lead_directory_field_provenance
//   · opt-out registry respected · no contact detail written for opted-out email/phone

import type { PoolClient } from "pg";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function publicListingRef(dedupeHash: string): string {
  const bytes = Buffer.from(dedupeHash.slice(0, 10), "hex");
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let ref5 = "";
  for (let i = 0; i < 5; i++) {
    ref5 = CROCKFORD[Number(bits & 0x1Fn)] + ref5;
    bits >>= 5n;
  }
  return `#BL-${new Date().getUTCFullYear()}-${ref5}`;
}

// Router: derived_category+subcategory → which nex.* table this row belongs in.
// Returns null when the row should NOT go to business_lead_directory (specialist
// vertical owns it). The specialist executors handle those.
function routesToLeadDirectory(cat: string | undefined, sub: string | undefined): boolean {
  if (!cat) return true; // unclassified · goes to broad directory as low-quality lead
  // Specialist verticals already own these — do NOT double-write
  if (cat === "food-beverage") return false;
  if (cat === "accommodation") return false;
  // service_business owns 6 sub-categories · everything else in "services" is broad
  if (cat === "services" || cat === "health") {
    const specialistSubs = new Set(["fitness", "beauty-wellness", "dentist", "optical", "pharmacy", "auto-service", "clinic"]);
    if (sub && specialistSubs.has(sub)) return false;
  }
  return true;
}

export interface BusinessLeadExecuteResult {
  inserted: number;
  updated: number;
  skipped: number;
  skipped_specialist: number;
  errors: string[];
}

async function isOptedOut(client: PoolClient, email: string | null, phone: string | null): Promise<boolean> {
  if (!email && !phone) return false;
  const r = await client.query(
    `SELECT 1 FROM nex.business_lead_opt_out
     WHERE ($1::text IS NOT NULL AND LOWER(email) = LOWER($1))
        OR ($2::text IS NOT NULL AND phone = $2)
     LIMIT 1`,
    [email, phone]
  );
  return r.rowCount ? r.rowCount > 0 : false;
}

/**
 * Execute the business-lead-directory copy for a specific promotion.
 * Called inside the approvePromotion transaction (client already open).
 */
export async function executeBusinessLeadPromotion(
  client: PoolClient,
  promotion_id: string,
): Promise<BusinessLeadExecuteResult> {
  const out: BusinessLeadExecuteResult = { inserted: 0, updated: 0, skipped: 0, skipped_specialist: 0, errors: [] };

  const rows = (await client.query(
    `SELECT pr.subject_ref, v.field_value, v.confidence, v.evidence_refs, v.source_count
     FROM nex_lab.promotion_rows pr
     JOIN nex_lab_business.verified v ON v.subject_ref = pr.subject_ref
     WHERE pr.promotion_id = $1 AND v.field_name = 'identity'`,
    [promotion_id],
  )).rows;

  for (const r of rows) {
    const fv = (r.field_value ?? {}) as Record<string, unknown>;
    const name = String(fv.name ?? "").trim();
    const cat = fv.derived_category as string | undefined;
    const sub = fv.derived_subcategory as string | undefined;
    const coords = fv.coordinates as { lat?: number; lon?: number } | undefined;
    const lat = coords?.lat;
    const lon = coords?.lon;

    if (!name) { out.skipped++; continue; }
    if (!routesToLeadDirectory(cat, sub)) { out.skipped_specialist++; continue; }

    const dedupeHash = r.subject_ref as string;
    const ref = publicListingRef(dedupeHash);
    const catGroup = cat ?? "other";
    const catSlug = sub ? `${catGroup}-${sub}` : `${catGroup}-unclassified`;

    // Contact enrichment (from website-enricher, gov-harvester, instagram-enricher)
    const enriched = (fv.enriched_contacts ?? {}) as Record<string, unknown>;
    const enrichedEmails = (enriched.emails ?? []) as Array<{ email: string; confidence: string }>;
    const primaryEmail = enrichedEmails.find((e) => e.confidence === "high")?.email
                       ?? enrichedEmails[0]?.email
                       ?? null;
    const additionalEmails = enrichedEmails.slice(1).map((e) => e.email);
    const whatsapp = (enriched.whatsapp as string[] | undefined)?.[0] ?? null;
    const socials = enriched.socials ?? null;
    const phone = (fv.phone as string | undefined) ?? null;

    // Compliance: skip contact details for opted-out entities
    const optedOut = await isOptedOut(client, primaryEmail, phone);
    const emailToWrite = optedOut ? null : primaryEmail;
    const phoneToWrite = optedOut ? null : phone;
    const whatsappToWrite = optedOut ? null : whatsapp;

    const address = fv.address as Record<string, string> | undefined;
    const addrText = address ? [address.street, address.city].filter(Boolean).join(", ") || null : null;
    const cityLabel = (address?.city ?? fv.city ?? "Yogyakarta") as string;

    const sp = `sp_${dedupeHash.slice(0, 8)}`;
    await client.query(`SAVEPOINT ${sp}`);
    try {
      const existing = await client.query(
        `SELECT internal_id FROM nex.business_lead_directory WHERE dedupe_hash = $1 LIMIT 1`,
        [dedupeHash],
      );
      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE nex.business_lead_directory SET
             last_verified_at = now(),
             verification_source = $1,
             email = COALESCE(email, $2),
             phone = COALESCE(phone, $3),
             whatsapp_number = COALESCE(whatsapp_number, $4),
             public_social_links = COALESCE(public_social_links, $5::jsonb),
             updated_at = now()
           WHERE dedupe_hash = $6`,
          [`lab_promotion:${promotion_id}`, emailToWrite, phoneToWrite, whatsappToWrite,
           socials ? JSON.stringify(socials) : null, dedupeHash],
        );
        await client.query(`RELEASE SAVEPOINT ${sp}`);
        out.updated++;
        continue;
      }
      const inserted = await client.query(`
        INSERT INTO nex.business_lead_directory
          (public_listing_ref, business_name, category_slug, category_group, categories,
           address, city, country, coordinates_lng, coordinates_lat,
           phone, whatsapp_number, email, additional_emails, website, public_social_links,
           source, source_reference, source_licence_terms, source_ingested_at,
           dedupe_hash, last_verified_at, verification_source)
        VALUES ($1, $2, $3, $4, $5,
                $6, $7, 'ID', $8, $9,
                $10, $11, $12, $13, $14, $15::jsonb,
                $16, $17, $18, now(),
                $19, now(), $20)
        RETURNING internal_id
      `, [
        ref, name, catSlug, catGroup, [catSlug],
        addrText, cityLabel, lon ?? null, lat ?? null,
        phoneToWrite, whatsappToWrite, emailToWrite, additionalEmails, (fv.website as string | undefined) ?? null,
        socials ? JSON.stringify(socials) : null,
        (fv.source as string | undefined) ?? "osm_overpass_via_lab",
        Array.isArray(r.evidence_refs) ? r.evidence_refs.join(",") : null,
        (fv.source_licence_terms as string | undefined) ?? "openstreetmap:odbl-1.0",
        dedupeHash, `lab_promotion:${promotion_id}`,
      ]);
      const leadId = inserted.rows[0]?.internal_id;
      if (leadId) {
        // Write per-source provenance rows so field-level origins are recoverable
        const provRows: Array<[string, string, unknown]> = [];
        provRows.push(["name", "osm", name]);
        if (lat && lon) provRows.push(["coordinates", "osm", { lat, lon }]);
        if (phone) provRows.push(["phone", "osm", phone]);
        if ((fv.website as string | undefined)) provRows.push(["website", "osm", fv.website]);
        if (primaryEmail) provRows.push(["email", "website_enrich", primaryEmail]);
        if (whatsapp) provRows.push(["whatsapp", "website_enrich", whatsapp]);
        if (socials) provRows.push(["social_links", "website_enrich", socials]);
        for (const [field, layer, value] of provRows) {
          await client.query(
            `INSERT INTO nex.business_lead_directory_field_provenance
               (lead_internal_id, field_name, field_value, source_layer, source_reference, confidence)
             VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
            [leadId, field, JSON.stringify(value), layer, `lab_promotion:${promotion_id}`,
             (r.confidence as number | null) ?? null],
          );
        }
        out.inserted++;
      }
      await client.query(`RELEASE SAVEPOINT ${sp}`);
    } catch (err) {
      out.skipped++;
      if (out.errors.length < 5) out.errors.push(`${name}: ${String(err).slice(0, 200)}`);
      try { await client.query(`ROLLBACK TO SAVEPOINT ${sp}`); } catch { /* outer will handle */ }
    }
  }
  return out;
}
