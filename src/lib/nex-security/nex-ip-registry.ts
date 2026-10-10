// NEX IP Registry · 2026-09-19 · Ledger B additive · Local · Deterministic
//
// PURPOSE
//   Frozen, deterministic, evidence-based categorisation of NEX's proprietary
//   intellectual property surface. This module does NOT enforce anything at
//   runtime. It is a READ-ONLY reference used by:
//     · nex-publication-gate.ts   (publication preflight)
//     · scripts/nex-ip-protection/build-manifest.mjs   (manifest generation)
//     · human review + founder authorisation
//
// STRICT NON-BEHAVIOUR
//   · Zero LLM. Zero network. Zero mutation of any other file.
//   · No autonomous enforcement · this module refuses to be a security agent.
//   · No opinion about legal ownership · legal review is required separately.
//   · No secret values stored here · only path patterns and category tags.
//
// AUTHORITY BOUNDARY
//   · This registry describes WHICH categories exist and WHICH path patterns
//     map to which category. It does NOT itself change any file.
//   · Founder release authority is preserved · publication requires an
//     explicit founder decision recorded elsewhere.

// ── IP category taxonomy ────────────────────────────────────────────────

export type IpCategory =
  | "IP_CORE"           // Directly reveals or implements proprietary NEX intelligence
  | "IP_SUPPORT"        // Materially helps someone reproduce NEX (tests, docs, harnesses)
  | "IP_DATA"           // Learned experience corpus, patterns, traces, derived intelligence
  | "SECURITY_SECRET"   // Credentials, private keys, tokens · NEVER COMMIT
  | "PUBLIC_CANDIDATE"  // Potentially publishable but requires founder review
  | "NON_IP"            // Generic, no meaningful replication value
  | "UNKNOWN";          // Requires human review

// ── Replication-risk qualitative bands ──────────────────────────────────

export type ReplicationRisk =
  | "R0"   // No meaningful replication value
  | "R1"   // Low · minor supporting information
  | "R2"   // Moderate · could reveal implementation strategy
  | "R3"   // High · could materially accelerate reconstruction
  | "R4";  // Critical · could expose central learning/intelligence mechanism

// ── Frozen category descriptors ─────────────────────────────────────────
// These describe categories · NOT individual files. Path matching lives
// separately so this registry stays small and auditable.

export interface IpCategoryDescriptor {
  readonly category: IpCategory;
  readonly title: string;
  readonly description: string;
  readonly default_risk: ReplicationRisk;
  readonly protection_directive:
    | "PRIVATE_STAYS_PRIVATE"
    | "PRIVATE_UNTIL_FOUNDER_APPROVES"
    | "NEVER_COMMIT"
    | "REQUIRES_FOUNDER_REVIEW"
    | "NOT_IP";
}

export const IP_CATEGORIES: readonly IpCategoryDescriptor[] = [
  {
    category: "IP_CORE",
    title: "Proprietary NEX Cognitive Intelligence",
    description:
      "Source files that implement or materially reveal NEX1 cognition, learning, abstraction, generalisation, Q7/Q8 policy, chat-turn orchestration, micro-brains, cortex router, NEX2 governance, NEX3 arbitration, Twin NEX, hypothesis engines, reflection, repair loops, capability discovery.",
    default_risk: "R4",
    protection_directive: "PRIVATE_STAYS_PRIVATE",
  },
  {
    category: "IP_SUPPORT",
    title: "Reproduction-Enabling Documentation and Tests",
    description:
      "Architecture ADRs, design specifications, experimental protocols, truth reports, intelligence proof tests, cross-experience abstraction tests, scaling experiments. Does not itself implement the intelligence but materially accelerates reproduction.",
    default_risk: "R3",
    protection_directive: "PRIVATE_UNTIL_FOUNDER_APPROVES",
  },
  {
    category: "IP_DATA",
    title: "Learned Experience Corpus and Derived Patterns",
    description:
      "JSONL and JSON stores of investigation conclusions, episode receipts, evidence streams, hypothesis logs, reflection stores, error episodes, cognitive traces, derived pattern stores, agent memory/discovery events, brain-state persistence.",
    default_risk: "R4",
    protection_directive: "PRIVATE_STAYS_PRIVATE",
  },
  {
    category: "SECURITY_SECRET",
    title: "Credentials, Keys, Tokens, Delegation Envelopes",
    description:
      "Private keys, signing keys, delegation envelopes with signatures, .env credentials, OAuth tokens, provider API keys, founder-key-tmp material, .nex-secrets contents.",
    default_risk: "R4",
    protection_directive: "NEVER_COMMIT",
  },
  {
    category: "PUBLIC_CANDIDATE",
    title: "Potentially Publishable Product Surface",
    description:
      "Product marketing pages, generic UI components, public API surface, pricing documentation, and other product-level material that does not reveal cognitive mechanism. Publication still requires founder approval.",
    default_risk: "R1",
    protection_directive: "REQUIRES_FOUNDER_REVIEW",
  },
  {
    category: "NON_IP",
    title: "Non-IP",
    description:
      "Third-party dependencies, generic tooling configuration, node_modules, build outputs · nothing NEX-proprietary.",
    default_risk: "R0",
    protection_directive: "NOT_IP",
  },
  {
    category: "UNKNOWN",
    title: "Requires Human Review",
    description:
      "Files that do not match any deterministic rule. Default to founder review before any release decision.",
    default_risk: "R2",
    protection_directive: "PRIVATE_UNTIL_FOUNDER_APPROVES",
  },
] as const;

// ── Path pattern rules · deterministic · evidence-based ─────────────────
//
// Each rule associates a path glob or regex with a category.
// Rules are evaluated in order · first match wins.
// A rule carries `evidence` — one sentence justifying the classification.

export interface IpClassificationRule {
  readonly id: string;
  readonly category: IpCategory;
  readonly risk: ReplicationRisk;
  readonly path_matches: (repoRelativePath: string) => boolean;
  readonly evidence: string;
}

// Helper: normalise slashes for cross-platform matching
const norm = (p: string): string => p.replace(/\\/g, "/");

// Helper: prefix match
const startsWith = (prefix: string) => (p: string) => norm(p).startsWith(prefix);

// Helper: regex match
const rx = (re: RegExp) => (p: string) => re.test(norm(p));

export const IP_CLASSIFICATION_RULES: readonly IpClassificationRule[] = [
  // ── SECURITY_SECRET · absolute priority · never commit ─────────────
  {
    id: "sec-01-env-files",
    category: "SECURITY_SECRET",
    risk: "R4",
    path_matches: rx(/(^|\/)\.env(\.|$)/),
    evidence: ".env file family · standard credential holder",
  },
  {
    id: "sec-02-nex-secrets-dir",
    category: "SECURITY_SECRET",
    risk: "R4",
    path_matches: rx(/(^|\/)\.nex-secrets\//),
    evidence: "Substrate attestation private key directory (WO-13)",
  },
  {
    id: "sec-03-founder-key-manifests",
    category: "SECURITY_SECRET",
    risk: "R4",
    path_matches: rx(/(^|\/)\.founder-keys\.local\.json$|config\/founder-keys\.local\.json$/),
    evidence: "Founder key manifest · local · never committed",
  },
  {
    id: "sec-04-founder-key-tmp",
    category: "SECURITY_SECRET",
    risk: "R4",
    path_matches: rx(/(^|\/)data\/founder-key-tmp-/),
    evidence: "Temporary Ed25519 key material (private hex) for delegation testing",
  },
  {
    id: "sec-05-delegations",
    category: "SECURITY_SECRET",
    risk: "R3",
    path_matches: rx(/nex_founder_delegations\.jsonl$/),
    evidence: "Founder delegation envelopes with signatures + nonces",
  },
  {
    id: "sec-06-key-file-extensions",
    category: "SECURITY_SECRET",
    risk: "R4",
    path_matches: rx(/\.(pem|p12|pfx|jks|key)$/i),
    evidence: "Standard key/cert file extension",
  },
  {
    id: "sec-07-signing-authorizations",
    category: "SECURITY_SECRET",
    risk: "R3",
    path_matches: rx(/nex1_founder_authorizations\.jsonl$/),
    evidence: "Signed founder authorisations · Ed25519 envelopes",
  },

  // ── IP_DATA · learned corpus + persistent cognitive traces ────────
  {
    id: "data-01-investigation-conclusions",
    category: "IP_DATA",
    risk: "R4",
    path_matches: startsWith("data/nex1-investigation-conclusions/"),
    evidence: "Real Q8 selection corpus · every persisted NEX experience",
  },
  {
    id: "data-02-nex-brain",
    category: "IP_DATA",
    risk: "R4",
    path_matches: startsWith("data/nex-brain/"),
    evidence: "Learned knowledge graph + confidence scores + audit history",
  },
  {
    id: "data-03-nex1-experiment-receipts",
    category: "IP_DATA",
    risk: "R3",
    path_matches: rx(/^data\/nex1-[^/]+\//),
    evidence: "Experiment/mechanism receipts · derived from cognitive runs",
  },
  {
    id: "data-04-nex-storage-runtime",
    category: "IP_DATA",
    risk: "R3",
    path_matches: rx(/^data\/nex-storage\/nex_.*\.jsonl$|^data\/nex-storage\/nex1_.*\.jsonl$/),
    evidence: "Runtime cognitive state · heartbeats · agent evidence · discovery events",
  },
  {
    id: "data-05-nex-events",
    category: "IP_DATA",
    risk: "R2",
    path_matches: startsWith("data/nex-events/"),
    evidence: "Runtime event stream from cognitive layer",
  },
  {
    id: "data-06-nex-learning-log",
    category: "IP_DATA",
    risk: "R3",
    path_matches: rx(/data\/nex-learning-log\.jsonl$/),
    evidence: "Cross-session learning log · captured cognitive progression",
  },
  {
    id: "data-07-nex-preservation",
    category: "IP_DATA",
    risk: "R2",
    path_matches: startsWith("data/nex1-preservation/"),
    evidence: "Preservation snapshots of frozen cognitive checkpoints",
  },

  // ── IP_CORE · cognitive intelligence source ───────────────────────
  {
    id: "core-01-chat-turn",
    category: "IP_CORE",
    risk: "R4",
    path_matches: rx(/src\/lib\/nex-agent\/code-engine\/capability-chat-turn\.ts$/),
    evidence: "NEX1 chat-turn orchestrator · deterministic zero-LLM entry point",
  },
  {
    id: "core-02-native-investigation",
    category: "IP_CORE",
    risk: "R4",
    path_matches: rx(/src\/lib\/nex-agent\/code-engine\/native-investigation-mode\.ts$/),
    evidence: "Investigation pipeline · 15 actions · deterministic evidence chain",
  },
  {
    id: "core-03-q7-ranker",
    category: "IP_CORE",
    risk: "R4",
    path_matches: rx(/capability-candidate-ranker\.ts$/),
    evidence: "Q7 deterministic ranking policy V1",
  },
  {
    id: "core-04-q8-selector",
    category: "IP_CORE",
    risk: "R4",
    path_matches: rx(/capability-candidate-selector\.ts$/),
    evidence: "Q8 deterministic selection policy V1 · 7-state precedence",
  },
  {
    id: "core-05-experience-writer",
    category: "IP_CORE",
    risk: "R4",
    path_matches: rx(/investigation-conclusion-store\.ts$/),
    evidence: "Experience writer · INFERRED lock · type-locked schema",
  },
  {
    id: "core-06-experience-abstraction",
    category: "IP_CORE",
    risk: "R4",
    path_matches: rx(/capability-experience-abstraction\.ts$/),
    evidence: "Cross-experience pattern extractor · Fix 34 · generalisation engine",
  },
  {
    id: "core-07-experience-retrieval",
    category: "IP_CORE",
    risk: "R4",
    path_matches: rx(/capability-experience-retrieval\.ts$/),
    evidence: "Experience retrieval · read-side of learned corpus",
  },
  {
    id: "core-08-experience-corpus",
    category: "IP_CORE",
    risk: "R4",
    path_matches: rx(/capability-experience-corpus\.ts$/),
    evidence: "Wilson-ranked episode corpus · Phase 9-11",
  },
  {
    id: "core-09-classifier",
    category: "IP_CORE",
    risk: "R4",
    path_matches: rx(/capability-a-founder-intent\//),
    evidence: "Intent classifier · vocabulary + slang patterns · gates INVESTIGATE",
  },
  {
    id: "core-10-brains-cortex",
    category: "IP_CORE",
    risk: "R4",
    path_matches: rx(/capability-(micro-brain|cortex-router|brb\/|processing\/|cell-centre\/)/),
    evidence: "Micro-brain / cortex / brain-in-network / cell-centre orchestration",
  },
  {
    id: "core-11-hypothesis-engines",
    category: "IP_CORE",
    risk: "R4",
    path_matches: rx(/capability-.*hypothesis|hypothesis\//),
    evidence: "Root-cause hypothesis generation + evaluation + storage + verifier",
  },
  {
    id: "core-12-reflection-repair",
    category: "IP_CORE",
    risk: "R4",
    path_matches: rx(/capability-(post-verdict-reflection|reflection-aware-prediction|cross-session-learning|repair-execution-loop|c-type-aware-repair|failure-classifier|independent-verifier|chat-verified-outcome)\.ts$/),
    evidence: "Reflection / repair / verification / cross-session learning",
  },
  {
    id: "core-13-twin-referee",
    category: "IP_CORE",
    risk: "R4",
    path_matches: rx(/capability-(twin-nex|referee|technical-evidence-stream|error-episode|file-ownership-lock|twin-workspace)\.ts$/),
    evidence: "Twin NEX + Referee + evidence stream · independent-inspection architecture",
  },
  {
    id: "core-14-capability-discovery-registry",
    category: "IP_CORE",
    risk: "R4",
    path_matches: rx(/capability-(capability-discovery|agent-registry|outcome-experience|mb-outcome-quality|prior-evidence-comparator|multi-perspective-synthesis|domain-aware-consultation|hypothesis-set)\.ts$/),
    evidence: "Capability discovery + agent registry + multi-perspective synthesis",
  },
  {
    id: "core-15-chain-composition",
    category: "IP_CORE",
    risk: "R3",
    path_matches: rx(/capability-(observed-chains|chain-narrative-emitter|chain-relationship-detector|chain-relationship-composer|candidate-comparator|data-flow-tracer|k-local-value-dataflow)\.ts$/),
    evidence: "Chain / relationship / composition inference (ACTIONs 7-13)",
  },
  {
    id: "core-16-nex-cap-governance",
    category: "IP_CORE",
    risk: "R3",
    path_matches: rx(/src\/lib\/nex-cap\/nex1-(engineer|escalation-registry|native-proposal-bridge|native-runtime-governance-wrapper)\.ts$/),
    evidence: "NEX-Cap governance layer · escalation registry · authorization gate",
  },
  {
    id: "core-17-fast-path-router",
    category: "IP_CORE",
    risk: "R3",
    path_matches: rx(/capability-fast-path-router\.ts$/),
    evidence: "Deterministic FAST/DEEP path routing (Fix 25)",
  },
  {
    id: "core-18-code-engine-adapters",
    category: "IP_CORE",
    risk: "R3",
    path_matches: rx(/src\/lib\/nex-agent\/code-engine\/(adapters|)\//),
    evidence: "Code-engine adapters + reasoners · deterministic programming substrate",
  },

  // ── IP_SUPPORT · docs + tests that reveal the mechanism ───────────
  {
    id: "support-01-nex-decisions",
    category: "IP_SUPPORT",
    risk: "R3",
    path_matches: rx(/^docs\/DECISIONS\/(0016|0017|0018|0019|0020|0021|0027|0028|0029|0030|0033|0034|0035|0036|0100|0100a|0120|0121|0308|0309|0309\.1|0310|0311|0312|0314|0314a)-/),
    evidence: "ADR describing NEX cognitive architecture / brains / knowledge routing",
  },
  {
    id: "support-02-nex-top-docs",
    category: "IP_SUPPORT",
    risk: "R3",
    path_matches: rx(/^docs\/NEX[_-]/),
    evidence: "Top-level NEX architecture / roadmap / execution documents",
  },
  {
    id: "support-03-nex1-discovery-docs",
    category: "IP_SUPPORT",
    risk: "R3",
    path_matches: rx(/^docs\/NEX1-/),
    evidence: "NEX1 discovery / baseline / benchmark / growth reports",
  },
  {
    id: "support-04-research-docs",
    category: "IP_SUPPORT",
    risk: "R3",
    path_matches: rx(/^docs\/research\//),
    evidence: "Research + mechanism-extraction docs from external systems",
  },
  {
    id: "support-05-doctrine",
    category: "IP_SUPPORT",
    risk: "R3",
    path_matches: rx(/^docs\/doctrine\//),
    evidence: "Doctrine documents describing cognitive engine decisions",
  },
  {
    id: "support-06-nex1-proof-tests",
    category: "IP_SUPPORT",
    risk: "R3",
    path_matches: rx(/src\/lib\/nex-cap\/nex1-(experience-writer-proof|generalisation-proof|nex-runs-tests|engineer|native-runtime-governance-wrapper|native-proposal-bridge|escalation-registry)\.test\.ts$/),
    evidence: "Intelligence proof tests · reveal experience/abstraction/generalisation mechanism",
  },
  {
    id: "support-07-code-engine-tests",
    category: "IP_SUPPORT",
    risk: "R3",
    path_matches: rx(/src\/lib\/nex-agent\/code-engine\/.*\.test\.ts$/),
    evidence: "Code-engine unit / integration tests · reveal cognitive substrate behaviour",
  },
  {
    id: "support-08-nex-intelligence-tests",
    category: "IP_SUPPORT",
    risk: "R3",
    path_matches: rx(/src\/lib\/nex-(intelligence|agent-runtime|agent)\/.*\.test\.ts$/),
    evidence: "Native intelligence + agent-runtime tests · governance boundaries + brain wiring",
  },

  // ── NON_IP · standard tooling ─────────────────────────────────────
  {
    id: "nonip-01-node-modules",
    category: "NON_IP",
    risk: "R0",
    path_matches: startsWith("node_modules/"),
    evidence: "Third-party dependencies",
  },
  {
    id: "nonip-02-build-outputs",
    category: "NON_IP",
    risk: "R0",
    path_matches: rx(/^(\.next|dist|build|coverage)\//),
    evidence: "Generated build output",
  },
  {
    id: "nonip-03-package-manifests",
    category: "NON_IP",
    risk: "R0",
    path_matches: rx(/^(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig(\..+)?\.json|next\.config\.(js|ts|mjs))$/),
    evidence: "Standard tooling configuration",
  },
];

// ── Classification result shape ─────────────────────────────────────────

export interface IpClassificationResult {
  readonly path: string;
  readonly category: IpCategory;
  readonly risk: ReplicationRisk;
  readonly rule_id: string;
  readonly evidence: string;
}

/**
 * Deterministic single-file classification.
 * First matching rule wins. No path matches → UNKNOWN with R2 default.
 */
export function classifyPath(repoRelativePath: string): IpClassificationResult {
  const p = norm(repoRelativePath);
  for (const rule of IP_CLASSIFICATION_RULES) {
    if (rule.path_matches(p)) {
      return {
        path: p,
        category: rule.category,
        risk: rule.risk,
        rule_id: rule.id,
        evidence: rule.evidence,
      };
    }
  }
  return {
    path: p,
    category: "UNKNOWN",
    risk: "R2",
    rule_id: "unknown-fallback",
    evidence: "no matching rule · founder review required",
  };
}

export const NEX_IP_REGISTRY_VERSION = "nex-ip-registry.v1.2026-09-19";
