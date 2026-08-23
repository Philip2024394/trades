#!/usr/bin/env node
// NEX Food · Phase 8.2 · batch recompute of NEXT_ACTION per business.
//
// Reads current business state + commercial value + outreach history · runs
// the deterministic rule engine · persists results into
// nex.food_business_next_action · logs every state change into
// nex.food_next_action_audit.
//
// USAGE
//   NEX_POSTGRES_URL=... node scripts/nex-food/hq-recompute-next-actions.mjs
//     [--business=<ref>]   restrict to a single business
//     [--refresh-mv]       REFRESH MATERIALIZED VIEW nex.food_business_value first
//     [--json]             emit JSON summary instead of text
//
// Safe to re-run. Deterministic given input state.

import pg from "pg";

const args = process.argv.slice(2);
const singleRef = args.find((a) => a.startsWith("--business="))?.split("=")[1];
const refreshMv = args.includes("--refresh-mv");
const wantJson = args.includes("--json");

// Inline copy of the rule engine (mjs · no ts build step).

const DEFAULT_RULES = {
  freeAllowanceQualifiedEnquiries: 5,
  offerMembershipMinValueScore: 100,
  churnSignalDaysInactive: 60,
  followUpCooldownDays: 30,
  onboardWindowDaysAfterClaim: 7,
};

function computeNextAction(input, rules = DEFAULT_RULES) {
  const wrap = (nextAction, reason) => ({ nextAction, reason, inputSnapshot: input });

  if (input.suppressed) return wrap("NO_ACTION", "Suppression list · outreach permanently blocked");
  if (input.claimStatus === "paying") return wrap("NO_ACTION", "Paying NEX member · no acquisition action needed");
  if (input.claimStatus === "discovered" || input.claimStatus === "verifying") {
    return wrap("WAIT", `Business in ${input.claimStatus} · admin verification pending`);
  }
  if (input.claimStatus === "invited" && input.ownerStatus === "contacted") {
    if (input.daysSinceLastOutreach != null && input.daysSinceLastOutreach < 7) {
      return wrap("CLAIM_PENDING", "Invitation sent recently · give owner time to respond");
    }
    if (input.daysSinceLastOutreach != null && input.daysSinceLastOutreach < rules.followUpCooldownDays) {
      return wrap("WAIT", `Follow-up cooldown · ${rules.followUpCooldownDays - input.daysSinceLastOutreach} days until next allowed`);
    }
    return wrap("FOLLOW_UP", `Invited > ${rules.followUpCooldownDays} days ago · owner has not responded`);
  }
  if (input.claimStatus === "claimed" && input.daysSinceClaim != null && input.daysSinceClaim <= rules.onboardWindowDaysAfterClaim) {
    return wrap("ONBOARD", `Claimed ${input.daysSinceClaim} day(s) ago · guide owner through dashboard`);
  }
  if (input.claimStatus === "claimed") {
    const allowanceExhausted = input.qualifiedEnquiries >= rules.freeAllowanceQualifiedEnquiries;
    const valueThresholdHit = input.nexValueScore >= rules.offerMembershipMinValueScore;
    if (allowanceExhausted || valueThresholdHit) {
      const trigger = allowanceExhausted
        ? `free allowance exhausted (${input.qualifiedEnquiries}/${rules.freeAllowanceQualifiedEnquiries} qualified enquiries used)`
        : `value threshold hit (score=${input.nexValueScore} ≥ ${rules.offerMembershipMinValueScore})`;
      return wrap("OFFER_MEMBERSHIP", `Claimed business ready for conversion · ${trigger}`);
    }
    return wrap("SHOW_VALUE", `Claimed · ${input.qualifiedEnquiries}/${rules.freeAllowanceQualifiedEnquiries} enquiries · value=${input.nexValueScore} · keep delivering`);
  }
  if (input.claimStatus === "listed") {
    if (!input.hasContactDestination) return wrap("NO_ACTION", "Listed · no contact destination · enrichment needed");
    if (input.activeCampaignThrottle) return wrap("WAIT", "Active campaign handles this · avoid duplicate outreach");
    if (input.daysSinceLastOutreach == null) return wrap("INVITE_BUSINESS", "Listed with contact · never invited · ready for first outreach");
    if (input.daysSinceLastOutreach >= rules.followUpCooldownDays) return wrap("FOLLOW_UP", `Listed · last touch ${input.daysSinceLastOutreach}d ago · follow-up allowed`);
    return wrap("WAIT", `Cooldown · ${rules.followUpCooldownDays - input.daysSinceLastOutreach}d until next allowed`);
  }
  return wrap("NO_ACTION", "No rule matched · investigate business state");
}

// ── Data loaders ────────────────────────────────────────────────────────────

async function loadRules(pool) {
  const r = await pool.query(`SELECT rule_key, rule_value_int FROM nex.food_hq_rule WHERE rule_value_int IS NOT NULL`);
  const overrides = { ...DEFAULT_RULES };
  for (const row of r.rows) {
    if (row.rule_key === "free_allowance_qualified_enquiries") overrides.freeAllowanceQualifiedEnquiries = row.rule_value_int;
    else if (row.rule_key === "offer_membership_min_value_score") overrides.offerMembershipMinValueScore = row.rule_value_int;
    else if (row.rule_key === "churn_signal_days_inactive") overrides.churnSignalDaysInactive = row.rule_value_int;
    else if (row.rule_key === "follow_up_cooldown_days") overrides.followUpCooldownDays = row.rule_value_int;
    else if (row.rule_key === "onboard_window_days_after_claim") overrides.onboardWindowDaysAfterClaim = row.rule_value_int;
  }
  return overrides;
}

async function loadBusinessSnapshots(pool, filterRef) {
  const whereBiz = filterRef ? `WHERE b.public_listing_ref = $1` : ``;
  const params = filterRef ? [filterRef] : [];
  const r = await pool.query(`
    SELECT
      b.public_listing_ref AS business_ref,
      b.business_name,
      b.claim_status,
      b.owner_status,
      b.phone,
      b.whatsapp_number,
      COALESCE(v.qualified_enquiries, 0) AS qualified_enquiries,
      COALESCE(v.nex_value_score, 0) AS nex_value_score,
      (
        SELECT MAX(created_at)
        FROM nex.food_outreach_attempt oa
        WHERE oa.business_ref = b.public_listing_ref
          AND oa.status IN ('sent','delivered','queued','dry_run')
      ) AS last_outreach_at,
      (
        SELECT MIN(cc.consumed_at)
        FROM nex.food_claim_code cc
        WHERE cc.business_ref = b.public_listing_ref
          AND cc.consumed_at IS NOT NULL
      ) AS first_claim_consumed_at,
      EXISTS(
        SELECT 1 FROM nex.food_outreach_suppression sup
        WHERE sup.business_ref = b.public_listing_ref
      ) AS suppressed
    FROM nex.food_business b
    LEFT JOIN nex.food_business_value v ON v.business_ref = b.public_listing_ref
    ${whereBiz}
    ORDER BY b.public_listing_ref
  `, params);
  return r.rows;
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
  const pool = new pg.Pool({ connectionString: url });

  if (refreshMv) {
    await pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY nex.food_business_value`);
    console.log("  refreshed materialized view nex.food_business_value");
  }

  const rules = await loadRules(pool);
  const businesses = await loadBusinessSnapshots(pool, singleRef);
  const now = new Date();

  const outputs = [];
  for (const b of businesses) {
    const input = {
      businessRef: b.business_ref,
      claimStatus: b.claim_status,
      ownerStatus: b.owner_status,
      qualifiedEnquiries: Number(b.qualified_enquiries),
      nexValueScore: Number(b.nex_value_score),
      daysSinceLastOutreach: daysBetween(b.last_outreach_at, now),
      daysSinceClaim: daysBetween(b.first_claim_consumed_at, now),
      suppressed: b.suppressed === true,
      hasContactDestination: Boolean(b.whatsapp_number ?? b.phone),
      activeCampaignThrottle: false,
    };
    const result = computeNextAction(input, rules);

    // Check previous action for audit-log trigger
    const prev = await pool.query(
      `SELECT next_action FROM nex.food_business_next_action WHERE business_ref = $1`,
      [b.business_ref]
    );
    const fromAction = prev.rowCount > 0 ? prev.rows[0].next_action : null;
    const changed = fromAction !== result.nextAction;

    await pool.query(
      `INSERT INTO nex.food_business_next_action
         (business_ref, next_action, reason, computed_at, input_snapshot)
       VALUES ($1, $2, $3, now(), $4)
       ON CONFLICT (business_ref)
       DO UPDATE SET next_action = EXCLUDED.next_action,
                     reason = EXCLUDED.reason,
                     computed_at = EXCLUDED.computed_at,
                     input_snapshot = EXCLUDED.input_snapshot`,
      [b.business_ref, result.nextAction, result.reason, JSON.stringify(input)]
    );

    if (changed) {
      await pool.query(
        `INSERT INTO nex.food_next_action_audit
           (business_ref, from_action, to_action, reason, input_snapshot, computed_by)
         VALUES ($1, $2, $3, $4, $5, 'engine:v1')`,
        [b.business_ref, fromAction, result.nextAction, result.reason, JSON.stringify(input)]
      );
    }

    outputs.push({
      businessRef: b.business_ref,
      businessName: b.business_name,
      claimStatus: b.claim_status,
      ownerStatus: b.owner_status,
      previousAction: fromAction,
      nextAction: result.nextAction,
      reason: result.reason,
      changed,
      nexValueScore: input.nexValueScore,
      qualifiedEnquiries: input.qualifiedEnquiries,
    });
  }

  await pool.end();

  if (wantJson) {
    console.log(JSON.stringify({ rules, count: outputs.length, businesses: outputs }, null, 2));
    return;
  }

  console.log(`── Next-action recompute complete · ${outputs.length} businesses ──`);
  console.log();
  const counts = {};
  for (const o of outputs) counts[o.nextAction] = (counts[o.nextAction] ?? 0) + 1;
  console.log("Action counts:");
  for (const [a, n] of Object.entries(counts).sort((x, y) => y[1] - x[1])) {
    console.log(`  ${a.padEnd(24)} ${n}`);
  }
  console.log();
  console.log("Detailed:");
  for (const o of outputs) {
    const flag = o.changed ? "*" : " ";
    console.log(`${flag} ${o.businessRef}  ${o.businessName.slice(0, 40).padEnd(40)}  ${o.nextAction.padEnd(20)}  ${o.reason.slice(0, 70)}`);
  }
  const changedCount = outputs.filter((o) => o.changed).length;
  console.log(`\nChanged this run: ${changedCount} (marked with *)`);
}

main().catch((err) => { console.error(`FATAL: ${err.message}`); console.error(err.stack); process.exit(1); });
