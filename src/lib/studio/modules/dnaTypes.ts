// Module DNA — Stage 2 schema.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Rich metadata that lets the platform auto-propose assembly (never
// silently auto-configure — every rule surfaces to the merchant with
// its rationale so they can accept, modify, or dismiss).
//
// The Module DNA is intentionally grouped into semantic clusters:
//   intent        — WHY this module exists
//   runtime       — how it runs (dependencies, events, permissions)
//   presentation  — where it lands in the site
//   behaviour     — cross-cutting UX flags (SEO, mobile, offline, a11y)
//   intelligence  — AI + automation surface
//   assemblyRules — the rule engine that ties it all together
//
// Every field is OPTIONAL for backward compatibility. Modules without
// full DNA keep working exactly as they did; modules WITH full DNA
// participate in auto-assembly proposals.

// ─── Intent ──────────────────────────────────────────────────────

export type BusinessGoal =
  | "capture-leads"
  | "increase-quotes"
  | "reduce-friction"
  | "recurring-revenue"
  | "cross-sell"
  | "trust-building"
  | "compliance"
  | "operational-efficiency"
  | "customer-retention"
  | "brand-authority";

export type ModuleIntent = {
  /** One paragraph explaining what the module DOES for the business. */
  purpose: string;
  /** Business goals this module advances. Drives Growth Coach nudges. */
  businessGoals: BusinessGoal[];
};

// ─── Runtime ─────────────────────────────────────────────────────

export type ModuleEvent = {
  /** Namespaced event id, e.g. "material-calculators.calculated".
   *  Prefixed by module id so multiple modules can emit similarly
   *  named events without collision. */
  id: string;
  /** Human description of the emission trigger. */
  emittedWhen: string;
  /** Optional payload schema hint — same primitive vocabulary as
   *  Domain entity contracts. */
  payload?: Record<
    string,
    "string" | "number" | "boolean" | "date" | "reference"
  >;
};

export type DataLifecycle = {
  /** Domain entity refs this module creates rows for.
   *  Format: "<domainId>.<entityId>". */
  creates: string[];
  /** Domain entity refs this module reads. */
  reads: string[];
  /** Domain entity refs this module updates. */
  updates: string[];
  /** True if the module's state doesn't survive a page reload
   *  (client-side scratchpad). Merchant confirmations required for
   *  ephemeral modules that ask for form input. */
  ephemeral: boolean;
};

export type ModuleRuntime = {
  /** Other Module ids this module needs installed first. Registry
   *  validates against BUSINESS_MODULES on register. */
  dependencies: string[];
  /** Events this module emits. */
  events: ModuleEvent[];
  /** Permissions the module needs. Free-form strings like
   *  "read:credentials", "write:studio_layouts". Documented in
   *  the Knowledge Graph reference doc. */
  permissions: string[];
  /** What the module creates/reads/updates. */
  dataLifecycle: DataLifecycle;
};

// ─── Presentation ────────────────────────────────────────────────

export type ModulePresentation = {
  /** Page ids this module logically belongs on. Powers the "which
   *  page should this be added to?" assembly proposal. */
  pages: string[];
  /** Section registry keys this module can be inserted as. */
  sections: string[];
  /** Nav locations where this module should surface an entry. Free
   *  text — actual nav-composition happens through Assembly Rules. */
  navHooks: string[];
};

// ─── Behaviour ───────────────────────────────────────────────────

export type SeoImpact = "neutral" | "positive" | "negative";
export type MobileBehaviour = "identical" | "adapted" | "hidden";
export type OfflineBehaviour = "works" | "read-only" | "unavailable";

export type ModuleBehaviour = {
  seoImpact: SeoImpact;
  mobileBehaviour: MobileBehaviour;
  offlineBehaviour: OfflineBehaviour;
  /** Accessibility notes for merchants who need them (e.g.
   *  "focus-trap in modal; announces result live"). */
  a11yNotes?: string;
};

// ─── Intelligence ────────────────────────────────────────────────

export type ModuleIntelligence = {
  /** AiTaskKind values this module can drive. Free string for now
   *  so we don't tightly couple to aiTypes.ts here. */
  aiActions: string[];
  /** Automation names this module benefits from. Growth Coach surfaces
   *  these as "consider automating X". */
  recommendedAutomations: string[];
  /** Third-party integrations that pair naturally (Stripe for
   *  payments, Twilio for SMS, etc.). */
  recommendedIntegrations: string[];
};

// ─── Assembly Rules ──────────────────────────────────────────────

export type AssemblyTrigger =
  | { kind: "on-install" }
  | { kind: "on-configure" }
  | { kind: "on-usage-first" }
  | { kind: "on-days-elapsed"; days: number }
  | { kind: "on-conversion-below"; percentage: number; withinDays: number };

/** Actions the runtime knows how to interpret. Any action string
 *  emitted by a rule must be one of these; validator throws on
 *  unknown kinds. */
export type AssemblyActionKind =
  | "add-to-page"
  | "add-nav-item"
  | "add-cta"
  | "wire-to"
  | "suggest-module"
  | "insert-section";

export type AssemblyAction = {
  kind: AssemblyActionKind;
  /** Depending on kind: pageId, slotId, moduleId, or sectionKey. */
  target: string;
  /** 0-100. Higher wins conflicts on the same target slot. */
  priority: number;
};

export type AssemblyRule = {
  /** Stable id within the module; used for install-log audit. */
  id: string;
  trigger: AssemblyTrigger;
  action: AssemblyAction;
  /** One plain sentence — surfaced to the merchant in Growth Coach +
   *  install log. Never black-box. */
  rationale: string;
};

// ─── Full DNA envelope ───────────────────────────────────────────

export type ModuleDna = {
  intent?: ModuleIntent;
  runtime?: ModuleRuntime;
  presentation?: ModulePresentation;
  behaviour?: ModuleBehaviour;
  intelligence?: ModuleIntelligence;
  assemblyRules?: AssemblyRule[];
};
