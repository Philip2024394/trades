// Shared helper for logging into os_activity_events.
//
// Every event source (comment created, project submitted, contact
// tracked, ...) calls one of the small typed helpers below. Keeps the
// enum + shape drift-proof and centralises the anonymisation policy
// (public rows use source_display_name if the listing consented, else
// "A joiner in Manchester" style summary).

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type LoggedRow = {
  kind:
    | "comment_reply"
    | "contact_received"
    | "lead_matched"
    | "trade_joined"
    | "tier_upgraded"
    | "thread_hot"
    | "project_posted"
    | "system_tip"
    | "beacon_fired"
    | "follower_new_post"
    | "follower_gained";
  subject_type?: "post" | "comment" | "project" | "listing" | "thread" | null;
  subject_id?: string | null;
  is_public?: boolean;
  recipient_listing_id?: string | null;
  source_listing_id?: string | null;
  source_display_name?: string | null;
  source_trade?: string | null;
  source_city?: string | null;
  summary_text: string;
  action_url?: string | null;
};

export async function logActivityEvent(row: LoggedRow): Promise<void> {
  // Fire-and-forget from the caller's perspective — errors are logged
  // but never bubble. Missing an activity event should never block a
  // core user action.
  try {
    const { error } = await supabaseAdmin
      .from("os_activity_events")
      .insert({
        kind: row.kind,
        subject_type: row.subject_type ?? null,
        subject_id: row.subject_id ?? null,
        is_public: row.is_public ?? false,
        recipient_listing_id: row.recipient_listing_id ?? null,
        source_listing_id: row.source_listing_id ?? null,
        source_display_name: row.source_display_name ?? null,
        source_trade: row.source_trade ?? null,
        source_city: row.source_city ?? null,
        summary_text: row.summary_text.slice(0, 240),
        action_url: row.action_url ?? null
      });
    if (error) {
      console.warn("[activity] insert failed:", error.message);
    }
  } catch (e) {
    console.warn(
      "[activity] insert threw:",
      e instanceof Error ? e.message : String(e)
    );
  }
}

// Convenience: comment_reply — fires when a trade posts a comment on
// another trade's yard post. Writes ONE personal event (to the post
// owner) plus ONE public row (anonymised).
export async function logCommentReply(args: {
  post_id: string;
  post_owner_listing_id: string;
  commenter_listing_id: string;
  commenter_display_name: string;
  commenter_trade: string;
  commenter_city: string | null;
  comment_id: string;
}) {
  const summaryPersonal = `${args.commenter_display_name} replied on your Yard post.`;
  const summaryPublic = `A ${args.commenter_trade.replace(/-/g, " ")}${
    args.commenter_city ? ` in ${args.commenter_city}` : ""
  } replied on a Yard thread.`;
  await Promise.all([
    // Personal event — post owner sees this in their "Your day" widget
    logActivityEvent({
      kind: "comment_reply",
      subject_type: "comment",
      subject_id: args.comment_id,
      recipient_listing_id: args.post_owner_listing_id,
      source_listing_id: args.commenter_listing_id,
      source_display_name: args.commenter_display_name,
      source_trade: args.commenter_trade,
      source_city: args.commenter_city,
      summary_text: summaryPersonal,
      action_url: `/trade-off/yard/${args.post_id}`
    }),
    // Public event — anonymised for the landing widget
    logActivityEvent({
      kind: "thread_hot",
      subject_type: "post",
      subject_id: args.post_id,
      is_public: true,
      source_trade: args.commenter_trade,
      source_city: args.commenter_city,
      summary_text: summaryPublic,
      action_url: `/trade-off/yard/${args.post_id}`
    })
  ]);
}

// Convenience: contact_received — fires when someone clicks a Yard
// post's WhatsApp/Buy button. Only writes a personal event (no public
// mirror — implies a private conversation started).
export async function logContactReceived(args: {
  post_id: string;
  post_owner_listing_id: string;
}) {
  await logActivityEvent({
    kind: "contact_received",
    subject_type: "post",
    subject_id: args.post_id,
    recipient_listing_id: args.post_owner_listing_id,
    summary_text: "New WhatsApp enquiry from your Yard post.",
    action_url: `/trade-off/yard/${args.post_id}`
  });
}

// Convenience: project_posted — fires when a homeowner submits a new
// project brief. Writes ONE public event (anonymised) plus ONE
// personal event per matched trade.
export async function logProjectPosted(args: {
  project_id: string;
  project_type: string;
  postcode_prefix: string | null;
  matched_listing_ids: string[];
}) {
  const projectLabel = args.project_type.replace(/-/g, " ");
  await logActivityEvent({
    kind: "project_posted",
    subject_type: "project",
    subject_id: args.project_id,
    is_public: true,
    source_city: args.postcode_prefix,
    summary_text: `New ${projectLabel} project${args.postcode_prefix ? ` in ${args.postcode_prefix}` : ""}.`,
    action_url: null
  });
  await Promise.all(
    args.matched_listing_ids.map((listingId) =>
      logActivityEvent({
        kind: "lead_matched",
        subject_type: "project",
        subject_id: args.project_id,
        recipient_listing_id: listingId,
        source_city: args.postcode_prefix,
        summary_text: `New ${projectLabel} lead matched to you.`,
        action_url: `/trade-off/dashboard/leads`
      })
    )
  );
}

// Convenience: beacon_fired — fires when a trade posts a beacon. Writes
// ONE public event (anonymised, drives the "the network is alive" feel
// on the landing widget) plus ONE personal event per trade whose
// primary_trade matches the beacon's trade slug (their notification
// inbox lights up so they can respond in time).
export async function logBeaconFired(args: {
  beacon_id: string;
  poster_listing_id: string;
  poster_display_name: string;
  poster_trade: string;
  poster_city: string | null;
  title: string;
  region: string | null;
  beacon_expires_at: string;
  match_trade_listing_ids: string[];
}) {
  const tradeText = args.poster_trade.replace(/-/g, " ");
  const region = args.region ?? args.poster_city;
  const publicSummary = `A ${tradeText}${
    region ? ` in ${region}` : ""
  } fired a beacon — nearby trades responding now.`;
  const personalSummary = `Beacon nearby: ${args.title.slice(0, 100)}${args.title.length > 100 ? "…" : ""}`;
  await logActivityEvent({
    kind: "beacon_fired",
    subject_type: "post",
    subject_id: args.beacon_id,
    is_public: true,
    source_listing_id: args.poster_listing_id,
    source_trade: args.poster_trade,
    source_city: region,
    summary_text: publicSummary,
    action_url: `/trade-off/yard`
  });
  await Promise.all(
    args.match_trade_listing_ids.map((listingId) =>
      logActivityEvent({
        kind: "beacon_fired",
        subject_type: "post",
        subject_id: args.beacon_id,
        recipient_listing_id: listingId,
        source_listing_id: args.poster_listing_id,
        source_trade: args.poster_trade,
        source_city: region,
        summary_text: personalSummary,
        action_url: `/trade-off/yard`
      })
    )
  );
}

// Convenience: fanout a new post to the poster's followers. Kind
// "follower_new_post" — one personal event per follower (respecting
// their notify preference). Used by the yard compose route on every
// non-chat post so followers see "X posted a new product / promo /
// beacon" in their landing widget.
export async function fanoutNewPostToFollowers(args: {
  post_id: string;
  poster_listing_id: string;
  poster_display_name: string;
  poster_trade: string;
  post_kind: string;
  post_title: string;
  action_url: string;
}) {
  const { data: rows } = await supabaseAdmin
    .from("hammerex_trade_followers")
    .select("follower_listing_id")
    .eq("followed_listing_id", args.poster_listing_id)
    .eq("notify", true)
    .limit(1000);
  if (!rows || rows.length === 0) return;
  const kindLabel = args.post_kind.replace(/-/g, " ");
  const summary = `${args.poster_display_name} posted a new ${kindLabel}: ${args.post_title.slice(0, 90)}${args.post_title.length > 90 ? "…" : ""}`;
  await Promise.all(
    rows.map((r) =>
      logActivityEvent({
        kind: "follower_new_post",
        subject_type: "post",
        subject_id: args.post_id,
        recipient_listing_id: r.follower_listing_id,
        source_listing_id: args.poster_listing_id,
        source_display_name: args.poster_display_name,
        source_trade: args.poster_trade,
        summary_text: summary,
        action_url: args.action_url
      })
    )
  );
}

// Convenience: trade_joined — fires when a new tradesperson finishes
// signup. Public event only. Anonymised unless they opt in later.
export async function logTradeJoined(args: {
  listing_id: string;
  primary_trade: string;
  city: string | null;
}) {
  const label = args.primary_trade.replace(/-/g, " ");
  await logActivityEvent({
    kind: "trade_joined",
    subject_type: "listing",
    subject_id: args.listing_id,
    is_public: true,
    source_listing_id: args.listing_id,
    source_trade: args.primary_trade,
    source_city: args.city,
    summary_text: `A new ${label}${args.city ? ` in ${args.city}` : ""} joined the Notebook.`,
    action_url: null
  });
}
