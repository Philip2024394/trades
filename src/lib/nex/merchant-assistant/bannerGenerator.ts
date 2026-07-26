// NEX Merchant Assistant — banner generator.
//
// Composes a promotional banner (headline + body + CTA + visual_style)
// for a merchant offer via Anthropic. Every generation:
//   - Uses a scoped banner system prompt (isolated from the main chat
//     framing so accidental cross-contamination is impossible)
//   - Runs the output through the shared guardrails
//   - Persists as a NEW version row (never overwrites) with
//     is_active: false — merchant activates explicitly
//
// Reference: docs/brains/PHASE_7_IMPLEMENTATION_PLAN.md · Section 4.1
// Reference: docs/architecture/NEX_MASTER_DATA_FLOW_ARCHITECTURE.md · Flow 6

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { completeWithUsage } from "@/lib/llm/anthropic";
import { checkFields } from "./guardrails";
import type {
  BannerVisualStyle,
  MerchantAssistantBanner,
  MerchantContext,
} from "./types";

const BANNER_SYSTEM_PROMPT = `
You are NEX composing a short promotional banner for a merchant's product
listing on the NEX Centre. Return a single JSON object with these fields:

  {
    "headline": string   (max 50 chars, punchy, product-focused)
    "body":     string   (max 140 chars, one clear benefit, not a list)
    "cta":      string   (max 20 chars, single action verb phrase)
  }

# HARD RULES

- NEVER claim guarantees NEX has not been told about ("lifetime
  guarantee", "always in stock", "unbreakable").
- NEVER claim certifications NEX has not been told about ("BSI-approved",
  "ISO 9001", "TrustMark verified") unless they appear in the merchant's
  supplied credentials.
- NEVER invent technical specifications ("waterproof", "fireproof",
  "structural-grade", "load-rated to N kg") unless they appear in the
  supplied product context.
- NEVER make comparative claims ("cheaper than", "better than", "the
  UK's number one", "award-winning").
- NEVER use marketing-cliche superlatives ("world-class", "unbeatable",
  "revolutionary").
- The tone must match the requested visual_style:
    premium   → confident, elegant, aspirational (not luxury cliches)
    utility   → practical, plain, trade-focused
    seasonal  → warm, timely, seasonal without hard sell
    minimal   → very short, direct, one strong idea

Return ONLY the JSON object, no surrounding prose. If any hard rule
would be broken by the requested product, return:
  { "headline": "REFUSAL", "body": "<reason>", "cta": "" }
and NEX will surface the reason to the merchant.
`.trim();

export type GenerateBannerInput = {
  offerId: string;
  visualStyle?: BannerVisualStyle;
  angle?: string; // e.g. "quality craftsmanship", "winter promotion"
};

export type GenerateBannerResult =
  | {
      ok: true;
      banner: MerchantAssistantBanner;
    }
  | {
      ok: false;
      error: string;
      guardrail_blocked?: boolean;
      guardrail_reason?: string;
    };

/** Compose a banner + persist as a new version. Ownership must be
 *  checked BEFORE calling this (the executor does it). */
export async function generateAndSaveBanner(
  ctx: MerchantContext,
  input: GenerateBannerInput,
  productContext: {
    productName: string;
    brandName: string;
    description: string | null;
    pricePence: number;
  }
): Promise<GenerateBannerResult> {
  const visualStyle: BannerVisualStyle = input.visualStyle ?? "premium";

  // Compose the user turn — passes the product + style + angle so the
  // model has enough context to write copy that fits
  const userMessage = `
Product: ${productContext.productName}
Brand:   ${productContext.brandName}
Description: ${productContext.description ?? "(not supplied)"}
Price:   £${(productContext.pricePence / 100).toFixed(2)}
Style:   ${visualStyle}
Angle:   ${input.angle ?? "(none supplied — pick something appropriate to the product)"}
`.trim();

  const llm = await completeWithUsage({
    system: BANNER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 512,
    temperature: 0.7,
  });

  if (!llm) {
    return { ok: false, error: "NEX banner service is unavailable right now." };
  }

  // Parse the JSON response
  const text = llm.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  let parsed: { headline: string; body: string; cta: string };
  try {
    // Strip any surrounding markdown fencing the model may have added
    const cleaned = text.replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      ok: false,
      error: "NEX could not compose a valid banner this time — please try again.",
    };
  }

  // Model-side refusal path
  if (parsed.headline === "REFUSAL") {
    return {
      ok: false,
      error: parsed.body || "NEX declined to compose this banner.",
      guardrail_blocked: true,
      guardrail_reason: parsed.body,
    };
  }

  // Server-side guardrails — belt-and-braces with the prompt rules
  const g = checkFields(
    {
      headline: parsed.headline,
      body: parsed.body,
      cta: parsed.cta,
    },
    { merchantCredentials: [] }
  );
  if (!g.ok) {
    return {
      ok: false,
      error: g.reason,
      guardrail_blocked: true,
      guardrail_reason: g.reason,
    };
  }

  // Length checks — the schema soft-limits are the last defence
  if (parsed.headline.length > 60 || parsed.body.length > 160) {
    return {
      ok: false,
      error: "NEX composed a banner that exceeded length limits — please try again.",
    };
  }

  // Compute next version number for this offer (monotonic per offer)
  const { data: latest } = await supabaseAdmin
    .from("app_nex_merchant_assistant_banners")
    .select("version")
    .eq("offer_id", input.offerId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = ((latest?.version as number) ?? 0) + 1;

  // Persist as a new version — is_active: false, merchant activates
  const { data: saved, error: saveErr } = await supabaseAdmin
    .from("app_nex_merchant_assistant_banners")
    .insert({
      merchant_id: ctx.merchantId, // forced from ctx
      offer_id: input.offerId,
      version: nextVersion,
      headline: parsed.headline,
      body: parsed.body,
      cta: parsed.cta,
      visual_style: visualStyle,
      is_active: false,
      generated_by: "nex_ai",
    })
    .select("*")
    .single();

  if (saveErr || !saved) {
    return {
      ok: false,
      error: `Could not save banner: ${saveErr?.message ?? "unknown"}`,
    };
  }

  return {
    ok: true,
    banner: {
      id: saved.id as string,
      merchantId: saved.merchant_id as string,
      offerId: saved.offer_id as string,
      version: saved.version as number,
      headline: saved.headline as string,
      body: (saved.body as string) ?? null,
      cta: (saved.cta as string) ?? null,
      visualStyle: (saved.visual_style as BannerVisualStyle) ?? null,
      isActive: (saved.is_active as boolean) ?? false,
      generatedBy: (saved.generated_by as MerchantAssistantBanner["generatedBy"]) ?? "nex_ai",
      generatedAt: saved.generated_at as string,
      approvedAt: (saved.approved_at as string) ?? null,
    },
  };
}

/** Activate a banner version. Deactivates all other versions on the
 *  same offer atomically (the DB unique partial index enforces only
 *  one active at a time — this helper does the swap explicitly to
 *  keep the DB constraint from firing).
 *
 *  Ownership MUST be checked before calling this. */
export async function activateBannerVersion(
  ctx: MerchantContext,
  bannerId: string
): Promise<{ ok: true; bannerId: string } | { ok: false; error: string }> {
  // Load the banner + verify ownership
  const { data: banner } = await supabaseAdmin
    .from("app_nex_merchant_assistant_banners")
    .select("id, merchant_id, offer_id")
    .eq("id", bannerId)
    .maybeSingle();

  if (!banner) return { ok: false, error: "Banner not found." };
  if ((banner.merchant_id as string) !== ctx.merchantId) {
    return { ok: false, error: "You can only activate your own banners." };
  }

  // Deactivate any currently-active banner on the same offer
  await supabaseAdmin
    .from("app_nex_merchant_assistant_banners")
    .update({ is_active: false })
    .eq("offer_id", banner.offer_id)
    .eq("is_active", true);

  // Activate this version
  const nowIso = new Date().toISOString();
  const { error: activateErr } = await supabaseAdmin
    .from("app_nex_merchant_assistant_banners")
    .update({ is_active: true, approved_at: nowIso })
    .eq("id", bannerId)
    .eq("merchant_id", ctx.merchantId); // SQL-level ownership re-check

  if (activateErr) {
    return { ok: false, error: `Activation failed: ${activateErr.message}` };
  }

  return { ok: true, bannerId };
}
