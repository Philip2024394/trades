// Construction Knowledge Graph — barrel loader.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Importing this module registers every Knowledge Domain. Every
// consumer (Package registry, Recommendation Engine, AI Brain,
// Blueprint runtime) imports this file first — or transitively
// depends on something that does.
//
// Slice 1.1 ships 4 reference Domains. Slice 1.1b backfills the
// remaining 19 as their contracts are researched.

// ─── Reference Domains (Slice 1.1 + 2.E + 2.M) ────────────────
import "./domains/estimating";
import "./domains/quoting";
import "./domains/compliance";
import "./domains/crm";
import "./domains/materials";
import "./domains/scheduling";
import "./domains/marketing";
import "./domains/deliveries";
import "./domains/finance";
import "./domains/projects";
import "./domains/staff";

// ─── Reference Packages (Slice 1.2 + 1.7 + 2.D + 2.G) ─────────
import "./packages/plantHire";
import "./packages/buildersMerchant";
import "./packages/roofer";
import "./packages/electrician";
import "./packages/gasEngineer";
import "./packages/painter";
import "./packages/plumber";
import "./packages/bathroomFitter";
import "./packages/kitchenFitter";
import "./packages/landscaper";
import "./packages/extensionBuilder";
import "./packages/groundworker";
import "./packages/tiler";

// ─── Re-exports ──────────────────────────────────────────────
export { knowledgeDomainRegistry } from "./registry";
export { knowledgePackageRegistry } from "./packageRegistry";
export { recommendModules } from "./recommender";
export type {
  ModuleRecommendation,
  PackageCoverage,
  RecommendationInput,
  RecommendationReason,
  RecommendationReasonKind,
  RecommendationResult
} from "./recommender";
export {
  retrieveKnowledge,
  formatRetrievalForPrompt
} from "./retriever";
export {
  blueprintForPackage,
  packageForBlueprint,
  packageForTrade,
  intelligenceForTrade,
  expectedModulesForTrade,
  packagesRequiringScheme,
  mandatorySchemesForTrade,
  knowledgeCoverageForTrade
} from "./adapters";
export type {
  MerchantContext,
  RetrievalLayer,
  RetrievalNode,
  RetrievalNodeType,
  RetrievalQuery,
  RetrievalResult
} from "./retrievalTypes";
export type {
  AiRetrievalHook,
  ComplianceElement,
  DomainCapability,
  DomainEntity,
  FrozenKnowledgeDomain,
  IntegrationPoint,
  KnowledgeDomain,
  KnowledgeDomainId
} from "./types";
export type {
  CapabilityImplementation,
  EntityExtension,
  ExtensionCompliance,
  ExtensionIntegration,
  ExtensionRetrievalHook,
  FrozenKnowledgePackage,
  KnowledgePackage,
  PackageCustomerType,
  PackageDomainExtension,
  PackageFaq,
  PackageService,
  PackageWorkflowStep,
  ResolvedPackage
} from "./packageTypes";
