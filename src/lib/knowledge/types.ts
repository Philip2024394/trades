// Construction Knowledge Graph — foundational types.
//
// Design principle (comment on every knowledge file):
//   "Does this increase the amount of reusable knowledge inside the
//    platform? If yes, we're moving in the right direction."
//
// Terminology (locked):
//   • KnowledgeDomain — a horizontal capability every construction
//     business needs some form of (Estimating, Scheduling, CRM, ...).
//     Domain owns: data-model contract, business-module surfaces,
//     AI-retrieval hooks, integration points, compliance surface.
//   • KnowledgePackage — a per-trade bundle that declares which
//     Domains it uses + extends them with trade-specific knowledge.
//   • BusinessModule — an implementable capability that satisfies
//     part of a Domain (declares poweredByDomain).
//   • Blueprint / Page / Section — presentation renderers driven by
//     Package + Modules.
//
// This file defines the DOMAIN layer only. Packages, Modules,
// Blueprints, Recommendation, AI Retrieval each get their own file.

/** Stable id for a Knowledge Domain — used across the platform.
 *  Runtime never branches on this value; it's a lookup key only. */
export type KnowledgeDomainId =
  | "estimating"
  | "quoting"
  | "scheduling"
  | "crm"
  | "compliance"
  | "health-safety"
  | "projects"
  | "materials"
  | "labour"
  | "inventory"
  | "deliveries"
  | "customers"
  | "staff"
  | "assets"
  | "vehicles"
  | "finance"
  | "recruitment"
  | "marketing"
  | "seo"
  | "reviews"
  | "reporting"
  | "analytics"
  | "automation";

/** A DomainEntity is a business object the Domain contract exposes.
 *  Verticals extend Entities with additional fields (e.g. Assets +
 *  attachments for Plant Hire). Runtime holds no per-vertical branch;
 *  extensions are additive metadata. */
export type DomainEntity = {
  /** e.g. "customer", "quote-line", "machine". Keep singular. */
  id: string;
  name: string;
  description: string;
  /** JSON-schema-lite hint for tooling. Not enforced at runtime — the
   *  actual persistence lives in whichever Business Module implements
   *  the Entity. Kept optional so a Domain can declare a contract
   *  without dictating storage. */
  contract?: Record<string, "string" | "number" | "boolean" | "date" | "text" | "reference" | "enum">;
};

/** A Capability is a discrete unit of work a Domain enables — the
 *  atomic thing a Business Module might implement. */
export type DomainCapability = {
  id: string;
  name: string;
  description: string;
};

/** Where AI retrieval can source Domain knowledge. Retrieval order is
 *  fixed platform-wide: Merchant data → Package → Domain → Global. */
export type AiRetrievalHook = {
  /** Stable hook id used by the AI Brain. */
  id: string;
  /** One-line description of what a retriever would look up here. */
  description: string;
  /** Optional keywords to boost lexical match ahead of embedding. */
  keywords?: string[];
};

/** Integration surface: named third-party classes the Domain talks to.
 *  Kept as free-text categories — implementation adapters land under
 *  src/lib/knowledge/integrations/ (Stage 6+). */
export type IntegrationPoint = {
  id: string;
  name: string;
  category:
    | "payment"
    | "accounting"
    | "identity"
    | "compliance-register"
    | "logistics"
    | "communications"
    | "storage"
    | "analytics"
    | "crm"
    | "hr"
    | "field-service"
    | "other";
  description: string;
};

/** Compliance element the Domain must surface — regulator, scheme, or
 *  legal duty. Cited so we never invent regulation. */
export type ComplianceElement = {
  id: string;
  name: string;
  regulator: string;
  /** UK by default; label the country if elsewhere. */
  jurisdiction?: string;
  /** Public URL for verification. */
  source: string;
  /** When this compliance element maps 1:1 to a scheme in the
   *  studio_brand_credentials table, name the scheme slug here.
   *  Growth Coach + verified-badges Module consume this to derive
   *  trade-mandatory nudges automatically. Not every regulation maps
   *  to a scheme (e.g. CDM 2015 is a duty, not a credential) — leave
   *  undefined when there's no 1:1 map. */
  credentialScheme?: string;
};

/** A KnowledgeDomain is the canonical contract for one horizontal
 *  capability. Every field is content — no code logic branches on
 *  Domain values. This file is the single source of truth for what
 *  every trade inherits. */
export type KnowledgeDomain = {
  id: KnowledgeDomainId;
  name: string;
  tagline: string;
  description: string;
  /** Entities this Domain owns the contract for. Verticals extend. */
  entities: DomainEntity[];
  /** Capabilities Business Modules can satisfy. */
  capabilities: DomainCapability[];
  /** Retrieval hooks for the AI Brain. */
  aiRetrieval: AiRetrievalHook[];
  /** Third-party surfaces (Stripe, Xero, GMB, Companies House, ...). */
  integrations: IntegrationPoint[];
  /** Statutory + scheme surface. Sourced only. */
  compliance: ComplianceElement[];
  /** Related Domains — the Recommendation Engine walks this graph to
   *  suggest cross-Domain Modules ("adding Scheduling? consider CRM"). */
  relatedDomains: KnowledgeDomainId[];
  /** Semver of the Domain contract. Breaking changes bump major and
   *  land as new files so tenants stay on their version. */
  version: string;
};

/** Frozen version returned by the registry. */
export type FrozenKnowledgeDomain = Readonly<KnowledgeDomain>;
