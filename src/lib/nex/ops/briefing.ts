// Personalised morning briefing — the "Good morning Phil" reply.
//
// Composes across prior engines + the four new detectors into the
// exact conversational shape the Phase 22 spec calls for. Nothing
// auto-fires — every draft still routes through Phase 15 AB.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildApprovalQueue } from "../ab";
import { buildFinancialSnapshot } from "../fi";
import { findDiaryGaps } from "./diary_gaps";
import { findOvernightPayments } from "./overnight_payments";
import { findWarrantiesExpiring } from "./warranty_window";
import { estimateTimeSaved } from "./time_saved";
import { evidenceFor, type MorningBriefing } from "./types";

export type BuildMorningBriefingInput = {
  merchantSlug: string;
  firstName?:   string;
  now?:         Date;
};

export type BuildMorningBriefingResult =
  | { ok: true;  briefing: MorningBriefing }
  | { ok: false; reason: "merchant_not_found" };

export async function buildMorningBriefing(opts: BuildMorningBriefingInput): Promise<BuildMorningBriefingResult> {
  const now = opts.now ?? new Date();

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, display_name")
    .eq("slug", opts.merchantSlug)
    .maybeSingle();
  if (!listing.data) return { ok: false, reason: "merchant_not_found" };
  const merchantListingId = String(listing.data.id);
  const merchantId = merchantListingId;
  const firstName = opts.firstName ?? String(listing.data.display_name ?? "").split(" ")[0] ?? "";

  const errors: MorningBriefing["errors"] = [];

  // Today's jobs count.
  const todayIso = now.toISOString().slice(0, 10);
  const todayJobs = await supabaseAdmin
    .from("app_job_diary_jobs")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("scheduled_start_date", todayIso)
    .not("status", "in", "(signed_off,cancelled)");

  const [payments, gaps, warranties, queue, fi] = await Promise.all([
    tryRun("overnight_payments", () => findOvernightPayments({ merchantListingId, now }),           errors),
    tryRun("diary_gaps",         () => findDiaryGaps({ merchantId, now }),                          errors),
    tryRun("warranties",         () => findWarrantiesExpiring({ merchantListingId, now }),          errors),
    tryRun("ab_queue",           () => buildApprovalQueue({ merchantSlug: opts.merchantSlug, now }), errors),
    tryRun("fi",                 () => buildFinancialSnapshot({ merchantSlug: opts.merchantSlug, now }), errors)
  ]);

  const paymentsList   = payments  ?? [];
  const gapsList       = gaps      ?? [];
  const warrantiesList = warranties ?? [];
  const draftsAwaiting = queue?.actions ?? [];
  const overdue        = fi?.ok ? fi.snapshot.cashflow_ref.overdue_now_pence : 0;

  const timeSaved = estimateTimeSaved(draftsAwaiting.map((a) => ({ category: a.category })));

  const briefing: MorningBriefing = {
    computed_at:           now.toISOString(),
    merchant_slug:         opts.merchantSlug,
    greeting:              firstName ? `Good morning ${firstName}.` : "Good morning.",
    today_job_count:       todayJobs.count ?? 0,
    overnight_payments:    paymentsList,
    diary_gaps:            gapsList.slice(0, 3),
    warranties_expiring:   warrantiesList.slice(0, 3),
    overdue_invoice_pence: overdue,
    drafts_awaiting:       draftsAwaiting.length,
    time_saved:            timeSaved,
    suggestions:           [],
    speak:                 "",
    errors
  };

  briefing.suggestions = suggest(briefing);
  briefing.speak       = composeSpeak(briefing);
  return { ok: true, briefing };
}

async function tryRun<T>(name: string, fn: () => Promise<T>, errors: MorningBriefing["errors"]): Promise<T | null> {
  try { return await fn(); }
  catch (err) {
    errors.push({ module: name, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

function gbp(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function composeSpeak(b: MorningBriefing): string {
  const lines: string[] = [];
  lines.push(b.greeting);
  lines.push("");

  // Today's jobs
  if (b.today_job_count > 0) {
    lines.push(`You have ${b.today_job_count} job${b.today_job_count === 1 ? "" : "s"} today.`);
  } else {
    lines.push("No jobs on the diary for today.");
  }

  // Overnight payments
  if (b.overnight_payments.length > 0) {
    const total = b.overnight_payments.reduce((s, p) => s + p.amount_pence, 0);
    if (b.overnight_payments.length === 1) {
      lines.push(`One customer paid overnight — ${gbp(total)}.`);
    } else {
      lines.push(`${b.overnight_payments.length} customers paid overnight — ${gbp(total)} in total.`);
    }
  }

  // Diary gaps
  if (b.diary_gaps.length > 0) {
    const g = b.diary_gaps[0];
    lines.push(`There's a ${g.days}-day gap in your diary starting ${g.start_date}.`);
  }

  // Warranties expiring
  if (b.warranties_expiring.length > 0) {
    const w = b.warranties_expiring[0];
    if (b.warranties_expiring.length === 1) {
      lines.push(`A ${w.title} warranty expires in ${w.days_until} day${w.days_until === 1 ? "" : "s"}.`);
    } else {
      lines.push(`${b.warranties_expiring.length} warranties expire in the next couple of weeks — soonest: ${w.title} (${w.days_until} days).`);
    }
  }

  // Overdue invoices
  if (b.overdue_invoice_pence > 0) {
    lines.push(`${gbp(b.overdue_invoice_pence)} sits on the overdue ledger.`);
  }

  // Drafts + time saved
  if (b.drafts_awaiting > 0) {
    lines.push(`I've prepared ${b.drafts_awaiting} draft${b.drafts_awaiting === 1 ? "" : "s"} for your approval.`);
    if (b.time_saved.minutes > 0) {
      lines.push(`Estimated time saved today: ~${b.time_saved.minutes} minutes.`);
    }
  }

  // Errors surfaced honestly.
  if (b.errors.length > 0) {
    lines.push("");
    lines.push("Modules that didn't respond this morning:");
    for (const e of b.errors) lines.push(`- ${e.module}: ${e.error}`);
  }

  lines.push("");
  lines.push("Would you like me to show today's plan?");
  return lines.join("\n");
}

function suggest(b: MorningBriefing): string[] {
  const out: string[] = [];
  if (b.drafts_awaiting > 0)          out.push("Show me what needs my approval");
  if (b.overdue_invoice_pence > 0)    out.push("Chase overdue invoices");
  if (b.diary_gaps.length > 0)        out.push("Fill that diary gap");
  if (b.warranties_expiring.length > 0) out.push("Send a maintenance reminder");
  if (out.length === 0) out.push("Show today's plan");
  return out;
}

// Re-export a lightweight evidence helper so callers can attach their
// own contribution without importing types.ts directly.
export { evidenceFor };
