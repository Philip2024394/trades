// NEX Comms Centre · Social · brand profile CRUD.
//
// Per-tenant brand configuration used by the Brand validator stage.
// Empty/absent → validator fails-closed (blocks Automatic mode per
// charter §S-VIII).

import type { PgClientLike } from "@/lib/nex/db";
import type { TenantId } from "../types";

export interface BrandProfile {
  tenant_id:              TenantId;
  tone:                   "professional" | "friendly" | "premium" | "traditional" | "modern" | "technical" | "local";
  additional_whitelist:   string[];
  forbidden_terms:        string[];
  required_hashtags:      string[];
  required_disclaimers:   Array<{ applies_to_kind?: string; text: string }>;
  preferred_cta_defaults: Record<string, string>;
  updated_at:             string;
}

export interface UpsertBrandProfileInput {
  client:                 PgClientLike;
  tenant_id:              TenantId;
  tone?:                  BrandProfile["tone"];
  additional_whitelist?:  string[];
  forbidden_terms?:       string[];
  required_hashtags?:     string[];
  required_disclaimers?:  BrandProfile["required_disclaimers"];
  preferred_cta_defaults?: Record<string, string>;
}

function isoOf(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  const s = String(v); const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString();
}
function rowToProfile(r: Record<string, unknown>): BrandProfile {
  return {
    tenant_id:              String(r.tenant_id),
    tone:                   r.tone as BrandProfile["tone"],
    additional_whitelist:   (r.additional_whitelist as string[]) ?? [],
    forbidden_terms:        (r.forbidden_terms as string[]) ?? [],
    required_hashtags:      (r.required_hashtags as string[]) ?? [],
    required_disclaimers:   (r.required_disclaimers as BrandProfile["required_disclaimers"]) ?? [],
    preferred_cta_defaults: (r.preferred_cta_defaults as Record<string, string>) ?? {},
    updated_at:             isoOf(r.updated_at),
  };
}

export async function upsertBrandProfile(input: UpsertBrandProfileInput): Promise<BrandProfile> {
  const r = await input.client.query(
    `INSERT INTO nex.social_brand_profiles
       (tenant_id, tone, additional_whitelist, forbidden_terms, required_hashtags,
        required_disclaimers, preferred_cta_defaults, updated_at)
     VALUES ($1::uuid, $2::text, $3::text[], $4::text[], $5::text[],
             $6::jsonb, $7::jsonb, NOW())
     ON CONFLICT (tenant_id) DO UPDATE
       SET tone = EXCLUDED.tone,
           additional_whitelist = EXCLUDED.additional_whitelist,
           forbidden_terms = EXCLUDED.forbidden_terms,
           required_hashtags = EXCLUDED.required_hashtags,
           required_disclaimers = EXCLUDED.required_disclaimers,
           preferred_cta_defaults = EXCLUDED.preferred_cta_defaults,
           updated_at = NOW()
     RETURNING *`,
    [
      input.tenant_id, input.tone ?? "friendly",
      input.additional_whitelist ?? [],
      input.forbidden_terms ?? [],
      input.required_hashtags ?? [],
      JSON.stringify(input.required_disclaimers ?? []),
      JSON.stringify(input.preferred_cta_defaults ?? {}),
    ],
  );
  return rowToProfile(r.rows[0]);
}

export async function getBrandProfile(client: PgClientLike, tenant_id: TenantId): Promise<BrandProfile | null> {
  const r = await client.query(
    `SELECT * FROM nex.social_brand_profiles WHERE tenant_id = $1`,
    [tenant_id],
  );
  return r.rows[0] ? rowToProfile(r.rows[0]) : null;
}
