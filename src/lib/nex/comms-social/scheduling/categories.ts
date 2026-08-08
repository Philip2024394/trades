// NEX Comms Centre · Social · category automation state.
//
// Charter §S-V: automatic mode is opt-in per content category. This
// module owns:
//   * enable/disable per (tenant, category) with role enforcement
//   * check-in stamping (called from every merchant touch point)
//   * 14-day auto-degrade sweep (Automatic → Assisted after dormancy)

import type { PgClientLike } from "@/lib/nex/db";
import type { TenantId, SocialRole } from "../types";
import { permits, type RoleGrantSnapshot } from "../roles";
import { emitSocialAudit } from "../audit";

export type CategoryName =
  | "project" | "educational" | "inspiration" | "product" | "faq"
  | "before_after" | "testimonial" | "seasonal" | "company" | "offer";

export type AutomationMode = "manual" | "assisted" | "automatic";

export interface CategoryAutomationRow {
  tenant_id:            TenantId;
  category:             CategoryName;
  mode:                 AutomationMode;
  enabled_by:           string | null;
  enabled_at:           string | null;
  last_check_in_at:     string | null;
  auto_degraded_at:     string | null;
  auto_degraded_reason: string | null;
  updated_at:           string;
}

function isoOf(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v); const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString();
}
function toRow(r: Record<string, unknown>): CategoryAutomationRow {
  return {
    tenant_id:            String(r.tenant_id),
    category:             r.category as CategoryName,
    mode:                 r.mode as AutomationMode,
    enabled_by:           (r.enabled_by as string | null) ?? null,
    enabled_at:           isoOf(r.enabled_at),
    last_check_in_at:     isoOf(r.last_check_in_at),
    auto_degraded_at:     isoOf(r.auto_degraded_at),
    auto_degraded_reason: (r.auto_degraded_reason as string | null) ?? null,
    updated_at:           isoOf(r.updated_at) ?? new Date().toISOString(),
  };
}

// ── Public helpers ────────────────────────────────────────────

/**
 * Set the mode for a (tenant, category). Enforces role scoping:
 *   * only owner/admin/agency_manager may enable 'automatic'
 *   * anyone with the 'propose_automatic' permission may set 'assisted'
 *   * setting to 'manual' is always permitted for anyone who can approve
 * Records enabled_by + enabled_at + resets any prior auto_degradation.
 * Also stamps last_check_in_at (this IS a merchant check-in).
 */
export interface SetCategoryModeInput {
  client:    PgClientLike;
  tenant_id: TenantId;
  category:  CategoryName;
  mode:      AutomationMode;
  actor:     string;
  grants:    readonly RoleGrantSnapshot[];
  now?:      Date;
}

export async function setCategoryMode(input: SetCategoryModeInput): Promise<CategoryAutomationRow> {
  if (input.mode === "automatic") {
    if (!permits(input.grants, "enable_automatic", input.now)) {
      const err = new Error(`permission_denied · actor=${input.actor} · action=enable_automatic`);
      (err as Error & { code?: string }).code = "PERMISSION_DENIED";
      throw err;
    }
  } else if (input.mode === "assisted") {
    if (!(permits(input.grants, "enable_automatic", input.now) || permits(input.grants, "propose_automatic", input.now))) {
      const err = new Error(`permission_denied · actor=${input.actor} · action=set_assisted`);
      (err as Error & { code?: string }).code = "PERMISSION_DENIED";
      throw err;
    }
  }
  const nowIso = (input.now ?? new Date()).toISOString();
  const r = await input.client.query(
    `INSERT INTO nex.social_category_automation
       (tenant_id, category, mode, enabled_by, enabled_at, last_check_in_at, updated_at)
     VALUES ($1::uuid, $2::text, $3::text, $4::text, $5::timestamptz, $5::timestamptz, $5::timestamptz)
     ON CONFLICT (tenant_id, category) DO UPDATE
       SET mode                 = EXCLUDED.mode,
           enabled_by           = EXCLUDED.enabled_by,
           enabled_at           = EXCLUDED.enabled_at,
           last_check_in_at     = EXCLUDED.last_check_in_at,
           auto_degraded_at     = NULL,
           auto_degraded_reason = NULL,
           updated_at           = EXCLUDED.updated_at
     RETURNING *`,
    [input.tenant_id, input.category, input.mode, input.actor, nowIso],
  );
  const row = toRow(r.rows[0]);
  await emitSocialAudit(input.client, {
    tenant_id:    input.tenant_id,
    event_type:   input.mode === "automatic" ? "category.automatic_enabled" : `category.mode_${input.mode}`,
    actor:        `user:${input.actor}`,
    subject_kind: "category",
    subject_id:   input.category,
    details:      { mode: input.mode, previous_mode_may_have_changed: true },
  });
  return row;
}

export async function getCategoryMode(
  client: PgClientLike,
  tenant_id: TenantId,
  category: CategoryName,
): Promise<CategoryAutomationRow | null> {
  const r = await client.query(
    `SELECT * FROM nex.social_category_automation WHERE tenant_id = $1 AND category = $2`,
    [tenant_id, category],
  );
  return r.rows[0] ? toRow(r.rows[0]) : null;
}

export async function listCategoryModes(client: PgClientLike, tenant_id: TenantId): Promise<CategoryAutomationRow[]> {
  const r = await client.query(
    `SELECT * FROM nex.social_category_automation WHERE tenant_id = $1 ORDER BY category`,
    [tenant_id],
  );
  return r.rows.map(toRow);
}

// Stamp a check-in for a (tenant, category). Called from every merchant
// approve / control-toggle / dashboard-view API path so the 14-day
// dormancy timer stays fresh.
export async function stampCheckIn(
  client: PgClientLike,
  tenant_id: TenantId,
  category?: CategoryName,
  now?: Date,
): Promise<number> {
  const nowIso = (now ?? new Date()).toISOString();
  if (category) {
    const r = await client.query(
      `UPDATE nex.social_category_automation SET last_check_in_at = $3::timestamptz, updated_at = $3::timestamptz
        WHERE tenant_id = $1 AND category = $2`,
      [tenant_id, category, nowIso]);
    return r.rowCount ?? 0;
  }
  const r = await client.query(
    `UPDATE nex.social_category_automation SET last_check_in_at = $2::timestamptz, updated_at = $2::timestamptz
      WHERE tenant_id = $1`,
    [tenant_id, nowIso]);
  return r.rowCount ?? 0;
}

// Sweep · Automatic categories whose last_check_in_at is older than
// 14 days are degraded to 'assisted'. Returns the affected rows.
export async function sweepAutoDegrade(
  client: PgClientLike,
  now?: Date,
  tenant_id?: TenantId,                // optional · limit sweep to one tenant (tests)
): Promise<CategoryAutomationRow[]> {
  const nowIso = (now ?? new Date()).toISOString();
  const params: unknown[] = [nowIso];
  let where = `mode = 'automatic'
                 AND last_check_in_at IS NOT NULL
                 AND last_check_in_at < ($1::timestamptz - INTERVAL '14 days')`;
  if (tenant_id) { params.push(tenant_id); where += ` AND tenant_id = $${params.length}`; }
  const r = await client.query(
    `UPDATE nex.social_category_automation
        SET mode = 'assisted',
            auto_degraded_at = $1::timestamptz,
            auto_degraded_reason = 'no merchant check-in in 14 days',
            updated_at = $1::timestamptz
      WHERE ${where}
      RETURNING *`,
    params,
  );
  return r.rows.map(toRow);
}
