// Nex Business Operations — contracts.
//
// The "OPS" layer is a THIN integrator that composes prior engines
// (Phase 5 BI, Phase 12 PM command centre, Phase 15 AB queue, Phase
// 16 CC warranties, Phase 10 FI) into the "Good morning Phil"
// personalised briefing the Phase 22 spec calls out.
//
// Four genuinely-new detectors live here:
//   • diary_gaps        — windows of ≥2 days with no scheduled work
//   • overnight_payments — payments logged since a cutoff timestamp
//   • warranty_window   — care items expiring in the next N days
//   • time_saved        — human-readable "I saved you about X minutes"
//                         from the current approval queue

import type { Evidence } from "../pi/types";
export type { Evidence };

/** A window of 2+ consecutive days with no scheduled work. */
export type DiaryGap = {
  start_date:  string;                   // ISO date (YYYY-MM-DD)
  end_date:    string;
  days:        number;
  reason:      string;                   // "no scheduled_start_date entries in that window"
  evidence:    Evidence;
};

export type OvernightPayment = {
  cost_id:      string;
  project_title: string | null;
  amount_pence: number;
  paid_at:      string;
  method:       string;
  evidence:     Evidence;
};

export type WarrantyExpiring = {
  title:        string;
  next_due_at:  string;
  days_until:   number;
  evidence:     Evidence;
};

export type TimeSavedEstimate = {
  minutes:      number;                  // rough estimate in minutes
  drafts:       number;                  // number of prepared items counted
  reason:       string;                  // "5 drafts × ~18 min manual = ~90 min"
  evidence:     Evidence;
};

/** The full personalised briefing — the "Good morning Phil" reply. */
export type MorningBriefing = {
  computed_at:        string;
  merchant_slug:      string;
  greeting:           string;            // "Good morning Phil."
  today_job_count:    number;
  overnight_payments: OvernightPayment[];
  diary_gaps:         DiaryGap[];        // upcoming gaps (next 21 days)
  warranties_expiring: WarrantyExpiring[];
  overdue_invoice_pence: number;
  drafts_awaiting:    number;            // from AB approval queue
  time_saved:         TimeSavedEstimate;
  suggestions:        string[];
  /** The plain-English block Nex speaks — matches the spec's exact
   *  conversational shape. */
  speak:              string;
  errors:             Array<{ module: string; error: string }>;
};

export function evidenceFor(source: string, tables: string[] = []): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString()
  };
}
