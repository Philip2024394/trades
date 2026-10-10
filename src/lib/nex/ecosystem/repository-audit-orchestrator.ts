// src/lib/nex/ecosystem/repository-audit-orchestrator.ts
//
// UWI · Wave 8.A · Repository-audit orchestrator
// Founder-authorised programme (Rule 5o.Q · 8-question output shape).
//
// Composes license-forensics + supply-chain-audit + Wave 7 purity
// contract (adapted for extracted-archive) + capability extraction
// into a single `WorldClassResourceVerdict` per Rule 5o.Q. Emits the
// verdict wrapped as an `EcosystemFinding` linked to the source
// resource. Feeds Wave 5 lifecycle if disposition warrants.
//
// Deterministic · pure orchestration · no external service.

import { createHash } from "node:crypto";
import type {
  EcosystemResource,
  EcosystemFinding,
  EcosystemRuntimePurityReport,
  WorldClassResourceVerdict,
  CapabilityExtractionReport,
} from "./types";
import type { SandboxedRepositoryView } from "./sandboxed-inspection";
import {
  readJsonMetadata,
  readMetadataFile,
  enumerateFiles,
  readCodeSample,
  filterCodeFiles,
} from "./sandboxed-inspection";
import { analyseLicense } from "./license-forensics";
import { auditSupplyChain } from "./supply-chain-audit";
import { BLOCKED_RUNTIME_IMPORTS } from "../continuous-loop/types";

// ─── Runtime-purity check against an EXTRACTED archive ──────────────
// The Wave 7 purity contract scans src/ within a repo root. For an
// extracted third-party archive, we adapt the scanner to look at the
// archive's own files rather than src/. Blocked-import matching reuses
// the same BLOCKED_RUNTIME_IMPORTS list.

async function scanRuntimePurity(view: SandboxedRepositoryView): Promise<EcosystemRuntimePurityReport> {
  const files = await enumerateFiles(view);
  const code_files = filterCodeFiles(files);
  const code_sample = await readCodeSample(view, code_files);

  const found_llm: string[] = [];
  const found_embedding: string[] = [];
  const found_hosted_ai: string[] = [];
  const found_cloud: string[] = [];
  let model_download = false;

  for (const blocked of BLOCKED_RUNTIME_IMPORTS) {
    // Look for import/require of blocked substrate in the sample
    const pattern = new RegExp(`(?:from\\s+["']|require\\s*\\(\\s*["']|import\\s*\\(\\s*["'])${escapeRegex(blocked)}(?:["'/])`, "i");
    if (pattern.test(code_sample)) {
      if (/langchain|crewai|autogen|@modelcontextprotocol/i.test(blocked)) found_llm.push(blocked);
      else if (/openai|anthropic|@anthropic|@google|cohere|groq|mistral|together|replicate|@huggingface/i.test(blocked)) found_llm.push(blocked);
      else if (/firecrawl|mendable/i.test(blocked)) found_hosted_ai.push(blocked);
    }
  }
  if (/api\.openai\.com|api\.anthropic\.com|api\.groq\.com|generativelanguage\.googleapis\.com/i.test(code_sample)) {
    found_hosted_ai.push("hosted-ai-endpoint");
  }
  if (/embed(?:dings?)?\.create|embedding_model|embedText/i.test(code_sample) &&
      (found_llm.length > 0 || /openai|anthropic|@huggingface/i.test(code_sample))) {
    found_embedding.push("external-embedding-api");
  }
  if (/aws-sdk|@aws-sdk|@google-cloud|@azure\//i.test(code_sample)) {
    found_cloud.push("cloud-sdk-detected");
  }
  if (/model_url|download_model|fetch_model|huggingface_hub|hf_hub_download|from_pretrained/i.test(code_sample)) {
    model_download = true;
  }

  const pure = found_llm.length === 0 && found_embedding.length === 0 && found_hosted_ai.length === 0 && !model_download;
  const notes: string[] = [];
  if (!pure) notes.push("candidate would introduce external AI/cloud/model-download at runtime · REJECT for NEX runtime unless clean-rebuild is performed");
  if (found_cloud.length > 0) notes.push("cloud SDK detected · verify whether needed for NEX use-case");

  return {
    checked_at_iso: new Date().toISOString(),
    external_llm_dependencies: found_llm,
    external_embedding_apis: found_embedding,
    hosted_ai_services: found_hosted_ai,
    cloud_service_dependencies: found_cloud,
    model_download_at_runtime: model_download,
    is_pure_for_nex_runtime: pure,
    notes,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Capability extraction (heuristic scaffold · Wave 8.A minimal) ──
function extractCapability(
  files: ReadonlyArray<string>,
  code_sample: string,
  resource: EcosystemResource,
): CapabilityExtractionReport {
  const notes: string[] = [];
  // Very light heuristics · this is intentionally minimal for Wave 8.A.
  // Wave 8.B will build a proper capability-taxonomy classifier.
  let category = "unknown";
  if (/(?:ocr|tesseract|paddleocr)/i.test(code_sample)) category = "OCR";
  else if (/(?:transformer|attention|encoder|decoder|self_attention)/i.test(code_sample)) category = "neural_architecture";
  else if (/(?:pdf|extract|parse.*document)/i.test(code_sample)) category = "document_processing";
  else if (/(?:embedding|vector|similarity)/i.test(code_sample)) category = "similarity_measurement";
  else if (/(?:cluster|kmeans|dbscan)/i.test(code_sample)) category = "clustering";
  else if (/(?:graph|adjacency|edge|node)/i.test(code_sample)) category = "graph_algorithm";
  else if (/(?:time.?series|forecast|arima|stl)/i.test(code_sample)) category = "time_series";
  else if (/(?:sitemap|robots|crawl|fetch)/i.test(code_sample)) category = "web_acquisition";

  const rebuildable = category !== "unknown" && category !== "neural_architecture";
  notes.push(`capability category heuristic: ${category}`);

  return {
    checked_at_iso: new Date().toISOString(),
    capability_summary: `${resource.resource_kind} in ${resource.ecosystem}${resource.metadata["title"] ? ` · ${String(resource.metadata["title"]).slice(0, 100)}` : ""}`,
    underlying_technique: `${category} · see resource source for authoritative documentation`,
    nex_reusable_directly: false, // Wave 8.A defaults conservative; clean-rebuild pathway is Wave 9+
    nex_rebuildable_natively: rebuildable,
    capability_category: category,
    notes,
  };
}

// ─── Full audit orchestrator ────────────────────────────────────────
export interface AuditRepositoryInput {
  readonly resource: EcosystemResource;
  readonly view: SandboxedRepositoryView | null;   // null if metadata-only (Wave 8.A default)
  readonly declared_license_spdx?: string | null;
  readonly declared_license_text?: string | null;
  readonly workflow_id: string;
  readonly activity_name: string;
  readonly attempt_id: string | number;
  readonly user_relevance: number;                 // caller-provided
  readonly nex_relevance: number;                  // caller-provided
  readonly novelty_score?: number;                 // from Wave 4 dedup cascade if known
}

export async function auditRepository(input: AuditRepositoryInput): Promise<EcosystemFinding> {
  const now_iso = new Date().toISOString();

  // 1 · License forensics
  const license = analyseLicense({
    spdx: input.declared_license_spdx,
    text: input.declared_license_text,
  });

  // 2 · Supply-chain audit + runtime-purity + capability extraction
  //    (metadata-only mode when view is null · Wave 8.A default)
  let supply: ReturnType<typeof auditSupplyChain>;
  let runtime_purity: EcosystemRuntimePurityReport;
  let capability: CapabilityExtractionReport;
  let dependencies_summary: { direct_count: number; transitive_count: number; notable: ReadonlyArray<string> };

  if (input.view) {
    const pkg = await readJsonMetadata<Record<string, unknown>>(input.view, "package.json");
    const files = await enumerateFiles(input.view);
    const code_files = filterCodeFiles(files);
    const code_sample = await readCodeSample(input.view, code_files);
    const direct_deps = pkg && typeof pkg["dependencies"] === "object" && pkg["dependencies"]
      ? Object.keys(pkg["dependencies"] as Record<string, unknown>)
      : [];
    const transitive: string[] = []; // Wave 8.B extracts via `npm ls` in sandbox

    supply = auditSupplyChain({
      package_json: pkg,
      transitive_deps: transitive,
      code_sample,
      maintainers: [],
      package_name: pkg && typeof pkg["name"] === "string" ? pkg["name"] as string : null,
    });
    runtime_purity = await scanRuntimePurity(input.view);
    capability = extractCapability(files, code_sample, input.resource);
    dependencies_summary = {
      direct_count: direct_deps.length,
      transitive_count: transitive.length,
      notable: direct_deps.slice(0, 10),
    };
  } else {
    // Metadata-only mode (Wave 8.A default): supply-chain audit based on
    // resource metadata alone · purity scan skipped · capability inferred
    // from resource description.
    supply = auditSupplyChain({
      package_json: null,
      transitive_deps: [],
      code_sample: null,
      maintainers: [],
      package_name: null,
    });
    runtime_purity = {
      checked_at_iso: now_iso,
      external_llm_dependencies: [],
      external_embedding_apis: [],
      hosted_ai_services: [],
      cloud_service_dependencies: [],
      model_download_at_runtime: false,
      is_pure_for_nex_runtime: true,
      notes: ["metadata-only audit · Wave 8.B extract-into-sandbox required for authoritative runtime-purity verdict"],
    };
    capability = {
      checked_at_iso: now_iso,
      capability_summary: `${input.resource.resource_kind} in ${input.resource.ecosystem} (metadata-only audit)`,
      underlying_technique: "metadata-only · authoritative capability extraction requires Wave 8.B sandbox inspection",
      nex_reusable_directly: false,
      nex_rebuildable_natively: false,
      capability_category: "unknown",
      notes: ["metadata-only Wave 8.A audit"],
    };
    dependencies_summary = { direct_count: 0, transitive_count: 0, notable: [] };
  }

  // 3 · 6-way disposition (Rule 5o.E)
  const disposition = deriveDisposition(license, supply, runtime_purity, capability, input);

  // 4 · Compose 8-question verdict (Rule 5o.Q)
  const verdict: WorldClassResourceVerdict = {
    what_it_does: capability.capability_summary,
    licence: license,
    dependencies_summary,
    runtime_purity,
    useful_technique: capability,
    direct_reuse_verdict: {
      appropriate: license.nex_compatible && runtime_purity.is_pure_for_nex_runtime && supply.risk_level === "low",
      reason: buildDirectReuseReason(license, runtime_purity, supply),
    },
    clean_rebuild_verdict: {
      possible: capability.nex_rebuildable_natively,
      reason: capability.nex_rebuildable_natively
        ? "capability category has deterministic algorithmic form; NEX-native rebuild feasible"
        : "capability requires model weights / neural architecture / non-deterministic components · clean rebuild not straightforward",
    },
    opportunity_recommendation: deriveOpportunityRecommendation(license, runtime_purity, supply, capability, input),
  };

  // 5 · Finding id (deterministic per Wave 2 D2 idempotency key)
  const finding_id = deriveFindingId(input);

  // 6 · Provenance chain
  const provenance_chain = [
    { stage: "resource_fetched", at_iso: input.resource.fetched_at_iso, detail: `${input.resource.ecosystem}:${input.resource.id}` },
    { stage: "license_forensics", at_iso: license.checked_at_iso, detail: license.copyleft_class },
    { stage: "supply_chain_audit", at_iso: supply.checked_at_iso, detail: `risk=${supply.risk_level}` },
    { stage: "runtime_purity_scan", at_iso: runtime_purity.checked_at_iso, detail: runtime_purity.is_pure_for_nex_runtime ? "pure" : "impure" },
    { stage: "capability_extraction", at_iso: capability.checked_at_iso, detail: capability.capability_category },
    { stage: "disposition_derived", at_iso: now_iso, detail: disposition },
  ];

  return {
    finding_id,
    resource: input.resource,
    verdict,
    disposition,
    created_at_iso: now_iso,
    nex_relevance: input.nex_relevance,
    user_relevance: input.user_relevance,
    novelty_score: input.novelty_score ?? 0.5,
    provenance_chain,
  };
}

function deriveDisposition(
  license: ReturnType<typeof analyseLicense>,
  supply: ReturnType<typeof auditSupplyChain>,
  purity: EcosystemRuntimePurityReport,
  capability: CapabilityExtractionReport,
  input: AuditRepositoryInput,
): EcosystemFinding["disposition"] {
  // Hard rejects first
  if (supply.risk_level === "critical") return "REJECT";
  if (license.copyleft_class === "network_copyleft") return "REJECT";
  if (!purity.is_pure_for_nex_runtime && !capability.nex_rebuildable_natively) return "REJECT";

  // Legal review triggers
  if (license.requires_legal_review) return "LEGAL-REVIEW";

  // Rebuild if runtime impure but capability is rebuildable
  if (!purity.is_pure_for_nex_runtime && capability.nex_rebuildable_natively) return "REBUILD";

  // Reuse if fully clean
  if (license.nex_compatible && purity.is_pure_for_nex_runtime && supply.risk_level === "low") {
    if (capability.nex_reusable_directly) return "REUSE";
    return "REBUILD";  // clean but rebuild-preferred until Wave 8.B explicit reuse pathway
  }

  // Reference by default (interesting but not adopted)
  if (input.nex_relevance < 0.3) return "DEFER";
  return "REFERENCE";
}

function buildDirectReuseReason(
  license: ReturnType<typeof analyseLicense>,
  purity: EcosystemRuntimePurityReport,
  supply: ReturnType<typeof auditSupplyChain>,
): string {
  if (!license.nex_compatible) return `licence '${license.spdx_identifier ?? "unknown"}' (${license.copyleft_class}) incompatible with NEX runtime`;
  if (!purity.is_pure_for_nex_runtime) return `runtime purity failed · external LLM/embedding/cloud/model-download detected: ${[...purity.external_llm_dependencies, ...purity.hosted_ai_services, ...purity.external_embedding_apis].join(", ") || "yes"}`;
  if (supply.risk_level !== "low") return `supply-chain risk ${supply.risk_level} · ${supply.notes.join(" · ")}`;
  return "clean · direct reuse appropriate";
}

function deriveOpportunityRecommendation(
  license: ReturnType<typeof analyseLicense>,
  purity: EcosystemRuntimePurityReport,
  supply: ReturnType<typeof auditSupplyChain>,
  capability: CapabilityExtractionReport,
  input: AuditRepositoryInput,
): WorldClassResourceVerdict["opportunity_recommendation"] {
  const worth_recording = capability.capability_category !== "unknown" || license.spdx_identifier !== null;
  const testable = capability.nex_rebuildable_natively;
  const create_opportunity = worth_recording && testable && input.nex_relevance >= 0.5;
  const downgrade = !worth_recording || (!testable && input.nex_relevance < 0.3);
  return {
    create_finding: worth_recording,
    create_hypothesis: testable,
    create_opportunity,
    downgrade_to_observation: downgrade,
    reason: downgrade
      ? "not falsifiable · not novel enough · or not NEX-relevant"
      : create_opportunity
      ? "capability is rebuildable · NEX-relevance sufficient · lifecycle warranted"
      : "worth recording as finding · not yet opportunity-worthy",
  };
}

function deriveFindingId(input: AuditRepositoryInput): string {
  const payload = `${input.workflow_id}|${input.activity_name}|${input.attempt_id}|${input.resource.ecosystem}:${input.resource.id}`;
  const hash = createHash("sha256").update(payload).digest("hex").slice(0, 16);
  return `ecofinding:${hash}`;
}
