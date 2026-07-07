// Predictive Gold Path — proactive task generation based on the
// merchant's activity patterns and current pipeline gaps.
//
// Runs weekly (call from a cron). Emits Gold Path tasks BEFORE the
// week goes wrong:
//   - post_gap_reminder — you've had no posts for N days
//   - complete_story_arc — arc has been idle for X days
//   - chase_consent — held publications waiting on permission
//   - reconnect_channel — a channel token is close to expiring
//
// The rules are intentionally simple + auditable. LLM-driven
// prediction (weather + seasonality + regional demand) comes in a
// later phase — the plumbing is here so the projection layer stays
// the same.

import { createClient } from "@supabase/supabase-js";
import { insertGoldPathTask } from "./loader";

const MAX_POST_GAP_DAYS = 7;
const MAX_ARC_IDLE_DAYS = 14;
const CHANNEL_EXPIRY_WARNING_DAYS = 7;

function client() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type PredictionOutcome = {
  merchantId: string;
  tasksCreated: number;
  reasons: string[];
};

export async function runPredictiveGoldPath(
  merchantId: string
): Promise<PredictionOutcome> {
  const c = client();
  const reasons: string[] = [];
  let tasksCreated = 0;
  if (!c) return { merchantId, tasksCreated: 0, reasons: ["supabase_unavailable"] };

  // 1) No captures for >7 days → post_gap_reminder
  const gapCutoff = new Date(
    Date.now() - MAX_POST_GAP_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: recentCaptures } = await c
    .from("business_events")
    .select("id")
    .eq("merchant_id", merchantId)
    .in("event_type", ["work_captured", "job_completed"])
    .gte("occurred_at", gapCutoff)
    .limit(1);
  if (!recentCaptures || recentCaptures.length === 0) {
    const t = await insertGoldPathTask({
      merchantId,
      taskKind: "post_gap_reminder",
      title: `No work captured in ${MAX_POST_GAP_DAYS}+ days`,
      bodyMarkdown:
        "Fresh work keeps your website + socials feeling alive. Even a quick photo of today's progress helps.",
      ctaKind: "open_capture",
      ctaTarget: "/capture",
      urgency: "normal",
      sourceProjectionType: "predictive_gold_path"
    });
    if (t) {
      tasksCreated += 1;
      reasons.push("post_gap_reminder");
    }
  }

  // 2) Idle open arcs → complete_story_arc reminders
  const arcCutoff = new Date(
    Date.now() - MAX_ARC_IDLE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: idleArcs } = await c
    .from("story_arcs")
    .select("id, natural_key, facets")
    .eq("merchant_id", merchantId)
    .eq("status", "open")
    .lte("last_event_at", arcCutoff);
  for (const arc of idleArcs ?? []) {
    const row = arc as {
      id: string;
      natural_key: string | null;
      facets: Record<string, unknown>;
    };
    const trade = (row.facets.trade as string) ?? "job";
    const t = await insertGoldPathTask({
      merchantId,
      taskKind: "complete_story_arc",
      title: `Finish the ${trade} story`,
      bodyMarkdown: `An open project has been quiet for ${MAX_ARC_IDLE_DAYS}+ days. Post a completion photo and we'll auto-generate the case study.`,
      ctaKind: "open_capture",
      ctaTarget: row.natural_key
        ? `/capture?job=${encodeURIComponent(row.natural_key)}`
        : "/capture",
      urgency: "low",
      sourceProjectionType: "predictive_gold_path"
    });
    if (t) {
      tasksCreated += 1;
      reasons.push(`complete_story_arc:${row.id}`);
    }
  }

  // 3) Held publications waiting on consent
  const { data: heldPubs } = await c
    .from("publications")
    .select("id, hold_reason")
    .eq("merchant_id", merchantId)
    .eq("status", "held")
    .limit(5);
  const consentHolds = (heldPubs ?? []).filter((p) => {
    const row = p as { hold_reason: string | null };
    return row.hold_reason?.startsWith("consent_missing");
  });
  if (consentHolds.length > 0) {
    const t = await insertGoldPathTask({
      merchantId,
      taskKind: "chase_consent",
      title: `${consentHolds.length} post${consentHolds.length === 1 ? "" : "s"} waiting on customer permission`,
      bodyMarkdown:
        "Ask the customer for a quick yes/no on sharing the photos. We'll release the posts as soon as you tap 'granted'.",
      ctaKind: "open_activity",
      ctaTarget: `/activity/${merchantId}`,
      urgency: "high",
      sourceProjectionType: "predictive_gold_path"
    });
    if (t) {
      tasksCreated += 1;
      reasons.push("chase_consent");
    }
  }

  // 4) Channel connections expiring soon
  const expiryCutoff = new Date(
    Date.now() + CHANNEL_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: expiringConns } = await c
    .from("merchant_channel_connections")
    .select("id, channel, expires_at")
    .eq("merchant_id", merchantId)
    .eq("status", "active")
    .lte("expires_at", expiryCutoff);
  for (const conn of expiringConns ?? []) {
    const row = conn as { id: string; channel: string; expires_at: string };
    const t = await insertGoldPathTask({
      merchantId,
      taskKind: "reconnect_channel",
      title: `${humanise(row.channel)} connection expires soon`,
      bodyMarkdown: `Your ${row.channel} auth expires ${new Date(row.expires_at).toLocaleDateString(
        "en-GB"
      )}. Reconnect in one tap to keep publishing.`,
      ctaKind: "open_settings",
      ctaTarget: `/settings/channels?reconnect=${row.channel}`,
      urgency: "high",
      sourceProjectionType: "predictive_gold_path"
    });
    if (t) {
      tasksCreated += 1;
      reasons.push(`reconnect_channel:${row.channel}`);
    }
  }

  return { merchantId, tasksCreated, reasons };
}

function humanise(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
