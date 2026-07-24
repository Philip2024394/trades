// Nex Construction Experience Intelligence — public barrel.

export type {
  BenchmarkStat,
  ContributionConsent,
  EvidenceSourceKind,
  Evidence,
  ExperienceRecommendation,
  ProjectBenchmark,
  ProjectFingerprint,
  PropertyTypeCategory,
  SimilarProject,
  SourcedClaim
} from "./types";
export { DISCLAIMERS, K_MIN, evidenceFor } from "./types";

export { anonymiseProject, classifyProjectType, classifyPropertyType, extractRegion } from "./anonymise";
export { isContributing, resolveConsent } from "./consent";
export type { ResolveConsentInput } from "./consent";

export { buildBenchmark } from "./aggregate";
export type { BuildBenchmarkInput } from "./aggregate";

export { findSimilarProjects } from "./similar";
export type { FindSimilarInput } from "./similar";

export { loadFingerprints } from "./loader";
export type { LoadFingerprintsInput } from "./loader";

export { answerXP, classifyXPQuestion } from "./answer";
export type { AnswerXPInput, XPQuestion } from "./answer";
