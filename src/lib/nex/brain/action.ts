// src/lib/nex/brain/action.ts
//
// Stage 3.21 · Phase 14 · Action / Execution (Philip 2026-08-31).
//
// Consumer of Reference Resolution (target) + Tool Selection (routing
// intent) + Governance (consent gating). Produces a structured
// ActionProposal + optional ActionExecution when the requested action
// is safe and available. Never claims an action succeeded that didn't.
//
// v1 discipline:
//   · Deterministic · no LLM · no side effects beyond link generation
//   · Only `open_directory` is fully wired v1 (safe · we always have refId)
//   · Other action kinds are DECLARED but return not_wired · never
//     silently pretend
//   · Governance report is CONSULTED · when require_consent is present
//     for execute.user_action, we produce a proposal (user sees the
//     link + reason) but execution is opt-in
//   · Reply text can include the proposed link · composer decides how
//     to present · Action itself never mutates the reply

import type { GovernanceReport } from "./governance";

export type ActionKind =
  | "open_directory"        // wa.me / directory URL · always safe v1
  | "contact_via_whatsapp"  // future · needs seller phone data
  | "email_seller"          // future · needs seller email data
  | "save_to_list"          // future · needs long_term_memory
  | "book_now"              // future · needs payment integration
  | "add_to_cart";          // future · needs commerce session

export type ActionAvailability = "available" | "declared_not_wired" | "requires_data" | "consent_gated";

export type ActionTarget = {
  canonical: string;
  raw: string;
  refId?: string;
};

export type ActionProposal = {
  kind: ActionKind;
  target: ActionTarget;
  availability: ActionAvailability;
  reason: string;
  /** Concrete link (when generatable). Never fabricated. */
  linkPreview?: string;
  /** Optional consent context from Governance. */
  consentRequired: boolean;
};

export type ActionExecution =
  | {
      executed: true;
      kind: ActionKind;
      target: ActionTarget;
      result: { url?: string; message?: string };
    }
  | {
      executed: false;
      kind: ActionKind;
      target?: ActionTarget;
      reason:
        | "no_target"
        | "no_consent"
        | "not_wired"
        | "no_data";
      message: string;
    };

// ─── Directory link generator ────────────────────────────────────────

function directoryUrl(target: ActionTarget): string {
  // Deterministic · uses refId when present, canonical name as fallback
  // query parameter. Never fabricates a URL for a target with no id.
  if (target.refId) return `/nex-app/centre?ref=${encodeURIComponent(target.refId)}`;
  return `/nex-app/centre?q=${encodeURIComponent(target.raw)}`;
}

// ─── Proposal ────────────────────────────────────────────────────────

export type ProposeActionInput = {
  requestedKind: ActionKind;
  target?: ActionTarget;
  governance?: GovernanceReport;
};

/** Produce an ActionProposal from the requested kind + resolved target.
 *  Consults Governance for consent state. Never fabricates data. */
export function proposeAction(input: ProposeActionInput): ActionProposal {
  const kind = input.requestedKind;
  const target: ActionTarget = input.target ?? { canonical: "", raw: "", refId: undefined };

  // Consent state from Governance · execute.user_action needs consent
  // under the default policy · Action honours it declaratively.
  const consentRequired = !!input.governance?.findings.some(
    (f) => f.permission === "execute.user_action" && f.decision === "require_consent",
  );

  // v1 wired actions
  if (kind === "open_directory") {
    if (!target.raw && !target.refId) {
      return {
        kind, target,
        availability: "requires_data",
        reason: "no target · Reference Resolution didn't resolve to a specific business",
        consentRequired,
      };
    }
    return {
      kind, target,
      availability: "available",
      reason: "directory link generatable from target refId or canonical name",
      linkPreview: directoryUrl(target),
      consentRequired,
    };
  }

  // Declared but not wired v1
  const notWiredReasons: Record<ActionKind, string> = {
    open_directory: "",
    contact_via_whatsapp: "seller phone data not yet in commerce records · pending workforce acquisition",
    email_seller: "seller email data not yet in commerce records · pending workforce acquisition",
    save_to_list: "long-term memory not yet wired · Phase 15+ candidate",
    book_now: "payment integration not yet wired · Stage 6 roadmap",
    add_to_cart: "commerce session not yet wired · Stage 6 roadmap",
  };
  return {
    kind, target,
    availability: "declared_not_wired",
    reason: notWiredReasons[kind] || "action not yet wired",
    consentRequired,
  };
}

// ─── Execution (v1 · link generation only, no side effects) ──────────

export function executeAction(proposal: ActionProposal): ActionExecution {
  const target = proposal.target;
  if (!target.raw && !target.refId) {
    return {
      executed: false,
      kind: proposal.kind,
      target: undefined,
      reason: "no_target",
      message: "No target to execute against.",
    };
  }
  if (proposal.consentRequired) {
    return {
      executed: false,
      kind: proposal.kind,
      target,
      reason: "no_consent",
      message: "Action requires consent (execute.user_action gated by Governance). Ask the user to confirm before executing.",
    };
  }
  if (proposal.availability === "declared_not_wired" || proposal.availability === "requires_data") {
    return {
      executed: false,
      kind: proposal.kind,
      target,
      reason: proposal.availability === "declared_not_wired" ? "not_wired" : "no_data",
      message: proposal.reason,
    };
  }
  // Only kind wired v1: open_directory.
  if (proposal.kind === "open_directory") {
    return {
      executed: true,
      kind: proposal.kind,
      target,
      result: { url: proposal.linkPreview, message: `Directory link for ${target.raw}` },
    };
  }
  // Fallback · shouldn't reach here.
  return {
    executed: false,
    kind: proposal.kind,
    target,
    reason: "not_wired",
    message: "Action kind not implemented v1",
  };
}
