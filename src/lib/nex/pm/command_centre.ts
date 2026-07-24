// "Nex, run today's business" — the top-of-stack briefing that
// composes across EVERY engine into one plain-English digest.
//
// Sections rendered when their engine has something to say:
//   • Business Health         (MD score + top priorities)
//   • Today's projects        (PM overview — worst-health first)
//   • Delays                  (PM delayed-projects)
//   • Cash flow warnings      (FI/MD)
//   • Shopping list           (SC upcoming materials)
//   • Customers to contact    (CX quiet customers)
//   • Recommendations         (MD urgent recs)
//
// Missing dimensions (weather / safety / staff calendar) surface as
// honest gaps — spec calls for them but no source exists.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildBusinessSnapshot } from "../bi";
import { buildFinancialSnapshot } from "../fi";
import { buildMDBriefing } from "../md";
import { buildSCSnapshot } from "../sc";
import { findCustomersToContact } from "../cx";
import { buildProjectsOverview } from "./overview";
import { detectDelayedProjects } from "./delays";
import type { CommandCentreBriefing, CommandCentreSection } from "./types";

const UNAVAILABLE_TODAY = [
  "Weather integration (no external weather API wired).",
  "Safety register (no RAMS / PPE / training / incident tables yet).",
  "Live staff calendar (no staff availability source yet).",
  "Automatic notifications to team members (merchant approval flow — surface, don't send)."
];

export type BuildCommandCentreInput = {
  merchantSlug: string;
  now?:         Date;
};

export type BuildCommandCentreResult =
  | { ok: true;  briefing: CommandCentreBriefing }
  | { ok: false; reason: "merchant_not_found" };

export async function buildCommandCentre(opts: BuildCommandCentreInput): Promise<BuildCommandCentreResult> {
  const now = opts.now ?? new Date();

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("slug", opts.merchantSlug)
    .maybeSingle();
  if (!listing.data) return { ok: false, reason: "merchant_not_found" };
  const merchantListingId = String(listing.data.id);
  const merchantId = merchantListingId;

  const errors: CommandCentreBriefing["errors"] = [];
  const [md, bi, fi, sc, overview, delays, quiet] = await Promise.all([
    tryRun("md",       () => buildMDBriefing({ merchantSlug: opts.merchantSlug, now }),                             errors),
    tryRun("bi",       () => buildBusinessSnapshot({ merchantSlug: opts.merchantSlug, now }),                       errors),
    tryRun("fi",       () => buildFinancialSnapshot({ merchantSlug: opts.merchantSlug, now }),                      errors),
    tryRun("sc",       () => buildSCSnapshot({ merchantSlug: opts.merchantSlug, now }),                             errors),
    tryRun("pm",       () => buildProjectsOverview({ merchantSlug: opts.merchantSlug, merchantId, merchantListingId, now }), errors),
    tryRun("delays",   () => detectDelayedProjects({ merchantId, merchantListingId, now }),                         errors),
    tryRun("cx_quiet", () => findCustomersToContact(merchantId, 60),                                                errors)
  ]);

  const sections: CommandCentreSection[] = [];

  // Business Health headline.
  const mdBriefing = md?.ok ? md.briefing : null;
  const healthHeadline = mdBriefing?.health.headline ?? bi?.headline ?? "Business Health: no data yet.";

  // MD priorities — top 3.
  if (mdBriefing && mdBriefing.priorities.length > 0) {
    sections.push({
      heading: "Business priorities",
      source:  "md",
      bullets: mdBriefing.priorities.slice(0, 3).map((p) => p.headline)
    });
  }

  // Portfolio — worst 3 projects.
  if (overview && overview.projects.length > 0) {
    sections.push({
      heading: "Projects needing attention",
      source:  "pm",
      bullets: overview.projects.slice(0, 3).map((p) => `${p.project.title} — ${p.health_score}%. ${p.observation_summary}`)
    });
  }

  // Delayed projects.
  if (delays && delays.length > 0) {
    sections.push({
      heading: "Running behind",
      source:  "pm",
      bullets: delays.slice(0, 3).map((d) => `${d.title} — forecast ${d.forecast_end} (${d.days_behind} day${d.days_behind === 1 ? "" : "s"} behind ${d.scheduled_end}).`)
    });
  }

  // Cash / finance warnings.
  const fiSnapshot = fi?.ok ? fi.snapshot : null;
  const cashWarnings: string[] = [];
  if (fiSnapshot) {
    if (fiSnapshot.cashflow_ref.overdue_now_pence > 0) cashWarnings.push(`£${(fiSnapshot.cashflow_ref.overdue_now_pence / 100).toLocaleString("en-GB")} overdue from customers.`);
    if (fiSnapshot.cashflow_ref.next_30d_net_pence < 0) cashWarnings.push(`Next-30-day cash net is £${(fiSnapshot.cashflow_ref.next_30d_net_pence / 100).toLocaleString("en-GB")}.`);
    if (fiSnapshot.profit_ref.low_margin_jobs_count > 0) cashWarnings.push(`${fiSnapshot.profit_ref.low_margin_jobs_count} accepted job${fiSnapshot.profit_ref.low_margin_jobs_count === 1 ? "" : "s"} below your margin target.`);
  }
  if (cashWarnings.length > 0) {
    sections.push({ heading: "Money", source: "fi", bullets: cashWarnings });
  }

  // Shopping list — top 5 materials for next 14 days.
  const scSnapshot = sc?.ok ? sc.snapshot : null;
  if (scSnapshot && scSnapshot.shopping_list.lines.length > 0) {
    sections.push({
      heading: `Materials needed (next ${scSnapshot.shopping_list.window_days} days)`,
      source:  "sc",
      bullets: scSnapshot.shopping_list.lines.slice(0, 5).map((l) => `${l.qty_needed} ${l.unit ?? "each"} · ${l.label} — £${(l.est_cost_pence / 100).toLocaleString("en-GB")}`)
    });
  }

  // Quiet customers — top 3 for a check-in.
  if (quiet && quiet.length > 0) {
    sections.push({
      heading: "Customers to check in with",
      source:  "cx",
      bullets: quiet.slice(0, 3).map((c) => `${c.displayName} — ${c.note}`)
    });
  }

  // MD recommendations — do first.
  if (mdBriefing && mdBriefing.recommendations.length > 0) {
    sections.push({
      heading: "Do first",
      source:  "md",
      bullets: mdBriefing.recommendations.slice(0, 3).map((r) => `${r.action} — because: ${r.reason}`)
    });
  }

  const briefing: CommandCentreBriefing = {
    computed_at:      now.toISOString(),
    merchant_slug:    opts.merchantSlug,
    greeting:         "Here's today's command centre.",
    overall_headline: healthHeadline,
    sections,
    unavailable:      UNAVAILABLE_TODAY,
    errors
  };
  return { ok: true, briefing };
}

async function tryRun<T>(name: string, fn: () => Promise<T>, errors: CommandCentreBriefing["errors"]): Promise<T | null> {
  try { return await fn(); }
  catch (err) {
    errors.push({ module: name, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/** Text renderer for the whole briefing. */
export function commandCentreToText(b: CommandCentreBriefing): string {
  const lines: string[] = [b.greeting, "", b.overall_headline];
  for (const s of b.sections) {
    lines.push("");
    lines.push(`${s.heading}:`);
    for (const bl of s.bullets) lines.push(`- ${bl}`);
  }
  if (b.sections.length === 0) {
    lines.push("");
    lines.push("Nothing needs your attention right now.");
  }
  return lines.join("\n");
}
