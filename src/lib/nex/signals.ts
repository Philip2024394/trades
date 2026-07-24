// Nex signals — proactive observations shown at the top of the chat.
//
// Every observer inspects the merchant's state and returns Signal[]s
// that surface "I noticed X" items in the daily briefing. Cheap DB
// queries only — no LLM calls. Fire on every page load.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SignalPriority = "high" | "medium" | "low";

export type Signal = {
  id:        string;
  kind:      "review_pending" | "post_awaiting" | "post_scheduled" | "gallery_stale" | "knowledge_stale";
  priority:  SignalPriority;
  headline:  string;                    // one-line what Nex noticed
  action?:   { label: string; href: string };
};

export type SignalContext = {
  merchantSlug: string;
  now?:         Date;
};

// ─── Public ────────────────────────────────────────────────────

export async function collectSignals(ctx: SignalContext): Promise<Signal[]> {
  const now = ctx.now ?? new Date();
  const signals = await Promise.all([
    reviewPending(ctx),
    postsAwaitingApproval(ctx),
    postsScheduledDueSoon(ctx, now),
    galleryStale(ctx, now),
    knowledgeStale(ctx, now)
  ]);
  return signals.flat().sort(byPriority);
}

function byPriority(a: Signal, b: Signal): number {
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return rank[a.priority] - rank[b.priority];
}

// ─── Observers ─────────────────────────────────────────────────

async function reviewPending(_ctx: SignalContext): Promise<Signal[]> {
  const { count = 0 } = await supabaseAdmin
    .from("hammerex_nex_review_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  if ((count ?? 0) === 0) return [];
  return [{
    id:       "review_pending",
    kind:     "review_pending",
    priority: (count ?? 0) > 5 ? "high" : "medium",
    headline: `${count} knowledge ${count === 1 ? "item" : "items"} waiting for approval.`,
    action:   { label: "Open Review", href: "/admin/nex/review" }
  }];
}

async function postsAwaitingApproval(ctx: SignalContext): Promise<Signal[]> {
  const { count = 0 } = await supabaseAdmin
    .from("hammerex_nex_social_posts")
    .select("*", { count: "exact", head: true })
    .eq("merchant_slug", ctx.merchantSlug)
    .eq("status", "awaiting_approval");
  if ((count ?? 0) === 0) return [];
  return [{
    id:       "post_awaiting",
    kind:     "post_awaiting",
    priority: "high",
    headline: `${count} social ${count === 1 ? "post is" : "posts are"} ready for your approval.`,
    action:   { label: "Open Social", href: "/studio/social" }
  }];
}

async function postsScheduledDueSoon(ctx: SignalContext, now: Date): Promise<Signal[]> {
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const { count = 0 } = await supabaseAdmin
    .from("hammerex_nex_social_posts")
    .select("*", { count: "exact", head: true })
    .eq("merchant_slug", ctx.merchantSlug)
    .eq("status", "scheduled")
    .lte("scheduled_for", in24h);
  if ((count ?? 0) === 0) return [];
  return [{
    id:       "post_scheduled",
    kind:     "post_scheduled",
    priority: "medium",
    headline: `${count} scheduled ${count === 1 ? "post is" : "posts are"} due within the next 24 hours.`,
    action:   { label: "Open Social", href: "/studio/social" }
  }];
}

/** Van/business asset generation gap — no new assets in 14 days. */
async function galleryStale(ctx: SignalContext, now: Date): Promise<Signal[]> {
  const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recent = 0 } = await supabaseAdmin
    .from("hammerex_nex_social_posts")
    .select("*", { count: "exact", head: true })
    .eq("merchant_slug", ctx.merchantSlug)
    .eq("status", "published")
    .gte("published_at", cutoff);
  if ((recent ?? 0) > 0) return [];
  // Only fire if the merchant has EVER published a post — otherwise
  // this is noise for a fresh signup.
  const { count: ever = 0 } = await supabaseAdmin
    .from("hammerex_nex_social_posts")
    .select("*", { count: "exact", head: true })
    .eq("merchant_slug", ctx.merchantSlug)
    .eq("status", "published");
  if ((ever ?? 0) === 0) return [];
  return [{
    id:       "gallery_stale",
    kind:     "gallery_stale",
    priority: "low",
    headline: "You haven't published a social post in two weeks. A finished job would make a strong one.",
    action:   { label: "Create a post", href: "/nex?prompt=Create%20a%20Facebook%20post%20for%20my%20latest%20project" }
  }];
}

/** Knowledge in the merchant's trade last touched > 180 days ago. */
async function knowledgeStale(ctx: SignalContext, now: Date): Promise<Signal[]> {
  const { data: identity } = await supabaseAdmin
    .from("hammerex_brand_identity")
    .select("brand_json")
    .eq("merchant_slug", ctx.merchantSlug)
    .maybeSingle();
  const trade = (identity?.brand_json as { industry?: string } | null)?.industry;
  if (!trade) return [];

  const cutoff = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const { count = 0 } = await supabaseAdmin
    .from("hammerex_nex_knowledge_entries")
    .select("*", { count: "exact", head: true })
    .eq("trade", trade)
    .eq("status", "published")
    .lt("updated_at", cutoff);
  if ((count ?? 0) === 0) return [];
  return [{
    id:       "knowledge_stale",
    kind:     "knowledge_stale",
    priority: "low",
    headline: `${count} ${trade} knowledge ${count === 1 ? "entry hasn't" : "entries haven't"} been reviewed in six months.`,
    action:   { label: "Ask Nex to research", href: `/nex?prompt=Research%20the%20latest%20${encodeURIComponent(trade)}%20guidance` }
  }];
}
