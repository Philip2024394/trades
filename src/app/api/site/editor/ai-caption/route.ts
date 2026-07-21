// POST /api/site/editor/ai-caption
//
// The 1-washer AI caption button in the Site Editor.
//
// Steps:
//   1. Require signed-in merchant (anonymous callers can still edit
//      but AI is trade-aware, so we need a listing).
//   2. Debit ONE washer via spendWashers("site-editor-ai-caption").
//      Fails 402 on insufficient balance — client shows the top-up
//      hint. This happens FIRST so the model call is always paid for.
//   3. Build a trade-aware prompt from { subject, tradeSlug, network }
//      and call OpenAI chat/completions. Falls back to a canned
//      template when OPENAI_API_KEY is unset (dev environments).
//   4. Log the row into hammerex_site_editor_ai_captions for Phase 9's
//      training pipeline. Response includes the row id so the client
//      can PATCH final_caption later after the user edits.
//
// Body: { subject, network, frame_slug, image_id? }
// Response: { ok, caption, log_id }

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdentity } from "@/lib/merchantSession";
import { spendWashers } from "@/lib/washers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NetworkSlug = "instagram" | "facebook" | "tiktok" | "snapchat";

/** Frame-aware caption rules. The frame the user picked tells us
 *  whether they're posting a Feed / Story / Reel and captions behave
 *  very differently across those:
 *   • Feed  — long captions read, hashtags matter, question drives replies
 *   • Story — captions rarely seen; content should live on the image
 *   • Reel / TikTok — hook in first 90 chars, hashtags critical
 *  Snapchat has no hashtag algorithm at all.
 *
 *  Format matches the OpenAI instruction directly. Falls back to the
 *  network's Feed rule when the frame slug doesn't map (e.g. custom). */
function captionRulesFor(network: NetworkSlug, frameSlug: string | null): string {
  const isStory = frameSlug?.endsWith("-story") ?? false;
  const isReel  = frameSlug === "ig-reel" || frameSlug === "tt-video-cover" || frameSlug === "tt-photo" || frameSlug === "snap-spot";

  if (network === "instagram") {
    if (isStory) return "IG Story caption is hidden below the image — output only 30–60 chars, no hashtags. Encourage viewer to swipe up / tap sticker.";
    if (isReel)  return "IG Reel: hook in first 90 chars, then break, then 3–5 tight hashtags (mix 1 broad + niche). Under 150 chars total. Include primary trade + city hashtag.";
    return "IG Feed: punchy first line, one blank line, then 3–4 short lines of substance, end with 5–8 hashtags (mix broad + local + trade). Include primary trade + city as hashtags. Under 300 chars.";
  }
  if (network === "facebook") {
    if (isStory) return "FB Story caption barely read — output only 30–50 chars, single emoji, no hashtags.";
    return "FB Feed: conversational tone. One CTA question at the end. NO hashtags (Meta's Feed algo ignores them). Under 280 chars.";
  }
  if (network === "tiktok") {
    return "TikTok: hook on line 1 (question or bold claim), one blank line, 3–5 hashtags at end mixing 1 trending + 2 niche. Include primary trade + city hashtag. Under 150 chars.";
  }
  // snapchat
  return "Snapchat: under 80 chars, punchy, single emoji at the end. Snapchat has NO hashtag algorithm — DO NOT output any hashtags.";
}

async function callOpenAi(prompt: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens:  240,
        messages: [
          { role: "system", content: "You write short UK-trade social captions that drive job enquiries. Never invent facts. Use British English." },
          { role: "user",   content: prompt }
        ]
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    return text.trim() || null;
  } catch {
    return null;
  }
}

/** Fallback caption when OpenAI is unreachable — mirrors the
 *  platform-aware hashtag rules above so the merchant still gets
 *  a reasonable draft even without the model. */
function stubCaption(subject: string, tradeLabel: string, city: string | null, network: NetworkSlug, frameSlug: string | null): string {
  const base = subject.length > 0 ? subject : `${tradeLabel} work`;
  const trimmed = base.replace(/[.!?]+$/, "");
  const tradeTag = `#${tradeLabel.replace(/\s+/g, "").toLowerCase()}`;
  const cityTag  = city ? `#${city.replace(/\s+/g, "").toLowerCase()}` : "";
  const isStory  = frameSlug?.endsWith("-story") ?? false;
  const isReel   = frameSlug === "ig-reel" || frameSlug === "tt-video-cover" || frameSlug === "tt-photo" || frameSlug === "snap-spot";
  if (network === "snapchat")            return `${trimmed}. Get a quote →`;
  if (network === "facebook" && isStory) return `${trimmed} 👀`;
  if (network === "facebook")            return `${trimmed}. Fancy something similar at your place? Quote in the DMs.`;
  if (network === "tiktok") {
    const tags = [tradeTag, cityTag, "#uktrades"].filter(Boolean).slice(0, 3).join(" ");
    return `${trimmed} 👀\n\n${tags}`;
  }
  if (network === "instagram" && isStory) return `${trimmed} — swipe up`;
  if (network === "instagram" && isReel) {
    const tags = [tradeTag, cityTag, "#uktrades"].filter(Boolean).slice(0, 4).join(" ");
    return `${trimmed} 🔥\n\n${tags}`;
  }
  // IG Feed
  const tags = [tradeTag, cityTag, "#uktrades", "#construction", "#tradesmen"].filter(Boolean).slice(0, 6).join(" ");
  return `${trimmed}.\n\nQuote in DMs 💬\n\n${tags}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const identity = await getMerchantIdentity();
  if (!identity) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  let body: {
    subject?:     unknown;
    network?:     unknown;
    frame_slug?:  unknown;
    image_id?:    unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const subject   = typeof body.subject === "string" ? body.subject.trim().slice(0, 400) : "";
  const network   = (["instagram", "facebook", "tiktok", "snapchat"] as NetworkSlug[])
    .includes(body.network as NetworkSlug) ? (body.network as NetworkSlug) : "instagram";
  const frameSlug = typeof body.frame_slug === "string" ? body.frame_slug : null;
  const imageId   = typeof body.image_id   === "string" ? body.image_id   : null;

  // Look up the merchant's primary trade for a trade-aware prompt.
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("primary_trade, city, display_name")
    .eq("slug", identity.slug)
    .maybeSingle();
  const tradeLabel = (listing.data?.primary_trade as string | undefined) ?? "trade";
  const city       = (listing.data?.city          as string | undefined) ?? null;
  const displayName= (listing.data?.display_name  as string | undefined) ?? null;

  // Debit ONE washer FIRST. If the merchant can't afford it, we
  // never spend the AI call.
  const debit = await spendWashers({
    merchantSlug: identity.slug,
    amount:       1,
    source:       "site-editor-ai-caption",
    detail:       { network, frameSlug, imageId, subject }
  });
  if (!debit.ok) {
    return NextResponse.json(
      {
        ok:      false,
        error:   debit.reason,
        message: debit.message,
        balance: debit.balance ?? null
      },
      { status: debit.reason === "insufficient-balance" ? 402 : 400 }
    );
  }

  const prompt = [
    `You're writing a caption for a UK ${tradeLabel} to post on ${network.toUpperCase()}${frameSlug ? ` (frame: ${frameSlug})` : ""}.`,
    displayName ? `Business name: ${displayName}.` : null,
    city        ? `Local area: ${city}.` : null,
    subject     ? `Image shows: ${subject}.` : null,
    `Platform + frame rules: ${captionRulesFor(network, frameSlug)}`,
    `When hashtags are needed, include the trade ("#${tradeLabel.replace(/\s+/g, "").toLowerCase()}")${city ? ` and city ("#${city.replace(/\s+/g, "").toLowerCase()}")` : ""} — but ONLY where the rule above allows.`,
    `Goal: drive quote enquiries. End with a call-to-action that fits the frame.`
  ].filter(Boolean).join("\n");

  const aiCaption = (await callOpenAi(prompt)) ?? stubCaption(subject, tradeLabel, city, network, frameSlug);

  // Log for the training pipeline (Phase 9).
  const log = await supabaseAdmin
    .from("hammerex_site_editor_ai_captions")
    .insert({
      requester_merchant_slug: identity.slug,
      prompt_json:             { subject, network, frameSlug, imageId, tradeLabel, city },
      ai_caption:              aiCaption,
      network_slug:            network,
      frame_slug:              frameSlug,
      source_image_id:         imageId,
      washer_debit:            1
    })
    .select("id")
    .single();

  return NextResponse.json({
    ok:        true,
    caption:   aiCaption,
    log_id:    log.data?.id ?? null,
    balance:   debit.balance
  });
}
