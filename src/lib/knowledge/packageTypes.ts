// Construction Knowledge Graph — Package types.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// A KnowledgePackage is a trade-specific bundle. It:
//   1. Declares which horizontal Knowledge Domains it uses.
//   2. Extends those Domains with trade-specific knowledge (added
//      entity fields, capability implementations, retrieval hooks,
//      integrations, compliance additions).
//   3. Carries trade-specific content that isn't inherited (services,
//      customer types, workflows, common questions, module + blueprint
//      recommendations).
//
// Runtime NEVER branches on Package id. Consumers (Recommendation
// Engine, AI Brain, Blueprint renderer) walk the Package's
// resolved capability set — Domain contract + extensions — as if it
// were one flat surface.

import type { KnowledgeDomainId } from "./types";

/** Add fields to a Domain-owned Entity. The Domain contract stays
 *  authoritative for the core fields; extensions layer on top. */
export type EntityExtension = {
  /** The Entity id the Domain declares. */
  entityId: string;
  /** Fields to add to the contract, using the same primitive vocab. */
  additionalFields: Record<
    string,
    "string" | "number" | "boolean" | "date" | "text" | "reference" | "enum"
  >;
  /** One-line human note explaining WHY these fields exist for this
   *  trade. Powers the AI Brain + audit trail. */
  reason: string;
};

/** Trade-specific implementation of a Domain-declared capability. */
export type CapabilityImplementation = {
  /** The Domain capability being implemented. */
  capabilityId: string;
  /** Slug for the implementation (e.g. "day-rate-calculator"). Must
   *  be unique within the package. */
  slug: string;
  name: string;
  description: string;
};

/** Trade-specific retrieval hook — added to whatever the Domain
 *  already publishes. */
export type ExtensionRetrievalHook = {
  domainId: KnowledgeDomainId;
  id: string;
  description: string;
  keywords?: string[];
};

/** Trade-specific integration. */
export type ExtensionIntegration = {
  id: string;
  name: string;
  description: string;
};

/** Trade-specific compliance element — layered on top of the Domain
 *  contract. Every one still needs a public source URL. */
export type ExtensionCompliance = {
  id: string;
  name: string;
  regulator: string;
  source: string;
  /** When this maps 1:1 to a scheme in studio_brand_credentials, name
   *  the scheme slug here. Growth Coach reads this to derive trade-
   *  mandatory credential nudges without hardcoded per-trade logic. */
  credentialScheme?: string;
};

/** A single Domain × Package extension bundle. */
export type PackageDomainExtension = {
  domainId: KnowledgeDomainId;
  entityExtensions?: EntityExtension[];
  capabilities?: CapabilityImplementation[];
  aiRetrieval?: ExtensionRetrievalHook[];
  integrations?: ExtensionIntegration[];
  compliance?: ExtensionCompliance[];
  /** One paragraph explaining what this Domain looks like for this
   *  trade in particular. */
  notes?: string;
};

/** A canonical service the trade sells — evidence-grounded, so the
 *  Recommendation Engine + Blueprint renderer can seed the services
 *  grid without inventing. */
export type PackageService = {
  slug: string;
  name: string;
  /** "core" | "common" | "specialism" — as per PRD Appendix D. */
  frequency: "core" | "common" | "specialism";
  /** "fixed-price" | "day-rate" | "quote-required" — pricing model. */
  pricingModel: "fixed-price" | "day-rate" | "quote-required";
  /** Compliance element id from any Domain that gates this service
   *  (e.g. "gas-safe" for a boiler install). */
  requiresCompliance?: string[];
  /** One-line customer-facing description. */
  description: string;
};

/** Canonical customer segment for the trade. Sets the Domain.CRM
 *  Contact.role enum for this Package's scope. */
export type PackageCustomerType = {
  slug: string;
  name: string;
  description: string;
};

/** Canonical journey stage the customer walks through. Powers AI
 *  suggestions ("your journey usually has a survey step — add one"). */
export type PackageWorkflowStep = {
  slug: string;
  name: string;
  description: string;
  /** Which Domain capability powers this step. */
  poweredByCapability?: string;
};

/** Frequently-asked customer question with an evidence-based answer.
 *  Directly seeds the FAQ section on the merchant's site. */
export type PackageFaq = {
  question: string;
  answer: string;
};

/** The full Package manifest. */
export type KnowledgePackage = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  version: string;
  emoji: string;

  /** Trade slugs from src/lib/tradeOff.ts that this package applies
   *  to. Multiple slugs can share one Package (roofer + emergency-
   *  roofing + flat-roofing use one package). */
  trades: string[];

  /** Horizontal Domains this Package uses. Every Domain here must be
   *  in the KnowledgeDomainRegistry. Runtime validates on register. */
  usesDomains: KnowledgeDomainId[];

  /** Trade-specific extensions of the Domain contracts. */
  extensions: PackageDomainExtension[];

  /** Trade knowledge grown from evidence (Appendix D + sourced
   *  regulator content). */
  services: PackageService[];
  customerTypes: PackageCustomerType[];
  workflow: PackageWorkflowStep[];
  commonFaqs: PackageFaq[];

  /** BusinessModule ids the Package expects. Powers the "recommended
   *  for your business" surface in Studio. */
  recommendedModules: string[];
  /** Which existing Blueprint is canonical for this Package's home
   *  page. Blueprint becomes an emergent render of the Package. */
  canonicalBlueprint?: string;

  /** Trade-plain intelligence bullets — surfaced by the AI Brain +
   *  Growth Coach as trade-specific advice. Migrated from the
   *  Blueprint.industryIntelligence field so the same content lives
   *  in the Knowledge Graph and blueprints can defer to it. Facts
   *  only; no fabricated stats. */
  industryIntelligence?: string[];
};

/** Frozen version returned by the registry. */
export type FrozenKnowledgePackage = Readonly<KnowledgePackage>;

/** Resolved view — what a consumer sees when it flattens the Package's
 *  inheritance. The Recommendation Engine + AI Brain walk this. */
export type ResolvedPackage = {
  package: FrozenKnowledgePackage;
  /** Every capability the Package can perform, grouped by Domain. */
  capabilitiesByDomain: Record<
    string,
    Array<{
      source: "domain" | "package";
      capabilityId: string;
      slug: string;
      name: string;
      description: string;
    }>
  >;
  /** Every entity the Package can persist, with Package extensions
   *  merged into the Domain contract. */
  entitiesByDomain: Record<
    string,
    Array<{
      entityId: string;
      contract: Record<string, string>;
      extendedBy: string[]; // package ids that contributed
    }>
  >;
  /** Every retrieval hook the AI Brain can source. */
  retrievalHooks: Array<{
    source: "domain" | "package";
    domainId: string;
    id: string;
    description: string;
    keywords: string[];
  }>;
  /** Every compliance element, deduplicated, cited. */
  complianceElements: Array<{
    source: "domain" | "package";
    domainId: string;
    id: string;
    name: string;
    regulator: string;
    sourceUrl: string;
  }>;
};
