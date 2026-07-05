// Business Modules — the honest inventory.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// A Module is a business-operating-system component. Each ships in
// one of four states:
//
//   shipped         — real, live, working today
//   available-addon — real, but requires enabling the paid/free add-on
//   partner         — third-party integration recommended (Xero, GMB, etc.)
//   coming-soon     — on the roadmap; merchant can join waitlist
//
// Never surface a module as "shipped" that isn't. Users trust the
// platform when the module inventory tells the truth.
//
// KNOWLEDGE GRAPH LINK (S1.3):
// Modules declare `poweredByDomain` + `implementsCapability` so the
// Recommendation Engine can walk a Knowledge Package's resolved
// capability set and surface every Module that satisfies part of it.
// This is what elevates modules from a manual list to a queryable
// implementation layer over the Knowledge Graph.

import type { KnowledgeDomainId } from "@/lib/knowledge";
import type {
  AssemblyRule,
  ModuleBehaviour,
  ModuleIntelligence,
  ModuleIntent,
  ModulePresentation,
  ModuleRuntime
} from "./dnaTypes";

export type ModuleState =
  | "shipped"
  | "available-addon"
  | "partner"
  | "coming-soon";

export type ModuleCategory =
  | "site"
  | "trust"
  | "growth"
  | "commerce"
  | "operations"
  | "customer"
  | "team"
  | "insight";

export type BusinessModule = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: ModuleCategory;
  state: ModuleState;
  /** Direct Studio route where the merchant configures / uses this
   *  module. Null for coming-soon + partner. */
  route: string | null;
  /** When state = 'available-addon' — the add-on slug in xratedAddons. */
  addonSlug?: string;
  /** When state = 'partner' — the recommended partner name + link. */
  partner?: { name: string; url: string; note: string };
  /** Simple emoji or letter for the card. Real hero art later. */
  glyph: string;
  /** Trade slugs where this module is table-stakes (drives Industry
   *  Brain nudges — Builders Merchants expect Stock, Roofers expect
   *  Waste Carrier, etc.). Empty = universal. */
  expectedByTrades: string[];

  // ─── Knowledge Graph link (S1.3) ─────────────────────────────
  /** Which Knowledge Domains this Module implements pieces of.
   *  Empty array = the Module is site-infrastructure that doesn't
   *  map to a business capability Domain (e.g. Storm Mode is a
   *  presentation feature). We keep the field required so the
   *  intent is explicit for every Module. */
  poweredByDomain: KnowledgeDomainId[];
  /** Which Domain-declared capabilities this Module actually
   *  implements. Format: "<domainId>.<capabilityId>". Empty when
   *  poweredByDomain is empty. Validated on registry.register()
   *  against the live Knowledge Domain Registry. */
  implementsCapability: string[];

  // ─── Module DNA (S2.A) ───────────────────────────────────────
  // All optional so pre-DNA modules keep working. Modules that fully
  // declare DNA participate in auto-assembly proposals + Growth Coach
  // trade-specific nudges + third-party marketplace compatibility.
  //
  // Groups:
  //   intent        — why the module exists + business goals it drives
  //   runtime       — dependencies, events, permissions, data lifecycle
  //   presentation  — where the module lands (pages, sections, nav)
  //   behaviour     — cross-cutting UX flags (SEO/mobile/offline/a11y)
  //   intelligence  — AI + automation surface
  //   assemblyRules — trigger → action rules that propose assembly
  intent?: ModuleIntent;
  runtime?: ModuleRuntime;
  presentation?: ModulePresentation;
  behaviour?: ModuleBehaviour;
  intelligence?: ModuleIntelligence;
  assemblyRules?: AssemblyRule[];
};
