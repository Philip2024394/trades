// OS — Dashboard notice resolution.
//
// Reads os_dashboard_notices, filters by audience + target predicates,
// removes ones the party has dismissed, and returns the highest-
// priority active notice for rendering on their dashboard.
//
// Notice copy lives in the DB — this file evaluates targeting, it
// does not hardcode copy. Growth team can A/B test without a deploy.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ResolvedNotice = {
  id: string;
  noticeKey: string;
  headline: string;
  body: string;
  primaryCtaLabel: string | null;
  primaryCtaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
  iconHint: string | null;
  variant: "primary" | "success" | "warning" | "danger" | "info";
  dismissible: boolean;
};

type NoticeTargetPredicates = {
  vault_tier?: "none" | "basic" | "lifetime" | "trial";
  has_project_count_gte?: number;
  video_count_gte?: number;
  has_completed_bundle?: boolean;
  has_pending_property_transfer?: boolean;
};

export type PartyStateForTargeting = {
  vaultTier: "none" | "basic" | "lifetime" | "trial";
  projectCount: number;
  videoCount: number;
  hasCompletedBundle: boolean;
  hasPendingPropertyTransfer: boolean;
};

function matchesPredicates(
  predicates: NoticeTargetPredicates,
  state: PartyStateForTargeting
): boolean {
  if (predicates.vault_tier && predicates.vault_tier !== state.vaultTier) {
    return false;
  }
  if (
    typeof predicates.has_project_count_gte === "number" &&
    state.projectCount < predicates.has_project_count_gte
  ) {
    return false;
  }
  if (
    typeof predicates.video_count_gte === "number" &&
    state.videoCount < predicates.video_count_gte
  ) {
    return false;
  }
  if (
    predicates.has_completed_bundle === true &&
    !state.hasCompletedBundle
  ) {
    return false;
  }
  if (
    predicates.has_pending_property_transfer === true &&
    !state.hasPendingPropertyTransfer
  ) {
    return false;
  }
  return true;
}

export async function resolveActiveNotices(
  partyId: string,
  state: PartyStateForTargeting,
  audience: "homeowner" | "merchant" = "homeowner"
): Promise<ResolvedNotice[]> {
  const now = new Date().toISOString();

  // Fetch active notices for audience within window
  const { data: notices, error: nErr } = await supabaseAdmin
    .from("os_dashboard_notices")
    .select("*")
    .eq("active", true)
    .in("audience", [audience, "all"])
    .lte("starts_at", now)
    .order("display_priority", { ascending: false });

  if (nErr) throw nErr;
  if (!notices || notices.length === 0) return [];

  // Fetch this party's dismissals
  const { data: dismissals } = await supabaseAdmin
    .from("os_dashboard_notice_dismissals")
    .select("notice_key, snooze_until")
    .eq("party_id", partyId);

  const dismissedKeys = new Set<string>();
  for (const d of dismissals ?? []) {
    if (!d.snooze_until || new Date(d.snooze_until) > new Date()) {
      dismissedKeys.add(d.notice_key);
    }
  }

  const resolved: ResolvedNotice[] = [];
  for (const n of notices) {
    if (n.ends_at && new Date(n.ends_at) < new Date()) continue;
    if (dismissedKeys.has(n.notice_key)) continue;

    const predicates = (n.target_conditions ?? {}) as NoticeTargetPredicates;
    if (!matchesPredicates(predicates, state)) continue;

    resolved.push({
      id: n.id,
      noticeKey: n.notice_key,
      headline: n.headline,
      body: n.body,
      primaryCtaLabel: n.primary_cta_label,
      primaryCtaHref: n.primary_cta_href,
      secondaryCtaLabel: n.secondary_cta_label,
      secondaryCtaHref: n.secondary_cta_href,
      iconHint: n.icon_hint,
      variant: (n.variant as ResolvedNotice["variant"]) || "primary",
      dismissible: Boolean(n.dismissible)
    });
  }

  return resolved;
}

export async function dismissNotice(
  partyId: string,
  noticeKey: string,
  channel: "x_button" | "converted" | "snoozed" = "x_button",
  snoozeDays: number | null = null
): Promise<void> {
  const snoozeUntil =
    snoozeDays && snoozeDays > 0
      ? new Date(Date.now() + snoozeDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const { error } = await supabaseAdmin
    .from("os_dashboard_notice_dismissals")
    .upsert(
      {
        party_id: partyId,
        notice_key: noticeKey,
        dismissed_at: new Date().toISOString(),
        dismissal_channel: channel,
        snooze_until: snoozeUntil
      },
      { onConflict: "party_id,notice_key" }
    );

  if (error) throw error;
}
