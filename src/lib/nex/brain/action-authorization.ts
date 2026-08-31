// src/lib/nex/brain/action-authorization.ts
//
// Stage 3.37 · Action authorization dance (Philip 2026-08-31).
//
// This module is the SINGLE canonical place that decides whether an
// AuthorizationState should be GRANTED for a mutation-capable action.
// The Stage 3.36 action-chain contract remains canonical · this module
// merely feeds it with the correct AuthorizationState.
//
// CONSTITUTIONAL:
//   · Every mutation requires explicit user confirmation.
//   · Authorization is BOUND to a specific proposal via fingerprint.
//   · Fingerprint changes (target · message · kind · channel) invalidate
//     the prior authorization.
//   · CONSUMED proposals cannot be re-executed even if the user says
//     "yes" again — replay guard.
//   · AMBIGUOUS confirmation NEVER authorizes.
//   · Missing required evidence BLOCKS before any proposal is emitted.

import { createHash } from "node:crypto";
import type {
  ActionChainTarget,
  AuthorizationState,
  ChainActionKind,
} from "./action-audit";

// ─── PendingProposal shape (persisted on SessionState) ─────────────

export type PendingProposalStatus = "AWAITING" | "CONSUMED" | "EXPIRED";

export type PendingProposal = {
  fingerprint: string;
  actionId:    string;
  kind:        ChainActionKind;
  target:      ActionChainTarget;
  messageBody?: string;
  proposedAt:  number;
  proposedInTurn: number;
  status:      PendingProposalStatus;
  /** Language the original proposal prompt was rendered in · used to
   *  render the confirmation/decline/UNKNOWN reply consistently even
   *  when the confirmation itself is too short to language-detect. */
  language?: "en" | "id";
};

// ─── Fingerprint · stable identity of a proposal ───────────────────

/**
 * The proposal fingerprint. Any of these fields changing means the
 * user is authorizing something DIFFERENT · the old auth cannot apply.
 *   · kind             (whatsapp vs directory)
 *   · target refId or canonical (which business)
 *   · contact channel value (which phone number)
 *   · message body     (what we're saying)
 */
export function proposalFingerprint(input: {
  kind: ChainActionKind;
  target: ActionChainTarget;
  messageBody?: string;
}): string {
  const targetKey = input.target.refId || input.target.canonical || "";
  const channelKey = input.target.contactChannel
    ? `${input.target.contactChannel.kind}:${input.target.contactChannel.value}`
    : "";
  const payload = [
    input.kind,
    targetKey,
    channelKey,
    input.messageBody ?? "",
  ].join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

// ─── Freshness / staleness ─────────────────────────────────────────

/** Max turns a proposal can sit unconfirmed before it goes EXPIRED. */
export const PROPOSAL_MAX_TURN_AGE = 5;

export function isProposalFresh(pending: PendingProposal, currentTurn: number): boolean {
  if (pending.status !== "AWAITING") return false;
  return currentTurn - pending.proposedInTurn <= PROPOSAL_MAX_TURN_AGE;
}

// ─── Required-evidence check · blocks BEFORE proposal ──────────────

export type EvidenceCheckResult =
  | { sufficient: true; contactChannel: NonNullable<ActionChainTarget["contactChannel"]> }
  | { sufficient: false; reason: string };

/**
 * For contact_via_whatsapp, verify the target actually has a whatsapp
 * (or phone) channel published. If not, we refuse BEFORE emitting a
 * proposal — never ask "shall I send?" when there is nothing valid
 * to send.
 */
export function checkRequiredEvidence(kind: ChainActionKind, target: ActionChainTarget): EvidenceCheckResult {
  if (kind === "open_directory") {
    if (target.refId || target.canonical) {
      return { sufficient: true, contactChannel: { kind: "url", value: target.canonical, source: "session" } };
    }
    return { sufficient: false, reason: "target has no refId or canonical name" };
  }
  if (kind === "contact_via_whatsapp") {
    const ch = target.contactChannel;
    if (!ch || ch.kind !== "whatsapp") {
      return { sufficient: false, reason: "no verified whatsapp contact channel published for this target" };
    }
    if (!ch.value.trim()) {
      return { sufficient: false, reason: "whatsapp channel value is empty" };
    }
    return { sufficient: true, contactChannel: ch };
  }
  // Unknown kind — refuse defensively.
  return { sufficient: false, reason: `unknown action kind ${kind}` };
}

// ─── Authorization decision · the single decision point ────────────

export type AuthorizationDecisionInput = {
  requestedKind: ChainActionKind;
  requestedTarget: ActionChainTarget;
  messageBody?: string;
  message: string;                            // raw user message this turn
  currentTurn: number;
  pendingProposal?: PendingProposal | null;
  confirmationResult?: import("./confirmation-parser").ConfirmationResult;
  now: () => string;
};

export type AuthorizationDecision =
  | {
      /** Chain should run · adapter WILL be invoked. */
      outcome: "PROCEED_WITH_AUTH";
      auth: AuthorizationState;
      proposal: PendingProposal;      // canonical proposal · will become CONSUMED
    }
  | {
      /** Chain should NOT run · user was proposed the action and now needs to confirm. */
      outcome: "AWAIT_CONFIRMATION";
      proposal: PendingProposal;      // just-created · status AWAITING
      reason: string;
    }
  | {
      /** Chain should NOT run · user declined explicitly. */
      outcome: "DECLINED";
      auth: AuthorizationState;
      priorProposal: PendingProposal;
    }
  | {
      /** Chain should NOT run · required evidence missing. */
      outcome: "BLOCKED_MISSING_EVIDENCE";
      reason: string;
    }
  | {
      /** User said "yes" but the pending proposal is stale / different / consumed. */
      outcome: "STALE_OR_MISMATCHED";
      reason: string;
      priorProposal?: PendingProposal;
    }
  | {
      /** Ambiguous confirmation · ask again. */
      outcome: "AMBIGUOUS_NEEDS_CLARIFICATION";
      reason: string;
      pendingProposal: PendingProposal;
    };

let __actionIdCounter = 0;
function newActionId(at: string): string {
  __actionIdCounter += 1;
  return `act_${at.replace(/[^0-9]/g, "").slice(0, 14)}_${__actionIdCounter.toString(36)}`;
}

/**
 * Compute the authorization decision for this turn.
 * The caller is responsible for persisting the returned proposal on
 * SessionState (or marking it CONSUMED after execution).
 */
export function decideAuthorization(input: AuthorizationDecisionInput): AuthorizationDecision {
  // 1. Required-evidence gate · run BEFORE any proposal is minted.
  //    Never ask "shall I send?" when there's nothing valid to send.
  const evidence = checkRequiredEvidence(input.requestedKind, input.requestedTarget);
  if (!evidence.sufficient) {
    return { outcome: "BLOCKED_MISSING_EVIDENCE", reason: evidence.reason };
  }

  // 2. Compute the fingerprint for the action the user is requesting
  //    THIS TURN. If it doesn't match a pending proposal, we're
  //    proposing something new.
  const requestedFingerprint = proposalFingerprint({
    kind: input.requestedKind,
    target: input.requestedTarget,
    messageBody: input.messageBody,
  });

  const pending = input.pendingProposal ?? null;
  const conf = input.confirmationResult;

  // 3. There IS a pending proposal · resolve confirmation.
  if (pending && conf) {
    // DECLINE against the pending proposal → BLOCKED authorization.
    if (conf.kind === "DECLINE") {
      return {
        outcome: "DECLINED",
        auth: {
          state: "DENIED",
          source: "user_reply",
          at: input.now(),
          reason: `user declined via "${conf.phrase}"`,
        },
        priorProposal: pending,
      };
    }

    // AMBIGUOUS → refuse to authorize · ask for clarification.
    if (conf.kind === "AMBIGUOUS") {
      return {
        outcome: "AMBIGUOUS_NEEDS_CLARIFICATION",
        reason: conf.reason,
        pendingProposal: pending,
      };
    }

    // CONFIRM · must match the pending proposal's fingerprint AND be
    // fresh AND not already CONSUMED.
    if (conf.kind === "CONFIRM") {
      if (pending.status === "CONSUMED") {
        return {
          outcome: "STALE_OR_MISMATCHED",
          reason: "the pending proposal was already executed once · replay protection: authorization consumed",
          priorProposal: pending,
        };
      }
      if (pending.status === "EXPIRED" || !isProposalFresh(pending, input.currentTurn)) {
        return {
          outcome: "STALE_OR_MISMATCHED",
          reason: `pending proposal expired (turn age ${input.currentTurn - pending.proposedInTurn} > ${PROPOSAL_MAX_TURN_AGE})`,
          priorProposal: pending,
        };
      }
      // Fingerprint mismatch = user is authorizing something different
      // than what we proposed · never treat as auth for the new thing.
      if (pending.fingerprint !== requestedFingerprint) {
        return {
          outcome: "STALE_OR_MISMATCHED",
          reason: "user confirmed but the current turn's requested action differs from the pending proposal · authorization does not carry across",
          priorProposal: pending,
        };
      }

      // All gates passed · GRANT authorization for the exact pending
      // proposal. Caller will mark it CONSUMED after runActionChain.
      return {
        outcome: "PROCEED_WITH_AUTH",
        auth: {
          state: "GRANTED",
          source: "user_reply",
          at: input.now(),
          evidence: `user confirmed via "${conf.phrase}" (${conf.language}) · fingerprint ${pending.fingerprint}`,
        },
        proposal: pending,
      };
    }
  }

  // 4. No pending confirmation on the table · we're proposing new.
  //    Mint a proposal, tell caller to persist + reply with a
  //    confirmation request. Adapter does NOT run this turn.
  const target: ActionChainTarget = {
    ...input.requestedTarget,
    contactChannel: input.requestedTarget.contactChannel ?? evidence.contactChannel,
    resolvedAt: input.now(),
  };
  const newProposal: PendingProposal = {
    fingerprint:    requestedFingerprint,
    actionId:       newActionId(input.now()),
    kind:           input.requestedKind,
    target,
    messageBody:    input.messageBody,
    proposedAt:     Date.now(),
    proposedInTurn: input.currentTurn,
    status:         "AWAITING",
  };
  return {
    outcome: "AWAIT_CONFIRMATION",
    proposal: newProposal,
    reason:   pending
      ? "prior proposal invalidated · this turn requests a different action fingerprint · minting new proposal"
      : "no prior proposal · minting new proposal · awaiting explicit confirmation",
  };
}

// ─── Composer for the confirmation-request reply ───────────────────

export function composeProposalPrompt(proposal: PendingProposal, lang: "en" | "id"): string {
  const target = proposal.target.canonical || "the requested target";
  const preview = proposal.messageBody ? `\n\n"${proposal.messageBody}"` : "";
  if (proposal.kind === "contact_via_whatsapp") {
    return lang === "id"
      ? `Saya bisa mengirim WhatsApp ke ${target}:${preview}\n\nKirim? (balas "iya" untuk mengirim, "jangan" untuk batal)`
      : `I can send a WhatsApp to ${target}:${preview}\n\nShall I send it? (reply "yes" to send, "no" to cancel)`;
  }
  return lang === "id"
    ? `Saya bisa membuka halaman direktori untuk ${target}. Lanjutkan? (balas "iya" atau "jangan")`
    : `I can open the directory page for ${target}. Proceed? (reply "yes" or "no")`;
}

export function composeAmbiguousReprompt(proposal: PendingProposal, lang: "en" | "id"): string {
  const target = proposal.target.canonical || "the target";
  return lang === "id"
    ? `Maaf, saya belum bisa memastikan itu jawaban "iya" atau "jangan". Untuk kirim ke ${target}, balas persis "iya" atau "jangan".`
    : `I couldn't tell if that was a yes or no. To send to ${target}, please reply with a clear "yes" or "no".`;
}

export function composeDeclineAck(proposal: PendingProposal, lang: "en" | "id"): string {
  const target = proposal.target.canonical || "the target";
  return lang === "id"
    ? `Baik, tidak jadi kirim ke ${target}.`
    : `Understood — I won't send anything to ${target}.`;
}

export function composeStaleAck(reason: string, lang: "en" | "id"): string {
  return lang === "id"
    ? `Konfirmasi tidak berlaku: ${reason}. Kalau kamu masih mau kirim, minta lagi ya.`
    : `That confirmation doesn't apply: ${reason}. If you still want to send, ask again.`;
}

export function composeMissingEvidenceReply(reason: string, target: ActionChainTarget, lang: "en" | "id"): string {
  const name = target.canonical || "the target";
  return lang === "id"
    ? `Saya tidak bisa kirim ke ${name}: ${reason}. Saya tidak akan mengarang nomor.`
    : `I can't send to ${name}: ${reason}. I won't guess a number.`;
}
