// Nex Autonomous Business — supervised-autonomy contracts.
//
// Every prior engine SURFACES observations + recommendations. This
// layer turns those into an approval queue the merchant works through
// with a single review pane, and provides the framework for
// AutomationRules that PREPARE actions but never auto-execute unless
// the merchant explicitly opted in.
//
// Non-negotiables (memory + spec):
//   • Nothing auto-fires. Every PreparedAction ships as
//     status='awaiting_approval' until the merchant confirms.
//   • Every action is REVERSIBLE and carries a preview_of_effect.
//   • Autonomy mode defaults to 'manual' (advise-only) until a
//     persistence source lands. No silent behaviour changes.

import type { Evidence } from "../pi/types";
export type { Evidence };

// ─── Autonomy modes ─────────────────────────────────────────────

export type AutonomyMode = "manual" | "assisted" | "trusted" | "enterprise";

export type AutonomySettings = {
  merchant_slug: string;
  mode:          AutonomyMode;
  /** Which action categories are auto-approvable in 'trusted' mode.
   *  Empty in manual/assisted. Enterprise ships an object per role. */
  trusted_categories: PreparedActionCategory[];
  /** Where the mode came from — helps the merchant see it hasn't been
   *  silently changed. */
  source: "engine_default" | "merchant_override";
};

export const MODE_LABELS: Record<AutonomyMode, string> = {
  manual:     "Manual — Nex advises only, nothing prepared without asking",
  assisted:   "Assisted — Nex prepares everything, you approve every send",
  trusted:    "Trusted — selected categories auto-send once prepared",
  enterprise: "Enterprise — policy-driven, different approval levels per staff"
};

// ─── Prepared actions ───────────────────────────────────────────

export type PreparedActionCategory =
  | "customer_message"        // WhatsApp / email drafts
  | "quote_followup"          // chase-up nudges on sent quotes
  | "invoice_reminder"        // overdue-payment nudges
  | "social_post"             // marketing draft
  | "review_request"          // ask for review
  | "purchase_order"          // materials shopping list → PO draft
  | "project_update"          // SiteBook update draft
  | "maintenance_reminder"    // homeowner care nudge
  | "recommendation";         // pure advisory, no send action

export type PreparedActionSeverity = "alert" | "warning" | "notice" | "info";

/** The unit of work that lands in the approval queue. */
export type PreparedAction = {
  key:                 string;              // stable dedupe key
  category:            PreparedActionCategory;
  severity:            PreparedActionSeverity;
  headline:            string;              // 1-line summary
  reason:              string;              // WHY this is being suggested
  preview_of_effect:   string;              // what will happen if approved
  reversible:          boolean;
  /** Where this action came from (BI observation / MD recommendation
   *  / cross-engine synthesis). */
  source:              "bi" | "pm" | "cx" | "fi" | "sc" | "md" | "cv" | "net" | "ab";
  /** Optional action URL the merchant can jump to instead of approving
   *  from the queue. */
  action_url?:         string;
  action_label?:       string;
  evidence:            Evidence;
  /** Merchant approval state — always 'awaiting_approval' at prep time. */
  status:              "awaiting_approval";
};

// ─── Automation rule contract ───────────────────────────────────
//
// Rules describe SHAPE only — nothing here executes. The rule
// evaluator returns { matches, prepared_action } and callers decide
// whether to auto-fire (only when merchant is in 'trusted' mode AND
// the category is in trusted_categories AND action.reversible).

export type AutomationRuleContext = {
  merchant_slug: string;
  autonomy:      AutonomySettings;
};

export type AutomationRuleResult = {
  matches:         boolean;
  prepared_action?: PreparedAction;
  auto_approvable: boolean;                // true only when policy AND action allow
  reason:          string;                 // "matches; category in trusted list; reversible"
};

export type AutomationRule = {
  key:        string;
  name:       string;
  category:   PreparedActionCategory;
  /** Pure predicate + action builder. Never touches the DB directly. */
  evaluate:   (ctx: AutomationRuleContext) => Promise<AutomationRuleResult>;
};

// ─── Approval queue snapshot ────────────────────────────────────

export type ApprovalQueue = {
  computed_at:   string;
  merchant_slug: string;
  autonomy:      AutonomySettings;
  actions:       PreparedAction[];         // sorted alert → warning → notice → info
  /** Actions that would auto-fire under current mode + policy. Merchant
   *  sees these so nothing surprises them. */
  auto_approvable: PreparedAction[];
  errors:        Array<{ module: string; error: string }>;
};

// ─── Overnight run ──────────────────────────────────────────────

export type OvernightRun = {
  merchant_slug:   string;
  ran_at:          string;
  /** How many actions were prepared (in queue). */
  prepared_count:  number;
  /** How many actions the current mode would auto-approve (0 today). */
  auto_approved:   number;
  /** Highlights the merchant should look at first. */
  highlights:      Array<{ headline: string; category: PreparedActionCategory }>;
  /** Full queue for the morning briefing. */
  queue:           ApprovalQueue;
  errors:          string[];
};

// ─── Multi-agent facade ─────────────────────────────────────────

export type NexAgent =
  | "marketing"   // routes to BI social / bi_observations
  | "finance"     // routes to FI
  | "projects"    // routes to PM / PI
  | "customer"    // routes to CX
  | "procurement" // routes to SC
  | "compliance"; // no-source-yet, honest reply

export const AGENT_DESCRIPTIONS: Record<NexAgent, string> = {
  marketing:   "Marketing Nex — social posts, campaign observations, publishing status.",
  finance:     "Finance Nex — revenue, profit, cash flow, VAT, affordability.",
  projects:    "Projects Nex — portfolio overview, per-project snapshots, delays.",
  customer:    "Customer Nex — customer profiles, list queries, referrals.",
  procurement: "Procurement Nex — supplier profiles, shopping lists, alternatives.",
  compliance:  "Compliance Nex — safety / certificates / regulations (source data pending)."
};

export function evidenceFor(source: string, tables: string[] = []): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString()
  };
}
