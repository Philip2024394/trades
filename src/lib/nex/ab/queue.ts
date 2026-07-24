// Approval queue — the pane the merchant works through in one sitting.
//
// Composes PreparedActions from:
//   • MD recommendations (already action-shaped)
//   • MD priorities  (alert + warning)
//   • FI observations you can act on (overdue chase, budget warnings)
//   • CX "customers to contact" (referral / check-in nudges)
//   • SC shopping list (top 3 items become a PO-draft nudge)
//   • Custom AutomationRules the caller registered
//
// Dedup by key. Sorted by severity + preserves original order.

import { buildBusinessSnapshot } from "../bi";
import { findCustomersToContact } from "../cx";
import { buildFinancialSnapshot } from "../fi";
import { buildMDBriefing } from "../md";
import { buildSCSnapshot } from "../sc";
import { evaluateRules } from "./rules";
import { evidenceFor } from "./types";
import { isAutoApprovable, resolveAutonomy } from "./modes";
import type {
  ApprovalQueue,
  AutomationRule,
  AutonomySettings,
  PreparedAction,
  PreparedActionCategory
} from "./types";

const SEV: Record<PreparedAction["severity"], number> = { alert: 0, warning: 1, notice: 2, info: 3 };

export type BuildQueueInput = {
  merchantSlug: string;
  now?:         Date;
  /** Per-call autonomy override (defaults to manual — see modes.ts). */
  autonomy?:    AutonomySettings;
  /** Optional custom AutomationRules to evaluate on top of the
   *  built-in engine sweep. */
  rules?:       AutomationRule[];
};

export async function buildApprovalQueue(input: BuildQueueInput): Promise<ApprovalQueue> {
  const now = input.now ?? new Date();
  const autonomy = input.autonomy ?? resolveAutonomy({ merchantSlug: input.merchantSlug });
  const errors: ApprovalQueue["errors"] = [];

  const [bi, md, fi, sc, quiet] = await Promise.all([
    tryRun("bi", () => buildBusinessSnapshot({ merchantSlug: input.merchantSlug, now }), errors),
    tryRun("md", () => buildMDBriefing({ merchantSlug: input.merchantSlug, now }),        errors),
    tryRun("fi", () => buildFinancialSnapshot({ merchantSlug: input.merchantSlug, now }), errors),
    tryRun("sc", () => buildSCSnapshot({ merchantSlug: input.merchantSlug, now }),        errors),
    tryRun("cx", () => cxQuiet(input.merchantSlug),                                       errors)
  ]);

  const actions: PreparedAction[] = [];

  // ── MD recommendations become actionable PreparedActions.
  const mdBriefing = md?.ok ? md.briefing : null;
  if (mdBriefing) {
    for (const r of mdBriefing.recommendations) {
      const severity = r.urgency === "today" ? "warning" : r.urgency === "this_week" ? "notice" : "info";
      actions.push({
        key:               `md_rec:${r.key}`,
        category:          categoryFromMDSource(r.source),
        severity,
        headline:          r.action,
        reason:            r.reason,
        preview_of_effect: "Nex would prepare a draft — nothing sends without your approval.",
        reversible:        true,
        source:            "md",
        evidence:          r.evidence,
        status:            "awaiting_approval"
      });
    }
    for (const p of mdBriefing.priorities) {
      if (p.severity === "info" || p.severity === "notice") continue;
      actions.push({
        key:               `md_pri:${p.key}`,
        category:          "recommendation",
        severity:          p.severity,
        headline:          p.headline,
        reason:            p.detail ?? p.headline,
        preview_of_effect: "Advisory — no action prepared, just flagged for your attention.",
        reversible:        true,
        source:            "md",
        action_url:        p.action?.href,
        action_label:      p.action?.label,
        evidence:          p.evidence,
        status:            "awaiting_approval"
      });
    }
  }

  // ── FI: overdue-payment nudge action.
  const fiSnap = fi?.ok ? fi.snapshot : null;
  if (fiSnap && fiSnap.cashflow_ref.overdue_now_pence > 0) {
    actions.push({
      key:               "fi_overdue_chase",
      category:          "invoice_reminder",
      severity:          fiSnap.cashflow_ref.overdue_now_pence > 100_000 ? "warning" : "notice",
      headline:          `Chase £${(fiSnap.cashflow_ref.overdue_now_pence / 100).toLocaleString("en-GB")} overdue.`,
      reason:            "Overdue balance across sitebook_costs. Nex can draft chase messages per customer.",
      preview_of_effect: "Drafts one WhatsApp/email per overdue payer — you approve each before it sends.",
      reversible:        true,
      source:            "fi",
      evidence:          evidenceFor("FI snapshot cashflow_ref.overdue_now_pence", ["hammerex_sitebook_costs"]),
      status:            "awaiting_approval"
    });
  }

  // ── CX: quiet-customer check-in nudge (top 3).
  const quietList = quiet ?? [];
  for (const c of quietList.slice(0, 3)) {
    actions.push({
      key:               `cx_checkin:${c.contactId}`,
      category:          "customer_message",
      severity:          "notice",
      headline:          `Check in with ${c.displayName}`,
      reason:            c.note,
      preview_of_effect: "Drafts a friendly check-in message — merchant approves before send.",
      reversible:        true,
      source:            "cx",
      evidence:          evidenceFor("CX findCustomersToContact", ["app_crm_contacts"]),
      status:            "awaiting_approval"
    });
  }

  // ── SC: shopping-list PO draft nudge.
  const scSnap = sc?.ok ? sc.snapshot : null;
  if (scSnap && scSnap.shopping_list.lines.length > 0) {
    actions.push({
      key:               "sc_po_draft",
      category:          "purchase_order",
      severity:          "notice",
      headline:          `${scSnap.shopping_list.lines.length} materials line${scSnap.shopping_list.lines.length === 1 ? "" : "s"} needed in the next ${scSnap.shopping_list.window_days} days.`,
      reason:            `Aggregated from ${scSnap.shopping_list.jobs_count} scheduled jobs. Estimated £${(scSnap.shopping_list.total_pence / 100).toLocaleString("en-GB")}.`,
      preview_of_effect: "Prepares one purchase-order draft per supplier — you approve before sending.",
      reversible:        true,
      source:            "sc",
      evidence:          evidenceFor("SC shopping_list", ["app_job_diary_jobs", "app_quote_workspace_quote_items"]),
      status:            "awaiting_approval"
    });
  }

  // ── BI observations (top warnings) that aren't already covered above.
  const biSnap = bi ?? null;
  if (biSnap) {
    for (const o of biSnap.observations) {
      if (o.severity === "info") continue;
      const key = `bi_obs:${o.key}`;
      actions.push({
        key,
        category:          "recommendation",
        severity:          o.severity,
        headline:          o.headline,
        reason:            o.detail ?? o.headline,
        preview_of_effect: "Advisory — no action prepared, review at your convenience.",
        reversible:        true,
        source:            "bi",
        action_url:        o.action?.href,
        action_label:      o.action?.label,
        evidence:          o.evidence,
        status:            "awaiting_approval"
      });
    }
  }

  // ── Custom rules.
  if (input.rules && input.rules.length > 0) {
    const { actions: customActions } = await evaluateRules(input.rules, { merchant_slug: input.merchantSlug, autonomy });
    for (const a of customActions) actions.push(a);
  }

  // Dedup + sort.
  const bestByKey = new Map<string, PreparedAction>();
  for (const a of actions) {
    const cur = bestByKey.get(a.key);
    if (!cur || SEV[a.severity] < SEV[cur.severity]) bestByKey.set(a.key, a);
  }
  const merged = Array.from(bestByKey.values()).sort((a, b) => SEV[a.severity] - SEV[b.severity]);

  // Split into auto-approvable set (mirrors what merchant would see
  // if they'd opted into trusted mode with categories).
  const autoSet = merged.filter((a) => isAutoApprovable(a.category, a.reversible, autonomy));

  return {
    computed_at:     now.toISOString(),
    merchant_slug:   input.merchantSlug,
    autonomy,
    actions:         merged,
    auto_approvable: autoSet,
    errors
  };
}

async function tryRun<T>(name: string, fn: () => Promise<T>, errors: ApprovalQueue["errors"]): Promise<T | null> {
  try { return await fn(); }
  catch (err) {
    errors.push({ module: name, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

async function cxQuiet(merchantSlug: string): Promise<Array<{ contactId: string; displayName: string; note: string }>> {
  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("slug", merchantSlug)
    .maybeSingle();
  if (!listing.data) return [];
  const merchantId = String(listing.data.id);
  return findCustomersToContact(merchantId, 60);
}

function categoryFromMDSource(source: string): PreparedActionCategory {
  if (source === "md_cashflow") return "invoice_reminder";
  if (source === "md_profit")   return "recommendation";
  if (source === "cx")          return "customer_message";
  return "recommendation";
}
