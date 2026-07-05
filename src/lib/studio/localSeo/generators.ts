// Local SEO generators.
//
// Deterministic templates — no LLM. Fed by the merchant's own live
// data (trade, brand name, city, coverage postcode, verified
// credentials, blueprint services). Output matches the exact
// character limits of Google Business Profile (GMB) so paste-in is
// friction-free.
//
// GMB limits (verified against Google's public spec):
//   • Business description:  750 chars
//   • Post copy:             1500 chars (Google recommends 100–300)
//   • Service description:    300 chars per service
//
// Refs (public):
//   support.google.com/business/answer/3038177 (description)
//   support.google.com/business/answer/7156154 (posts)

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { blueprintRegistry } from "@/lib/studio/blueprints";
import { tradeLabel as getTradeLabel } from "@/lib/tradeOff";
import type { LocalSeoBlock } from "./types";

// ─── Shared context loader ───────────────────────────────────────────

export type LocalSeoContext = {
  merchantId: string;
  brandId: string;
  merchantName: string;
  primaryTrade: string;
  tradeLabel: string;
  city: string;
  coveragePostcode: string | null;
  coverageRadiusMi: number | null;
  whatsapp: string | null;
  phone: string | null;
  websiteUrl: string;
  yearsTrading: number | null;
  verifiedCredentials: string[];
  blueprintSlug: string | null;
  blueprintServiceItems: string[];
};

export async function loadLocalSeoContext(input: {
  merchantId: string;
  brandId: string;
  primaryTrade: string;
  slug: string;
  city: string | null;
  merchantName: string;
  origin: string;
}): Promise<LocalSeoContext> {
  const [outcomesRes, credsRes, listingRes, layoutRes] = await Promise.all([
    supabaseAdmin
      .from("studio_brand_outcomes")
      .select("coverage_postcode, coverage_radius_mi")
      .eq("brand_id", input.brandId)
      .maybeSingle(),
    supabaseAdmin
      .from("studio_brand_credentials")
      .select("scheme, status")
      .eq("brand_id", input.brandId)
      .eq("status", "verified"),
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("whatsapp, phone, years_trading")
      .eq("id", input.merchantId)
      .maybeSingle(),
    // Latest published home layout to extract services list from
    supabaseAdmin
      .from("studio_layouts")
      .select("blueprint_id, layout_json")
      .eq("brand_id", input.brandId)
      .eq("page_id", "home")
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const outcomes = outcomesRes.data as {
    coverage_postcode: string | null;
    coverage_radius_mi: number | null;
  } | null;
  const listing = listingRes.data as {
    whatsapp: string | null;
    phone: string | null;
    years_trading: number | null;
  } | null;
  const layout = layoutRes.data as {
    blueprint_id: string | null;
    layout_json: Record<string, unknown> | null;
  } | null;

  const verifiedCredentials = ((credsRes.data ?? []) as { scheme: string }[])
    .map((c) => c.scheme);

  // Extract service items from the blueprint (source of truth) — the
  // published layout may have been re-ordered but the manifest's
  // services list is the canonical set.
  const blueprintServiceItems: string[] = [];
  if (layout?.blueprint_id) {
    const manifest = blueprintRegistry.get(layout.blueprint_id);
    if (manifest) {
      for (const page of Object.values(manifest.layout)) {
        for (const seed of page as { key: string; config?: Record<string, unknown> }[]) {
          if (seed.key === "services.list_1") {
            const items = (seed.config?.items ?? []) as { title?: string }[];
            for (const it of items) if (it.title) blueprintServiceItems.push(it.title);
          }
        }
      }
    }
  }

  return {
    merchantId: input.merchantId,
    brandId: input.brandId,
    merchantName: input.merchantName,
    primaryTrade: input.primaryTrade,
    tradeLabel: getTradeLabel(input.primaryTrade),
    city: input.city ?? "your area",
    coveragePostcode: outcomes?.coverage_postcode ?? null,
    coverageRadiusMi: outcomes?.coverage_radius_mi ?? null,
    whatsapp: listing?.whatsapp ?? null,
    phone: listing?.phone ?? null,
    websiteUrl: `${input.origin}/trade/${input.slug}`,
    yearsTrading: listing?.years_trading ?? null,
    verifiedCredentials,
    blueprintSlug: layout?.blueprint_id ?? null,
    blueprintServiceItems: Array.from(new Set(blueprintServiceItems))
  };
}

// ─── Description generator ───────────────────────────────────────────

const CRED_PHRASES: Record<string, string> = {
  "gas-safe": "Gas Safe registered",
  niceic: "NICEIC-registered",
  napit: "NAPIT-registered",
  trustmark: "TrustMark endorsed",
  fmb: "FMB Master Builder",
  mcs: "MCS certified",
  hetas: "HETAS registered",
  fensa: "FENSA registered",
  chas: "CHAS accredited",
  safecontractor: "SafeContractor accredited",
  ipaf: "IPAF trained operators",
  pasma: "PASMA trained operators",
  "waste-carrier": "registered Waste Carrier",
  "companies-house": "UK registered company",
  vat: "VAT registered"
};

export function generateDescription(ctx: LocalSeoContext): LocalSeoBlock {
  const parts: string[] = [];

  // Opening
  const years = ctx.yearsTrading
    ? `With ${ctx.yearsTrading}+ years' experience, `
    : "";
  parts.push(
    `${ctx.merchantName} provides professional ${ctx.tradeLabel.toLowerCase()} services in ${ctx.city} and surrounding areas.`
  );

  // Credentials sentence
  const credPhrases = ctx.verifiedCredentials
    .map((c) => CRED_PHRASES[c])
    .filter((s): s is string => !!s);
  if (credPhrases.length > 0) {
    parts.push(
      `${years}We are ${listSentence(credPhrases)}.`
    );
  } else if (years) {
    parts.push(`${years}Serving local homeowners and businesses.`);
  }

  // Services
  if (ctx.blueprintServiceItems.length > 0) {
    const top = ctx.blueprintServiceItems.slice(0, 6);
    parts.push(`Services include ${listSentence(top)}.`);
  }

  // Coverage
  if (ctx.coveragePostcode) {
    parts.push(
      `Free callouts inside our ${ctx.coverageRadiusMi ?? 15}-mile radius from ${ctx.coveragePostcode}.`
    );
  }

  // Call to action
  parts.push(`Get a free no-obligation quote at ${ctx.websiteUrl}.`);

  let text = parts.join(" ");
  // Clamp to 750 while trying to break on a sentence
  if (text.length > 750) {
    const clipped = text.slice(0, 750);
    const lastStop = clipped.lastIndexOf(". ");
    text = lastStop > 400 ? clipped.slice(0, lastStop + 1) : clipped;
  }

  return {
    id: "description",
    label: "Google Business description",
    hint: "Paste into GMB → Info → Business description",
    content: text,
    format: "text",
    charLimit: 750
  };
}

// ─── Services list ───────────────────────────────────────────────────

export function generateServiceList(ctx: LocalSeoContext): LocalSeoBlock[] {
  if (ctx.blueprintServiceItems.length === 0) {
    return [
      {
        id: "services-empty",
        label: "Services (no blueprint yet)",
        hint: "Install a blueprint first — the wizard seeds every service.",
        content:
          "Complete the setup wizard first so we can generate your service list from your chosen blueprint.",
        format: "text"
      }
    ];
  }
  return ctx.blueprintServiceItems.slice(0, 20).map((service, idx) => ({
    id: `service-${idx}`,
    label: service,
    hint: "Paste into GMB → Services",
    content:
      `${service} — professional ${ctx.tradeLabel.toLowerCase()} service in ${ctx.city}. ` +
      `Free quotations, fully insured, ${ctx.verifiedCredentials.length > 0 ? "verified trade credentials." : "reliable local team."}`,
    format: "text",
    charLimit: 300
  }));
}

// ─── Weekly post generator ───────────────────────────────────────────

const POST_TEMPLATES = [
  (ctx: LocalSeoContext) =>
    `Booking now for ${ctx.tradeLabel.toLowerCase()} work across ${ctx.city} and ${ctx.coverageRadiusMi ?? 15} miles around. Free quotes, fixed prices, no cold calls. Get in touch to schedule a survey.`,
  (ctx: LocalSeoContext) =>
    `New project completed this week in ${ctx.city}. Fully documented, all certificates handed over, snag-free. Thinking about your own project? Send us a photo — we'll come back with an honest quote within 48 hours.`,
  (ctx: LocalSeoContext) =>
    `We're a ${ctx.verifiedCredentials.length > 0 ? "verified" : "trusted local"} ${ctx.tradeLabel.toLowerCase()} covering ${ctx.city}. ${ctx.yearsTrading ? `${ctx.yearsTrading}+ years experience.` : "Trained + insured team."} Every job priced upfront — no drift.`,
  (ctx: LocalSeoContext) =>
    `Common question this week: how long does a job like ours take? Answer varies — the honest answer starts with a site visit. Book one here + we'll give you a firm window.`
];

export function generateWeeklyPost(
  ctx: LocalSeoContext,
  seed = 0
): LocalSeoBlock {
  const idx = Math.abs(seed) % POST_TEMPLATES.length;
  return {
    id: `post-${idx}`,
    label: `Weekly update post ${idx + 1} of ${POST_TEMPLATES.length}`,
    hint: "Paste into GMB → Add update → What's new",
    content: POST_TEMPLATES[idx](ctx),
    format: "text",
    charLimit: 1500
  };
}

export function generateAllPosts(ctx: LocalSeoContext): LocalSeoBlock[] {
  return POST_TEMPLATES.map((_, i) => generateWeeklyPost(ctx, i));
}

// ─── Review request templates ────────────────────────────────────────

export function generateReviewRequests(
  ctx: LocalSeoContext
): LocalSeoBlock[] {
  const url = `${ctx.websiteUrl}?review=1`;
  return [
    {
      id: "review-email",
      label: "Email review request",
      hint: "Send after job completion",
      content:
        `Hi {name},\n\n` +
        `Thanks for choosing ${ctx.merchantName} — hope everything's working perfectly.\n\n` +
        `If you have 30 seconds, we'd really appreciate a Google review. It genuinely helps a small business like ours reach the next customer.\n\n` +
        `Leave one here: {googleReviewUrl}\n\n` +
        `Any issues at all, reply to this and we'll come back out — no charge.\n\n` +
        `Cheers,\n${ctx.merchantName}\n${url}`,
      format: "text"
    },
    {
      id: "review-sms",
      label: "SMS review request",
      hint: "Short + punchy — fits in one message",
      content:
        `Hi {name}, thanks for choosing ${ctx.merchantName}. If you've got 30 seconds, a Google review would really help us out — link here: {googleReviewUrl}. Any issues, just reply.`,
      format: "text",
      charLimit: 320
    },
    {
      id: "review-whatsapp",
      label: "WhatsApp review request",
      hint: "Friendlier tone — feels like a message not a broadcast",
      content:
        `Hey {name} — just wrapping up. Hope the job's up to scratch! 🙌\n\n` +
        `If you've got a minute, a quick Google review is huge for us: {googleReviewUrl}\n\n` +
        `Reply here any time if anything needs attention.`,
      format: "text"
    }
  ];
}

// ─── Helpers ─────────────────────────────────────────────────────────

function listSentence(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
