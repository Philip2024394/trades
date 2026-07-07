// Monthly digest — picks the merchant's best-performing feed posts
// over the last 30 days and drafts a newsletter/round-up.
//
// "Best-performing" today = most recent (we don't have enough
// signals data on day 1). When signals accumulate, this switches to
// engagement-weighted ranking without changing the interface.

import { completeJson } from "@/lib/llm/anthropic";
import { loadPublishedFeed } from "@/lib/feed/loader";
import type { FeedPost } from "@/lib/feed/types";

export type MonthlyDigestDraft = {
  headline: string;
  intro: string;
  featured_posts: Array<{
    feedPostId: string;
    headline: string;
    blurb: string;
    hero_image_url: string | null;
  }>;
  closing_cta: string;
  suggested_channels: string[];
};

export async function composeMonthlyDigest(
  merchantId: string
): Promise<MonthlyDigestDraft | null> {
  const posts = await loadPublishedFeed(merchantId, 40);
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const inWindow = posts.filter((p) => {
    const t = new Date(p.publishedAt ?? p.updatedAt).getTime();
    return t >= monthAgo;
  });
  if (inWindow.length === 0) return null;

  // Pick top 5 for the digest.
  const featured = inWindow.slice(0, 5);
  const primaryTrade = extractPrimaryTrade(featured);

  const llm = await completeJson<{
    headline?: string;
    intro?: string;
    blurbs?: string[];
    closing_cta?: string;
  }>({
    system: `You draft a monthly round-up newsletter for a UK trade business.
Warm, direct, no marketing-speak. Show the range of work; don't oversell.`,
    maxTokens: 900,
    temperature: 0.5,
    messages: [
      {
        role: "user",
        content: `Draft a monthly digest summarising ${inWindow.length} recent jobs${
          primaryTrade ? ` (mostly ${primaryTrade})` : ""
        }.

Top 5 posts by recency:
${featured.map((p, i) => `${i + 1}. ${p.headline}`).join("\n")}

Compose:
- headline (max 60 chars, mentions the month + trade context)
- intro (2 sentences, warm opener)
- blurbs (array of 5 short 1-sentence blurbs, one per featured post, matched to the order above)
- closing_cta (1 sentence — "get in touch if you're planning X")

Respond with JSON: { "headline", "intro", "blurbs", "closing_cta" }`
      }
    ]
  });

  if (llm && llm.headline && Array.isArray(llm.blurbs)) {
    return {
      headline: llm.headline,
      intro: llm.intro ?? "",
      featured_posts: featured.map((p, i) => ({
        feedPostId: p.id,
        headline: p.headline,
        blurb: llm.blurbs?.[i] ?? p.bodyMarkdown.slice(0, 140),
        hero_image_url: p.heroImageUrl
      })),
      closing_cta: llm.closing_cta ?? "Message us if you're planning something similar.",
      suggested_channels: ["email", "website_feed"]
    };
  }

  // Fallback: deterministic
  return {
    headline: `This month — ${featured.length} recent jobs`,
    intro: `A short round-up of jobs completed in the last month.`,
    featured_posts: featured.map((p) => ({
      feedPostId: p.id,
      headline: p.headline,
      blurb: p.bodyMarkdown.slice(0, 140),
      hero_image_url: p.heroImageUrl
    })),
    closing_cta: "Get in touch if you're planning something similar.",
    suggested_channels: ["email", "website_feed"]
  };
}

function extractPrimaryTrade(posts: FeedPost[]): string {
  const counts = new Map<string, number>();
  for (const p of posts) {
    const t = (p.facets.trade as string) ?? "";
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [t, n] of counts) {
    if (n > bestCount) {
      best = t;
      bestCount = n;
    }
  }
  return best.replace(/_/g, " ");
}
