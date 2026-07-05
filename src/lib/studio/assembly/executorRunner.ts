// Assembly Executor Runner — DB-touching orchestration.
//
// Splits from executor.ts so the pure dispatch stays importable from
// unit-test scripts without triggering server-only imports.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getModule } from "@/lib/studio/modules";
import {
  executeDecision,
  type ExecutorContext,
  type PendingDecisionRow
} from "./executor";

/** Materialise an `add-nav-item` decision: insert a row into
 *  studio_assembly_nav_entries so composeNavigation folds the item into
 *  the merchant's composed nav. Idempotent on (brand_id, proposal_id).
 *  Returns null on success, an error string on failure. */
async function materialiseNavEntry(
  row: PendingDecisionRow,
  ctx: ExecutorContext
): Promise<string | null> {
  const module = getModule(row.module_id);
  if (!module) return `unknown-source-module:${row.module_id}`;

  const label = module.name;
  const href = module.route ?? `/studio/apps/${row.module_id}`;
  const icon = module.glyph ?? null;

  const upsert = await supabaseAdmin
    .from("studio_assembly_nav_entries")
    .upsert(
      {
        merchant_id: ctx.merchantId,
        brand_id: ctx.brandId,
        target_slot: row.action_json.target,
        label,
        href,
        icon,
        order_index: 100 - row.action_json.priority,
        source_module_id: row.module_id,
        source_proposal_id: row.proposal_id,
        rationale_snapshot: row.rationale_snapshot
      },
      { onConflict: "brand_id,source_proposal_id" }
    )
    .select("id");
  return upsert.error?.message ?? null;
}

/** Materialise an `add-cta` decision: insert a row into
 *  studio_assembly_ctas keyed on (brand, proposal). Hero renderers read
 *  the highest-priority non-hidden row for their slot via getAssemblyCta.
 *  Idempotent. Returns null on success, error string on failure. */
async function materialiseCta(
  row: PendingDecisionRow,
  ctx: ExecutorContext
): Promise<string | null> {
  const module = getModule(row.module_id);
  if (!module) return `unknown-source-module:${row.module_id}`;

  // Label derives from the module's tagline where present, otherwise
  // the module name — merchants recognise their installed App by
  // either. Href is the module's route or the App Store deep-link.
  const label = ctaLabelFor(module);
  const href = module.route ?? `/studio/apps/${row.module_id}`;

  const upsert = await supabaseAdmin
    .from("studio_assembly_ctas")
    .upsert(
      {
        merchant_id: ctx.merchantId,
        brand_id: ctx.brandId,
        slot_id: row.action_json.target,
        label,
        href,
        priority: row.action_json.priority,
        source_module_id: row.module_id,
        source_proposal_id: row.proposal_id,
        rationale_snapshot: row.rationale_snapshot
      },
      { onConflict: "brand_id,source_proposal_id" }
    )
    .select("id");
  return upsert.error?.message ?? null;
}

/** Merchant-facing CTA label for each source module. Falls back to the
 *  module name so unmapped modules still get a working button. */
function ctaLabelFor(module: {
  id: string;
  name: string;
}): string {
  const OVERRIDES: Record<string, string> = {
    bookings: "Book a slot",
    payments: "Pay online",
    "quote-pipeline": "Get a quote",
    newsletter: "Get stock updates",
    "material-calculators": "Estimate materials",
    "verified-badges": "See our credentials"
  };
  return OVERRIDES[module.id] ?? module.name;
}

/** Reads every accepted-but-not-applied decision for a brand and runs
 *  the executor. Returns a summary the API can hand back to the UI. */
export async function runExecutorForBrand(
  ctx: ExecutorContext
): Promise<{
  applied: number;
  queued: number;
  errors: Array<{ proposalId: string; error: string }>;
}> {
  const pending = await supabaseAdmin
    .from("studio_assembly_decisions")
    .select("id, proposal_id, module_id, rule_id, action_json, rationale_snapshot")
    .eq("brand_id", ctx.brandId)
    .eq("decision", "accepted")
    .is("applied_at", null);

  if (pending.error) {
    throw new Error(pending.error.message);
  }

  const rows = (pending.data ?? []) as unknown as PendingDecisionRow[];
  let applied = 0;
  let queued = 0;
  const errors: Array<{ proposalId: string; error: string }> = [];
  const now = new Date().toISOString();

  for (const row of rows) {
    const outcome = executeDecision(row.action_json, ctx);
    if (!outcome.ok) {
      // Honest "queued" — we RECORD the current inability so the audit
      // trail is real; applied_at stays null so a future executor slice
      // can retry after implementing that action-kind.
      await supabaseAdmin
        .from("studio_assembly_decisions")
        .update({ apply_error: outcome.error })
        .eq("id", row.id);
      queued += 1;
      errors.push({ proposalId: row.proposal_id, error: outcome.error });
      continue;
    }

    // Runner-side side effects — one branch per action-kind that the
    // executor greenlit but requires a DB write.
    let sideEffectError: string | null = null;
    if (row.action_json.kind === "add-nav-item") {
      sideEffectError = await materialiseNavEntry(row, ctx);
    } else if (row.action_json.kind === "add-cta") {
      sideEffectError = await materialiseCta(row, ctx);
    }

    if (sideEffectError) {
      await supabaseAdmin
        .from("studio_assembly_decisions")
        .update({ apply_error: sideEffectError })
        .eq("id", row.id);
      queued += 1;
      errors.push({ proposalId: row.proposal_id, error: sideEffectError });
    } else {
      await supabaseAdmin
        .from("studio_assembly_decisions")
        .update({ applied_at: now, apply_error: null })
        .eq("id", row.id);
      applied += 1;
    }
  }

  return { applied, queued, errors };
}
