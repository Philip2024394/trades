// NEX Contact Intelligence · Trades Directory Connector
//
// Synchronises `hammerex_trade_off_listings` (legacy Supabase-hosted
// trades directory) into the canonical Contact Registry. Each listing
// becomes ONE contact keyed by canonical email, with source_ref = listing.id
// so re-runs UPDATE the same contact_sources row rather than creating
// duplicate history.
//
// Field mapping:
//   listings.email          → contact.email
//   listings.phone          → contact.phone
//   listings.display_name   → contact.name
//   listings.trading_name   → attributes.trading_name  (kept as extra context)
//   listings.city           → contact.region
//   listings.country        → contact.country
//   listings.primary_trade + secondary_trades → contact.trade_categories
//   listings.id             → source_ref
//   listings.status         → attributes.listing_status
//   listings.tier           → attributes.tier
//
// Consent (defensive default):
//   consent_marketing     = NULL   (unknown · trades signed up to be
//                                   listed, not necessarily to receive
//                                   marketing · admin promotes explicitly)
//   consent_transactional = TRUE   (signing up implies transactional consent
//                                   for listing-related communications)
//   consent_source        = "trades_directory_signup"
//
// Every write goes through registry.upsertContact() — the connector NEVER
// touches the contacts tables directly.

import { upsertContact } from "../registry";
import type { Connector, ConnectorDefinition } from "./types";

type SupabaseAdminModule = { supabaseAdmin: { from: (t: string) => { select: (c: string) => { range: (a: number, b: number) => Promise<{ data: TradesRow[] | null; error: { message: string } | null }> } } } };

type TradesRow = {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string | null;
  trading_name: string | null;
  city: string | null;
  country: string | null;
  primary_trade: string | null;
  secondary_trades: string[] | null;
  status: string | null;
  tier: string | null;
};

const BATCH_SIZE = 500;

export const tradesConnectorDefinition: ConnectorDefinition = {
  id: "trades",
  label: "Trades Directory",
  source_type: "trades",
  status: "supported",
  description: "Syncs hammerex_trade_off_listings (legacy Supabase) into the Contact Registry · one contact per listing keyed by email · source_ref = listing.id",
  mode: "pull",
  scheduled: false,               // admin-triggered until Phase 3d
};

async function loadSupabaseAdmin(): Promise<SupabaseAdminModule["supabaseAdmin"] | null> {
  // Dynamic import keeps the connector safe to typecheck when Supabase env
  // isn't set. The Trades table is on legacy Supabase · migrating that
  // table off Supabase is a separate concern (per doctrine, Supabase is
  // one adapter, but here we're using it as a SOURCE of legacy data).
  try {
    const mod = (await import("@/lib/supabaseAdmin")) as unknown as SupabaseAdminModule;
    return mod.supabaseAdmin;
  } catch {
    return null;
  }
}

export const tradesConnector: Connector = {
  definition: tradesConnectorDefinition,
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
        .from("hammerex_trade_off_listings")
        .select("id, email, phone, display_name, trading_name, city, country, primary_trade, secondary_trades, status, tier")
        .range(offset, offset + take - 1);
      if (error) {
        errors += 1;
        if (errorSamples.length < 5) errorSamples.push(`batch offset ${offset}: ${error.message}`);
        break;                    // stop on batch error · partial result reported
      }
      if (!data || data.length === 0) break;

      for (const row of data) {
        processed += 1;
        // Skip rows without any contact identifier · they can't dedup
        if (!row.email && !row.phone) continue;

        if (opts.dry_run) {
          // Count but don't write · connector runner will surface the audit event
          continue;
        }

        try {
          const trades = [row.primary_trade, ...(row.secondary_trades ?? [])].filter((t): t is string => !!t);
          const result = await upsertContact({
            email: row.email,
            phone: row.phone,
            name: row.display_name,
            company: row.trading_name,
            region: row.city,
            country: row.country,
            trade_categories: trades,
            lifecycle_stage: "trade",
            consent_marketing: null,           // unknown · admin promotes explicitly
            consent_transactional: true,       // signing up implies transactional consent
            consent_source: "trades_directory_signup",
            attributes: {
              trading_name: row.trading_name,
              listing_status: row.status,
              tier: row.tier,
            },
            source: {
              type: "trades",
              ref: row.id,
              metadata: {
                listing_status: row.status,
                imported_at: new Date().toISOString(),
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
      duplicates_detected: 0,          // Phase 3c: surface dedup suggestions from upsert result
      errors,
      error_samples: errorSamples,
    };
  },
};
