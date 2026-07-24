// Autonomous workflow actions — DRAFT ONLY.
//
// Nex will prepare the content. The merchant approves before Nex sends
// anything. Every ActionSuggestion has `requires_approval: true` — the
// approval gate lives in Phase 15 (AB) and is enforced there. This
// engine only produces the drafts.
//
// Constitutional rules that apply here (from CLAUDE.md + memory):
//   • Never auto-send. Never auto-charge. Never auto-publish.
//   • No voice AI in the purchasing path.
//   • Every draft carries an evidence chain.

import { evidenceFor, type ActionKind, type ActionSuggestion } from "./types";

export type OverdueInvoice = {
  invoice_id:     string;
  customer_label: string;
  amount_pence:   number;
  days_overdue:   number;
};

export type StaleFollowUp = {
  customer_label: string;
  last_touch_days: number;
};

export type QuoteToPrepare = {
  customer_label: string;
  scope_brief:    string;
  price_hint_pence?: number;
};

export type ProjectUpdateToPrepare = {
  project_id:     string;
  project_title:  string;
  status_change:  string;    // "Ready for sign-off" / "Awaiting materials"
};

export type SupplierRecommendation = {
  need:          string;     // "20mm MDPE 100m"
  supplier_name: string;
  reason:        string;
};

export type ReportToPrepare = {
  label:         string;     // "November P&L for accountant"
  period:        string;
};

export type SuggestActionsInput = {
  overdue_invoices?:  OverdueInvoice[];
  stale_follow_ups?:  StaleFollowUp[];
  quotes_to_prepare?: QuoteToPrepare[];
  project_updates?:   ProjectUpdateToPrepare[];
  supplier_recs?:     SupplierRecommendation[];
  reports_to_prepare?: ReportToPrepare[];
};

export function suggestActions(input: SuggestActionsInput): ActionSuggestion[] {
  const out: ActionSuggestion[] = [];

  for (const inv of input.overdue_invoices ?? []) {
    out.push(build("send_reminder",
      `${inv.customer_label} · £${(inv.amount_pence / 100).toLocaleString("en-GB")} · ${inv.days_overdue}d overdue`,
      draftReminder(inv),
      `Invoice ${inv.invoice_id} has been unpaid for ${inv.days_overdue} days`,
      "bos.actions.reminder", ["hammerex_quotes"]
    ));
  }

  for (const f of input.stale_follow_ups ?? []) {
    out.push(build("follow_up_customer",
      `${f.customer_label} · no contact ${f.last_touch_days}d`,
      draftFollowUp(f),
      `${f.last_touch_days} days since last touch`,
      "bos.actions.follow_up", ["hammerex_customers"]
    ));
  }

  for (const q of input.quotes_to_prepare ?? []) {
    out.push(build("draft_quote",
      `Quote for ${q.customer_label}. ${q.scope_brief}`,
      draftQuote(q),
      "Customer requested a quote / scope drafted from prior context",
      "bos.actions.draft_quote", ["hammerex_quotes"]
    ));
  }

  for (const pu of input.project_updates ?? []) {
    out.push(build("update_project_status",
      `${pu.project_title} → ${pu.status_change}`,
      `Project ${pu.project_title}: ${pu.status_change}`,
      "Status warrants a customer update",
      "bos.actions.project_update", ["hammerex_projects"]
    ));
  }

  for (const s of input.supplier_recs ?? []) {
    out.push(build("recommend_supplier",
      `${s.need} → ${s.supplier_name}`,
      `Recommendation: source ${s.need} from ${s.supplier_name}. Reason: ${s.reason}`,
      s.reason,
      "bos.actions.supplier_rec", []
    ));
  }

  for (const r of input.reports_to_prepare ?? []) {
    out.push(build("generate_report",
      `${r.label} · ${r.period}`,
      `Nex will assemble ${r.label} covering ${r.period} on approval.`,
      "Report requested",
      "bos.actions.report", []
    ));
  }

  return out;
}

// ─── Draft composers (plain text — no jargon, no em dashes) ─────

function draftReminder(inv: OverdueInvoice): string {
  return [
    `Hi ${inv.customer_label.split(" ")[0]},`,
    "",
    `Quick note. Invoice for £${(inv.amount_pence / 100).toLocaleString("en-GB")} has been open for ${inv.days_overdue} days.`,
    "Would you be able to settle this week?",
    "",
    "Any issues, let me know and I'll sort it.",
    "",
    "Thanks."
  ].join("\n");
}

function draftFollowUp(f: StaleFollowUp): string {
  return [
    `Hi ${f.customer_label.split(" ")[0]},`,
    "",
    `Been a while (${f.last_touch_days} days). Anything I can help with on the last job, or a new one on the horizon?`,
    "",
    "Happy to pop out if useful."
  ].join("\n");
}

function draftQuote(q: QuoteToPrepare): string {
  const price = q.price_hint_pence
    ? `\n\nRough figure: £${(q.price_hint_pence / 100).toLocaleString("en-GB")} (subject to a proper site look)`
    : "";
  return [
    `Quote draft for ${q.customer_label}`,
    "",
    `Scope: ${q.scope_brief}${price}`,
    "",
    "Confirm scope + I'll firm this up."
  ].join("\n");
}

function build(
  kind:      ActionKind,
  target:    string,
  draft:     string,
  reason:    string,
  source:    string,
  tables:    string[]
): ActionSuggestion {
  return {
    kind,
    target_label:      target,
    draft,
    requires_approval: true,
    reason,
    evidence: evidenceFor(source, tables)
  };
}
