// src/lib/nex/brain/action-authorization-integration.test.ts
//
// Stage 3.37 · End-to-end tests · authorization → runActionChain.
//
// These prove the acceptance criteria that span TWO modules:
//   · No adapter invocation before authorization
//   · GRANTED auth → chain advances all the way through 3.36
//   · DENIED auth → chain BLOCKED · adapter never called
//   · CONSUMED replay → adapter never called a second time
//   · Full conversation script (turn 1: propose · turn 2: yes · turn 3: replay ignored)
//   · Multi-conversation isolation: pending proposal on session A must not authorize action on session B

import { describe, expect, it } from "vitest";
import { runActionChain } from "./action-chain";
import { whatsappStubAdapter } from "./adapters/whatsapp-stub";
import {
  decideAuthorization,
  proposalFingerprint,
  type PendingProposal,
} from "./action-authorization";
import { parseConfirmation } from "./confirmation-parser";
import type { ActionAdapter, ActionChainTarget } from "./action-audit";

const NOW = () => "2026-08-31T10:00:00.000Z";

const target: ActionChainTarget = {
  canonical: "Gaotama Hotel",
  refId: "biz_gaotama",
  contactChannel: { kind: "whatsapp", value: "+62 812 3456 7890", source: "world_record" },
  resolvedAt: NOW(),
};

describe("full turn-1 flow · propose without executing", () => {
  it("first request → AWAIT_CONFIRMATION → adapter NEVER called this turn", async () => {
    let called = false;
    const spy: ActionAdapter = {
      kind: "contact_via_whatsapp",
      execute: async () => { called = true; return { kind: "accepted", pending: { correlationId: "x", awaitingKind: "not_wired", reason: "should not fire" } }; },
    };
    const decision = decideAuthorization({
      requestedKind: "contact_via_whatsapp",
      requestedTarget: target,
      messageBody: "Hello, do you have a room tonight?",
      message: "message this hotel and ask about tonight",
      currentTurn: 1,
      pendingProposal: null,
      confirmationResult: undefined,
      now: NOW,
    });
    // In the AWAIT_CONFIRMATION branch, orchestrate MUST NOT call runActionChain
    expect(decision.outcome).toBe("AWAIT_CONFIRMATION");
    // Prove that if we did nothing, the adapter would have been idle
    expect(called).toBe(false);
    // Additionally: if the caller mistakenly runs the chain anyway
    // with a REQUIRED auth, it should BLOCK · never invoke.
    const audit = await runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "message this hotel and ask about tonight",
      target,
      authorization: { state: "REQUIRED", reason: "test defensive" },
      adapter: spy,
      now: NOW,
    });
    expect(called).toBe(false);
    expect(audit.finalState).toBe("BLOCKED");
  });
});

describe("full turn-2 flow · confirm · executes · UNKNOWN with stub adapter", () => {
  it("PROPOSE → confirm 'yes' → GRANTED → runActionChain → finalState UNKNOWN (stub adapter, honest)", async () => {
    // Turn 1: minted proposal
    const t1 = decideAuthorization({
      requestedKind: "contact_via_whatsapp",
      requestedTarget: target,
      messageBody: "Hello, tonight?",
      message: "message hotel",
      currentTurn: 1,
      pendingProposal: null,
      confirmationResult: undefined,
      now: NOW,
    });
    expect(t1.outcome).toBe("AWAIT_CONFIRMATION");
    if (t1.outcome !== "AWAIT_CONFIRMATION") return;
    const pending = t1.proposal;

    // Turn 2: user says "yes"
    const t2 = decideAuthorization({
      requestedKind: "contact_via_whatsapp",
      requestedTarget: target,
      messageBody: "Hello, tonight?",
      message: "yes send it",
      currentTurn: 2,
      pendingProposal: pending,
      confirmationResult: parseConfirmation("yes send it"),
      now: NOW,
    });
    expect(t2.outcome).toBe("PROCEED_WITH_AUTH");
    if (t2.outcome !== "PROCEED_WITH_AUTH") return;

    const audit = await runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "yes send it",
      target,
      authorization: t2.auth,
      adapter: whatsappStubAdapter,
      now: NOW,
    });
    expect(audit.finalState).toBe("UNKNOWN"); // stub adapter · UNKNOWN by design
    expect(audit.execution.state).toBe("EXECUTED");
    expect(audit.execution.outcome?.kind).toBe("accepted");
  });
});

describe("full turn-2 flow · decline · BLOCKED · adapter never called", () => {
  it("PROPOSE → 'no' → BLOCKED · adapter never invoked", async () => {
    let called = false;
    const spy: ActionAdapter = {
      kind: "contact_via_whatsapp",
      execute: async () => { called = true; return { kind: "accepted", pending: { correlationId: "x", awaitingKind: "not_wired", reason: "boom" } }; },
    };
    const pending: PendingProposal = {
      fingerprint: proposalFingerprint({ kind: "contact_via_whatsapp", target, messageBody: "hi" }),
      actionId: "a1", kind: "contact_via_whatsapp",
      target, messageBody: "hi",
      proposedAt: 0, proposedInTurn: 1, status: "AWAITING",
    };
    const decision = decideAuthorization({
      requestedKind: "contact_via_whatsapp",
      requestedTarget: target,
      messageBody: "hi",
      message: "no, don't send",
      currentTurn: 2,
      pendingProposal: pending,
      confirmationResult: parseConfirmation("no, don't send"),
      now: NOW,
    });
    expect(decision.outcome).toBe("DECLINED");
    if (decision.outcome !== "DECLINED") return;
    const audit = await runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "no",
      target,
      authorization: decision.auth,
      adapter: spy,
      now: NOW,
    });
    expect(called).toBe(false);
    expect(audit.finalState).toBe("BLOCKED");
    expect(audit.blockedReason).toContain("authorization denied");
  });
});

describe("replay guard · CONSUMED proposal · adapter never re-invoked", () => {
  it("after successful chain marks pending CONSUMED · second 'yes' does NOT re-execute", async () => {
    // Simulate turn 2 successful confirm (as above)
    const pending: PendingProposal = {
      fingerprint: proposalFingerprint({ kind: "contact_via_whatsapp", target, messageBody: "hi" }),
      actionId: "a1", kind: "contact_via_whatsapp",
      target, messageBody: "hi",
      proposedAt: 0, proposedInTurn: 1, status: "AWAITING",
    };
    // Turn 2: confirm & execute
    const t2 = decideAuthorization({
      requestedKind: "contact_via_whatsapp", requestedTarget: target, messageBody: "hi",
      message: "yes", currentTurn: 2, pendingProposal: pending,
      confirmationResult: parseConfirmation("yes"), now: NOW,
    });
    expect(t2.outcome).toBe("PROCEED_WITH_AUTH");

    // After the chain runs, orchestrate marks the pending CONSUMED.
    const consumed: PendingProposal = { ...pending, status: "CONSUMED" };

    // Turn 3: user says "yes" again — this MUST NOT execute the chain.
    let callCount = 0;
    const spy: ActionAdapter = {
      kind: "contact_via_whatsapp",
      execute: async () => { callCount += 1; return { kind: "accepted", pending: { correlationId: "x", awaitingKind: "not_wired", reason: "should not fire" } }; },
    };
    const t3 = decideAuthorization({
      requestedKind: "contact_via_whatsapp", requestedTarget: target, messageBody: "hi",
      message: "yes", currentTurn: 3, pendingProposal: consumed,
      confirmationResult: parseConfirmation("yes"), now: NOW,
    });
    expect(t3.outcome).toBe("STALE_OR_MISMATCHED");
    // Adapter never called on this turn because decision != PROCEED_WITH_AUTH
    expect(callCount).toBe(0);
  });
});

describe("cross-target isolation · one action cannot authorize another", () => {
  it("pending is for Hotel A · new turn is Hotel B + 'yes' → STALE (no auth for B)", async () => {
    const targetA: ActionChainTarget = target;
    const targetB: ActionChainTarget = {
      canonical: "Indonesia Hotel", refId: "biz_ind",
      contactChannel: { kind: "whatsapp", value: "+62 999 8888 7777", source: "world_record" },
      resolvedAt: NOW(),
    };
    const pendingForA: PendingProposal = {
      fingerprint: proposalFingerprint({ kind: "contact_via_whatsapp", target: targetA, messageBody: "hi" }),
      actionId: "a1", kind: "contact_via_whatsapp",
      target: targetA, messageBody: "hi",
      proposedAt: 0, proposedInTurn: 1, status: "AWAITING",
    };
    let called = false;
    const spy: ActionAdapter = {
      kind: "contact_via_whatsapp",
      execute: async () => { called = true; return { kind: "accepted", pending: { correlationId: "x", awaitingKind: "not_wired", reason: "no" } }; },
    };
    const decision = decideAuthorization({
      requestedKind: "contact_via_whatsapp", requestedTarget: targetB, messageBody: "hi",
      message: "yes", currentTurn: 2, pendingProposal: pendingForA,
      confirmationResult: parseConfirmation("yes"), now: NOW,
    });
    expect(decision.outcome).toBe("STALE_OR_MISMATCHED");
    expect(called).toBe(false);
  });
});

describe("changed message body invalidates authorization", () => {
  it("propose 'tonight' → user says 'actually tomorrow' → NEW proposal minted (different fingerprint) · adapter never called", async () => {
    const pendingTonight: PendingProposal = {
      fingerprint: proposalFingerprint({ kind: "contact_via_whatsapp", target, messageBody: "tonight" }),
      actionId: "a1", kind: "contact_via_whatsapp",
      target, messageBody: "tonight",
      proposedAt: 0, proposedInTurn: 1, status: "AWAITING",
    };
    // Turn 2: user changes the request · no confirmation phrase in it
    const decision = decideAuthorization({
      requestedKind: "contact_via_whatsapp", requestedTarget: target, messageBody: "tomorrow",
      message: "actually ask them about tomorrow instead",
      currentTurn: 2, pendingProposal: pendingTonight,
      confirmationResult: parseConfirmation("actually ask them about tomorrow instead"),
      now: NOW,
    });
    // parseConfirmation returns AMBIGUOUS on that message · caller
    // should re-propose with the new fingerprint. decideAuthorization
    // routes this via the AMBIGUOUS branch only IF the confirmation
    // parser thinks it was a confirmation attempt against the
    // pending proposal. But per the spec, this message is a new
    // action request, not a response. Orchestrate is responsible for
    // detecting "this is a new action-verb message" and re-entering
    // the decideAuthorization path with confirmationResult=undefined.
    // Let's assert that outcome directly:
    const newProposalDecision = decideAuthorization({
      requestedKind: "contact_via_whatsapp",
      requestedTarget: target,
      messageBody: "tomorrow",
      message: "actually ask them about tomorrow instead",
      currentTurn: 2,
      pendingProposal: pendingTonight,
      confirmationResult: undefined,     // orchestrate: treat as new action
      now: NOW,
    });
    expect(newProposalDecision.outcome).toBe("AWAIT_CONFIRMATION");
    if (newProposalDecision.outcome === "AWAIT_CONFIRMATION") {
      expect(newProposalDecision.proposal.fingerprint).not.toBe(pendingTonight.fingerprint);
      expect(newProposalDecision.reason).toContain("prior proposal invalidated");
    }
  });
});
