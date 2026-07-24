// Posts adapter — the site diary + change conversations.
//
// Every post is one channel (Slack-per-topic). Kinds:
//   update / new-work / question / warranty / completion / trade-note
// The adapter surfaces recent activity + reply lag + the last handful
// of posts as timeline entries. Homeowner-visible; merchants only see
// posts they were invited to (visibility='all-trades' OR they're a
// member).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PIAdapter, TimelineEvent, Observation } from "../types";
import { evidenceFor } from "../types";
import { scoreMetric } from "../health";

const DAY_MS = 86_400_000;

export const postsAdapter: PIAdapter = {
  aspect: "posts",
  label:  "Site diary",
  weight: 1.3,

  async run(ctx) {
    const now       = ctx.now ?? new Date();
    const lookback  = ctx.lookbackDays ?? 30;
    const fromIso   = new Date(now.getTime() - lookback * DAY_MS).toISOString();
    const evidence  = evidenceFor("hammerex_sitebook_posts", ["hammerex_sitebook_posts"], `/sitebook/${ctx.projectId}`);

    // For merchants we need to join on membership. For simplicity,
    // fetch all posts then filter server-side to the invited set — the
    // per-project post volume is small.
    const rows = await supabaseAdmin
      .from("hammerex_sitebook_posts")
      .select("id, title, body, kind, visibility, status, reply_count, last_reply_at, author_type, author_display_name, created_at")
      .eq("project_id", ctx.projectId)
      .order("created_at", { ascending: false })
      .limit(100);

    let posts = rows.data ?? [];
    if (ctx.viewer === "merchant") {
      const invited = await supabaseAdmin
        .from("hammerex_sitebook_post_members")
        .select("post_id")
        .eq("listing_id", ctx.viewerId);
      const allowed = new Set((invited.data ?? []).map((r) => String(r.post_id)));
      posts = posts.filter((p) => p.visibility === "all-trades" || allowed.has(String(p.id)));
    }

    const recentPosts = posts.filter((p) => (p.created_at as string) >= fromIso);
    const openQuestions = posts.filter((p) => p.kind === "question" && p.status === "open");
    const withReply     = posts.filter((p) => Number(p.reply_count ?? 0) > 0).length;
    const replyRate     = posts.length === 0 ? null : Number(((withReply / posts.length) * 100).toFixed(1));

    const daysSinceLast = posts[0]?.created_at
      ? Math.floor((now.getTime() - new Date(posts[0].created_at as string).getTime()) / DAY_MS)
      : null;

    const timeline: TimelineEvent[] = posts.slice(0, 15).map((p) => ({
      at:         p.created_at as string,
      event_type: "message_posted",
      actor_type: (p.author_type ?? null) as TimelineEvent["actor_type"],
      actor_name: (p.author_display_name ?? null) as string | null,
      headline:   p.title ? String(p.title) : String(p.body).slice(0, 80),
      detail:     String(p.body).slice(0, 200),
      evidence
    }));

    const observations: Observation[] = [];
    if (openQuestions.length > 0) {
      observations.push({
        key:      "open_questions",
        aspect:   "posts",
        severity: openQuestions.length >= 3 ? "warning" : "notice",
        headline: `${openQuestions.length} open ${openQuestions.length === 1 ? "question" : "questions"} on the project.`,
        action:   { label: "Open site diary", href: `/sitebook/${ctx.projectId}` },
        evidence
      });
    }
    if (daysSinceLast !== null && daysSinceLast >= 7) {
      observations.push({
        key:      "diary_stale",
        aspect:   "posts",
        severity: daysSinceLast >= 14 ? "warning" : "notice",
        headline: `No site diary entry for ${daysSinceLast} days.`,
        detail:   "One line a day keeps everyone in the loop and cuts phone calls in half.",
        action:   { label: "Post an update", href: `/sitebook/${ctx.projectId}` },
        evidence
      });
    }

    const activityScore = scoreMetric(recentPosts.length, { floor: 0, ceiling: 10, direction: "higher_is_better" });
    const replyScore    = replyRate === null ? 60 : scoreMetric(replyRate, { floor: 30, ceiling: 90, direction: "higher_is_better" });
    const sub_score = Math.round((activityScore + replyScore) / 2);

    return {
      aspect: "posts",
      label:  "Site diary",
      sub_score,
      weight: 1.3,
      metrics: [
        { key: "posts_total",         label: "Posts on the diary", value: posts.length,       unit: "count", direction: "higher_is_better", evidence },
        { key: "posts_recent",        label: `Posts last ${lookback} days`, value: recentPosts.length, unit: "count", direction: "higher_is_better", evidence },
        { key: "posts_open_questions", label: "Open questions",     value: openQuestions.length, unit: "count", direction: "lower_is_better", evidence },
        { key: "posts_reply_rate",    label: "Reply rate",         value: replyRate,          unit: "pct",   direction: "higher_is_better", evidence },
        { key: "days_since_post",     label: "Days since last post", value: daysSinceLast,    unit: "days",  direction: "lower_is_better", evidence }
      ],
      observations,
      timeline
    };
  }
};
