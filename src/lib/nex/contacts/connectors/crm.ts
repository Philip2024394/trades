// NEX Contact Intelligence · CRM Connector
//
// Reads `app_crm_contacts` (legacy Supabase CRM · one row per
// merchant × person) and syncs each into the canonical Contact Registry.
//
// Same email in two merchants' CRMs collapses to ONE canonical contact
// with TWO source rows (source_ref = app_crm_contacts.id · one per merchant).
// The registry's compliance ratchet still runs — a person who unsubscribed
// via any prior source remains unsubscribed at the canonical level.
//
// This connector is intentionally thin. Its only responsibilities are:
//   · read CRM records
//   · map CRM fields to canonical registry fields
//   · call registry.upsertContact() per row
//   · record source history (source_ref = crm.id · linked_business_id = merchant_id)
//   · report sync status (via the shared connector runner + audit trail)
//
// Validation · duplicate detection · compliance enforcement · reporting ·
// history — ALL inherited from the Contact Registry + shared Import
// pipeline. The connector implements none of that itself.
//
// Doctrine: constitution_nex_contact_intelligence_registry_2026_08_07.md

import { upsertContact } from "../registry";
import type { LifecycleStage } from "../types";
import type { Connector, ConnectorDefinition } from "./types";

type SupabaseAdminModule = { supabaseAdmin: { from: (t: string) => { select: (c: string) => { range: (a: number, b: number) => Promise<{ data: CrmContactRow[] | null; error: { message: string } | null }> } } } };

type CrmContactRow = {
  id: string;
  merchant_id: string;
  display_name: string | null;
  email: string | null;
  whatsapp_e164: string | null;
  postcode: string | null;
  lifecycle_stage: string | null;
  source: string | null;
  tags: string[] | null;
  owner_display_name: string | null;
  last_activity_at: string | null;
  last_touch_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
};

const BATCH_SIZE = 500;

/**
 * Map CRM's merchant-eye lifecycle to the registry's canonical stages.
 * When in doubt, prefer the softer / earlier stage — the registry's
 * ratchet handles the reverse.
 */
function mapLifecycle(crmStage: string | null): LifecycleStage | undefined {
  if (!crmStage) return undefined;
  switch (crmStage) {
    case "new":          return "lead";
    case "engaged":
    case "quoted":
    case "silent":       return "prospect";
    case "won":
    case "active":
    case "signed_off":   return "customer";
    case "lost":
    case "archived":     return "archived";
    default:             return undefined;                  // unknown CRM stage · leave registry stage untouched
  }
}

export const crmConnectorDefinition: ConnectorDefinition = {
  id: "crm",
  label: "CRM Records",
  source_type: "crm",
  status: "supported",
  mode: "pull",
  description: "Syncs app_crm_contacts (per-merchant CRM records) into the canonical registry · lifecycle mapped · linked_business_id = merchant_id preserves per-merchant relationship · source_ref = crm.id for idempotent re-syncs · scheduled runner lands in Phase 3d",
  scheduled: { cron: "0 */6 * * *" },              // intent: every 6 hours · no runner today
};

async function loadSupabaseAdmin(): Promise<SupabaseAdminModule["supabaseAdmin"] | null> {
  try {
    const mod = (await import("@/lib/supabaseAdmin")) as unknown as SupabaseAdminModule;
    return mod.supabaseAdmin;
  } catch {
    return null;
  }
}

export const crmConnector: Connector = {
  definition: crmConnectorDefinition,
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
        .from("app_crm_contacts")
        .select("id, merchant_id, display_name, email, whatsapp_e164, postcode, lifecycle_stage, source, tags, owner_display_name, last_activity_at, last_touch_at, next_follow_up_at, created_at")
        .range(offset, offset + take - 1);
      if (error) {
        errors += 1;
        if (errorSamples.length < 5) errorSamples.push(`batch offset ${offset}: ${error.message}`);
        break;
      }
      if (!data || data.length === 0) break;

      for (const row of data) {
        processed += 1;
        if (!row.email && !row.whatsapp_e164) continue;             // no identifier · registry would reject

        if (opts.dry_run) continue;

        try {
          const tags = Array.isArray(row.tags) ? row.tags : [];
          const result = await upsertContact({
            email: row.email,
            phone: row.whatsapp_e164,
            name: row.display_name,
            region: row.postcode,                                     // best-effort · postcode is the CRM's location hint
            lifecycle_stage: mapLifecycle(row.lifecycle_stage),
            tags,
            consent_marketing: null,                                  // CRM contacts didn't opt into NEX marketing · admin promotes explicitly
            consent_transactional: true,                              // implicit · they interacted with the merchant
            consent_source: `crm:${row.source ?? "unknown"}`,
            linked_business_id: row.merchant_id,                      // preserves the per-merchant relationship
            attributes: {
              crm_source: row.source ?? null,
              crm_owner: row.owner_display_name ?? null,
              crm_lifecycle_stage_original: row.lifecycle_stage,
              crm_next_follow_up_at: row.next_follow_up_at,
              crm_last_touch_at: row.last_touch_at,
              crm_last_activity_at: row.last_activity_at,
            },
            source: {
              type: "crm",
              ref: row.id,                                             // idempotent · per-merchant CRM row
              metadata: {
                merchant_id: row.merchant_id,
                crm_source: row.source ?? null,
                crm_lifecycle_stage: row.lifecycle_stage,
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
      duplicates_detected: 0,               // Phase 3c: surface from upsert result
      errors,
      error_samples: errorSamples,
    };
  },
};
