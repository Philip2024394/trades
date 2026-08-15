// NEX App Builder · Worker 4 · Design / Image Selection (Philip 2026-08-14).
//
// Consumes: AppBlueprint + adapter output (StudioLayoutJson per page).
// Uses:     the existing heroLibrary + sectionRegistry defaults + design tokens.
// Produces: DesignPlan describing which existing assets have been selected.
//
// Constitutional rule: reuse existing hero library and section defaults.
// Never invent new images, never fabricate a hero, never generate new
// design tokens. If no suitable asset exists, mark it as NEEDS_ASSET.

import type { AppBlueprint } from "../blueprint-schema";
import type {
  EvidenceRecord,
  EvidenceVerdict,
  WorkerContext,
  WorkerReport
} from "./types";
import { startReport } from "./types";
import { deriveIntentTags, type IntentTag } from "../design/intent-taxonomy";
import { selectImage, type ImageSelectionOutcome, type HeroEntryLike, type MatchProvenance } from "../design/intent-matcher";

// Loaded lazily on first worker call — avoids top-level await limits and
// lets the worker degrade gracefully when the library isn't reachable
// (e.g. running under browser bundling).
let cachedHeroLib: HeroEntryLike[] | null | undefined = undefined;
async function loadHeroLibrary(): Promise<HeroEntryLike[] | null> {
  if (cachedHeroLib !== undefined) return cachedHeroLib;
  try {
    // Load the JSON directly — the heroLibrary module doesn't export the
    // full list, but we need the full list to rank by intent.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const p = path.join(process.cwd(), "scripts", "hero-library.json");
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as { entries?: HeroEntryLike[] } | HeroEntryLike[];
    cachedHeroLib = Array.isArray(parsed)
      ? parsed
      : (parsed.entries && Array.isArray(parsed.entries) ? parsed.entries : null);
  } catch {
    cachedHeroLib = null;
  }
  return cachedHeroLib;
}

export type DesignPlan = {
  /** Intent tags derived from the Blueprint (all traceable to source). */
  intentTags: IntentTag[];
  heroSelection: {
    tradeSlug: string;
    matched: boolean;
    /** Real hero library entry (or null when no match). */
    heroId: string | null;
    imageUrl: string | null;
    palette: unknown | null;
    reason: string;
    /** Full provenance record when matched (Phase 5 constitutional). */
    provenance?: MatchProvenance;
    /** Alternates operator may swap to. */
    alternateIds?: string[];
    /** True when NO_SUITABLE_IMAGE — Blueprint must mark hero as REQUIRED / GENERATION_CANDIDATE. */
    requiresGenerationOrCustomerUpload?: boolean;
  };
  brandTokens: {
    /** Values already present on bp.brand — passed through untouched. */
    primary: string;
    background: string;
    foreground: string;
    headingFamily: string;
    bodyFamily: string;
    /** True when the Blueprint's brand palette was INFERRED (needs customer confirmation). */
    inferredFromDefaults: boolean;
  };
  /** Per-page asset needs derived from Blueprint sections. */
  perPageAssetPlan: Array<{
    pageId: string;
    heroInstanceId: string | null;
    additionalImageSlotCount: number;
    unmetImageNeeds: Array<{ instanceId: string; reason: string }>;
  }>;
};

export async function runDesignImageWorker(
  ctx: WorkerContext
): Promise<WorkerReport<DesignPlan>> {
  const report = startReport("design-image");
  const bp = ctx.blueprint;

  const warnings: WorkerReport<unknown>["warnings"] = [];
  const messages: WorkerReport<unknown>["messages"] = [];

  // ── Derive intent tags (Phase 5) ─────────────────────────────────
  const intentTags = deriveIntentTags(bp);
  const tradeSlug = bp.vertical.taxonomySlug;

  // ── Load hero library ────────────────────────────────────────────
  // We load the full library (not just a keyword pick) so intent
  // matcher can rank + record provenance.
  const heroLib = await loadHeroLibrary();
  let heroSelection: DesignPlan["heroSelection"];

  if (!heroLib || heroLib.length === 0) {
    heroSelection = {
      tradeSlug,
      matched: false,
      heroId: null,
      imageUrl: null,
      palette: null,
      reason: "hero library not available in this runtime OR empty"
    };
    messages.push({
      level: "info",
      text: "Hero library not reachable · downstream picker will handle hero at render time"
    });
  } else {
    const outcome: ImageSelectionOutcome = selectImage(heroLib, intentTags, {
      pagePurpose: "homepage",
      tradeSlug,
      minScore: 0.35
    });

    if (outcome.status === "MATCHED") {
      heroSelection = {
        tradeSlug,
        matched: true,
        heroId: outcome.entry.id,
        imageUrl: outcome.entry.image_url,
        palette: (outcome.entry as { theme_palette?: unknown }).theme_palette ?? null,
        reason: `intent match · ${outcome.provenance.reason.slice(0, 3).join(" · ")}`,
        provenance: outcome.provenance,
        alternateIds: outcome.alternates.map((a) => a.id)
      };
      messages.push({
        level: "info",
        text: `Selected hero "${outcome.entry.id}" via intent matching · score ${outcome.provenance.totalScore.toFixed(2)} · ${outcome.provenance.intentTagsMatched.length} intent tags matched`
      });
    } else {
      // NO_SUITABLE_IMAGE — constitutional: never silently substitute.
      heroSelection = {
        tradeSlug,
        matched: false,
        heroId: null,
        imageUrl: null,
        palette: null,
        reason: `no suitable image in library · ${outcome.reason}`,
        requiresGenerationOrCustomerUpload: true
      };
      warnings.push({
        code: "no-suitable-hero-image",
        message: `No hero library entry meets intent threshold for trade "${tradeSlug}" (${outcome.consideredIds.length} candidates considered)`,
        resolution: "Either (a) expand scripts/hero-library.json with a matching entry, (b) queue for generation with recorded prompt provenance, or (c) request customer upload."
      });
    }
  }

  // ── Brand tokens pass-through (do NOT invent) ────────────────────
  const brandTokens: DesignPlan["brandTokens"] = {
    primary: bp.brand.palette.primary,
    background: bp.brand.palette.background,
    foreground: bp.brand.palette.foreground,
    headingFamily: bp.brand.typography.headingFamily,
    bodyFamily: bp.brand.typography.bodyFamily,
    inferredFromDefaults: (bp.provenance["brand.palette.primary"]?.level === "INFERRED")
  };
  if (brandTokens.inferredFromDefaults) {
    messages.push({
      level: "info",
      text: "Brand primary colour is INFERRED — Studio should invite the customer to confirm or swap."
    });
  }

  // ── Per-page image needs ─────────────────────────────────────────
  const perPageAssetPlan: DesignPlan["perPageAssetPlan"] = bp.pages.map((page) => {
    const heroInstances = page.sections.filter((s) => s.registryId.startsWith("hero/") || s.registryId.startsWith("hero."));
    const heroInstance = heroInstances[0] ?? null;
    const imageSlots = page.sections.filter((s) =>
      s.registryId.startsWith("gallery/") || s.registryId.startsWith("gallery.") ||
      s.registryId.startsWith("product/") || s.registryId.startsWith("product.")
    );
    const unmetImageNeeds: Array<{ instanceId: string; reason: string }> = [];
    // Check data bindings — sections that need data.source images
    for (const s of page.sections) {
      const src = s.data?.source;
      if (src === "hero_images" && !heroSelection.matched) {
        unmetImageNeeds.push({ instanceId: s.instanceId, reason: "hero_images data model has no seeded rows AND hero library returned no match" });
      }
    }
    return {
      pageId: page.id,
      heroInstanceId: heroInstance?.instanceId ?? null,
      additionalImageSlotCount: imageSlots.length,
      unmetImageNeeds
    };
  });

  const totalUnmet = perPageAssetPlan.reduce((n, p) => n + p.unmetImageNeeds.length, 0);
  const status = (totalUnmet > 0 || heroSelection.requiresGenerationOrCustomerUpload) ? "warn" : "ok";

  // ── Phase 19B · Evidence-based verdict ─────────────────────────────
  const evidence: EvidenceRecord[] = [];
  evidence.push({
    observation: `Derived ${intentTags.length} intent tag(s) for trade "${tradeSlug}"`,
    source: "blueprint",
    path: "vertical.taxonomySlug",
    value: { intentTags: intentTags.slice(0, 6), tradeSlug }
  });
  if (heroLib === null) {
    evidence.push({
      observation: "Hero library file not reachable at scripts/hero-library.json",
      source: "hero-library"
    });
  } else {
    evidence.push({
      observation: `Hero library loaded with ${heroLib.length} entry/entries`,
      source: "hero-library",
      value: { entryCount: heroLib.length }
    });
  }
  evidence.push({
    observation: heroSelection.matched
      ? `Hero matched: ${heroSelection.heroId} · reason=${heroSelection.reason}`
      : `Hero NOT matched · reason=${heroSelection.reason}`,
    source: "hero-library",
    value: { matched: heroSelection.matched, heroId: heroSelection.heroId }
  });
  evidence.push({
    observation: brandTokens.inferredFromDefaults
      ? "Brand primary colour was INFERRED from Reference Brain defaults"
      : "Brand primary colour was CUSTOMER_SUPPLIED",
    source: "blueprint",
    path: "brand.palette.primary",
    value: { inferred: brandTokens.inferredFromDefaults }
  });
  for (const p of perPageAssetPlan) {
    if (p.unmetImageNeeds.length > 0) {
      evidence.push({
        observation: `Page "${p.pageId}" has ${p.unmetImageNeeds.length} unmet image slot(s)`,
        source: "blueprint",
        path: `pages.${p.pageId}`,
        value: { unmetCount: p.unmetImageNeeds.length }
      });
    }
  }

  const heroLibraryUnreachable = heroLib === null;
  const verdict: EvidenceVerdict = heroLibraryUnreachable
    ? {
        state: "UNKNOWN",
        evidence,
        diagnosis: "Hero library could not be loaded — design worker cannot conclude whether a suitable image exists",
        decision: "Investigate hero-library.json reachability; do not select a hero via fabrication"
      }
    : heroSelection.requiresGenerationOrCustomerUpload
      ? {
          state: "BLOCKED_INPUT",
          evidence,
          diagnosis: `No hero in the library meets intent threshold for trade "${tradeSlug}" — a customer-uploaded image or an explicitly authorised generation is required`,
          decision: "Either (a) add a matching hero-library entry, (b) queue for generation with recorded prompt provenance, or (c) request customer upload"
        }
      : totalUnmet > 0 || brandTokens.inferredFromDefaults
        ? {
            state: "DEGRADED",
            evidence,
            diagnosis: `Hero selected but ${totalUnmet} additional image slot(s) unmet${brandTokens.inferredFromDefaults ? " and primary colour is INFERRED" : ""}`,
            decision: "Proceed; surface unmet slots + inferred brand fields to operator for confirmation"
          }
        : {
            state: "HEALTHY",
            evidence,
            diagnosis: "Hero selected from library, all page image slots have a source, brand tokens supplied",
            decision: "Proceed"
          };

  return report.finish<DesignPlan>(
    status,
    { intentTags, heroSelection, brandTokens, perPageAssetPlan },
    verdict,
    { errors: [], warnings, messages }
  );
}
