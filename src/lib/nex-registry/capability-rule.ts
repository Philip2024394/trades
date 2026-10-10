// src/lib/nex-registry/capability-rule.ts
//
// NEX CAPABILITY RULES · Formal declaration + runtime enforcement
// Ledger B additive · Zero LLM · Frozen once accepted
//
// ═══════════════════════════════════════════════════════════════════
// FOUNDER RULE 1 · CAPABILITY SELF-KNOWLEDGE
// ═══════════════════════════════════════════════════════════════════
//
// "NEX must know what NEX can do, what NEX cannot do, which agents
// can do it, which tools/components/assets enable it, what evidence
// proves it, what dependencies constrain it, and how recently that
// capability was verified."
//
// This rule requires that every CapabilityRecord answers seven
// questions:
//
//   Q1  What is this capability?              → name + description
//   Q2  What state is it in?                  → status (7 explicit states)
//   Q3  Who owns / supports it?               → owner_agent + supporting_agents
//   Q4  What implements it?                   → implementation_paths
//   Q5  What proves it works?                 → evidence_refs
//   Q6  What does it depend on?               → dependencies
//   Q7  When was it last verified?            → last_verified_iso
//
// Rule 1 is enforced at write-time: any capability that does not
// answer Q1-Q7 fully is rejected by registerCapability().
//
// ═══════════════════════════════════════════════════════════════════
// FOUNDER RULE 2 · EVIDENCE REQUIRED FOR PROMOTION
// ═══════════════════════════════════════════════════════════════════
//
// "NEX may discover and propose capability evolution, but only
// verified evidence can promote a capability from proposed knowledge
// into trusted capability knowledge."
//
// This rule creates a strict lifecycle:
//
//     PROPOSED  ─────────────► needs evidence to advance
//         │
//         │  registerCapability() with new evidence_refs
//         ▼
//     VERIFIED  ─────────────► evidence exists · agents may reference
//         │
//         │  additional evidence + last_verified_iso recent
//         ▼
//     PROMOTED  ─────────────► auto-selectable · fully trusted
//
// Rule 2 is enforced at write-time AND at read-time:
//   · promoteCapability() throws without new EvidenceRef
//   · isAutoSelectableStatus() returns true only for PROMOTED
//   · verifyClaim() returns INSUFFICIENT_EVIDENCE for PROPOSED
//
// ═══════════════════════════════════════════════════════════════════
// RULE FROZEN LEVEL · both rules match the founder's frozen-infrastructure
// standard. They must not be silently relaxed. They may be extended
// only by adding STRICTER checks · never by removing checks.

import type {
  CapabilityRecord,
  CapabilityStatus,
  EvidenceRef,
} from "./capability-types";
import { listCapabilities } from "./capability-registry";

export const NEX_CAPABILITY_RULE_VERSION = "nex-capability-rule.v1.2026-09-19";

// ── The formal rule declarations (immutable constants) ────────────────
export const RULE_1_CAPABILITY_SELF_KNOWLEDGE = Object.freeze({
  id: "RULE-1",
  name: "capability-self-knowledge",
  statement: "NEX must know what NEX can do, what NEX cannot do, which agents can do it, which tools/components/assets enable it, what evidence proves it, what dependencies constrain it, and how recently that capability was verified.",
  required_answers: Object.freeze([
    { q: "Q1", subject: "identity",       fields: ["name", "description"] },
    { q: "Q2", subject: "state",          fields: ["status"] },
    { q: "Q3", subject: "ownership",      fields: ["owner_agent", "supporting_agents"] },
    { q: "Q4", subject: "implementation", fields: ["implementation_paths"] },
    { q: "Q5", subject: "evidence",       fields: ["evidence_refs"] },
    { q: "Q6", subject: "dependencies",   fields: ["dependencies"] },
    { q: "Q7", subject: "verification",   fields: ["last_verified_iso"] },
  ] as const),
  frozen: true,
  ledger: "B",
} as const);

export const RULE_2_EVIDENCE_REQUIRED_FOR_PROMOTION = Object.freeze({
  id: "RULE-2",
  name: "evidence-required-for-promotion",
  statement: "NEX may discover and propose capability evolution, but only verified evidence can promote a capability from proposed knowledge into trusted capability knowledge.",
  transitions: Object.freeze([
    { from: "PROPOSED",  to: "VERIFIED", requires: "≥1 EvidenceRef added and confirmed" },
    { from: "VERIFIED",  to: "PROMOTED", requires: "additional evidence + recent last_verified_iso" },
    { from: "PROMOTED",  to: "PROMOTED", requires: "revalidation adds evidence · last_verified_iso updates" },
    { from: "VERIFIED",  to: "REJECTED", requires: "failure_pattern recorded" },
    { from: "PROMOTED",  to: "DEPRECATED", requires: "superseded_by or reason recorded" },
    { from: "PROMOTED",  to: "SUPERSEDED", requires: "superseded_by capability_id recorded" },
  ] as const),
  frozen: true,
  ledger: "B",
} as const);

// ═══════════════════════════════════════════════════════════════════
// FOUNDER RULE 3 · CUSTOMER LANGUAGE PRIMACY
// ═══════════════════════════════════════════════════════════════════
//
// "Never require the customer to know the language of design in order
// to control the design. NEX should expose choices, not expose
// complexity."
//
// The customer must never be forced to type or understand:
//   · hero · container · section · CTA · breadcrumb · drawer
//   · responsive breakpoint · aspect ratio · padding · vertical rhythm
//   · z-index · flex · grid · typography scale · design token
//
// NEX may USE these terms internally, but MUST translate them into
// customer-facing language before presenting anything to the user.
// Customer-facing vocabulary is: "this area", "this heading",
// "this button", "this picture", "this section", "the top",
// "the bottom", "the menu", etc.
//
// NEX MAY teach the terminology · but only AFTER helping · and only
// as a "you don't need to remember this" aside.
//
// Rule 3 is enforced at:
//   · every choice-presentation surface (see ChoiceSet)
//   · every completeness explanation
//   · every design-map annotation
export const RULE_3_CUSTOMER_LANGUAGE_PRIMACY = Object.freeze({
  id: "RULE-3",
  name: "customer-language-primacy",
  statement: "Never require the customer to know the language of design in order to control the design. NEX should expose choices, not expose complexity.",
  forbidden_customer_facing_terms: Object.freeze([
    "hero", "container", "section", "CTA", "call-to-action",
    "breadcrumb", "drawer", "sheet", "popover", "combobox",
    "responsive breakpoint", "aspect ratio", "vertical rhythm",
    "z-index", "flex", "grid", "typography scale", "design token",
    "component", "primitive", "wireframe",
    "padding", "margin", "leading", "kerning",
    "atom", "composite", "pattern",
  ] as const),
  allowed_customer_facing_terms: Object.freeze([
    "this area", "this section", "this part of the page",
    "this heading", "this text", "this button", "this picture",
    "this image", "this form", "this menu", "this list",
    "the top", "the bottom", "the middle", "the sides",
    "make it bigger", "make it smaller", "cleaner", "more compact",
    "more premium", "more visual", "simpler", "less crowded",
  ] as const),
  when_customer_uses_technical_term:
    "If the customer volunteers a technical term (e.g. 'change the hero'), NEX may respond in kind. Do not correct or reject their vocabulary.",
  frozen: true,
  ledger: "B",
} as const);

// ═══════════════════════════════════════════════════════════════════
// FOUNDER RULE 4 · NO HALF-BUILT PAGES
// ═══════════════════════════════════════════════════════════════════
//
// "Every design must be complete, not half-built."
//
// A page cannot be presented as finished if:
//   · a requested region is missing
//   · a placeholder ("coming later", "TBD", "lorem ipsum") is present
//   · a required interaction is unimplemented
//   · a required responsive transformation is missing (desktop / tablet / mobile)
//   · a loading / empty / error state is unimplemented
//   · a requested integration (map · form · chart) is mocked but not real
//
// If the user asked for something, NEX must EITHER:
//   1. Build it, OR
//   2. Clearly mark it as UNAVAILABLE with reason, OR
//   3. Ask the user to decide.
//
// It may NEVER silently ship a stub and claim completion.
//
// Rule 4 is enforced at:
//   · PageCompletenessGate (see nex-guided-design.ts)
//   · Layout Quality Gate L10 (visual evidence)
//   · Modernity Quality Gate signal E (composition · anti-generic)
export const RULE_4_NO_HALF_BUILT_PAGES = Object.freeze({
  id: "RULE-4",
  name: "no-half-built-pages",
  statement: "Every design must be complete, not half-built. If the user asked for it, NEX either builds it, clearly marks it as unavailable, or asks for a decision.",
  forbidden_completion_signals: Object.freeze([
    "coming later",
    "coming soon",
    "will be added",
    "TBD",
    "TODO",
    "placeholder",
    "stub",
    "lorem ipsum",
    "mock only",
    "not implemented",
  ] as const),
  required_page_checklist: Object.freeze([
    { region: "header",           mandatory_if_requested: true },
    { region: "navigation",       mandatory_if_requested: true },
    { region: "hero",             mandatory_if_requested: true },
    { region: "primary_content",  mandatory_always: true },
    { region: "responsive_desktop", mandatory_always: true },
    { region: "responsive_tablet",  mandatory_always: true },
    { region: "responsive_mobile",  mandatory_always: true },
    { region: "loading_state",    mandatory_if_interactive: true },
    { region: "empty_state",      mandatory_if_list_or_search: true },
    { region: "error_state",      mandatory_if_interactive: true },
    { region: "footer",           mandatory_if_requested: true },
  ] as const),
  allowed_deferrals: Object.freeze([
    "customer explicitly deferred this region",
    "region declared UNAVAILABLE with reason and evidence",
    "region blocked on capability that is registered as MISSING",
  ] as const),
  frozen: true,
  ledger: "B",
} as const);

// ═══════════════════════════════════════════════════════════════════
// FOUNDER RULE 5 · EVERY CHOICE MUST LEAD TO REAL IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════
//
// "Every choice must lead to a real implementation and a real
// verification result. Otherwise we end up with a beautiful design
// assistant that says 'Absolutely, I've updated your hero.' when the
// actual application hasn't changed."
//
// This closes the loop between three earlier rules:
//   Rule 2: promotion requires evidence
//   Rule 3: customer language on the surface
//   Rule 4: no half-built pages
//
// Rule 5 targets the CHOICE surface specifically. When NEX offers
// alternatives ("A · Clean · B · Bold · C · Premium"), and the customer
// picks one, the following MUST occur:
//
//   1. A real file change (or a documented refusal)
//   2. A real re-run of the affected surface (build/render)
//   3. A real verification signal (structural or visual)
//   4. An evidence receipt that ties the choice to the observed result
//
// It is a violation of Rule 5 for NEX to:
//   · Return "done" without a real code change
//   · Change one file but present it as if the whole page updated
//   · Verify only that code compiles when the surface is visual
//   · Present a choice whose "implementation" is a comment or a stub
//   · Verify with a fake screenshot or a manufactured probe hash
export const RULE_5_CHOICE_TO_REAL_IMPLEMENTATION = Object.freeze({
  id: "RULE-5",
  name: "choice-to-real-implementation",
  statement: "Every choice must lead to a real implementation and a real verification result.",
  required_after_customer_choice: Object.freeze([
    { step: 1, requires: "real file mutation OR documented refusal (Rule 4 permits explicit deferral only with a stated reason)" },
    { step: 2, requires: "real re-run of the affected surface (build for code · render for visual)" },
    { step: 3, requires: "real verification signal (structural check for logic · visual probe for design)" },
    { step: 4, requires: "evidence receipt linking choice_id → file_diff → run_id → probe_hash" },
  ] as const),
  forbidden_completion_claims: Object.freeze([
    "already updated",
    "already changed",
    "done" ,
    "applied",
    "you should now see",
    "the new design is live",
  ] as const),  // These phrases must not appear in a completion claim without matching evidence
  frozen: true,
  ledger: "B",
} as const);

// ── Rule violation types ──────────────────────────────────────────────
export type RuleId = "RULE-1" | "RULE-2";

export interface RuleViolation {
  readonly rule: RuleId;
  readonly capability_id: string;
  readonly capability_name: string;
  readonly missing: string;   // which check failed
  readonly detail: string;    // human-readable diagnostic
}

// ── Rule assertion helpers · used by write paths ──────────────────────
export function assertRule1(spec: Pick<CapabilityRecord, "name" | "description" | "status" | "owner_agent" | "supporting_agents" | "implementation_paths" | "evidence_refs" | "dependencies" | "last_verified_iso">): readonly string[] {
  const violations: string[] = [];
  if (!spec.name || spec.name.length === 0)               violations.push("Q1: missing name");
  if (!spec.description || spec.description.length === 0) violations.push("Q1: missing description");
  if (!spec.status)                                        violations.push("Q2: missing status");
  // Q3 · ownership: owner_agent MAY be null (for infrastructure) but
  // the record must at least declare supporting_agents array (possibly empty · empty is a truthful answer)
  if (!Array.isArray(spec.supporting_agents))              violations.push("Q3: supporting_agents must be an array (empty is allowed as an honest answer)");
  // Q4 · implementation_paths MAY be empty for pure agent-role records but must be an array
  if (!Array.isArray(spec.implementation_paths))           violations.push("Q4: implementation_paths must be an array");
  // Q5 · evidence_refs must be an array. Emptiness allowed ONLY for PROPOSED/UNKNOWN/REJECTED status (see Rule 2 checks).
  if (!Array.isArray(spec.evidence_refs))                  violations.push("Q5: evidence_refs must be an array");
  if (!Array.isArray(spec.dependencies))                   violations.push("Q6: dependencies must be an array");
  // Q7 · last_verified_iso may be null · but records with VERIFIED/PROMOTED status must set it (checked by Rule 2)
  return violations;
}

export function assertRule2Registration(spec: Pick<CapabilityRecord, "status" | "evidence_refs" | "last_verified_iso" | "proposed_by">): readonly string[] {
  const violations: string[] = [];
  if (spec.status === "PROMOTED" || spec.status === "VERIFIED") {
    if (spec.evidence_refs.length === 0) violations.push(`${spec.status} status requires ≥1 evidence_ref (Rule 2)`);
    if (!spec.last_verified_iso)         violations.push(`${spec.status} status requires last_verified_iso (Rule 2)`);
  }
  if (spec.status === "PROPOSED") {
    if (!spec.proposed_by || spec.proposed_by.length === 0) violations.push("PROPOSED capability must declare proposed_by (Rule 2 · discovery is honest about origin)");
  }
  return violations;
}

export function assertRule2Promotion(input: { new_status: CapabilityStatus; new_evidence: readonly EvidenceRef[] }): readonly string[] {
  const violations: string[] = [];
  if (input.new_status === "VERIFIED" || input.new_status === "PROMOTED") {
    if (input.new_evidence.length === 0) violations.push(`promotion to ${input.new_status} requires ≥1 new evidence_ref (Rule 2)`);
  }
  return violations;
}

// ── Registry-wide audit · scans every capability for rule compliance ──
export interface RuleAuditResult {
  readonly total_capabilities: number;
  readonly rule1_violations: readonly RuleViolation[];
  readonly rule2_violations: readonly RuleViolation[];
  readonly all_compliant: boolean;
  readonly audited_at_iso: string;
  readonly rule_version: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

export function auditRuleCompliance(): RuleAuditResult {
  const rule1_violations: RuleViolation[] = [];
  const rule2_violations: RuleViolation[] = [];
  for (const cap of listCapabilities()) {
    // Rule 1 · every capability must answer all seven questions
    const r1 = assertRule1(cap);
    for (const m of r1) {
      rule1_violations.push({ rule: "RULE-1", capability_id: cap.capability_id, capability_name: cap.name, missing: m, detail: `Rule 1 (capability-self-knowledge): ${m}` });
    }
    // Rule 2 · status + evidence coherence
    if ((cap.status === "PROMOTED" || cap.status === "VERIFIED") && cap.evidence_refs.length === 0) {
      rule2_violations.push({ rule: "RULE-2", capability_id: cap.capability_id, capability_name: cap.name, missing: "evidence_refs", detail: `Rule 2: ${cap.status} without evidence` });
    }
    if ((cap.status === "PROMOTED" || cap.status === "VERIFIED") && !cap.last_verified_iso) {
      rule2_violations.push({ rule: "RULE-2", capability_id: cap.capability_id, capability_name: cap.name, missing: "last_verified_iso", detail: `Rule 2: ${cap.status} without last_verified_iso` });
    }
    if (cap.status === "PROPOSED" && !cap.proposed_by) {
      rule2_violations.push({ rule: "RULE-2", capability_id: cap.capability_id, capability_name: cap.name, missing: "proposed_by", detail: "Rule 2: PROPOSED without proposed_by" });
    }
  }
  const list = listCapabilities();
  return {
    total_capabilities: list.length,
    rule1_violations: Object.freeze(rule1_violations),
    rule2_violations: Object.freeze(rule2_violations),
    all_compliant: rule1_violations.length === 0 && rule2_violations.length === 0,
    audited_at_iso: new Date().toISOString(),
    rule_version: NEX_CAPABILITY_RULE_VERSION,
    zero_llm: true,
    ledger: "B",
  };
}

// ── Public rule reference · for chat-turn / agents / documentation ─────
export function describeRules(): {
  rule_1: typeof RULE_1_CAPABILITY_SELF_KNOWLEDGE;
  rule_2: typeof RULE_2_EVIDENCE_REQUIRED_FOR_PROMOTION;
  rule_3: typeof RULE_3_CUSTOMER_LANGUAGE_PRIMACY;
  rule_4: typeof RULE_4_NO_HALF_BUILT_PAGES;
  rule_5: typeof RULE_5_CHOICE_TO_REAL_IMPLEMENTATION;
  rule_6: typeof RULE_6_CUSTOMER_SOVEREIGNTY;
  version: string;
} {
  return {
    rule_1: RULE_1_CAPABILITY_SELF_KNOWLEDGE,
    rule_2: RULE_2_EVIDENCE_REQUIRED_FOR_PROMOTION,
    rule_3: RULE_3_CUSTOMER_LANGUAGE_PRIMACY,
    rule_4: RULE_4_NO_HALF_BUILT_PAGES,
    rule_5: RULE_5_CHOICE_TO_REAL_IMPLEMENTATION,
    rule_6: RULE_6_CUSTOMER_SOVEREIGNTY,
    version: NEX_CAPABILITY_RULE_VERSION,
  };
}

// ── Rule-5 helper · asserts a choice-outcome payload has real evidence
export interface ChoiceOutcomeEvidence {
  readonly choice_id: string;
  readonly file_diff_paths: readonly string[];    // real files modified
  readonly run_id: string | null;                 // build/render invocation id
  readonly verification_hash: string | null;      // structural or probe hash
  readonly completion_claim: string;              // NEX's own claim text
}

// ═══════════════════════════════════════════════════════════════════
// FOUNDER RULE 6 · CUSTOMER SOVEREIGNTY (NEX GUIDE)
// ═══════════════════════════════════════════════════════════════════
//
// "NEX has hands on the interface — but the customer remains in control.
// The Orb points, explains, offers, and guides. The customer decides."
//
// NEX Guide (a.k.a. the Orb) is a spatial guidance layer: NEX resolves
// customer intent to a real interface target and physically points at
// it via a laser/highlight/overlay. But NEX MUST NOT act on the
// customer's behalf without explicit invocation.
//
// This rule protects the trust boundary between assistance and autonomy.
//
// FORBIDDEN NEX Guide actions:
//   · silent click on customer's behalf
//   · silent form submission
//   · silent navigation (routing away from the current view)
//   · silent state mutation (opening a panel, toggling a setting)
//   · background action while the Orb appears idle
//   · triggering an action for which the customer has not typed or clicked
//     an explicit "do this for me" style confirmation
//
// ALLOWED NEX Guide actions:
//   · highlight a real target element (glow / pulse)
//   · render laser from Orb to target
//   · verbal explanation of what the target does
//   · open a preview / show state (no side effects)
//   · offer to perform the action, gated behind explicit acceptance
//
// Rule 6 targets the interaction layer between NEX and the interface.
// Every action classified as "invoking" MUST record customer_authorization.
export const RULE_6_CUSTOMER_SOVEREIGNTY = Object.freeze({
  id: "RULE-6",
  name: "customer-sovereignty",
  statement: "NEX has hands on the interface — but the customer remains in control. The Orb points, explains, offers, and guides. The customer decides.",
  forbidden_actions: Object.freeze([
    "silent_click",
    "silent_form_submission",
    "silent_navigation",
    "silent_state_mutation",
    "background_action_during_idle",
    "invocation_without_explicit_authorization",
  ] as const),
  allowed_actions: Object.freeze([
    "highlight_target",
    "render_laser_to_target",
    "explain_target_purpose",
    "open_preview_readonly",
    "offer_action_pending_authorization",
  ] as const),
  frozen: true,
  ledger: "B",
} as const);

// ── Rule-6 helper · asserts a NEX Guide action carries authorization ───
export interface GuideActionEvidence {
  readonly action_id: string;                       // e.g. "highlight" · "click_on_behalf"
  readonly customer_authorization: null | { kind: "explicit_click" | "explicit_typed_intent" | "explicit_orb_confirm"; observed_at_iso: string };
  readonly side_effect_kind: "none" | "highlight_only" | "preview_readonly" | "invocation";
}

export function assertRule6GuideAction(action: GuideActionEvidence): readonly string[] {
  const violations: string[] = [];
  if (action.side_effect_kind === "invocation" && action.customer_authorization === null) {
    violations.push(`Rule 6: action "${action.action_id}" would invoke a side effect but no customer_authorization is recorded`);
  }
  // Forbidden-action name check
  for (const bad of RULE_6_CUSTOMER_SOVEREIGNTY.forbidden_actions) {
    if (action.action_id === bad) {
      violations.push(`Rule 6: action "${action.action_id}" is explicitly forbidden by the sovereignty rule`);
    }
  }
  return violations;
}

export function assertRule5ChoiceOutcome(payload: ChoiceOutcomeEvidence): readonly string[] {
  const violations: string[] = [];
  if (payload.file_diff_paths.length === 0) {
    violations.push("Rule 5: choice outcome must include ≥1 file_diff_path (no code changed = no real implementation)");
  }
  if (payload.run_id === null || payload.run_id.length === 0) {
    violations.push("Rule 5: choice outcome must include a run_id (no re-run = no real verification)");
  }
  if (payload.verification_hash === null || payload.verification_hash.length === 0) {
    violations.push("Rule 5: choice outcome must include a verification_hash (structural check hash or visual probe hash)");
  }
  const claim = payload.completion_claim.toLowerCase();
  for (const bad of RULE_5_CHOICE_TO_REAL_IMPLEMENTATION.forbidden_completion_claims) {
    if (claim.includes(bad.toLowerCase()) && (payload.file_diff_paths.length === 0 || !payload.verification_hash)) {
      violations.push(`Rule 5: completion_claim contains "${bad}" but no matching evidence supplied`);
    }
  }
  return violations;
}

// ── Rule-3 summary · mechanically derived from the frozen array ────────
// Founder-directed fix: the rule cannot lie about its own contents.
// Any consumer that reports "N forbidden terms" MUST use this helper.
export function describeRule3Summary(): {
  rule_id: "RULE-3";
  forbidden_customer_facing_terms_count: number;
  allowed_customer_facing_terms_count: number;
  frozen: true;
} {
  return {
    rule_id: "RULE-3",
    forbidden_customer_facing_terms_count: RULE_3_CUSTOMER_LANGUAGE_PRIMACY.forbidden_customer_facing_terms.length,
    allowed_customer_facing_terms_count: RULE_3_CUSTOMER_LANGUAGE_PRIMACY.allowed_customer_facing_terms.length,
    frozen: true,
  };
}

// ── Rule-3 helper · scans a NEX-authored string for forbidden terminology
// unless the CUSTOMER used the same term first (context-aware exception).
export function assertRule3CustomerLanguage(input: {
  nex_reply: string;
  customer_message: string;
}): readonly string[] {
  const violations: string[] = [];
  const reply = input.nex_reply.toLowerCase();
  const customer = input.customer_message.toLowerCase();
  for (const forbidden of RULE_3_CUSTOMER_LANGUAGE_PRIMACY.forbidden_customer_facing_terms) {
    const term = forbidden.toLowerCase();
    if (reply.includes(term) && !customer.includes(term)) {
      violations.push(`Rule 3: NEX used "${forbidden}" but customer never did`);
    }
  }
  return violations;
}

// ── Rule-4 helper · scans a candidate page-completion payload for
// forbidden stub signals.
export function assertRule4NoHalfBuiltPages(input: {
  page_summary: string;
  region_manifest: readonly { region: string; implemented: boolean; explicitly_deferred: boolean }[];
}): readonly string[] {
  const violations: string[] = [];
  const summary = input.page_summary.toLowerCase();
  for (const bad of RULE_4_NO_HALF_BUILT_PAGES.forbidden_completion_signals) {
    if (summary.includes(bad.toLowerCase())) {
      violations.push(`Rule 4: page_summary contains forbidden completion signal "${bad}"`);
    }
  }
  for (const r of input.region_manifest) {
    if (!r.implemented && !r.explicitly_deferred) {
      violations.push(`Rule 4: region "${r.region}" is not implemented and not explicitly deferred`);
    }
  }
  return violations;
}
