// NEX Contact Intelligence · Newsletter Connector
//
// Synchronises `hammerex_xrated_newsletter_subscribers` (legacy Supabase
// per-merchant subscriber list) into the Contact Registry. Same person
// subscribed to multiple merchants becomes ONE canonical contact with
// multiple source rows (one per subscription).
//
// Compliance mapping (status column drives real consent state):
//   status = "active"        → consent_marketing: true
//   status = "unsubscribed"  → consent_marketing: false, unsubscribe_at: unsubscribed_at ?? now
//   status = "bounced"       → consent_marketing: false, attributes.hard_bounce_at: now
//                              (bounce ≠ unsubscribe; the registry's compliance
//                               ratchet still blocks sends via consent_marketing = false)
//   status = "complained"    → consent_marketing: false, never_contact: TRUE,
//                              unsubscribe_at: unsubscribed_at ?? now
//                              (spam complaint = one-way ratchet toward safety ·
//                               admin must explicitly override to re-contact)
//
// Every write goes through registry.upsertContact() · never touches the
// contacts tables directly. Registry's compliance ratchet ensures that
// safer state always wins across sources (a person unsubscribed from one
// merchant's newsletter but subscribed to another still shows consent
// as FALSE at the canonical level · that's the correct legal spine).

import { upsertContact } from "../registry";
import type { Connector, ConnectorDefinition } from "./types";

type SupabaseAdminModule = { supabaseAdmin: { from: (t: string) => { select: (c: string) => { range: (a: number, b: number) => Promise<{ data: NewsletterRow[] | null; error: { message: string } | null }> } } } };

type NewsletterRow = {
  id: string;
  listing_id: string;
  email: string;
  consent_at: string;
  consent_text: string;
  unsubscribe_token: string;
  status: "active" | "unsubscribed" | "bounced" | "complained";
  unsubscribed_at: string | null;
  created_at: string;
};

const BATCH_SIZE = 500;

export const newsletterConnectorDefinition: ConnectorDefinition = {
  id: "newsletter",
  label: "Newsletter Subscribers",
  source_type: "newsletter",
  status: "supported",
  description: "Syncs hammerex_xrated_newsletter_subscribers (per-merchant subs) into the Contact Registry · status → consent_marketing + unsubscribe_at · complaint → never_contact + unsubscribe_at · source_ref = subscription.id",
  scheduled: false,
};

async function loadSupabaseAdmin(): Promise<SupabaseAdminModule["supabaseAdmin"] | null> {
  try {
    const mod = (await import("@/lib/supabaseAdmin")) as unknown as SupabaseAdminModule;
    return mod.supabaseAdmin;
  } catch {
    return null;
  }
}

/**
 * Map subscription status to registry inputs · the safety ratchet in the
 * registry ensures these values only get STRICTER over time · never weaker.
 */
function mapStatus(status: NewsletterRow["status"], unsubscribedAt: string | null): {
  consent_marketing: boolean;
  unsubscribe_at: string | null;
  never_contact: boolean;
  attribute_overlay: Record<string, unknown>;
} {
  const now = new Date().toISOString();
  switch (status) {
    case "active":
      return { consent_marketing: true, unsubscribe_at: null, never_contact: false, attribute_overlay: {} };
    case "unsubscribed":
      return {
        consent_marketing: false,
        unsubscribe_at: unsubscribedAt ?? now,
        never_contact: false,
        attribute_overlay: { unsubscribed_from_source: "newsletter" },
      };
    case "bounced":
      return {
        consent_marketing: false,
        unsubscribe_at: null,
        never_contact: false,
        attribute_overlay: { hard_bounce_at: now, hard_bounce_source: "newsletter" },
      };
    case "complained":
      return {
        consent_marketing: false,
        unsubscribe_at: unsubscribedAt ?? now,
        never_contact: true,                       // one-way ratchet toward safety
        attribute_overlay: { spam_complaint_at: now, spam_complaint_source: "newsletter" },
      };
  }
}

export const newsletterConnector: Connector = {
  definition: newsletterConnectorDefinition,
  async sync(opts) {
    const admin = await loadSupabaseAdmin();
    if (!admin) {
      return { records_processed: 0, new_contacts: 0, updated_contacts: 0, duplicates_detected: 0, errors: 1, error_samples: ["Supabase admin client unavailable · check NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY"] };
    }

    let processed = 0, created = 0, updated = 0, errors = 0;
    const errorSamples: string[] = [];
    const globalLimit = opts.limit ?? Number.MAX_SAFE_INTEGER;

    let offset = 0;
    while (processed < globalLimit) {
      const take = Math.min(BATCH_SIZE, globalLimit - processed);
      const { data, error } = await admin
        .from("hammerex_xrated_newsletter_subscribers")
        .select("id, listing_id, email, consent_at, consent_text, unsubscribe_token, status, unsubscribed_at, created_at")
        .range(offset, offset + take - 1);
      if (error) {
        errors += 1;
        if (errorSamples.length < 5) errorSamples.push(`batch offset ${offset}: ${error.message}`);
        break;
      }
      if (!data || data.length === 0) break;

      for (const row of data) {
        processed += 1;
        if (!row.email) continue;

        if (opts.dry_run) continue;

        try {
          const mapped = mapStatus(row.status, row.unsubscribed_at);
          const result = await upsertContact({
            email: row.email,
            consent_marketing: mapped.consent_marketing,
            consent_transactional: true,             // newsletter signup implies transactional consent
            consent_source: `newsletter_signup:${row.consent_text.slice(0, 60)}`,
            unsubscribe_at: mapped.unsubscribe_at,
            never_contact: mapped.never_contact,
            attributes: {
              ...mapped.attribute_overlay,
              newsletter_unsubscribe_token: row.unsubscribe_token,
              newsletter_listing_id: row.listing_id,
              newsletter_status: row.status,
              newsletter_consent_at: row.consent_at,
            },
            source: {
              type: "newsletter",
              ref: row.id,
              metadata: {
                listing_id: row.listing_id,
                status: row.status,
                consent_at: row.consent_at,
              },
            },
          });
          if (result.created) created += 1;
          else updated += 1;
        } catch (err) {
          errors += 1;
          if (errorSamples.length < 5) {
            const msg = err instanceof Error ? err.message : String(err);
            errorSamples.push(`row ${row.id}: ${msg}`);
          }
        }
      }

      if (data.length < take) break;
      offset += take;
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
