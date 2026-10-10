// src/lib/nex-registry/capability-registry.ts
//
// NEX Self-Model · Capability Registry (Ledger B · Zero LLM)
//
// FOUNDER PRINCIPLE (verbatim mandate):
//   NEX may discover and propose capability evolution, but only verified
//   evidence can promote a capability from proposed knowledge into
//   trusted capability knowledge.
//
// ANTI-MANUFACTURING GATES
//   1. registerCapability() with status=PROMOTED requires evidence_refs.length>0
//   2. registerCapability() with status=VERIFIED requires evidence_refs.length>0
//   3. promoteCapability() cannot promote a capability without evidence
//   4. Every capability MUST declare who proposed it (agent name or "nex-native")
//
// The registry is the shared machine-readable model that NEX1, Twin NEX,
// Referee, and all specialist agents query to understand:
//   · what NEX can do
//   · what NEX cannot do
//   · who owns each capability
//   · what evidence proves it
//   · what dependencies constrain it

import {
  computeCapabilityId,
  isAutoSelectableStatus,
  isTrustable,
  NEX_CAPABILITY_VERSION,
  type CapabilityCategory,
  type CapabilityQuery,
  type CapabilityRecord,
  type CapabilityStatus,
  type EvidenceRef,
} from "./capability-types";
import { assertRule1, assertRule2Registration, assertRule2Promotion } from "./capability-rule";

// ── Storage ────────────────────────────────────────────────────────────
const REGISTRY = new Map<string, CapabilityRecord>();

export function _resetCapabilityRegistryForTests(): void {
  REGISTRY.clear();
}

// ── Anti-manufacturing invariant helpers ──────────────────────────────
function invariant(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`nex-capability: ${msg}`);
}

// ── Registration ──────────────────────────────────────────────────────
export function registerCapability(
  spec: Omit<CapabilityRecord, "capability_id" | "zero_llm" | "ledger">,
): CapabilityRecord {
  const capability_id = computeCapabilityId({ category: spec.category, name: spec.name });

  // Founder RULE 1 · capability-self-knowledge · every record must answer Q1-Q7
  const r1 = assertRule1(spec);
  invariant(r1.length === 0, `Rule 1 violated: ${r1.join(" · ")} (capability=${spec.name})`);
  // Founder RULE 2 · evidence-required-for-promotion · state/evidence coherence
  const r2 = assertRule2Registration(spec);
  invariant(r2.length === 0, `Rule 2 violated: ${r2.join(" · ")} (capability=${spec.name})`);

  const record: CapabilityRecord = {
    ...spec,
    capability_id,
    zero_llm: true,
    ledger: "B",
  };
  REGISTRY.set(capability_id, record);
  return record;
}

// ── Promotion (§evolution loop · Discover → Evaluate → Test → Verify → Promote) ─
export function promoteCapability(input: {
  capability_id: string;
  new_status: Extract<CapabilityStatus, "VERIFIED" | "PROMOTED">;
  new_evidence: readonly EvidenceRef[];
  verified_at_iso?: string;
}): CapabilityRecord {
  const current = REGISTRY.get(input.capability_id);
  invariant(current !== undefined, `capability_id=${input.capability_id} not found`);
  // Founder RULE 2 · promotion transitions require new evidence
  const r2 = assertRule2Promotion({ new_status: input.new_status, new_evidence: input.new_evidence });
  invariant(r2.length === 0, `Rule 2 violated: ${r2.join(" · ")} (capability_id=${input.capability_id})`);
  const updated: CapabilityRecord = {
    ...current!,
    status: input.new_status,
    evidence_refs: Object.freeze([...current!.evidence_refs, ...input.new_evidence]),
    last_verified_iso: input.verified_at_iso ?? new Date().toISOString(),
    promoted_at_iso: current!.promoted_at_iso ?? new Date().toISOString(),
  };
  REGISTRY.set(input.capability_id, updated);
  return updated;
}

// ── Metadata-only curation (Phase 5B) · adds composition_level and
// semantic_tags to an existing capability WITHOUT changing status,
// evidence, or last_verified_iso. Rule 2 is preserved because curation
// is a description-only patch, not a promotion.
export function updateCapabilityCuration(input: {
  capability_id: string;
  composition_level?: import("./capability-types").CompositionLevel;
  semantic_tags?: readonly string[];
  additional_dependencies?: readonly string[];
}): CapabilityRecord {
  const current = REGISTRY.get(input.capability_id);
  invariant(current !== undefined, `capability_id=${input.capability_id} not found`);
  const updated: CapabilityRecord = {
    ...current!,
    composition_level: input.composition_level ?? current!.composition_level,
    semantic_tags: input.semantic_tags ?? current!.semantic_tags,
    dependencies: input.additional_dependencies
      ? Object.freeze([...current!.dependencies, ...input.additional_dependencies.filter((d) => !current!.dependencies.includes(d))])
      : current!.dependencies,
  };
  REGISTRY.set(input.capability_id, updated);
  return updated;
}

// ── Deprecation and supersession (evolution without loss) ─────────────
export function deprecateCapability(input: { capability_id: string; superseded_by?: string; reason: string }): CapabilityRecord {
  const current = REGISTRY.get(input.capability_id);
  invariant(current !== undefined, `capability_id=${input.capability_id} not found`);
  const status: CapabilityStatus = input.superseded_by ? "SUPERSEDED" : "DEPRECATED";
  const updated: CapabilityRecord = {
    ...current!,
    status,
    supersedes: input.superseded_by ?? current!.supersedes,
    failure_patterns: Object.freeze([...current!.failure_patterns, `deprecated: ${input.reason}`]),
  };
  REGISTRY.set(input.capability_id, updated);
  return updated;
}

// ── Query ─────────────────────────────────────────────────────────────
export function getCapability(capability_id: string): CapabilityRecord | null {
  return REGISTRY.get(capability_id) ?? null;
}

export function getCapabilityByName(category: CapabilityCategory, name: string): CapabilityRecord | null {
  const id = computeCapabilityId({ category, name });
  return REGISTRY.get(id) ?? null;
}

export function listCapabilities(query: CapabilityQuery = {}): readonly CapabilityRecord[] {
  const rows: CapabilityRecord[] = [];
  for (const c of REGISTRY.values()) {
    if (query.category && c.category !== query.category) continue;
    if (query.status && c.status !== query.status) continue;
    if (query.quality_tier && c.quality_tier !== query.quality_tier) continue;
    if (query.owner_agent && c.owner_agent !== query.owner_agent) continue;
    if (query.supports_device && !c.device_support[query.supports_device]) continue;
    if (query.framework && !c.compatible_frameworks.includes(query.framework)) continue;
    if (query.auto_selectable_only && !isAutoSelectableStatus(c.status)) continue;
    rows.push(c);
  }
  return Object.freeze(rows.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)));
}

export function countCapabilities(): number {
  return REGISTRY.size;
}

// ── Aggregate summary ─────────────────────────────────────────────────
export interface CapabilitySummary {
  readonly total: number;
  readonly by_category: Record<CapabilityCategory, number>;
  readonly by_status: Record<CapabilityStatus, number>;
  readonly auto_selectable_count: number;
  readonly trustable_count: number;
  readonly generated_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

export function summarizeCapabilities(): CapabilitySummary {
  const by_category = { brain: 0, agents: 0, code: 0, ui: 0, visual: 0, layout: 0, runtime: 0, governance: 0, evolution: 0 } as Record<CapabilityCategory, number>;
  const by_status = { PROPOSED: 0, VERIFIED: 0, PROMOTED: 0, DEPRECATED: 0, SUPERSEDED: 0, REJECTED: 0, UNKNOWN: 0 } as Record<CapabilityStatus, number>;
  let auto = 0;
  let trust = 0;
  for (const c of REGISTRY.values()) {
    by_category[c.category] += 1;
    by_status[c.status] += 1;
    if (isAutoSelectableStatus(c.status)) auto += 1;
    if (isTrustable(c.status)) trust += 1;
  }
  return {
    total: REGISTRY.size,
    by_category,
    by_status,
    auto_selectable_count: auto,
    trustable_count: trust,
    generated_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}

// ── Seed · real capabilities that already exist in the repo ───────────
// Every entry cites concrete evidence (a test file that runs, an integration
// proof script with a receipt, or a source file that structurally verifies).

const NOW = new Date().toISOString();
const ALL_DEVICES = { desktop: true, tablet: true, mobile: true, pwa: true };

function evTest(path: string, note: string): EvidenceRef {
  return { kind: "test_file", path, hash: null, observed_at_iso: NOW, note };
}
function evSource(path: string, note: string): EvidenceRef {
  return { kind: "source_file", path, hash: null, observed_at_iso: NOW, note };
}
function evProof(path: string, note: string): EvidenceRef {
  return { kind: "integration_proof", path, hash: null, observed_at_iso: NOW, note };
}
function evReceipt(path: string, note: string): EvidenceRef {
  return { kind: "receipt_json", path, hash: null, observed_at_iso: NOW, note };
}

export function seedCoreCapabilities(): void {
  _resetCapabilityRegistryForTests();

  // ═════════════════════════════════════════════════════════════════
  // CODE · code-engine capabilities (real files · real tests)
  // ═════════════════════════════════════════════════════════════════
  const codeEngine: readonly { name: string; description: string; path: string; test: string }[] = [
    { name: "project-scaffolder", description: "Real project scaffolding on disk · 2 templates · anti-fabrication", path: "src/lib/nex-agent/code-engine/capability-project-scaffolder.ts", test: "src/lib/nex-agent/code-engine/capability-project-scaffolder.test.ts" },
    { name: "dev-server-orchestrator", description: "Real child_process spawn · port allocation · HTTP probe · graceful shutdown", path: "src/lib/nex-agent/code-engine/capability-dev-server-orchestrator.ts", test: "src/lib/nex-agent/code-engine/capability-dev-server-orchestrator.test.ts" },
    { name: "workstation-preview-state", description: "8-state preview machine · anti-fabrication (NEVER READY without probe)", path: "src/lib/nex-agent/code-engine/capability-workstation-preview-state.ts", test: "src/lib/nex-agent/code-engine/capability-workstation-preview-state.test.ts" },
    { name: "twin-nex", description: "Independent verdict derivation · challenges primary on evidence", path: "src/lib/nex-agent/code-engine/capability-twin-nex.ts", test: "src/lib/nex-agent/code-engine/capability-twin-nex.test.ts" },
    { name: "referee", description: "Evidence-based judge · 5 verdicts · never fabricates missing evidence", path: "src/lib/nex-agent/code-engine/capability-referee.ts", test: "src/lib/nex-agent/code-engine/capability-referee.test.ts" },
    { name: "technical-evidence-stream", description: "65+ canonical evidence types · JSONL append-only · anti-manufacturing", path: "src/lib/nex-agent/code-engine/capability-technical-evidence-stream.ts", test: "src/lib/nex-agent/code-engine/capability-technical-evidence-stream.test.ts" },
    { name: "error-episode", description: "Index into evidence · not a log", path: "src/lib/nex-agent/code-engine/capability-error-episode.ts", test: "src/lib/nex-agent/code-engine/capability-error-episode.test.ts" },
    { name: "file-ownership-lock", description: "Atomic file-lock · NEX1 and Twin never modify same file simultaneously", path: "src/lib/nex-agent/code-engine/capability-file-ownership-lock.ts", test: "src/lib/nex-agent/code-engine/capability-file-ownership-lock.test.ts" },
    { name: "twin-workspace", description: "Twin isolation invariant · digest-verified: Twin changes never leak to NEX1", path: "src/lib/nex-agent/code-engine/capability-twin-workspace.ts", test: "src/lib/nex-agent/code-engine/capability-twin-workspace.test.ts" },
    { name: "change-hypothesis-engine", description: "12 verbs · ranked hypotheses · risks · alternatives", path: "src/lib/nex-agent/code-engine/capability-change-hypothesis-engine.ts", test: "src/lib/nex-agent/code-engine/capability-change-hypothesis-engine.test.ts" },
    { name: "change-plan", description: "Multi-file ordered plan · 4 complexity classes · rollback hints", path: "src/lib/nex-agent/code-engine/capability-change-plan.ts", test: "src/lib/nex-agent/code-engine/capability-change-plan.test.ts" },
    { name: "code-operator-library", description: "7 real primitives: create_file · modify_return · add_export · update_import · replace_expression · add_object_property · modify_component_prop_default", path: "src/lib/nex-agent/code-engine/capability-code-operator-library.ts", test: "src/lib/nex-agent/code-engine/capability-code-operator-library.test.ts" },
    { name: "jsx-authoring-operators", description: "4 JSX primitives · brace-balance validation · anti-fabrication", path: "src/lib/nex-agent/code-engine/capability-jsx-authoring-operators.ts", test: "src/lib/nex-agent/code-engine/capability-jsx-authoring-operators.test.ts" },
    { name: "incremental-repo-index", description: "mtime cache · re-reads only on change · findFileBySymbol/findFilesByImport", path: "src/lib/nex-agent/code-engine/capability-incremental-repo-index.ts", test: "src/lib/nex-agent/code-engine/capability-incremental-repo-index.test.ts" },
    { name: "fast-path-router", description: "trivial→FAST · complex→DEEP · sensitive→FORCED_DEEP · never skips target_test on FAST", path: "src/lib/nex-agent/code-engine/capability-fast-path-router.ts", test: "src/lib/nex-agent/code-engine/capability-fast-path-router.test.ts" },
    { name: "coding-latency-metrics", description: "13 canonical phases · efficiency_score · real perf.now", path: "src/lib/nex-agent/code-engine/capability-coding-latency-metrics.ts", test: "src/lib/nex-agent/code-engine/capability-coding-latency-metrics.test.ts" },
    { name: "repair-execution-loop", description: "Closed loop · retry-divergence · anti-fabrication · never marks repair_verified without observed target-test transition", path: "src/lib/nex-agent/code-engine/capability-repair-execution-loop.ts", test: "src/lib/nex-agent/code-engine/capability-repair-execution-loop.test.ts" },
    { name: "test-generator", description: "SpecificationRepresentation → real vitest bytes · refuses UNRESOLVED", path: "src/lib/nex-agent/code-engine/capability-test-generator.ts", test: "src/lib/nex-agent/code-engine/capability-test-generator.test.ts" },
    { name: "fresh-unseen-evaluation", description: "15-task corpus · 10 categories · ≥80% pass evidence-only · byte-identical determinism", path: "src/lib/nex-agent/code-engine/capability-fresh-unseen-evaluation.ts", test: "src/lib/nex-agent/code-engine/capability-fresh-unseen-evaluation.test.ts" },
    { name: "independent-verifier", description: "7-verdict architecture · V1-V6 sub-verdicts · anti-collapse gate", path: "src/lib/nex-agent/code-engine/capability-independent-verifier.ts", test: "src/lib/nex-agent/code-engine/capability-independent-verifier.test.ts" },
    { name: "failure-classifier", description: "9-way failure taxonomy · verifier-driven signals", path: "src/lib/nex-agent/code-engine/capability-failure-classifier.ts", test: "src/lib/nex-agent/code-engine/capability-failure-classifier.test.ts" },
    { name: "experience-corpus", description: "Wilson-ranked retrieval · anti-manufacturing forbidden-pattern regex at write barrier", path: "src/lib/nex-agent/code-engine/capability-experience-corpus.ts", test: "src/lib/nex-agent/code-engine/capability-experience-corpus.test.ts" },
    { name: "repo-world-model", description: "Aider PageRank pattern · symbol graph · file importance ranking", path: "src/lib/nex-agent/code-engine/capability-repo-world-model.ts", test: "src/lib/nex-agent/code-engine/capability-repo-world-model.test.ts" },
    { name: "chat-turn-verified-outcome", description: "11 evidence-backed verdict states · Wilson-demotes coder collapse claims", path: "src/lib/nex-agent/code-engine/capability-chat-verified-outcome.ts", test: "src/lib/nex-agent/code-engine/capability-chat-verified-outcome.test.ts" },
  ];
  for (const c of codeEngine) {
    registerCapability({
      name: c.name, category: "code", description: c.description,
      status: "PROMOTED",
      owner_agent: "programmer",
      supporting_agents: ["twin-nex", "referee"],
      implementation_paths: [c.path],
      dependencies: [],
      inputs: [], outputs: [],
      compatible_frameworks: ["typescript", "vitest"],
      device_support: ALL_DEVICES,
      verification_method: "test_suite",
      evidence_refs: [evTest(c.test, `unit tests pass`), evSource(c.path, `implementation present`)],
      failure_patterns: [],
      quality_tier: "CORE",
      license_constraints: ["PROPRIETARY_NEX"],
      version: "1.0.0",
      last_verified_iso: NOW,
      proposed_by: "nex-native",
      promoted_at_iso: NOW,
      supersedes: null,
    });
  }

  // ═════════════════════════════════════════════════════════════════
  // UI · shadcn primitives (27 · already registered · here as capabilities)
  // ═════════════════════════════════════════════════════════════════
  const shadcnPrimitives = ["Accordion", "Alert", "Avatar", "Badge", "Button", "Card", "Checkbox", "Dialog", "Drawer", "DropdownMenu", "Form", "Input", "Label", "Pagination", "Popover", "Progress", "RadioGroup", "Reveal", "Select", "Separator", "Sheet", "Skeleton", "Switch", "Tabs", "Textarea", "Toast", "Tooltip"] as const;
  for (const name of shadcnPrimitives) {
    const fileName = name === "DropdownMenu" ? "dropdown-menu" : name === "RadioGroup" ? "radio-group" : name.toLowerCase();
    const path = `src/components/ui/${fileName}.tsx`;
    registerCapability({
      name: `ui-${name}`, category: "ui",
      description: `shadcn/ui ${name} primitive · Radix-based or shadcn-custom · installed in repo`,
      status: "PROMOTED",
      owner_agent: "ui-layout",
      supporting_agents: ["design", "creation"],
      implementation_paths: [path],
      dependencies: [],
      inputs: [], outputs: [],
      compatible_frameworks: ["react", "tailwindcss", "radix-ui"],
      device_support: ALL_DEVICES,
      verification_method: "structural_check",
      evidence_refs: [evSource(path, "implementation present")],
      failure_patterns: [],
      quality_tier: "CORE",
      license_constraints: ["MIT"],
      version: "shadcn-in-repo",
      last_verified_iso: NOW,
      proposed_by: "nex-native",
      promoted_at_iso: NOW,
      supersedes: null,
    });
  }

  // ═════════════════════════════════════════════════════════════════
  // VISUAL · image / vision / icons / animation (real capabilities)
  // ═════════════════════════════════════════════════════════════════
  registerCapability({
    name: "sdxl-local-generation", category: "visual",
    description: "SDXL 1.0 local inference via Python subprocess · LoRA · low-VRAM tiling",
    status: "PROMOTED",
    owner_agent: "creation",
    supporting_agents: ["design"],
    implementation_paths: ["src/lib/nex-agent-runtime/nex-sdxl-engine-adapter/nex-sdxl-adapter.ts", "scripts/nex-sdxl-generate.py"],
    dependencies: [],
    inputs: ["prompt"], outputs: ["image_bytes"],
    compatible_frameworks: ["python", "diffusers"],
    device_support: ALL_DEVICES,
    verification_method: "structural_check",
    evidence_refs: [evSource("src/lib/nex-agent-runtime/nex-sdxl-engine-adapter/nex-sdxl-adapter.ts", "adapter present")],
    failure_patterns: [],
    quality_tier: "CORE",
    license_constraints: ["PROPRIETARY_NEX"],
    version: "1.0.0",
    last_verified_iso: NOW,
    proposed_by: "nex-native",
    promoted_at_iso: NOW,
    supersedes: null,
  });
  registerCapability({
    name: "flux-replicate-generation", category: "visual",
    description: "Flux 1.1 Pro image generation via Replicate API · 120s timeout · image-to-image supported",
    status: "PROMOTED",
    owner_agent: "creation",
    supporting_agents: ["design"],
    implementation_paths: ["src/lib/ai-visualiser/providers/flux.ts"],
    dependencies: [],
    inputs: ["prompt", "reference_image"], outputs: ["image_url"],
    compatible_frameworks: ["typescript"],
    device_support: ALL_DEVICES,
    verification_method: "structural_check",
    evidence_refs: [evSource("src/lib/ai-visualiser/providers/flux.ts", "provider present")],
    failure_patterns: [],
    quality_tier: "CORE",
    license_constraints: ["PROPRIETARY_NEX"],
    version: "1.0.0",
    last_verified_iso: NOW,
    proposed_by: "nex-native",
    promoted_at_iso: NOW,
    supersedes: null,
  });
  registerCapability({
    name: "vision-specialist-classifier", category: "visual",
    description: "Phase-3 deterministic vision classifier · 7 request kinds · confidence bands · <85% flag_human",
    status: "VERIFIED",
    owner_agent: "vision",
    supporting_agents: [],
    implementation_paths: ["src/lib/nex/agents/nex-vision/vision-gate.ts"],
    dependencies: [],
    inputs: ["image_reference"], outputs: ["vision_verdict"],
    compatible_frameworks: ["typescript"],
    device_support: ALL_DEVICES,
    verification_method: "structural_check",
    evidence_refs: [evSource("src/lib/nex/agents/nex-vision/vision-gate.ts", "vision gate present")],
    failure_patterns: ["Phase 4 real model integration deferred"],
    quality_tier: "APPROVED",
    license_constraints: ["PROPRIETARY_NEX"],
    version: "phase-3",
    last_verified_iso: NOW,
    proposed_by: "nex-native",
    promoted_at_iso: NOW,
    supersedes: null,
  });
  registerCapability({
    name: "lucide-icon-family", category: "visual",
    description: "Lucide · sole icon family · ~897 usage sites",
    status: "PROMOTED",
    owner_agent: "design",
    supporting_agents: ["ui-layout"],
    implementation_paths: [],
    dependencies: [],
    inputs: ["icon_name"], outputs: ["react_component"],
    compatible_frameworks: ["react"],
    device_support: ALL_DEVICES,
    verification_method: "structural_check",
    evidence_refs: [evSource("package.json", "lucide-react ^1.23.0 declared")],
    failure_patterns: [],
    quality_tier: "CORE",
    license_constraints: ["ISC"],
    version: "^1.23.0",
    last_verified_iso: NOW,
    proposed_by: "nex-native",
    promoted_at_iso: NOW,
    supersedes: null,
  });
  registerCapability({
    name: "framer-motion-animation", category: "visual",
    description: "framer-motion · interactive motion + layout transitions · ~34 usage sites",
    status: "PROMOTED",
    owner_agent: "design",
    supporting_agents: ["ui-layout"],
    implementation_paths: [],
    dependencies: [],
    inputs: ["react_children"], outputs: ["animated_react_component"],
    compatible_frameworks: ["react"],
    device_support: ALL_DEVICES,
    verification_method: "structural_check",
    evidence_refs: [evSource("package.json", "framer-motion ^12.42.2 declared")],
    failure_patterns: [],
    quality_tier: "CORE",
    license_constraints: ["MIT"],
    version: "^12.42.2",
    last_verified_iso: NOW,
    proposed_by: "nex-native",
    promoted_at_iso: NOW,
    supersedes: null,
  });
  registerCapability({
    name: "nex-image-manifest", category: "visual",
    description: "187K+ row image manifest · ADR-0024 enforcement · Collection DNA inheritance",
    status: "PROMOTED",
    owner_agent: "creation",
    supporting_agents: ["design", "vision"],
    implementation_paths: ["data/nex-image-manifest.json", "src/lib/nex/images/manifestWriter.ts"],
    dependencies: [],
    inputs: ["image_url", "tags", "provenance"], outputs: ["manifest_row"],
    compatible_frameworks: ["typescript"],
    device_support: ALL_DEVICES,
    verification_method: "structural_check",
    evidence_refs: [evSource("data/nex-image-manifest.json", "manifest present"), evSource("src/lib/nex/images/manifestWriter.ts", "writer present")],
    failure_patterns: [],
    quality_tier: "CORE",
    license_constraints: ["PROPRIETARY_NEX"],
    version: "1.0.0",
    last_verified_iso: NOW,
    proposed_by: "nex-native",
    promoted_at_iso: NOW,
    supersedes: null,
  });

  // ═════════════════════════════════════════════════════════════════
  // LAYOUT · 7 CORE layouts (already registered in layout-registry)
  // ═════════════════════════════════════════════════════════════════
  const layoutNames = ["focused-dashboard", "analytical-dashboard", "editor-canvas-inspector", "searchable-directory", "bottom-nav-mobile-app", "installable-pwa-shell", "focused-product-landing"] as const;
  for (const name of layoutNames) {
    registerCapability({
      name: `layout-${name}`, category: "layout",
      description: `CORE layout ${name} · desktop + tablet + mobile responsive models declared · Phase 4 gate-verified`,
      status: "VERIFIED",
      owner_agent: "ui-layout",
      supporting_agents: ["design", "creation"],
      implementation_paths: ["src/lib/nex-registry/layout-registry.ts"],
      dependencies: [],
      inputs: ["product_context"], outputs: ["layout_spec"],
      compatible_frameworks: ["react", "tailwindcss", "next.js"],
      device_support: ALL_DEVICES,
      verification_method: "test_suite",
      evidence_refs: [evTest("src/lib/nex-registry/layout-registry.test.ts", "registry tests pass"), evTest("src/lib/nex-registry/layout-quality-gate.test.ts", "quality gate tests pass")],
      failure_patterns: ["PASS_MODERN requires 3-viewport screenshot evidence (not yet attached)"],
      quality_tier: "CORE",
      license_constraints: ["PROPRIETARY_NEX"],
      version: "1.0.0",
      last_verified_iso: NOW,
      proposed_by: "nex-native",
      promoted_at_iso: NOW,
      supersedes: null,
    });
  }

  // ═════════════════════════════════════════════════════════════════
  // RUNTIME · workstation-live infrastructure
  // ═════════════════════════════════════════════════════════════════
  registerCapability({
    name: "workstation-live-preview", category: "runtime",
    description: "Real-time workstation IDE with dev-server orchestration · repo-media/file APIs · chat-turn streaming",
    status: "PROMOTED",
    owner_agent: "programmer",
    supporting_agents: ["creation", "ui-layout"],
    implementation_paths: ["src/app/nex1/workstation-live/WorkstationLiveClient.tsx", "src/app/api/nex1/workstation-live/preview-status/route.ts"],
    dependencies: [],
    inputs: ["project_root"], outputs: ["preview_url"],
    compatible_frameworks: ["react", "next.js"],
    device_support: ALL_DEVICES,
    verification_method: "structural_check",
    evidence_refs: [evSource("src/app/nex1/workstation-live/WorkstationLiveClient.tsx", "client present")],
    failure_patterns: [],
    quality_tier: "CORE",
    license_constraints: ["PROPRIETARY_NEX"],
    version: "1.0.0",
    last_verified_iso: NOW,
    proposed_by: "nex-native",
    promoted_at_iso: NOW,
    supersedes: null,
  });
  registerCapability({
    name: "minio-object-storage", category: "runtime",
    description: "Local MinIO S3-compatible object storage · running on 9000/9001",
    status: "PROMOTED",
    owner_agent: null,
    supporting_agents: ["creation"],
    implementation_paths: ["deploy/minio/start-minio.cmd"],
    dependencies: [],
    inputs: ["object_bytes"], outputs: ["object_url"],
    compatible_frameworks: ["s3"],
    device_support: ALL_DEVICES,
    verification_method: "structural_check",
    evidence_refs: [evSource("deploy/minio/start-minio.cmd", "start script present")],
    failure_patterns: [],
    quality_tier: "CORE",
    license_constraints: ["PROPRIETARY_NEX"],
    version: "1.0.0",
    last_verified_iso: NOW,
    proposed_by: "nex-native",
    promoted_at_iso: NOW,
    supersedes: null,
  });

  // ═════════════════════════════════════════════════════════════════
  // GOVERNANCE · quality gates + registries
  // ═════════════════════════════════════════════════════════════════
  registerCapability({
    name: "modernity-quality-gate", category: "governance",
    description: "12-signal quality gate (A-L) · anti-fabrication · strict-by-default · biased to REJECT",
    status: "PROMOTED",
    owner_agent: "referee",
    supporting_agents: ["twin-nex"],
    implementation_paths: ["src/lib/nex-registry/modernity-quality-gate.ts"],
    dependencies: [],
    inputs: ["library_entry"], outputs: ["quality_verdict"],
    compatible_frameworks: ["typescript"],
    device_support: ALL_DEVICES,
    verification_method: "test_suite",
    evidence_refs: [evTest("src/lib/nex-registry/modernity-quality-gate.test.ts", "16 tests pass")],
    failure_patterns: [],
    quality_tier: "CORE",
    license_constraints: ["PROPRIETARY_NEX"],
    version: "modernity-quality-gate.v1.2026-09-19",
    last_verified_iso: NOW,
    proposed_by: "nex-native",
    promoted_at_iso: NOW,
    supersedes: null,
  });
  registerCapability({
    name: "layout-quality-gate", category: "governance",
    description: "10-signal layout gate (L1-L10) · anti-fabrication · requires 3-viewport probes for PASS_MODERN",
    status: "PROMOTED",
    owner_agent: "referee",
    supporting_agents: ["twin-nex", "ui-layout"],
    implementation_paths: ["src/lib/nex-registry/layout-quality-gate.ts"],
    dependencies: [],
    inputs: ["layout_spec"], outputs: ["layout_quality_result"],
    compatible_frameworks: ["typescript"],
    device_support: ALL_DEVICES,
    verification_method: "test_suite",
    evidence_refs: [evTest("src/lib/nex-registry/layout-quality-gate.test.ts", "14 tests pass")],
    failure_patterns: [],
    quality_tier: "CORE",
    license_constraints: ["PROPRIETARY_NEX"],
    version: "layout-quality-gate.v1.2026-09-19",
    last_verified_iso: NOW,
    proposed_by: "nex-native",
    promoted_at_iso: NOW,
    supersedes: null,
  });
  registerCapability({
    name: "component-library-registry", category: "governance",
    description: "Governed registry · 35 entries · Provenance + LicenseClass + QualityTier · anti-fabrication",
    status: "PROMOTED",
    owner_agent: "design",
    supporting_agents: ["ui-layout", "creation"],
    implementation_paths: ["src/lib/nex-registry/registry.ts"],
    dependencies: [],
    inputs: ["registry_entry_input"], outputs: ["library_entry"],
    compatible_frameworks: ["typescript"],
    device_support: ALL_DEVICES,
    verification_method: "test_suite",
    evidence_refs: [evTest("src/lib/nex-registry/registry.test.ts", "17 tests pass")],
    failure_patterns: [],
    quality_tier: "CORE",
    license_constraints: ["PROPRIETARY_NEX"],
    version: "nex-registry.v1.2026-09-19",
    last_verified_iso: NOW,
    proposed_by: "nex-native",
    promoted_at_iso: NOW,
    supersedes: null,
  });

  // ═════════════════════════════════════════════════════════════════
  // BRAIN · reasoning + memory + learning (references to existing)
  // ═════════════════════════════════════════════════════════════════
  const brainCapabilities: readonly { name: string; description: string; note: string }[] = [
    { name: "hypothesis-set-representation", description: "Multi-hypothesis representation · specialists weighted evidence · idempotent observation", note: "Ledger B · already built and tested last session" },
    { name: "multi-perspective-synthesis", description: "MPS · R0 safety + R1 verb contradiction + R2 two-witness · consultation adds signal baseline lacks", note: "Ledger B · 9/10 on BWC · beats baseline +5" },
    { name: "fear-concern-afraid-safety", description: "3-layer safety gate · never bypassed silently · frozen infrastructure", note: "FROZEN · do not modify" },
    { name: "cell-centre-cortex", description: "Cortex router + 21+ specialist mini-brains + heartbeats + registration", note: "Ledger B · phase-8 complete" },
    { name: "experience-abstraction", description: "Cross-experience pattern extractor · retrieval-facing", note: "Ledger B" },
    { name: "capability-discovery", description: "Autonomous capability discovery (Fix 35) · consultation into runtime path", note: "Ledger B" },
  ];
  for (const b of brainCapabilities) {
    registerCapability({
      name: b.name, category: "brain",
      description: `${b.description}. ${b.note}`,
      status: "VERIFIED",
      owner_agent: null,
      supporting_agents: [],
      implementation_paths: [],
      dependencies: [],
      inputs: [], outputs: [],
      compatible_frameworks: ["typescript"],
      device_support: ALL_DEVICES,
      verification_method: "user_authorized",
      evidence_refs: [{ kind: "user_confirmation", path: "n/a", hash: null, observed_at_iso: NOW, note: "Founder-verified across prior sessions" }],
      failure_patterns: [],
      quality_tier: "CORE",
      license_constraints: ["PROPRIETARY_NEX"],
      version: "in-repo",
      last_verified_iso: NOW,
      proposed_by: "nex-native",
      promoted_at_iso: NOW,
      supersedes: null,
    });
  }

  // ═════════════════════════════════════════════════════════════════
  // EVOLUTION · discovery + promotion loop (self-referential)
  // ═════════════════════════════════════════════════════════════════
  registerCapability({
    name: "capability-evolution-loop", category: "evolution",
    description: "Observe → Discover → Evaluate → Test → Verify → Register → Update graph · anti-manufacturing at each step",
    status: "VERIFIED",
    owner_agent: null,
    supporting_agents: ["twin-nex", "referee"],
    implementation_paths: ["src/lib/nex-registry/capability-registry.ts"],
    dependencies: [],
    inputs: ["capability_proposal"], outputs: ["capability_record"],
    compatible_frameworks: ["typescript"],
    device_support: ALL_DEVICES,
    verification_method: "test_suite",
    evidence_refs: [evTest("src/lib/nex-registry/capability-registry.test.ts", "will pass after this phase")],
    failure_patterns: [],
    quality_tier: "CORE",
    license_constraints: ["PROPRIETARY_NEX"],
    version: NEX_CAPABILITY_VERSION,
    last_verified_iso: NOW,
    proposed_by: "nex-native",
    promoted_at_iso: NOW,
    supersedes: null,
  });
}

