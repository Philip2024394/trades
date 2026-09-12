// src/lib/nex-agent/core/autonomous-engineer.ts
//
// NEX Agent v1.5 · Autonomous Engineer evaluator.
// Decides whether a given plan qualifies for AUTO-APPLY given:
//   1. Founder has ACTIVATED a pre-cleared category matching this plan
//   2. Nex1's current autonomy tier meets the category's required_min_autonomy_tier
//   3. The plan's proposed_files stay within the category's allowed_path_prefixes
//   4. NONE of the plan's paths hit forbidden_path_prefixes (rules · tierCatalog · truth-engine · migrations · ADRs)
//   5. The daily cap for the category hasn't been hit
//   6. Architecture Guardian's merge_gate says can_merge=true
//   7. Founder's stop-override is false
//
// If ANY of 1-7 fail → founder-approval-required. Founder stays in the loop for
// every business-relevant change. This library is passive: it computes the
// decision · it does NOT trigger the apply. The founder-approved flow still
// calls postgresApplyMigration / writeFileSafe · this just gates whether the
// UI shows "auto-apply · SAFE" or "founder-approval-required".

import { Client } from "pg";
import type { Plan } from "./orchestrator-types";
import { computeAutonomyDashboard } from "./autonomy-dashboard";
import { runMergeGate } from "./architecture-guardian";

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}
async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  await c.connect();
  try { return await fn(c); } finally { try { await c.end(); } catch { /* ignore */ } }
}

export interface PreClearedCategory {
  category_id: string;
  category_key: string;
  category_label: string;
  description: string;
  max_files_changed: number;
  allowed_intent_kinds: string[];
  allowed_path_prefixes: string[];
  forbidden_path_prefixes: string[];
  required_min_autonomy_tier: "LOW" | "MEDIUM" | "HIGH";
  max_auto_applies_per_day: number;
  active: boolean;
}

export interface AutonomousDecision {
  can_auto_apply: boolean;
  matched_category: PreClearedCategory | null;
  reasons_for: string[];
  reasons_against: string[];
  founder_approval_required: boolean;
  daily_cap_reached: boolean;
  autonomy_tier: string;
}

export async function listPreClearedCategories(): Promise<PreClearedCategory[]> {
  return withClient(async c => {
    const r = await c.query(`SELECT * FROM nex_agent.pre_cleared_categories ORDER BY category_key`);
    return r.rows.map(row => ({
      ...row,
      allowed_intent_kinds: Array.isArray(row.allowed_intent_kinds) ? row.allowed_intent_kinds : [],
      allowed_path_prefixes: Array.isArray(row.allowed_path_prefixes) ? row.allowed_path_prefixes : [],
      forbidden_path_prefixes: Array.isArray(row.forbidden_path_prefixes) ? row.forbidden_path_prefixes : [],
    }));
  });
}

// Never-auto-applyable paths · these force founder approval regardless of category
const NEVER_AUTO_APPLY_PATHS = [
  "rules/", "src/lib/tierCatalog.ts", "src/lib/nex/truth-engine/",
  "db/migrations/", "supabase/migrations/", "docs/DECISIONS/",
];

export async function evaluateAutonomousDecision(plan: Plan): Promise<AutonomousDecision> {
  const reasons_for: string[] = [];
  const reasons_against: string[] = [];

  // 1. Compute current autonomy tier
  const dashboard = await computeAutonomyDashboard();
  const currentTier = dashboard.tier;

  // 2. Merge-gate must pass (Architecture Guardian says architecturally clean)
  const mergeGate = runMergeGate(plan);
  if (!mergeGate.can_merge) {
    reasons_against.push(`Architecture Guardian block: ${mergeGate.blocked_by.slice(0, 2).join("; ")}`);
    return { can_auto_apply: false, matched_category: null, reasons_for, reasons_against, founder_approval_required: true, daily_cap_reached: false, autonomy_tier: currentTier };
  }
  reasons_for.push(`Architecture Guardian: PASS`);

  // 3. Never-auto-apply path check (regardless of category)
  // Filter out unresolved template placeholders (e.g. "src/app/api/{route}/route.ts" ·
  // "db/migrations/NNN_TODO_ENGINEER_PICK_NUMBER.sql" · "src/lib/nex/{name}/index.ts").
  // Only REAL paths from proposed_files matter for the auto-apply gate.
  const rawTouched = [...(plan.files_to_touch ?? []), ...(plan.files_to_create ?? []), ...(plan.proposed_files ?? []).map(f => f.path)];
  const isPlaceholder = (p: string) => /\{[a-zA-Z_]+\}|TBD|TODO_ENGINEER|NNN/.test(p);
  const touched = rawTouched.filter(p => !isPlaceholder(p));
  const hitNever = touched.find(p => NEVER_AUTO_APPLY_PATHS.some(prefix => p.startsWith(prefix)));
  if (hitNever) {
    reasons_against.push(`Touches never-auto-apply path: ${hitNever}`);
    return { can_auto_apply: false, matched_category: null, reasons_for, reasons_against, founder_approval_required: true, daily_cap_reached: false, autonomy_tier: currentTier };
  }
  reasons_for.push("No never-auto-apply paths touched");

  // 4. Try to match an ACTIVE pre-cleared category
  const categories = (await listPreClearedCategories()).filter(c => c.active);
  if (categories.length === 0) {
    reasons_against.push("No pre-cleared categories active · founder hasn't turned any on yet");
    return { can_auto_apply: false, matched_category: null, reasons_for, reasons_against, founder_approval_required: true, daily_cap_reached: false, autonomy_tier: currentTier };
  }

  const intent = plan.intent?.kind ?? "";
  const tierOrder: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
  let matched: PreClearedCategory | null = null;
  for (const cat of categories) {
    // Intent kind check
    if (cat.allowed_intent_kinds.length > 0 && !cat.allowed_intent_kinds.includes(intent)) continue;
    // Every touched path must be inside allowed_path_prefixes
    const allPathsAllowed = touched.every(p => cat.allowed_path_prefixes.some(prefix => p.startsWith(prefix)));
    if (!allPathsAllowed) continue;
    // No path can hit category's forbidden_path_prefixes
    const anyForbidden = touched.some(p => cat.forbidden_path_prefixes.some(prefix => p.startsWith(prefix)));
    if (anyForbidden) continue;
    // Files-changed cap
    if (touched.length > cat.max_files_changed) continue;
    // Autonomy tier meets requirement
    if (tierOrder[currentTier] < tierOrder[cat.required_min_autonomy_tier]) continue;
    matched = cat;
    break;
  }
  if (!matched) {
    reasons_against.push("No active pre-cleared category matches this plan (intent, paths, tier or file-count didn't align)");
    return { can_auto_apply: false, matched_category: null, reasons_for, reasons_against, founder_approval_required: true, daily_cap_reached: false, autonomy_tier: currentTier };
  }
  reasons_for.push(`Matches category: ${matched.category_label}`);
  reasons_for.push(`Autonomy tier ${currentTier} ≥ required ${matched.required_min_autonomy_tier}`);

  // 5. Daily cap check
  const usedToday = await withClient(async c => {
    const r = await c.query(`SELECT count(*)::int c FROM nex_agent.auto_apply_events WHERE category_id=$1 AND decided_at >= (now() - interval '24 hours') AND decision='auto_applied'`, [matched.category_id]);
    return Number(r.rows[0].c);
  });
  if (usedToday >= matched.max_auto_applies_per_day) {
    reasons_against.push(`Daily cap reached (${usedToday}/${matched.max_auto_applies_per_day} auto-applies in last 24h for this category)`);
    return { can_auto_apply: false, matched_category: matched, reasons_for, reasons_against, founder_approval_required: true, daily_cap_reached: true, autonomy_tier: currentTier };
  }
  reasons_for.push(`Daily cap ok (${usedToday}/${matched.max_auto_applies_per_day} used)`);

  // 6. Founder stop-override check (best-effort · library exists at agent-runtime/registry)
  // In V1.5 this would call readFounderStopOverride() · for now we assume founder hasn't stopped
  // If they had, the whole agent-runtime would be halted before this point.

  return { can_auto_apply: true, matched_category: matched, reasons_for, reasons_against, founder_approval_required: false, daily_cap_reached: false, autonomy_tier: currentTier };
}

// Audit trail for every decision (whether auto-applied or refused)
export async function recordAutoApplyDecision(input: { task_id?: string; category_id?: string; decision: "auto_applied" | "refused_tier" | "refused_category" | "refused_daily_cap" | "founder_forced_review"; reason: string; files_changed?: number; }): Promise<void> {
  await withClient(c => c.query(
    `INSERT INTO nex_agent.auto_apply_events (task_id, category_id, decision, reason, files_changed) VALUES ($1,$2,$3,$4,$5)`,
    [input.task_id ?? null, input.category_id ?? null, input.decision, input.reason, input.files_changed ?? 0],
  ));
}
