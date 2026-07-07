// Brand-voice, channel-native LLM composer.
//
// Takes a business event + target channel, returns rendered content
// tuned for that channel's constraints (aspect / char limits /
// hashtags / tone). Falls back to a deterministic template when
// ANTHROPIC_API_KEY is missing so shipping doesn't block on API keys.
//
// The prompt is intentionally UK-trade-specific — no marketing-speak,
// no corporate voice. "Ordering gravel, no ties or ribbons" as one of
// the merchant-facing feedback notes puts it.

import { completeJson } from "./anthropic";
import { topPerformingCaptions } from "./voiceTraining";
import { loadInsightsFor } from "@/lib/insights/loader";
import type { BusinessEvent } from "@/lib/events/types";

export type ChannelId =
  | "instagram"
  | "facebook"
  | "gbp"
  | "linkedin"
  | "tiktok"
  | "pinterest"
  | "x"
  | "threads"
  | "youtube_shorts"
  | "website_feed";

export type RenderedContent = {
  caption: string;
  hashtags: string[];
  cta_kind: "get_quote" | "call" | "book" | "message" | null;
  cta_target: string | null;
  hero_image_url: string | null;
  photo_urls: string[];
  channel_meta: Record<string, unknown>;
};

const CHANNEL_CONSTRAINTS: Record<
  ChannelId,
  {
    charTarget: number;
    hashtagCount: number;
    tone: string;
    aspect: string;
    ctaStyle: string;
  }
> = {
  instagram: {
    charTarget: 150,
    hashtagCount: 4,
    tone: "visual-first, punchy, first sentence hooks",
    aspect: "4:5 or 1:1",
    ctaStyle: "Comment 'quote' for a price"
  },
  facebook: {
    charTarget: 280,
    hashtagCount: 2,
    tone: "friendly, community, a little chatty",
    aspect: "1:1 or 16:9",
    ctaStyle: "Message us on Facebook"
  },
  gbp: {
    charTarget: 100,
    hashtagCount: 0,
    tone: "local + specific + one line about the job",
    aspect: "landscape",
    ctaStyle: "Call now"
  },
  linkedin: {
    charTarget: 600,
    hashtagCount: 3,
    tone: "professional insight, one lesson learned from the job",
    aspect: "landscape",
    ctaStyle: "Comment or DM"
  },
  tiktok: {
    charTarget: 100,
    hashtagCount: 3,
    tone: "casual, first-person, native to the platform",
    aspect: "9:16 vertical",
    ctaStyle: "Follow for more"
  },
  pinterest: {
    charTarget: 100,
    hashtagCount: 5,
    tone: "keyword-heavy, DIY-inspiration-friendly",
    aspect: "2:3 vertical",
    ctaStyle: "Save to your board"
  },
  x: {
    charTarget: 200,
    hashtagCount: 1,
    tone: "short, dry, punchy",
    aspect: "16:9",
    ctaStyle: "Reply if interested"
  },
  threads: {
    charTarget: 200,
    hashtagCount: 0,
    tone: "casual repost of instagram; strip corporate voice further",
    aspect: "1:1 or 4:5",
    ctaStyle: "Reply for a quote"
  },
  youtube_shorts: {
    charTarget: 90,
    hashtagCount: 3,
    tone: "hook-first title, tag with #Shorts + trade",
    aspect: "9:16 vertical",
    ctaStyle: "Sub for more"
  },
  website_feed: {
    charTarget: 800,
    hashtagCount: 0,
    tone: "full story with materials, timeline, one detail about craft",
    aspect: "16:9 hero",
    ctaStyle: "Service-matched CTA"
  }
};

const SYSTEM_PROMPT = `You are a UK tradesperson writing about a job you just finished.
Speak like the trade — practical, direct, honest, no marketing-speak. No superlatives
("the best", "world-class"). No emojis unless you would actually text with them (rare).
Reference the material or technique specifically. Mention the city if given.
NEVER invent details not in the source. NEVER quote prices.
Respond in JSON only — no markdown fencing, no prose before or after.`;

export async function composeForChannel(
  event: BusinessEvent,
  channel: ChannelId
): Promise<RenderedContent> {
  const p = event.eventPayload as Record<string, unknown>;
  const trade = (p.trade as string) ?? "";
  const service = (p.service as string) ?? "";
  const materials = ((p.materials as string[]) ?? []).map(humanise);
  const postcode = (p.postcode as string) ?? "";
  const city = cityFromPostcode(postcode);
  const stage = (p.stage as string) ?? "";
  const photoUrls = (p.photo_urls as string[]) ?? [];

  const constraints = CHANNEL_CONSTRAINTS[channel];

  // G5 · voice training — inject the merchant's own top-performing
  // captions on this channel so future posts sound more like them
  // as their history grows.
  const voiceExamples = await topPerformingCaptions(event.merchantId, channel);
  const voiceBlock = voiceExamples.length
    ? `\nHIGH-PERFORMING PAST POSTS OF THIS MERCHANT (mimic voice, not content):\n${voiceExamples
        .map((v, i) => `${i + 1}. "${v.caption}"`)
        .join("\n")}\n`
    : "";

  // G5 · trade-wide insights — inject anonymised cross-merchant
  // patterns so the composer knows what's typical for THIS trade on
  // THIS channel.
  const insights = trade ? await loadInsightsFor(trade, channel) : [];
  const insightBlock = buildInsightBlock(insights);

  // Try LLM first for voicey output.
  const llm = await completeJson<{
    caption?: string;
    hashtags?: string[];
    cta_suggestion?: string;
  }>({
    system: SYSTEM_PROMPT,
    maxTokens: 500,
    temperature: 0.5,
    messages: [
      {
        role: "user",
        content: `Compose a ${channel} post about this job.

Trade: ${trade || "unspecified"}
Service: ${service || "unspecified"}
Materials: ${materials.length ? materials.join(", ") : "unspecified"}
Location: ${city || postcode || "not specified"}
Stage: ${stage}

Channel constraints:
- Length target: ~${constraints.charTarget} characters
- Tone: ${constraints.tone}
- Hashtags: exactly ${constraints.hashtagCount} (relevant + trade + local)
- Preferred CTA style: ${constraints.ctaStyle}
${voiceBlock}${insightBlock}
Respond with JSON: { "caption": string, "hashtags": string[], "cta_suggestion": string }`
      }
    ]
  });

  if (llm && typeof llm.caption === "string") {
    return {
      caption: llm.caption,
      hashtags: Array.isArray(llm.hashtags)
        ? llm.hashtags.slice(0, constraints.hashtagCount)
        : [],
      cta_kind: pickCtaKind(channel, event.eventType),
      cta_target: pickCtaTarget(service),
      hero_image_url: photoUrls[0] ?? null,
      photo_urls: photoUrls,
      channel_meta: {
        aspect: constraints.aspect,
        char_count: llm.caption.length,
        model_used: true
      }
    };
  }

  // Fallback: deterministic template — still shippable, just less voicey.
  return {
    caption: fallbackCaption(event, channel, trade, service, materials, city),
    hashtags: fallbackHashtags(trade, service, city, constraints.hashtagCount),
    cta_kind: pickCtaKind(channel, event.eventType),
    cta_target: pickCtaTarget(service),
    hero_image_url: photoUrls[0] ?? null,
    photo_urls: photoUrls,
    channel_meta: {
      aspect: constraints.aspect,
      model_used: false,
      fallback: "deterministic_template"
    }
  };
}

function fallbackCaption(
  event: BusinessEvent,
  channel: ChannelId,
  trade: string,
  service: string,
  materials: string[],
  city: string
): string {
  const svc = service ? humanise(service).toLowerCase() : humanise(trade).toLowerCase();
  const mat = materials.length ? ` in ${materials.join(" + ")}` : "";
  const where = city ? ` in ${city}` : "";
  if (event.eventType === "job_completed") {
    return `${svc} finished${where}${mat}. Full details on the site.`;
  }
  if (event.eventType === "work_captured") {
    return `Latest progress on the ${svc}${where}${mat}.`;
  }
  return `New from the ${trade || "team"}${where}.`;
}

function fallbackHashtags(
  trade: string,
  service: string,
  city: string,
  count: number
): string[] {
  const all = [
    trade ? `#${trade.replace(/_/g, "")}` : "",
    service ? `#${service.replace(/_/g, "")}` : "",
    city ? `#${city.replace(/\s+/g, "")}` : "",
    "#uktrades",
    "#tradelife"
  ].filter(Boolean) as string[];
  return all.slice(0, count);
}

function pickCtaKind(
  channel: ChannelId,
  eventType: string
): RenderedContent["cta_kind"] {
  if (eventType === "review_received") return null;
  if (channel === "gbp") return "call";
  if (channel === "instagram" || channel === "facebook") return "message";
  return "get_quote";
}

function pickCtaTarget(service: string): string | null {
  if (!service) return null;
  return `/quote?service=${encodeURIComponent(service)}`;
}

function humanise(s: string): string {
  return s
    .toString()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildInsightBlock(
  insights: Array<{ insightKind: string; facets: Record<string, unknown> }>
): string {
  if (insights.length === 0) return "";
  const parts: string[] = [];
  for (const ins of insights) {
    if (ins.insightKind === "top_caption_length") {
      const median = (ins.facets.median_chars as number) ?? 0;
      if (median > 0) parts.push(`- Top posts in this trade + channel are ~${median} chars long`);
    }
    if (ins.insightKind === "top_material_mentions") {
      const mats = (ins.facets.materials as Array<{ material: string }>) ?? [];
      if (mats.length > 0)
        parts.push(
          `- Top-engagement posts in this trade mention: ${mats
            .map((m) => m.material.replace(/_/g, " "))
            .join(", ")}`
        );
    }
  }
  if (parts.length === 0) return "";
  return `\nTRADE-WIDE PATTERNS (anonymised, use as tendencies not rules):\n${parts.join("\n")}\n`;
}

function cityFromPostcode(pc: string): string {
  if (!pc) return "";
  const area = pc.replace(/\s+/g, "").toUpperCase().slice(0, 2);
  const KNOWN: Record<string, string> = {
    SW: "London",
    W1: "London",
    NW: "London",
    SE: "London",
    E1: "London",
    LS: "Leeds",
    M1: "Manchester",
    B1: "Birmingham",
    NE: "Newcastle",
    L1: "Liverpool",
    G1: "Glasgow",
    EH: "Edinburgh",
    CF: "Cardiff",
    BS: "Bristol",
    S1: "Sheffield"
  };
  return KNOWN[area] ?? "";
}
