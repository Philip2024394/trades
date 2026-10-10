// NEX Publication Gate · 2026-09-19 · Deterministic Preflight Checker
//
// PURPOSE
//   Given a proposed list of file paths for release, deterministically report
//   which files carry protected material and which are safe candidates for
//   founder review. This is a PREFLIGHT ADVISORY — it does NOT grant
//   publication authority. Final publication authority remains the Founder.
//
// STRICT NON-BEHAVIOUR
//   · Zero LLM · zero network.
//   · Zero autonomous action · pure function.
//   · No secret values ever stored or printed.
//   · Never bypasses classification · always errs toward BLOCKED / FOUNDER_REVIEW.

import {
  classifyPath,
  type IpCategory,
  type IpClassificationResult,
} from "./nex-ip-registry";

// ── Public shape ────────────────────────────────────────────────────────

export type PublicationVerdict =
  | "APPROVED_FOR_FOUNDER_REVIEW"
  | "BLOCKED_IP_CORE"
  | "BLOCKED_IP_SUPPORT"
  | "BLOCKED_IP_DATA"
  | "BLOCKED_SECURITY_SECRET"
  | "UNKNOWN_REQUIRES_REVIEW";

export interface PublicationDecision {
  readonly path: string;
  readonly verdict: PublicationVerdict;
  readonly classification: IpClassificationResult;
}

export interface PublicationPreflightInput {
  readonly proposed_files: readonly string[];
}

export interface PublicationPreflightResult {
  readonly proposal_size: number;
  readonly decisions: readonly PublicationDecision[];
  readonly approved_for_founder_review: readonly string[];
  readonly blocked_ip_core: readonly string[];
  readonly blocked_ip_support: readonly string[];
  readonly blocked_ip_data: readonly string[];
  readonly blocked_security_secret: readonly string[];
  readonly unknown_requires_review: readonly string[];
  readonly authority_reminder: "FOUNDER_AUTHORITY_REQUIRED_FOR_ANY_RELEASE";
}

// ── Category → verdict mapping ──────────────────────────────────────────

function verdictForCategory(cat: IpCategory): PublicationVerdict {
  switch (cat) {
    case "IP_CORE":
      return "BLOCKED_IP_CORE";
    case "IP_SUPPORT":
      return "BLOCKED_IP_SUPPORT";
    case "IP_DATA":
      return "BLOCKED_IP_DATA";
    case "SECURITY_SECRET":
      return "BLOCKED_SECURITY_SECRET";
    case "PUBLIC_CANDIDATE":
      return "APPROVED_FOR_FOUNDER_REVIEW";
    case "NON_IP":
      return "APPROVED_FOR_FOUNDER_REVIEW";
    case "UNKNOWN":
      return "UNKNOWN_REQUIRES_REVIEW";
  }
}

// ── Preflight entry point ──────────────────────────────────────────────

export function publicationPreflight(
  input: PublicationPreflightInput,
): PublicationPreflightResult {
  const decisions: PublicationDecision[] = [];
  const approved: string[] = [];
  const blocked_core: string[] = [];
  const blocked_support: string[] = [];
  const blocked_data: string[] = [];
  const blocked_secret: string[] = [];
  const unknown: string[] = [];

  for (const path of input.proposed_files) {
    const classification = classifyPath(path);
    const verdict = verdictForCategory(classification.category);
    decisions.push({ path, verdict, classification });
    switch (verdict) {
      case "APPROVED_FOR_FOUNDER_REVIEW":
        approved.push(path);
        break;
      case "BLOCKED_IP_CORE":
        blocked_core.push(path);
        break;
      case "BLOCKED_IP_SUPPORT":
        blocked_support.push(path);
        break;
      case "BLOCKED_IP_DATA":
        blocked_data.push(path);
        break;
      case "BLOCKED_SECURITY_SECRET":
        blocked_secret.push(path);
        break;
      case "UNKNOWN_REQUIRES_REVIEW":
        unknown.push(path);
        break;
    }
  }

  return {
    proposal_size: input.proposed_files.length,
    decisions,
    approved_for_founder_review: approved,
    blocked_ip_core: blocked_core,
    blocked_ip_support: blocked_support,
    blocked_ip_data: blocked_data,
    blocked_security_secret: blocked_secret,
    unknown_requires_review: unknown,
    authority_reminder: "FOUNDER_AUTHORITY_REQUIRED_FOR_ANY_RELEASE",
  };
}

/**
 * Convenience: single-path check.
 */
export function checkPath(repoRelativePath: string): PublicationDecision {
  const classification = classifyPath(repoRelativePath);
  return {
    path: classification.path,
    verdict: verdictForCategory(classification.category),
    classification,
  };
}

export const NEX_PUBLICATION_GATE_VERSION = "nex-publication-gate.v1.2026-09-19";
