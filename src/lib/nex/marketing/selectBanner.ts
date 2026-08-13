// Campaign Selection Engine · selectBanner()
//
// Given a campaign brief, returns the recommended banner variant with reasoning.
// Reads banner metadata from data/nex-image-manifest.json (subject_domain === "marketing_banner").
//
// Doctrine: docs/brains/nex-campaign-selection-engine-philip-2026-08-04.md
// Composes with: Recommendation Engine (Phase D.6/D.7) + Marketing Design Intelligence + Design Token System.

import fs from "node:fs";
import path from "node:path";

const IMAGE_MANIFEST = path.join(process.cwd(), "data", "nex-image-manifest.json");

export type CampaignBrief = {
  industry?: string;                    // "kitchen" · "staircase" · "under_stair_storage" · "front_entrance_door"
  product?: string;                     // "oak_staircase" · "shaker_kitchen" · etc.
  audience?: string;                    // one of the 7 personas
  goal?: string;                        // campaign_type: promotional_offer · lead_generation · brand_awareness · etc.
  platform?: string;                    // facebook · instagram · linkedin · google · print
  tone?: string;                        // luxury · professional · sales_event · family · heritage · lifestyle
  timber?: string;                      // oak · walnut · pine · mahogany · glass · steel
  campaign_family?: string;             // optional filter (e.g. kitchen_mania_promo)
};

type BannerRow = {
  url: string;
  banner_id?: string;
  banner_family?: string;
  layout_family?: string;
  campaign_family?: string;
  hero_product_type?: string;
  campaign_type?: string;
  marketing_tone?: string;
  brand_personality?: string;
  theme_pack?: string;
  cta_architecture?: string;
  timber_profile?: string;
  kitchen_market_segment?: string;
  storage_tier?: string;
  a_plus?: boolean;
  subject_domain?: string;
};

export type SelectionResult = {
  recommended: BannerRow | null;
  score: number;
  runners_up: readonly BannerRow[];
  candidates_considered: number;
  reasoning: string;
  reasoning_breakdown: {
    persona_match: number;
    campaign_type_match: number;
    platform_match: number;
    theme_compatibility: number;
    tone_match: number;
    historical_quality: number;
  };
};

// ─── Compatibility rules (from doctrine) ─────────────────────────────

const TIMBER_THEME_COMPATIBILITY: Record<string, { preferred: string[]; acceptable: string[]; avoid: string[] }> = {
  oak: {
    preferred: ["traditional_brown", "luxury_black_gold", "nature_green"],
    acceptable: ["modern_blue", "corporate_grey"],
    avoid: ["industrial_orange", "premium_purple", "aqua_teal"],
  },
  walnut: {
    preferred: ["luxury_black_gold", "heritage_walnut_cream", "premium_purple"],
    acceptable: ["traditional_brown"],
    avoid: ["industrial_orange", "nature_green"],
  },
  pine: {
    preferred: ["nature_green", "minimal_white"],
    acceptable: ["traditional_brown"],
    avoid: ["luxury_black_gold", "luxury_burgundy"],
  },
  mahogany: {
    preferred: ["traditional_brown", "heritage_walnut_cream", "luxury_burgundy"],
    acceptable: ["luxury_black_gold"],
    avoid: ["industrial_orange", "aqua_teal", "nature_green"],
  },
  glass: {
    preferred: ["aqua_teal", "modern_blue", "minimal_white", "luxury_black_gold"],
    acceptable: ["premium_purple"],
    avoid: ["traditional_brown", "nature_green"],
  },
  steel: {
    preferred: ["industrial_orange", "corporate_grey", "premium_purple"],
    acceptable: ["modern_blue", "luxury_black_gold"],
    avoid: ["traditional_brown", "heritage_walnut_cream", "nature_green"],
  },
};

// ─── Persona → brand personality mapping ─────────────────────────────

const PERSONA_TO_PERSONALITY: Record<string, string[]> = {
  luxury_homeowner: ["luxury", "heritage"],
  executive_homeowner: ["luxury", "heritage"],
  family_homeowner: ["family", "professional"],
  house_renovator: ["family", "lifestyle"],
  budget_renovator: ["sales_event"],
  architect: ["professional", "luxury"],
  builder: ["professional", "sales_event"],
  property_developer: ["professional"],
  interior_designer: ["heritage", "luxury"],
  commercial_client: ["professional"],
};

// ─── Load banners from manifest ───────────────────────────────────────

function loadBanners(): BannerRow[] {
  if (!fs.existsSync(IMAGE_MANIFEST)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(IMAGE_MANIFEST, "utf8")) as {
      images?: Record<string, BannerRow>;
    };
    const out: BannerRow[] = [];
    for (const [url, meta] of Object.entries(parsed.images ?? {})) {
      if (meta.subject_domain === "marketing_banner") {
        out.push({ ...meta, url });
      }
    }
    return out;
  } catch {
    return [];
  }
}

// ─── Scoring functions ───────────────────────────────────────────────

function personaMatch(banner: BannerRow, audience?: string): number {
  if (!audience || !banner.brand_personality) return 0.3;
  const preferred = PERSONA_TO_PERSONALITY[audience] ?? [];
  if (preferred.includes(banner.brand_personality)) return 1.0;
  return 0.2;
}

function campaignTypeMatch(banner: BannerRow, goal?: string): number {
  if (!goal || !banner.campaign_type) return 0.3;
  if (banner.campaign_type === goal) return 1.0;
  // Lenient partial match
  if (goal.includes("lead") && banner.campaign_type === "promotional_offer") return 0.6;
  if (goal.includes("brand") && banner.campaign_type === "lead_generation") return 0.5;
  return 0.2;
}

function platformMatch(banner: BannerRow, platform?: string): number {
  if (!platform) return 0.5;
  // CTA architecture hints at platform suitability
  const arch = banner.cta_architecture ?? "";
  if (platform === "facebook" && arch === "bottom_right_contact_box") return 1.0;
  if (platform === "instagram" && arch === "full_width_cta_bar") return 1.0;
  if (platform === "google" && arch === "bottom_right_contact_box") return 0.9;
  if (platform === "linkedin" && arch === "bottom_right_contact_box") return 0.8;
  return 0.5;
}

function timberCompatibility(banner: BannerRow, timber?: string): number {
  if (!timber || !banner.theme_pack) return 0.5;
  const rules = TIMBER_THEME_COMPATIBILITY[timber];
  if (!rules) return 0.5;
  if (rules.preferred.includes(banner.theme_pack)) return 1.0;
  if (rules.acceptable.includes(banner.theme_pack)) return 0.7;
  if (rules.avoid.includes(banner.theme_pack)) return 0.1;
  return 0.4;
}

function toneMatch(banner: BannerRow, tone?: string): number {
  if (!tone || !banner.marketing_tone) return 0.5;
  if (banner.marketing_tone === tone) return 1.0;
  if (banner.marketing_tone.includes(tone) || tone.includes(banner.marketing_tone)) return 0.7;
  return 0.3;
}

function historicalQuality(_banner: BannerRow): number {
  // MVP: no telemetry yet · default 0.5. Phase F will read data/nex-banner-performance.jsonl.
  return 0.5;
}

// ─── Main selection function ─────────────────────────────────────────

export function selectBanner(brief: CampaignBrief): SelectionResult {
  const banners = loadBanners();

  // Filter by industry (hero_product_type or campaign_family)
  let candidates = banners;
  if (brief.industry) {
    const industryLower = brief.industry.toLowerCase();
    candidates = candidates.filter((b) => {
      const heroType = (b.hero_product_type ?? "").toLowerCase();
      const family = (b.campaign_family ?? "").toLowerCase();
      return heroType.includes(industryLower) || family.includes(industryLower);
    });
    // If filter removed everything, fall back to all banners (avoid returning zero results).
    if (candidates.length === 0) candidates = banners;
  }

  if (brief.campaign_family) {
    const filtered = candidates.filter((b) => b.campaign_family === brief.campaign_family);
    if (filtered.length > 0) candidates = filtered;
  }

  // Score every candidate
  const scored = candidates.map((banner) => {
    const persona = personaMatch(banner, brief.audience);
    const campaignType = campaignTypeMatch(banner, brief.goal);
    const platform = platformMatch(banner, brief.platform);
    const themeCompat = timberCompatibility(banner, brief.timber);
    const tone = toneMatch(banner, brief.tone);
    const quality = historicalQuality(banner);
    const total =
      persona * 0.35 +
      campaignType * 0.25 +
      platform * 0.15 +
      themeCompat * 0.10 +
      tone * 0.10 +
      quality * 0.05;
    return {
      banner,
      score: total,
      breakdown: { persona_match: persona, campaign_type_match: campaignType, platform_match: platform, theme_compatibility: themeCompat, tone_match: tone, historical_quality: quality },
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  const runners = scored.slice(1, 4).map((s) => s.banner);

  if (!top) {
    return {
      recommended: null,
      score: 0,
      runners_up: [],
      candidates_considered: 0,
      reasoning: "no banners in manifest",
      reasoning_breakdown: { persona_match: 0, campaign_type_match: 0, platform_match: 0, theme_compatibility: 0, tone_match: 0, historical_quality: 0 },
    };
  }

  const b = top.breakdown;
  const reasoning = `persona_match=${b.persona_match.toFixed(2)} · campaign_type=${b.campaign_type_match.toFixed(2)} · platform=${b.platform_match.toFixed(2)} · theme_compatibility=${b.theme_compatibility.toFixed(2)} · tone_match=${b.tone_match.toFixed(2)} · historical_quality=${b.historical_quality.toFixed(2)} → total=${top.score.toFixed(3)}. Selected ${top.banner.banner_id ?? top.banner.url} (theme_pack=${top.banner.theme_pack} · personality=${top.banner.brand_personality}) from ${candidates.length} candidates.`;

  return {
    recommended: top.banner,
    score: top.score,
    runners_up: runners,
    candidates_considered: candidates.length,
    reasoning,
    reasoning_breakdown: b,
  };
}
