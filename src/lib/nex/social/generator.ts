// Post generator.
//
// Given a brief ("Facebook post for my latest bathroom renovation"),
// Nex composes a draft: caption, hashtags, CTA, image suggestion.
// Uses the merchant's Brand DNA + trade + services for tone.
// Uses Claude reasoning when the key is available; otherwise falls
// back to a deterministic template so the flow works in dev.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { reasonJson } from "@/lib/openai/reasoning";
import { PLATFORM_LIMITS, type SocialPlatform, type SocialPost, type SocialPostImage } from "./types";
import { auditSocial } from "./audit";

export type GenerateInput = {
  merchantSlug: string;
  platform:     SocialPlatform;
  brief:        string;                 // "latest bathroom renovation"
  campaignId?:  string;
  imageHint?:   string;                 // project ref or image URL
  createdBy:    string;                 // 'nex' | 'merchant:phil'
};

export type GeneratedDraft = {
  headline:       string;
  caption:        string;
  hashtags:       string[];
  call_to_action: string;
  images:         SocialPostImage[];
};

/** Draft + persist. Post lands in status='awaiting_approval' unless
 *  the merchant has auto_publish enabled + this is a recurring
 *  schedule post (caller decides). */
export async function generateAndDraft(input: GenerateInput): Promise<SocialPost> {
  // Load brand snapshot (source of truth for tone + services).
  const { data: identity } = await supabaseAdmin
    .from("hammerex_brand_identity")
    .select("id, brand_json")
    .eq("merchant_slug", input.merchantSlug)
    .maybeSingle();

  const brand = (identity?.brand_json ?? {}) as Record<string, unknown>;

  const draft = await composeDraft(brand, input);

  const { data: post, error } = await supabaseAdmin
    .from("hammerex_nex_social_posts")
    .insert({
      merchant_slug:     input.merchantSlug,
      campaign_id:       input.campaignId ?? null,
      platform:          input.platform,
      status:            "awaiting_approval",
      headline:          draft.headline,
      caption:           draft.caption,
      hashtags:          draft.hashtags,
      call_to_action:    draft.call_to_action,
      image_urls:        draft.images,
      brand_snapshot_id: identity?.id ?? null,
      created_by:        input.createdBy
    })
    .select("*")
    .single();
  if (error || !post) throw new Error(`create post failed: ${error?.message}`);

  await auditSocial({
    merchantSlug: input.merchantSlug,
    actor:        input.createdBy,
    action:       "post.created_by_nex",
    postId:       post.id,
    details:      { platform: input.platform, brief: input.brief }
  });

  return post as unknown as SocialPost;
}

// ─── Composition ────────────────────────────────────────────────

async function composeDraft(brand: Record<string, unknown>, input: GenerateInput): Promise<GeneratedDraft> {
  const ai = await composeViaReasoning(brand, input);
  if (ai) return trimToLimits(ai, input.platform);
  return trimToLimits(deterministicDraft(brand, input), input.platform);
}

const SYSTEM = [
  "You compose UK trade-business social posts.",
  "Voice: direct, natural, no marketing jargon, no emojis unless the platform expects them.",
  "Never invent facts. Only use what the brief and brand data tell you.",
  "Return ONLY JSON with keys: headline (short), caption (2-4 short sentences), hashtags (array of 3-8), call_to_action (one line)."
].join(" ");

async function composeViaReasoning(brand: Record<string, unknown>, input: GenerateInput): Promise<GeneratedDraft | null> {
  const limits = PLATFORM_LIMITS[input.platform];
  const raw = await reasonJson<{ headline?: string; caption?: string; hashtags?: string[]; call_to_action?: string }>({
    system:      SYSTEM,
    messages:    [{
      role: "user",
      content: [
        `Platform: ${input.platform} (caption max ${limits.captionMax}, hashtags max ${limits.hashtagsMax})`,
        `Brief: ${input.brief}`,
        `Business: ${brand.name ?? ""}`,
        `Trade: ${brand.industry ?? ""}`,
        `Tagline: ${brand.tagline ?? ""}`,
        `Positioning: ${brand.positioning ?? ""}`,
        `Audience: ${brand.audience ?? "UK homeowners"}`,
        `Return the JSON now.`
      ].join("\n")
    }],
    temperature: 0.4,
    maxTokens:   500
  });
  if (!raw?.caption) return null;
  return {
    headline:       raw.headline ?? "",
    caption:        String(raw.caption),
    hashtags:       Array.isArray(raw.hashtags) ? raw.hashtags.slice(0, 10) : [],
    call_to_action: raw.call_to_action ?? "Get in touch for a quote.",
    images:         input.imageHint
      ? [{ url: input.imageHint, alt: input.brief, source: "project" }]
      : []
  };
}

function deterministicDraft(brand: Record<string, unknown>, input: GenerateInput): GeneratedDraft {
  const name  = String(brand.name ?? "our team");
  const trade = String(brand.industry ?? "trade");
  const tagline = String(brand.tagline ?? "");
  const captionBase = `${input.brief}. ${tagline} Get in touch for a free quote.`;
  const hashtags: string[] = [`#${trade.replace(/[^a-z0-9]/gi, "")}`, "#UKtrades"];
  return {
    headline:       input.brief,
    caption:        `${name}: ${captionBase}`,
    hashtags,
    call_to_action: "Message us for a quote.",
    images:         input.imageHint
      ? [{ url: input.imageHint, alt: input.brief, source: "project" }]
      : []
  };
}

function trimToLimits(d: GeneratedDraft, platform: SocialPlatform): GeneratedDraft {
  const limits = PLATFORM_LIMITS[platform];
  return {
    headline:       d.headline,
    caption:        d.caption.slice(0, limits.captionMax),
    hashtags:       d.hashtags.slice(0, limits.hashtagsMax),
    call_to_action: d.call_to_action,
    images:         d.images.slice(0, limits.imagesMax)
  };
}
