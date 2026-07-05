// Growth Coach — checkers.
//
// Each checker inspects the merchant's live DB state and returns a
// GrowthTask if the merchant hasn't finished the task, or null if
// they have. All checkers are safe to run in parallel — they never
// mutate state, only read.
//
// S2.H migration: trade-mandatory credentials are now derived from
// the Knowledge Graph (Package.compliance elements flagged with a
// credentialScheme). Every future Package added → Growth Coach
// automatically nudges for its mandatory schemes without touching this
// file. The old hardcoded MANDATORY_BY_TRADE map is retired.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mandatorySchemesForTrade } from "@/lib/knowledge";
import "@/lib/knowledge"; // populate Domain + Package registries
import { getModule } from "@/lib/studio/modules";
import type { GrowthTask } from "./types";

type CheckerInput = {
  merchantId: string;
  brandId: string;
  primaryTrade: string;
  slug: string;
  city: string | null;
};

// ─── 1. Any drafts unpublished? Highest-impact single action. ───────

async function checkUnpublishedDrafts(
  ctx: CheckerInput
): Promise<GrowthTask | null> {
  const drafts = await supabaseAdmin
    .from("studio_layouts")
    .select("id, page_id, updated_at", { count: "exact", head: false })
    .eq("brand_id", ctx.brandId)
    .eq("status", "draft");
  const published = await supabaseAdmin
    .from("studio_layouts")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", ctx.brandId)
    .eq("status", "published");
  const draftCount = drafts.data?.length ?? 0;
  const publishedCount = published.count ?? 0;

  if (draftCount === 0 && publishedCount === 0) return null;
  if (publishedCount === 0 && draftCount > 0) {
    return {
      id: "publish-first-time",
      title: "Publish your site — one click",
      description: `${draftCount} page${draftCount === 1 ? "" : "s"} ready to go live. Nobody sees them until you publish.`,
      ctaLabel: "Publish now",
      ctaHref: "/studio/publish",
      impact: 100,
      category: "publishing",
      reason:
        "You've built pages but they're still drafts. Publishing takes one click and puts your site at /trade/" +
        ctx.slug
    };
  }
  // Published exists but there are newer drafts — softer nudge
  if (draftCount > 0) {
    return {
      id: "publish-updates",
      title: `${draftCount} page${draftCount === 1 ? "" : "s"} with unpublished changes`,
      description:
        "Your live site is still showing the old version until you publish.",
      ctaLabel: "Review + publish",
      ctaHref: "/studio/publish",
      impact: 60,
      category: "publishing"
    };
  }
  return null;
}

// ─── 2. Coverage postcode set? ───────────────────────────────────────

async function checkCoverageSet(
  ctx: CheckerInput
): Promise<GrowthTask | null> {
  const res = await supabaseAdmin
    .from("studio_brand_outcomes")
    .select("coverage_postcode, coverage_radius_mi")
    .eq("brand_id", ctx.brandId)
    .maybeSingle();
  const row = res.data as {
    coverage_postcode: string | null;
    coverage_radius_mi: number | null;
  } | null;

  if (!row) {
    return {
      id: "wizard-not-answered",
      title: "Complete the 60-second setup",
      description:
        "One trade, one outcome, coverage area — that's all we need to tune your site.",
      ctaLabel: "Run the wizard",
      ctaHref: "/studio/blueprints/wizard",
      impact: 90,
      category: "setup"
    };
  }
  if (!row.coverage_postcode) {
    return {
      id: "coverage-postcode-missing",
      title: "Set your coverage postcode",
      description:
        "So local customers know you're within reach. Powers the postcode gate widget on your site.",
      ctaLabel: "Set coverage",
      ctaHref: "/studio/blueprints/wizard",
      impact: 80,
      category: "coverage"
    };
  }
  return null;
}

// ─── 3. Companies House credential ────────────────────────────────────

async function checkCompaniesHouse(
  ctx: CheckerInput
): Promise<GrowthTask | null> {
  const res = await supabaseAdmin
    .from("studio_brand_credentials")
    .select("scheme")
    .eq("brand_id", ctx.brandId)
    .in("scheme", ["companies-house"]);
  if ((res.data ?? []).length > 0) return null;
  return {
    id: "credential-companies-house",
    title: "Add your Companies House number",
    description:
      "Auto-verifies daily against the free public register. Turns on the verified badge on your site.",
    ctaLabel: "Add credential",
    ctaHref: "/studio/credentials",
    impact: 75,
    category: "trust",
    reason:
      "Homeowners check company numbers — putting yours on the site + verified converts trust."
  };
}

// ─── 4. Trade-mandatory credentials (Knowledge-Graph-driven, S2.H) ──
//
// mandatorySchemesForTrade walks the merchant's Package.compliance for
// elements flagged with credentialScheme, deduplicated. Every Package
// we ship makes this checker smarter — no touch of this file required.
// The old hardcoded MANDATORY_BY_TRADE map is retired.

// Short display labels for the growth-task title. Only covers the
// schemes that currently come through as mandatory across the Packages
// we've shipped — new schemes auto-fall-back to their raw slug, which
// is still honest.
const SCHEME_DISPLAY_LABEL: Record<string, string> = {
  "gas-safe": "Gas Safe",
  ipaf: "IPAF PAL",
  pasma: "PASMA",
  "waste-carrier": "Waste Carrier",
  niceic: "NICEIC",
  napit: "NAPIT",
  mcs: "MCS",
  fensa: "FENSA",
  hetas: "HETAS"
};

async function checkTradeMandatory(
  ctx: CheckerInput
): Promise<GrowthTask | null> {
  const mandatory = mandatorySchemesForTrade(ctx.primaryTrade);
  if (mandatory.length === 0) return null;

  const held = await supabaseAdmin
    .from("studio_brand_credentials")
    .select("scheme")
    .eq("brand_id", ctx.brandId)
    .in(
      "scheme",
      mandatory.map((m) => m.scheme)
    );
  const heldSet = new Set((held.data ?? []).map((r) => r.scheme));

  // Find the first mandatory scheme the merchant doesn't hold —
  // one nag at a time to avoid overwhelming the top-3 slot.
  const missing = mandatory.find((m) => !heldSet.has(m.scheme));
  if (!missing) return null;

  const label = SCHEME_DISPLAY_LABEL[missing.scheme] ?? missing.scheme;
  return {
    id: `credential-mandatory-${missing.scheme}`,
    title: `Add your ${label} number`,
    description: `${missing.label}. Auto-verifies against the public register.`,
    ctaLabel: "Add credential",
    ctaHref: "/studio/credentials",
    impact: 95,
    category: "trust",
    reason: `Source: ${missing.source}`
  };
}

// ─── 5. WhatsApp number ──────────────────────────────────────────────

async function checkWhatsapp(ctx: CheckerInput): Promise<GrowthTask | null> {
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("whatsapp")
    .eq("id", ctx.merchantId)
    .maybeSingle();
  const row = res.data as { whatsapp: string | null } | null;
  if (row?.whatsapp && row.whatsapp.trim().length > 4) return null;
  return {
    id: "add-whatsapp",
    title: "Add your WhatsApp number",
    description:
      "Every trade blueprint prefills WhatsApp CTAs. Without a number the button goes to a generic fallback.",
    ctaLabel: "Add WhatsApp",
    ctaHref: "/studio/settings",
    impact: 65,
    category: "contact"
  };
}

// ─── 6. Verified badges — nice-to-have TrustMark / FMB ───────────────

async function checkNiceToHaveTrust(
  ctx: CheckerInput
): Promise<GrowthTask | null> {
  const res = await supabaseAdmin
    .from("studio_brand_credentials")
    .select("scheme")
    .eq("brand_id", ctx.brandId);
  const held = new Set((res.data ?? []).map((r) => r.scheme));
  if (held.has("trustmark") || held.has("fmb")) return null;
  return {
    id: "credential-trustmark",
    title: "Add TrustMark or FMB (optional but powerful)",
    description:
      "TrustMark is government-endorsed. FMB is the biggest UK builders' body. Either lifts trust dramatically.",
    ctaLabel: "Add credential",
    ctaHref: "/studio/credentials",
    impact: 45,
    category: "trust"
  };
}

// ─── 7. Assembly module suggestions — proposals accepted at install ──
//
// When a merchant installs an App, its assemblyRules can carry
// `suggest-module` proposals. Accepted ones are recorded in
// studio_assembly_decisions and marked applied_at by the executor.
// The Growth Coach surfaces them here as ordinary tasks so the merchant
// doesn't need to remember what the platform recommended earlier.

async function checkAssemblySuggestions(
  ctx: CheckerInput
): Promise<GrowthTask | null> {
  const res = await supabaseAdmin
    .from("studio_assembly_decisions")
    .select("id, module_id, action_json, rationale_snapshot, decided_at")
    .eq("brand_id", ctx.brandId)
    .eq("decision", "accepted")
    .not("applied_at", "is", null)
    .order("decided_at", { ascending: false })
    .limit(20);

  if (res.error || !res.data) return null;

  // Filter to suggest-module rows whose target module isn't already
  // installed. Query installed_apps once for the merchant.
  const suggestions = res.data.filter(
    (r) => (r.action_json as { kind?: string })?.kind === "suggest-module"
  );
  if (suggestions.length === 0) return null;

  const installed = await supabaseAdmin
    .from("installed_apps")
    .select("app_slug")
    .eq("merchant_id", ctx.merchantId)
    .is("uninstalled_at", null);
  const installedSet = new Set(
    (installed.data ?? []).map((r) => r.app_slug as string)
  );

  const openSuggestion = suggestions
    .map((r) => ({
      row: r,
      target: (r.action_json as { target?: string }).target ?? "",
      sourceModuleId: r.module_id as string
    }))
    .find(
      (s) =>
        s.target.length > 0 &&
        !installedSet.has(s.target)
    );

  if (!openSuggestion) return null;

  const suggestedModule = getModule(openSuggestion.target);
  const sourceModule = getModule(openSuggestion.sourceModuleId);
  const targetName = suggestedModule?.name ?? openSuggestion.target;
  const sourceName = sourceModule?.name ?? openSuggestion.sourceModuleId;

  return {
    id: `assembly-suggest-${openSuggestion.target}`,
    title: `Install ${targetName}`,
    description: `${sourceName} suggested this at install — it stacks with what you already have.`,
    ctaLabel: `View ${targetName}`,
    ctaHref: `/studio/apps/${openSuggestion.target}`,
    impact: 55,
    category: "setup",
    reason: openSuggestion.row.rationale_snapshot as string
  };
}

// ─── Orchestrator ────────────────────────────────────────────────────

export async function runGrowthCoach(
  ctx: CheckerInput
): Promise<GrowthTask[]> {
  const results = await Promise.all([
    checkUnpublishedDrafts(ctx),
    checkCoverageSet(ctx),
    checkTradeMandatory(ctx),
    checkCompaniesHouse(ctx),
    checkWhatsapp(ctx),
    checkNiceToHaveTrust(ctx),
    checkAssemblySuggestions(ctx)
  ]);
  return results
    .filter((r): r is GrowthTask => r !== null)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);
}
