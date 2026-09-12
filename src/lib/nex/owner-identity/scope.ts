// src/lib/nex/owner-identity/scope.ts
//
// FOUNDER MASTER ACCESS · scope enforcement (read/query + approved updates)
// Philip 2026-09-08 · AUTHORIZE Founder Master Access mission
//
// Even though the authenticated party is Founder · this interface refuses
// engineering / financial / credential-change / deployment operations.
// Identity ≠ authority.

export type OwnerRequestClass =
  // Allowed
  | "READ_MEMBERS"
  | "READ_REVENUE"
  | "READ_COSTS"
  | "READ_BUSINESSES"
  | "READ_ACCOMMODATION"
  | "READ_AGENT_HEALTH"
  | "READ_MASTER_AI_STATE"
  | "READ_RECOMMENDATIONS"
  | "READ_FAILURES"
  | "READ_RESEARCH"
  | "READ_KNOWLEDGE"
  | "READ_LEARNING"
  | "READ_SPECIALIST"
  | "READ_VISION_V1"
  | "READ_STRATEGIC"
  | "READ_EVOLUTION"
  | "READ_ENDURANCE"
  | "APPROVED_DATA_UPDATE"          // requires explicit confirm-then-execute
  // Forbidden from mobile Founder chat
  | "ENGINEERING_CHANGE"
  | "CODE_MODIFY"
  | "DEPLOYMENT"
  | "SHELL_COMMAND"
  | "INFRASTRUCTURE_MODIFY"
  | "SECURITY_CONTROL_MODIFY"
  | "AUTH_IMPL_MODIFY"
  | "PROMOTE_CANDIDATE"
  | "ELEVATE_AGENT"
  | "PHASE_A_TO_G_MODIFY"
  | "BYPASS_FOUNDER_GATE"
  | "FINANCIAL_TRANSACTION"
  | "PAYMENT"
  | "PURCHASE"
  | "WITHDRAW"
  | "TRANSFER"
  | "CREDENTIAL_CHANGE"
  | "PERMISSIONS_CHANGE"
  | "USER_GRANT_REVOKE"
  | "UNKNOWN";

export const ALLOWED_READ_CLASSES: readonly OwnerRequestClass[] = [
  "READ_MEMBERS", "READ_REVENUE", "READ_COSTS", "READ_BUSINESSES",
  "READ_ACCOMMODATION", "READ_AGENT_HEALTH", "READ_MASTER_AI_STATE",
  "READ_RECOMMENDATIONS", "READ_FAILURES", "READ_RESEARCH", "READ_KNOWLEDGE",
  "READ_LEARNING", "READ_SPECIALIST", "READ_VISION_V1", "READ_STRATEGIC",
  "READ_EVOLUTION", "READ_ENDURANCE",
];

export const FORBIDDEN_MOBILE_CLASSES: readonly OwnerRequestClass[] = [
  "ENGINEERING_CHANGE", "CODE_MODIFY", "DEPLOYMENT", "SHELL_COMMAND",
  "INFRASTRUCTURE_MODIFY", "SECURITY_CONTROL_MODIFY", "AUTH_IMPL_MODIFY",
  "PROMOTE_CANDIDATE", "ELEVATE_AGENT", "PHASE_A_TO_G_MODIFY",
  "BYPASS_FOUNDER_GATE", "FINANCIAL_TRANSACTION", "PAYMENT", "PURCHASE",
  "WITHDRAW", "TRANSFER", "CREDENTIAL_CHANGE", "PERMISSIONS_CHANGE",
  "USER_GRANT_REVOKE",
];

export type ScopeDecision =
  | { allowed: true; class: OwnerRequestClass; refusal_message?: undefined; requires_confirm?: boolean }
  | { allowed: false; class: OwnerRequestClass; refusal_message: string };

/** Given a request class, decide whether the mobile Founder chat may
 *  execute it. Forbidden classes return a canonical refusal message. */
export function decideScope(requestClass: OwnerRequestClass): ScopeDecision {
  if (ALLOWED_READ_CLASSES.includes(requestClass)) {
    return { allowed: true, class: requestClass };
  }
  if (requestClass === "APPROVED_DATA_UPDATE") {
    return { allowed: true, class: requestClass, requires_confirm: true };
  }
  if (FORBIDDEN_MOBILE_CLASSES.includes(requestClass)) {
    // Choose the doctrinally-correct refusal per category
    const isFinancial = ["FINANCIAL_TRANSACTION","PAYMENT","PURCHASE","WITHDRAW","TRANSFER"].includes(requestClass);
    const message = isFinancial
      ? "I can report financial data, but I cannot execute transactions from Founder Chat."
      : "I can report on that from Founder Chat, but engineering changes require the governed engineering workflow.";
    return { allowed: false, class: requestClass, refusal_message: message };
  }
  return { allowed: false, class: "UNKNOWN", refusal_message: "I don't recognize that request. Please rephrase." };
}

/** Very rough natural-language → request-class mapper. Intent extraction
 *  is deliberately conservative · UNKNOWN when uncertain. This is a
 *  security-relevant classifier so bias toward false-UNKNOWN (safer than
 *  false-ALLOW). */
export function classifyOwnerRequest(text: string): OwnerRequestClass {
  const t = (text ?? "").toLowerCase();
  if (!t) return "UNKNOWN";

  // Forbidden buckets first (safest ordering)
  if (/\b(deploy|deployment|shipit|ship it|publish|release)\b/.test(t)) return "DEPLOYMENT";
  if (/\b(commit|merge|edit source|change (?:the )?code|modify (?:the )?code|rewrite (?:the )?code|refactor (?:the )?code)\b/.test(t)) return "CODE_MODIFY";
  if (/\b(shell|bash|powershell|npm install|npm run|rm -rf|curl|wget)\b/.test(t)) return "SHELL_COMMAND";
  if (/\b(promote|approve promotion|activate the candidate)\b/.test(t)) return "PROMOTE_CANDIDATE";
  if (/\b(elevate|grant phase g|give phase g)\b/.test(t)) return "ELEVATE_AGENT";
  if (/\bbypass\b.*\bgate\b|\boverride\s+(?:the\s+)?gate\b/.test(t)) return "BYPASS_FOUNDER_GATE";
  if (/\b(transfer money|send money|pay|purchase|withdraw|refund|charge (?:the )?card)\b/.test(t)) return "FINANCIAL_TRANSACTION";
  if (/\b(change (?:the )?(?:credential|password)|rotate credential|reset password)\b/.test(t)) return "CREDENTIAL_CHANGE";
  if (/\b(grant|revoke)\s+(?:user|access|permission)\b/.test(t)) return "USER_GRANT_REVOKE";

  // Read categories
  if (/\b(how many (?:members|users)|user count|member count)\b/.test(t)) return "READ_MEMBERS";
  if (/\b(revenue|income|earnings|monthly (?:income|revenue))\b/.test(t)) return "READ_REVENUE";
  if (/\b(costs?|expenses?|spend|spending)\b/.test(t)) return "READ_COSTS";
  if (/\b(business(?:es)?|active businesses|business memberships)\b/.test(t)) return "READ_BUSINESSES";
  if (/\b(hotel|accommodation|directory)\b/.test(t)) return "READ_ACCOMMODATION";
  if (/\b(agent|agents|running agents|agent health)\b/.test(t)) return "READ_AGENT_HEALTH";
  if (/\b(master ai (?:doing|learning|state)|what is master ai|master ai activity)\b/.test(t)) return "READ_MASTER_AI_STATE";
  if (/\brecommendation/.test(t)) return "READ_RECOMMENDATIONS";
  if (/\b(failure|failures|crash|crashes|error)/.test(t)) return "READ_FAILURES";
  if (/\bresearch(?:ing)?\b/.test(t)) return "READ_RESEARCH";
  if (/\bknowledge\b/.test(t)) return "READ_KNOWLEDGE";
  if (/\blearn(?:ing)?\b/.test(t)) return "READ_LEARNING";
  if (/\b(speaking specialist|speaking agent|specialist)\b/.test(t)) return "READ_SPECIALIST";
  if (/\b(image|vision|visual)\b/.test(t)) return "READ_VISION_V1";
  if (/\b(strategy|strategic)\b/.test(t)) return "READ_STRATEGIC";
  if (/\b(stale|contradiction|supersession|evolution)\b/.test(t)) return "READ_EVOLUTION";
  if (/\b(endurance|7-day|uptime)\b/.test(t)) return "READ_ENDURANCE";

  // Data-update signal (conservative)
  if (/\b(update|correct|change|edit)\s+(?:the )?(?:business|listing|record|category|field|entry)\b/.test(t)) return "APPROVED_DATA_UPDATE";

  return "UNKNOWN";
}

/** Compose a canonical natural response wrapper (Phil / Founder / Boss variation).
 *  Deterministic PSEUDO-random selection based on a rotating counter · so tests
 *  can seed it. */
let _addressCounter = 0;
const ADDRESS_VARIANTS = ["Phil", "Boss", "Founder"] as const;
export function nextFounderAddress(): string {
  const v = ADDRESS_VARIANTS[_addressCounter % ADDRESS_VARIANTS.length];
  _addressCounter += 1;
  return v;
}
export function _resetFounderAddressCounterForTests(): void { _addressCounter = 0; }
