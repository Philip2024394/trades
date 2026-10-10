// src/lib/nex/ecosystem/index.ts
//
// UWI · Wave 8.A · Ecosystem judgement machinery public API.
// Founder-authorised programme.

export * from "./types";
export { analyseLicense } from "./license-forensics";
export { auditSupplyChain, type AuditInput } from "./supply-chain-audit";
export {
  readMetadataFile,
  readJsonMetadata,
  enumerateFiles,
  readCodeSample,
  filterCodeFiles,
  DEFAULT_INSPECTION_LIMITS,
  type SandboxedRepositoryView,
  type InspectionLimits,
} from "./sandboxed-inspection";
export {
  auditRepository,
  type AuditRepositoryInput,
} from "./repository-audit-orchestrator";
export {
  makeHuggingFaceAdapter,
  HUGGING_FACE_API_BASE,
  extractDeclaredLicense,
} from "./adapter-hugging-face";
export {
  makeGitHubAdapter,
  GITHUB_API_BASE,
  extractDeclaredGitHubLicense,
} from "./adapter-github";
export {
  extractZipToSandbox,
  cleanupSandbox,
  DEFAULT_EXTRACTION_LIMITS,
  ExtractionSafetyError,
  type ExtractedArchiveResult,
  type ExtractionLimits,
} from "./sandbox-extractor";
export {
  bridgeEcosystemFindingToOpportunity,
  type BridgeOptions,
  type BridgeOutcome,
} from "./wave-5-bridge";
export {
  extractCapabilities,
  type MultiCapabilityExtractionInput,
  type MultiCapabilityExtractionReport,
} from "./multi-capability-extraction";
