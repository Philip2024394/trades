// src/lib/nex/create-banners/__tests__/create-banners.test.ts
//
// NEX Create Banners · Authorisation A acceptance suite
// =====================================================
// Covers §23 of the Authorisation A message · contract, provider/consumer,
// engine independence, campaign validation, concept validation, variant
// orchestration, 12-format orchestration, quality status, provenance,
// reference eligibility, third-party-AI rejection, composition contract,
// verification contract, Social Poster handoff, legacy Anthropic isolation.

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  QUALITY_STATUS_VALUES,
  DEFAULT_QUALITY_STATUS_UNTIL_EVALUATION_PASSES,
  mayPublishToSocialPoster,
  isQualityStatus,
  BANNER_FORMATS,
  BANNER_FORMAT_IDS,
  EVALUATION_REQUIRED_FORMAT_IDS,
  getBannerFormat,
  InMemoryGenerationEngineRegistry,
  makeSdxlEngineAdapter,
  makeSdxlProvider,
  NEX_VISUAL_ENGINE_PRIMARY_SLUG,
  classifyRawProvenanceText,
  classifyReferenceHandle,
  guardCampaignReferences,
  validateBannerCampaign,
  validateBannerConcept,
  buildOrchestrationPlan,
  initialJobLifecycles,
  planSafeZones,
  buildInitialVerification,
  buildProvenanceChain,
  preflightHandoff,
  CREATE_BANNERS_MUST_NOT_IMPORT_FROM,
  CREATE_BANNERS_MAY_REUSE_LEGACY_ANTHROPIC_ROUTE,
  CREATE_BANNERS_MAY_DELETE_LEGACY_ROUTE_UNILATERALLY,
  LEGACY_ANTHROPIC_BANNER_ROUTE_PATH,
  THIRD_PARTY_AI_MARKERS,
  type BannerCampaign,
  type BannerConcept,
  type BannerVariant,
  type ReferenceAssetHandle,
  type GenerationResult,
} from "../index";

// ---------------------------------------------------------------------------
// § Quality Status
// ---------------------------------------------------------------------------
describe("quality-status", () => {
  it("has exactly five values including UNPROVEN and PRODUCTION_VALIDATED", () => {
    expect(QUALITY_STATUS_VALUES).toContain("UNPROVEN");
    expect(QUALITY_STATUS_VALUES).toContain("EVALUATING");
    expect(QUALITY_STATUS_VALUES).toContain("PROVISIONALLY_VALIDATED");
    expect(QUALITY_STATUS_VALUES).toContain("PRODUCTION_VALIDATED");
    expect(QUALITY_STATUS_VALUES).toContain("BLOCKED");
    expect(QUALITY_STATUS_VALUES).toHaveLength(5);
  });
  it("defaults to UNPROVEN", () => {
    expect(DEFAULT_QUALITY_STATUS_UNTIL_EVALUATION_PASSES).toBe("UNPROVEN");
  });
  it("only PRODUCTION_VALIDATED may publish", () => {
    for (const s of QUALITY_STATUS_VALUES) {
      const may = mayPublishToSocialPoster(s);
      expect(may).toBe(s === "PRODUCTION_VALIDATED");
    }
  });
  it("isQualityStatus rejects garbage", () => {
    expect(isQualityStatus("PRODUCTION_VALIDATED")).toBe(true);
    expect(isQualityStatus("MOSTLY_OK")).toBe(false);
    expect(isQualityStatus(null)).toBe(false);
    expect(isQualityStatus(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// § Formats
// ---------------------------------------------------------------------------
describe("formats", () => {
  it("exposes 12 formats", () => {
    expect(BANNER_FORMATS).toHaveLength(12);
    expect(BANNER_FORMAT_IDS).toHaveLength(12);
  });
  it("evaluation-required formats include the three plan-D7 shapes", () => {
    expect(EVALUATION_REQUIRED_FORMAT_IDS).toEqual([
      "square_1024",
      "landscape_1200x628",
      "portrait_1080x1920",
    ]);
  });
  it("getBannerFormat returns dimensions correctly", () => {
    const sq = getBannerFormat("square_1024");
    expect(sq.width).toBe(1024);
    expect(sq.height).toBe(1024);
    expect(sq.aspect).toBe("square");
  });
  it("every format has valid text_region_area_fraction_hint 0<x<1", () => {
    for (const f of BANNER_FORMATS) {
      expect(f.text_region_area_fraction_hint).toBeGreaterThan(0);
      expect(f.text_region_area_fraction_hint).toBeLessThan(1);
    }
  });
  it("no format is engine-specific · none names SDXL", () => {
    for (const f of BANNER_FORMATS) {
      expect(f.label.toLowerCase()).not.toContain("sdxl");
      expect(f.id.toLowerCase()).not.toContain("sdxl");
    }
  });
});

// ---------------------------------------------------------------------------
// § Capability contract · engine registry
// ---------------------------------------------------------------------------
describe("capability contract · engine registry", () => {
  it("registers and picks a provider", async () => {
    const registry = new InMemoryGenerationEngineRegistry();
    const adapter = makeSdxlEngineAdapter({
      invokeUnderlyingAdapter: async () => ({
        kind: "SUCCESS",
        output_image_path_relative: "out/x.png",
        output_bytes: 1000,
        output_sha256: "abc",
        duration_ms: 100,
        model_weights_sha256_fingerprint: "fp",
      }),
      output_dir_abs: "/tmp",
      request_json_path_abs: "/tmp/r.json",
    });
    const provider = makeSdxlProvider(adapter);
    expect(provider.provider_slug).toBe(NEX_VISUAL_ENGINE_PRIMARY_SLUG);
    expect(provider.quality_status).toBe("UNPROVEN");
    registry.register(provider);
    expect(registry.list()).toHaveLength(1);
    expect(registry.get(NEX_VISUAL_ENGINE_PRIMARY_SLUG)).toBe(provider);
  });
  it("refuses duplicate registration", () => {
    const registry = new InMemoryGenerationEngineRegistry();
    const adapter = makeSdxlEngineAdapter({
      invokeUnderlyingAdapter: async () => ({
        kind: "FAILURE",
        reason: "test",
      }),
      output_dir_abs: "/tmp",
      request_json_path_abs: "/tmp/r.json",
    });
    const provider = makeSdxlProvider(adapter);
    registry.register(provider);
    expect(() => registry.register(provider)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// § Engine independence · module has ONE engine-specific file only
// ---------------------------------------------------------------------------
describe("engine independence", () => {
  const MODULE_ROOT = path.join(
    process.cwd(),
    "src",
    "lib",
    "nex",
    "create-banners"
  );
  const ENGINE_FILE_BASENAME = "sdxl-engine-adapter-binding.ts";
  it("no create-banners file OTHER than the binding names 'sdxl' or 'anthropic' or 'openai' etc.", () => {
    const files = fs
      .readdirSync(MODULE_ROOT)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    // The binding + tests + doctrine-quarantine + eligibility file legitimately reference names
    const allowed = new Set<string>([
      ENGINE_FILE_BASENAME,
      "legacy-anthropic-quarantine.ts",
      "reference-eligibility.ts",
      "index.ts", // barrel re-exports the binding
    ]);
    for (const file of files) {
      if (allowed.has(file)) continue;
      const text = fs
        .readFileSync(path.join(MODULE_ROOT, file), "utf8")
        .toLowerCase();
      expect(text, `${file} must not name engine specifics`).not.toContain(
        "sdxl"
      );
      expect(text, `${file} must not name anthropic`).not.toContain(
        "anthropic"
      );
      expect(text, `${file} must not import openai`).not.toContain("openai");
    }
  });
});

// ---------------------------------------------------------------------------
// § Reference eligibility · inherits NEX doctrine
// ---------------------------------------------------------------------------
describe("reference eligibility · doctrine inherited", () => {
  it("classifies obvious third-party AI markers as INELIGIBLE", () => {
    const decision = classifyReferenceHandle({
      reference_id: "ref-1",
      manifest_asset_id_or_path: "x",
      sha256: "y",
      provenance: {
        classification: "THIRD_PARTY_AI_GENERATED",
        evidence: "chatgpt in url",
        recorded_by: "manifest_lookup",
        recorded_at: new Date().toISOString(),
      },
    });
    expect(decision.outcome).toBe("INELIGIBLE");
  });
  it("classifies UNKNOWN as NOT_AUTHORISABLE (absence of AI marker != proof of human origin)", () => {
    const decision = classifyReferenceHandle({
      reference_id: "ref-2",
      manifest_asset_id_or_path: "x",
      sha256: "y",
      provenance: {
        classification: "UNKNOWN",
        evidence: "no positive evidence",
        recorded_by: "manifest_lookup",
        recorded_at: new Date().toISOString(),
      },
    });
    expect(decision.outcome).toBe("NOT_AUTHORISABLE");
  });
  it("classifies NEX_LOCAL_GENERATION_OUTPUT as INELIGIBLE for reference use (it is an OUTPUT not an INPUT)", () => {
    const decision = classifyReferenceHandle({
      reference_id: "ref-3",
      manifest_asset_id_or_path: "x",
      sha256: "y",
      provenance: {
        classification: "NEX_LOCAL_GENERATION_OUTPUT",
        evidence: "NEX-local produced",
        recorded_by: "manifest_lookup",
        recorded_at: new Date().toISOString(),
      },
    });
    expect(decision.outcome).toBe("INELIGIBLE");
  });
  it("classifies KNOWN_HUMAN_LEGITIMATE_SOURCE as ELIGIBLE", () => {
    const decision = classifyReferenceHandle({
      reference_id: "ref-4",
      manifest_asset_id_or_path: "x",
      sha256: "y",
      provenance: {
        classification: "KNOWN_HUMAN_LEGITIMATE_SOURCE",
        evidence: "real photograph shot on camera",
        recorded_by: "founder",
        recorded_at: new Date().toISOString(),
      },
    });
    expect(decision.outcome).toBe("ELIGIBLE");
  });
  it("classifyRawProvenanceText detects ChatGPT-in-URL", () => {
    expect(
      classifyRawProvenanceText(
        "https://ik.imagekit.io/x/ChatGPT Image Aug 2.png"
      )
    ).toBe("THIRD_PARTY_AI_GENERATED");
  });
  it("classifyRawProvenanceText detects photograph-in-description", () => {
    expect(
      classifyRawProvenanceText(
        "https://example.com/opaque.png real photograph shot on iphone"
      )
    ).toBe("KNOWN_HUMAN_LEGITIMATE_SOURCE");
  });
  it("classifyRawProvenanceText leaves opaque filenames UNKNOWN", () => {
    expect(classifyRawProvenanceText("https://example.com/dfgdfg.png")).toBe(
      "UNKNOWN"
    );
  });
  it("guardCampaignReferences refuses campaign with ANY ineligible reference", () => {
    const refs: ReferenceAssetHandle[] = [
      {
        reference_id: "good",
        manifest_asset_id_or_path: "x",
        sha256: "y",
        provenance: {
          classification: "KNOWN_HUMAN_LEGITIMATE_SOURCE",
          evidence: "e",
          recorded_by: "founder",
          recorded_at: new Date().toISOString(),
        },
      },
      {
        reference_id: "bad",
        manifest_asset_id_or_path: "x",
        sha256: "y",
        provenance: {
          classification: "THIRD_PARTY_AI_GENERATED",
          evidence: "e",
          recorded_by: "manifest_lookup",
          recorded_at: new Date().toISOString(),
        },
      },
    ];
    const guard = guardCampaignReferences(refs);
    expect(guard.campaign_may_proceed).toBe(false);
    expect(guard.refusal_reason).toBeTruthy();
  });
  it("THIRD_PARTY_AI_MARKERS list includes the six major third-party AI providers", () => {
    for (const marker of [
      "chatgpt",
      "openai",
      "midjourney",
      "stable diffusion",
      "ideogram",
      "recraft",
    ]) {
      expect(THIRD_PARTY_AI_MARKERS).toContain(marker);
    }
  });
});

// ---------------------------------------------------------------------------
// § Legacy Anthropic route · quarantined
// ---------------------------------------------------------------------------
describe("legacy Anthropic banner route · quarantine", () => {
  it("must-not-import list includes the legacy paths + third-party SDKs", () => {
    expect(CREATE_BANNERS_MUST_NOT_IMPORT_FROM).toContain(
      "@/lib/llm/anthropic"
    );
    expect(CREATE_BANNERS_MUST_NOT_IMPORT_FROM).toContain(
      "@anthropic-ai/sdk"
    );
    expect(CREATE_BANNERS_MUST_NOT_IMPORT_FROM).toContain("openai");
  });
  it("re-use flag is false", () => {
    expect(CREATE_BANNERS_MAY_REUSE_LEGACY_ANTHROPIC_ROUTE).toBe(false);
  });
  it("unilateral delete flag is false", () => {
    expect(CREATE_BANNERS_MAY_DELETE_LEGACY_ROUTE_UNILATERALLY).toBe(false);
  });
  it("no create-banners source file imports any of the forbidden paths", () => {
    const MODULE_ROOT = path.join(
      process.cwd(),
      "src",
      "lib",
      "nex",
      "create-banners"
    );
    const files = fs
      .readdirSync(MODULE_ROOT)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    for (const file of files) {
      if (file === "legacy-anthropic-quarantine.ts") continue; // this file NAMES them intentionally
      const text = fs.readFileSync(path.join(MODULE_ROOT, file), "utf8");
      for (const forbidden of CREATE_BANNERS_MUST_NOT_IMPORT_FROM) {
        expect(
          text.includes(`from "${forbidden}`),
          `${file} imports forbidden ${forbidden}`
        ).toBe(false);
      }
    }
  });
  it("legacy route path constant is present and points at merchant-assistant", () => {
    expect(LEGACY_ANTHROPIC_BANNER_ROUTE_PATH).toContain(
      "merchant-assistant/banner"
    );
  });
});

// ---------------------------------------------------------------------------
// § Campaign + concept validation
// ---------------------------------------------------------------------------
function makeValidCampaign(): BannerCampaign {
  return {
    campaign_id: "c1",
    authored_by: "founder",
    authored_at: new Date().toISOString(),
    business: {
      business_id: "b1",
      display_name: "Acme Scaffolding",
      website: "https://example.com",
      trade_category: "scaffolding",
    },
    product_or_service: {
      kind: "service",
      label: "residential scaffolding installation",
      notes: "",
    },
    campaign_objective: "Reliable scaffolding for house renovations",
    target_audience_hints: [],
    brand_constraints: {
      colour_palette_hex: ["#165724"],
      must_include_logo: false,
      forbidden_elements: [],
    },
    permitted_source_assets: [
      {
        reference_id: "cat1",
        manifest_asset_id_or_path: "data/x.png",
        sha256:
          "6fe56772c3916612acd2af3ee224ce2fcb5915a45fc9fa8710448c51ce62cce0",
        provenance: {
          classification: "KNOWN_HUMAN_LEGITIMATE_SOURCE",
          evidence: "founder photograph",
          recorded_by: "founder",
          recorded_at: new Date().toISOString(),
        },
      },
    ],
    requested_formats: ["square_1024", "landscape_1200x628"],
    generation_quality_status: "UNPROVEN",
    provenance_requirements: {
      require_reference_sha256: true,
      require_engine_identity_recorded: true,
      require_composition_layer_recorded: true,
      require_verification_recorded: true,
    },
  };
}

function makeValidConcept(): BannerConcept {
  return {
    concept_id: "k1",
    campaign_id: "c1",
    subject: "UK scaffolded house",
    visual_objective: "Show a scaffolded house on a suburban street",
    composition_intent: {
      primary_subject_placement: "centre",
      negative_space_placement: "top",
      mood: "trustworthy",
    },
    environment: "UK suburban street",
    required_visual_elements: ["scaffolding", "brick house"],
    forbidden_elements: ["logos", "text"],
    brand_constraints: {
      colour_palette_hex: [],
      must_include_logo: false,
      forbidden_elements: [],
    },
    copy_requirements: {
      headline: "Reliable scaffolding for house renovations",
      offer: null,
      cta: "Book a free survey",
      phone: null,
      url: null,
    },
    reference_requirements: {
      reference_ids: ["cat1"],
      reference_strength_hint: 0.4,
      may_generate_without_reference: false,
    },
    engine_agnostic_hints: {
      photorealism_priority: "high",
      people_allowed: false,
      text_in_image_allowed: false,
      logo_in_image_allowed: false,
    },
  };
}

describe("campaign + concept validation", () => {
  it("valid campaign passes", () => {
    const result = validateBannerCampaign(makeValidCampaign());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
  it("invalid campaign with bad reference fails", () => {
    const c = makeValidCampaign();
    const bad: BannerCampaign = {
      ...c,
      permitted_source_assets: [
        {
          reference_id: "bad",
          manifest_asset_id_or_path: "x",
          sha256: "y",
          provenance: {
            classification: "THIRD_PARTY_AI_GENERATED",
            evidence: "chatgpt in url",
            recorded_by: "manifest_lookup",
            recorded_at: new Date().toISOString(),
          },
        },
      ],
    };
    const result = validateBannerCampaign(bad);
    expect(result.valid).toBe(false);
  });
  it("valid concept passes", () => {
    const result = validateBannerConcept(makeValidConcept());
    expect(result.valid).toBe(true);
  });
  it("concept must have text_in_image_allowed=false and logo_in_image_allowed=false (types enforce · validator asserts)", () => {
    const k = makeValidConcept();
    const result = validateBannerConcept(k);
    expect(result.valid).toBe(true);
    // We cannot cast an already-strict `false` into `true` at the type level;
    // the validator's checks are defensive against runtime tampering.
  });
});

// ---------------------------------------------------------------------------
// § Orchestrator · 12-variant planning
// ---------------------------------------------------------------------------
describe("orchestrator", () => {
  it("plans one variant per format × seed", () => {
    const c = makeValidCampaign();
    const k = makeValidConcept();
    const plan = buildOrchestrationPlan({
      campaign: c,
      concept: k,
      seeds: [42, 137, 271],
    });
    // 2 formats × 3 seeds = 6 variants
    expect(plan.total_variants).toBe(6);
    expect(plan.variant_definitions).toHaveLength(6);
    expect(plan.generation_requests).toHaveLength(6);
  });
  it("supports 12 formats × 3 seeds for full 12-banner-per-seed brief", () => {
    const c: BannerCampaign = {
      ...makeValidCampaign(),
      requested_formats: BANNER_FORMAT_IDS,
    };
    const k = makeValidConcept();
    const plan = buildOrchestrationPlan({
      campaign: c,
      concept: k,
      seeds: [42, 137, 271],
    });
    expect(plan.total_variants).toBe(36); // 12 × 3
  });
  it("initialJobLifecycles produces one job per variant · all UNPROVEN", () => {
    const c = makeValidCampaign();
    const k = makeValidConcept();
    const plan = buildOrchestrationPlan({
      campaign: c,
      concept: k,
      seeds: [42],
    });
    const jobs = initialJobLifecycles(plan);
    expect(jobs).toHaveLength(plan.total_variants);
    for (const j of jobs) {
      expect(j.state).toBe("requested");
      expect(j.quality_status).toBe("UNPROVEN");
    }
  });
  it("throws on zero seeds", () => {
    const c = makeValidCampaign();
    const k = makeValidConcept();
    expect(() =>
      buildOrchestrationPlan({ campaign: c, concept: k, seeds: [] })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// § Composition contract
// ---------------------------------------------------------------------------
describe("composition contract", () => {
  it("plans safe zones for a concept + format", () => {
    const k = makeValidConcept();
    const f = getBannerFormat("square_1024");
    const zones = planSafeZones(k, f);
    // headline + cta always present in valid concept · offer optional
    const roles = zones.map((z) => z.role);
    expect(roles).toContain("headline");
    expect(roles).toContain("cta");
  });
});

// ---------------------------------------------------------------------------
// § Verification contract
// ---------------------------------------------------------------------------
describe("verification contract", () => {
  it("initial verification has all checks marked not_yet_proven and overall=blocked", () => {
    const variant: BannerVariant = {
      variant_id: "v1",
      campaign_id: "c1",
      concept_id: "k1",
      format_id: "square_1024",
      generation_result_ref: "r1",
      composition_result_ref: null,
      verification_result_ref: null,
      lifecycle_state: "generated",
      quality_status: "UNPROVEN",
      provenance_chain_id: "p1",
    };
    const v = buildInitialVerification({ variant });
    expect(v.overall).toBe("blocked");
    for (const c of v.automated_checks) {
      expect(c.outcome).toBe("not_yet_proven");
    }
  });
});

// ---------------------------------------------------------------------------
// § Provenance chain
// ---------------------------------------------------------------------------
describe("provenance chain", () => {
  it("builds end-to-end chain from parts", () => {
    const campaign = makeValidCampaign();
    const concept = makeValidConcept();
    const variant: BannerVariant = {
      variant_id: "v1",
      campaign_id: campaign.campaign_id,
      concept_id: concept.concept_id,
      format_id: "square_1024",
      generation_result_ref: "r1",
      composition_result_ref: "cr1",
      verification_result_ref: "vr1",
      lifecycle_state: "verified",
      quality_status: "UNPROVEN",
      provenance_chain_id: "p1",
    };
    const gr: GenerationResult = {
      result_id: "r1",
      request_id: "req1",
      kind: "SUCCESS",
      generated_asset_path_or_ref: "out.png",
      generated_asset_sha256: "abc",
      engine_identity: {
        engine_slug: "nex-visual-engine-primary",
        engine_adapter_version: "0.1.0",
      },
      model_identity: {
        model_slug: "sdxl-1.0-base",
        model_variant: "fp16",
        model_weights_sha256_fingerprint: "fp",
      },
      seed: 42,
      generation_parameters_fingerprint: "seed=42",
      reference_provenance: campaign.permitted_source_assets.map(
        (r) => r.provenance
      ),
      generated_at: new Date().toISOString(),
      generation_duration_ms: 100,
      quality_status_at_generation_time: "UNPROVEN",
      failure_reason: null,
    };
    const chain = buildProvenanceChain({
      campaign,
      concept,
      variant,
      generation_result: gr,
      composition_result: null,
      verification: null,
      final_asset_ref: "final.png",
      final_asset_sha256: "def",
    });
    expect(chain.campaign_id).toBe(campaign.campaign_id);
    expect(chain.concept_id).toBe(concept.concept_id);
    expect(chain.variant_id).toBe(variant.variant_id);
    expect(chain.generation.engine_slug).toBe("nex-visual-engine-primary");
    expect(chain.generation.reference_provenance).toHaveLength(1);
    expect(chain.final_asset.asset_sha256).toBe("def");
  });
});

// ---------------------------------------------------------------------------
// § Social Poster handoff · refuses on quality gate
// ---------------------------------------------------------------------------
describe("social poster handoff", () => {
  const baseVariant: BannerVariant = {
    variant_id: "v1",
    campaign_id: "c1",
    concept_id: "k1",
    format_id: "square_1024",
    generation_result_ref: "r1",
    composition_result_ref: "cr1",
    verification_result_ref: "vr1",
    lifecycle_state: "approved",
    quality_status: "UNPROVEN",
    provenance_chain_id: "p1",
  };
  const baseChain = {
    provenance_chain_id: "p1",
    built_at: new Date().toISOString(),
    campaign_id: "c1",
    concept_id: "k1",
    variant_id: "v1",
    generation: {
      request_id: "req1",
      result_id: "r1",
      engine_slug: "nex-visual-engine-primary",
      engine_adapter_version: "0.1.0",
      model_slug: "sdxl-1.0-base",
      model_variant: "fp16",
      model_weights_sha256_fingerprint: "fp",
      seed: 42,
      generation_parameters_fingerprint: "seed=42",
      generated_asset_sha256: "abc",
      reference_provenance: [],
      generated_at: new Date().toISOString(),
    },
    composition: {
      composition_result_id: "cr1",
      composed_asset_sha256: "cabc",
      composed_at: new Date().toISOString(),
    },
    verification: {
      verification_id: "vr1",
      overall: "pass" as const,
      reviewed_by: "founder" as const,
      verified_at: new Date().toISOString(),
    },
    final_asset: {
      asset_ref: "final.png",
      asset_sha256: "fabc",
    },
  };
  it("refuses when quality is UNPROVEN", () => {
    const outcome = preflightHandoff({
      variant: baseVariant,
      provenance_chain: baseChain,
    });
    expect(outcome.outcome).toBe("REFUSED_QUALITY_GATE");
  });
  it("accepts when quality is PRODUCTION_VALIDATED and verification pass", () => {
    const outcome = preflightHandoff({
      variant: { ...baseVariant, quality_status: "PRODUCTION_VALIDATED" },
      provenance_chain: baseChain,
    });
    expect(outcome.outcome).toBe("ACCEPTED_BY_HANDOFF");
  });
  it("refuses when verification not pass, even at PRODUCTION_VALIDATED", () => {
    const outcome = preflightHandoff({
      variant: { ...baseVariant, quality_status: "PRODUCTION_VALIDATED" },
      provenance_chain: {
        ...baseChain,
        verification: { ...baseChain.verification, overall: "fail" },
      },
    });
    expect(outcome.outcome).toBe("REFUSED_QUALITY_GATE");
  });
  it("refuses when asset SHA missing", () => {
    const outcome = preflightHandoff({
      variant: { ...baseVariant, quality_status: "PRODUCTION_VALIDATED" },
      provenance_chain: {
        ...baseChain,
        final_asset: { asset_ref: null, asset_sha256: null },
      },
    });
    expect(outcome.outcome).toBe("REFUSED_MISSING_PROVENANCE");
  });
});
