// src/lib/nex/brain/action-chain.test.ts
//
// Stage 3.36 · Action + Verification v2 doctrine tests (Philip 2026-08-31).
//
// These tests are the *constitutional acceptance suite* for the
// Action+Verification landing. They must ALL stay green forever ·
// they encode the guarantees the user asked for:
//
//   G1 · EXECUTING unreachable without AUTHORIZED / NOT_REQUIRED
//   G2 · EXECUTED never advances to VERIFIED without a DeliveryProof
//   G3 · Adapter "accepted" outcome → UNKNOWN · never rounded up
//   G4 · Adapter throw → FAILED with captured error
//   G5 · Every transition captured in transitions[]
//   G6 · Audit is immutable · every step returns a new object
//   G7 · Composer never emits success language when state != VERIFIED
//   G8 · Illegal transitions throw · never silently patch
//   G9 · Correlation id assigned at EXECUTING · carried through
//   G10 · Adapter with wrong kind is a programmer error · loud throw

import { describe, expect, it } from "vitest";
import {
  createAudit,
  transition,
  isLegalTransition,
  IllegalTransitionError,
  isTerminal,
  type ActionAdapter,
  type ActionChainTarget,
  type AuthorizationState,
} from "./action-audit";
import { runActionChain } from "./action-chain";
import { openDirectoryAdapter } from "./adapters/open-directory";
import { whatsappStubAdapter }   from "./adapters/whatsapp-stub";
import {
  composeActionReply,
  findSuccessLanguageLeaks,
} from "./action-composer";

// ─── Fixtures ──────────────────────────────────────────────────────

const NOW = () => "2026-08-31T10:00:00.000Z";

const targetWithId: ActionChainTarget = {
  canonical: "Griya Sentana",
  refId: "biz_griya_sentana",
  resolvedAt: NOW(),
};

const targetWithWhatsapp: ActionChainTarget = {
  canonical: "Griya Sentana",
  refId: "biz_griya_sentana",
  contactChannel: { kind: "whatsapp", value: "+62 812 3456 7890", source: "world_record" },
  resolvedAt: NOW(),
};

const grantedAuth: AuthorizationState = {
  state: "GRANTED",
  source: "user_reply",
  at: NOW(),
  evidence: "user said 'yes send it'",
};

const requiredAuth: AuthorizationState = {
  state: "REQUIRED",
  reason: "external action requires explicit user confirmation",
};

const deniedAuth: AuthorizationState = {
  state: "DENIED",
  source: "user_reply",
  at: NOW(),
  reason: "user said 'no'",
};

// ─── G8 · Illegal transitions throw ────────────────────────────────

describe("state machine · illegal transitions throw", () => {
  it("PROPOSED → VERIFIED is illegal · throws", () => {
    const a = createAudit({
      kind: "open_directory",
      requestedByMessage: "test",
      target: targetWithId,
      authorization: grantedAuth,
      at: NOW(),
    });
    expect(() => transition(a, "VERIFIED", "bogus", NOW())).toThrow(IllegalTransitionError);
  });

  it("AUTHORIZED → EXECUTED is illegal · throws (must go through EXECUTING)", () => {
    const a = createAudit({ kind: "open_directory", requestedByMessage: "t", target: targetWithId, authorization: grantedAuth, at: NOW() });
    const b = transition(a, "AUTHORIZED", "ok", NOW());
    expect(() => transition(b, "EXECUTED", "skip executing", NOW())).toThrow(IllegalTransitionError);
  });

  it("EXECUTED → UNKNOWN is legal · EXECUTED → VERIFIED is legal · EXECUTED → BLOCKED is illegal", () => {
    expect(isLegalTransition("EXECUTED", "UNKNOWN")).toBe(true);
    expect(isLegalTransition("EXECUTED", "VERIFIED")).toBe(true);
    expect(isLegalTransition("EXECUTED", "BLOCKED")).toBe(false);
  });

  it("terminal states cannot transition out", () => {
    for (const t of ["VERIFIED", "UNKNOWN", "FAILED", "BLOCKED"] as const) {
      expect(isTerminal(t)).toBe(true);
      expect(isLegalTransition(t, "EXECUTING")).toBe(false);
      expect(isLegalTransition(t, "VERIFIED")).toBe(false);
    }
  });
});

// ─── G6 · Audit immutability ───────────────────────────────────────

describe("audit immutability", () => {
  it("transition returns a NEW object · original stage unchanged", () => {
    const a = createAudit({ kind: "open_directory", requestedByMessage: "t", target: targetWithId, authorization: grantedAuth, at: NOW() });
    const b = transition(a, "AUTHORIZED", "ok", NOW());
    expect(a.stage).toBe("PROPOSED");
    expect(b.stage).toBe("AUTHORIZED");
    expect(a).not.toBe(b);
  });
});

// ─── G1 · Authorization gates EXECUTING ────────────────────────────

describe("G1 · EXECUTING unreachable without AUTHORIZED / NOT_REQUIRED", () => {
  it("authorization REQUIRED → chain BLOCKED · never reaches EXECUTING", async () => {
    const audit = await runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "message them",
      target: targetWithWhatsapp,
      authorization: requiredAuth,
      adapter: whatsappStubAdapter,
      now: NOW,
    });
    expect(audit.finalState).toBe("BLOCKED");
    expect(audit.execution.state).toBe("PENDING"); // never advanced
    expect(audit.transitions.map((t) => t.to)).toEqual(["BLOCKED"]);
  });

  it("authorization DENIED → chain BLOCKED · adapter never called", async () => {
    let called = false;
    const spy: ActionAdapter = {
      kind: "contact_via_whatsapp",
      execute: async () => { called = true; return { kind: "accepted", pending: { correlationId: "x", awaitingKind: "not_wired", reason: "should not be called" } }; },
    };
    const audit = await runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "m",
      target: targetWithWhatsapp,
      authorization: deniedAuth,
      adapter: spy,
      now: NOW,
    });
    expect(called).toBe(false);
    expect(audit.finalState).toBe("BLOCKED");
    expect(audit.blockedReason).toContain("authorization denied");
  });
});

// ─── G2 · G3 · UNKNOWN discipline ──────────────────────────────────

describe("G2 · G3 · adapter 'accepted' → UNKNOWN · never rounded up to VERIFIED", () => {
  it("whatsapp stub always produces finalState UNKNOWN under GRANTED auth", async () => {
    const audit = await runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "message Griya Sentana",
      target: targetWithWhatsapp,
      authorization: grantedAuth,
      adapter: whatsappStubAdapter,
      now: NOW,
    });
    expect(audit.finalState).toBe("UNKNOWN");
    expect(audit.execution.state).toBe("EXECUTED");
    expect(audit.execution.outcome?.kind).toBe("accepted");
    expect(audit.verification.state).toBe("UNKNOWN");
    // Evidence array MUST be empty for UNKNOWN paths
    expect(audit.verification.evidence).toHaveLength(0);
    // delivery_evidence check MUST be recorded as failed
    const delivery = audit.verification.checks.find((c) => c.check === "delivery_evidence");
    expect(delivery?.passed).toBe(false);
  });

  it("open_directory delivers proof → VERIFIED with link_round_trip check", async () => {
    const audit = await runActionChain({
      kind: "open_directory",
      requestedByMessage: "open the directory page",
      target: targetWithId,
      authorization: { state: "NOT_REQUIRED", reason: "read-only action" },
      adapter: openDirectoryAdapter,
      now: NOW,
    });
    expect(audit.finalState).toBe("VERIFIED");
    expect(audit.verification.state).toBe("VERIFIED");
    expect(audit.verification.evidence).toHaveLength(1);
    expect(audit.verification.checks.find((c) => c.check === "link_round_trip")?.passed).toBe(true);
    expect(audit.verification.evidence[0].detail).toContain(encodeURIComponent("biz_griya_sentana"));
  });

  it("open_directory delivered but round-trip fails → downgrades to UNKNOWN honestly", async () => {
    // A malicious/broken adapter that returns "delivered" with a URL that
    // doesn't encode the target refId. The executor must NOT trust the
    // adapter's claim of delivery and must downgrade to UNKNOWN.
    const liar: ActionAdapter = {
      kind: "open_directory",
      execute: async () => ({
        kind: "delivered",
        proof: { kind: "link_round_trip", at: NOW(), detail: "/wrong/url" },
      }),
    };
    const audit = await runActionChain({
      kind: "open_directory",
      requestedByMessage: "open it",
      target: targetWithId,
      authorization: { state: "NOT_REQUIRED", reason: "read-only" },
      adapter: liar,
      now: NOW,
    });
    expect(audit.finalState).toBe("UNKNOWN");
    expect(audit.verification.checks.find((c) => c.check === "link_round_trip")?.passed).toBe(false);
  });

  it("adapter 'rejected' → FAILED with reason captured", async () => {
    const rejecter: ActionAdapter = {
      kind: "contact_via_whatsapp",
      execute: async () => ({ kind: "rejected", reason: "phone number blocked" }),
    };
    const audit = await runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "m",
      target: targetWithWhatsapp,
      authorization: grantedAuth,
      adapter: rejecter,
      now: NOW,
    });
    expect(audit.finalState).toBe("FAILED");
    expect(audit.verification.reason).toContain("phone number blocked");
  });

  it("adapter 'unreachable' → FAILED", async () => {
    const dead: ActionAdapter = {
      kind: "contact_via_whatsapp",
      execute: async () => ({ kind: "unreachable", reason: "twilio DNS lookup failed" }),
    };
    const audit = await runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "m",
      target: targetWithWhatsapp,
      authorization: grantedAuth,
      adapter: dead,
      now: NOW,
    });
    expect(audit.finalState).toBe("FAILED");
    expect(audit.verification.reason).toContain("twilio DNS");
  });
});

// ─── G4 · Adapter throw → FAILED ───────────────────────────────────

describe("G4 · adapter throw → FAILED with captured error", () => {
  it("thrown error captured on the audit · no partial-executed state", async () => {
    const flaky: ActionAdapter = {
      kind: "contact_via_whatsapp",
      execute: async () => { throw new Error("network timeout"); },
    };
    const audit = await runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "m",
      target: targetWithWhatsapp,
      authorization: grantedAuth,
      adapter: flaky,
      now: NOW,
    });
    expect(audit.finalState).toBe("FAILED");
    expect(audit.execution.state).toBe("FAILED");
    expect(audit.execution.error?.message).toBe("network timeout");
    // Chain never reached EXECUTED
    expect(audit.transitions.some((t) => t.to === "EXECUTED")).toBe(false);
  });
});

// ─── G5 · G9 · Transition trail + correlation id ───────────────────

describe("G5 · G9 · every transition captured · correlation id present", () => {
  it("VERIFIED path records PROPOSED → AUTHORIZED → EXECUTING → EXECUTED → VERIFIED", async () => {
    const audit = await runActionChain({
      kind: "open_directory",
      requestedByMessage: "open",
      target: targetWithId,
      authorization: { state: "NOT_REQUIRED", reason: "r/o" },
      adapter: openDirectoryAdapter,
      now: NOW,
    });
    const stages = audit.transitions.map((t) => t.to);
    expect(stages).toEqual(["AUTHORIZED", "EXECUTING", "EXECUTED", "VERIFIED"]);
    expect(audit.execution.correlationId).toMatch(/^corr_/);
  });

  it("UNKNOWN path records ... → UNKNOWN", async () => {
    const audit = await runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "m",
      target: targetWithWhatsapp,
      authorization: grantedAuth,
      adapter: whatsappStubAdapter,
      now: NOW,
    });
    const stages = audit.transitions.map((t) => t.to);
    expect(stages).toEqual(["AUTHORIZED", "EXECUTING", "EXECUTED", "UNKNOWN"]);
  });
});

// ─── G10 · Adapter kind mismatch is programmer error ───────────────

describe("G10 · adapter kind mismatch throws loudly", () => {
  it("running whatsapp intent with directory adapter throws", async () => {
    await expect(runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "m",
      target: targetWithWhatsapp,
      authorization: grantedAuth,
      adapter: openDirectoryAdapter, // wrong kind
      now: NOW,
    })).rejects.toThrow(/adapter kind mismatch/);
  });
});

// ─── WhatsApp adapter · refuses to guess ───────────────────────────

describe("whatsapp stub · refuses to guess a phone number", () => {
  it("no contact channel → adapter rejects → chain FAILED", async () => {
    const audit = await runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "m",
      target: targetWithId, // has no contactChannel
      authorization: grantedAuth,
      adapter: whatsappStubAdapter,
      now: NOW,
    });
    expect(audit.finalState).toBe("FAILED");
    expect(audit.verification.reason).toContain("no whatsapp contact channel");
  });

  it("garbage phone value → rejects (never guesses a number)", async () => {
    const audit = await runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "m",
      target: {
        canonical: "X",
        contactChannel: { kind: "whatsapp", value: "not a phone", source: "world_record" },
        resolvedAt: NOW(),
      },
      authorization: grantedAuth,
      adapter: whatsappStubAdapter,
      now: NOW,
    });
    expect(audit.finalState).toBe("FAILED");
    expect(audit.verification.reason).toContain("doesn't look like a phone number");
  });
});

// ─── G7 · THE LOAD-BEARING LINTER ──────────────────────────────────
// If this test ever fails, NEX is at risk of claiming success without
// evidence. Do not weaken it — fix the phrasing.

describe("G7 · composer never emits success language when finalState != VERIFIED", () => {
  const cases: {
    kind: "open_directory" | "contact_via_whatsapp";
    lang: "en" | "id";
    finalState: "UNKNOWN" | "FAILED" | "BLOCKED";
  }[] = [];
  for (const kind of ["open_directory", "contact_via_whatsapp"] as const) {
    for (const lang of ["en", "id"] as const) {
      for (const finalState of ["UNKNOWN", "FAILED", "BLOCKED"] as const) {
        cases.push({ kind, lang, finalState });
      }
    }
  }

  it.each(cases)("$kind · $lang · $finalState phrasing has NO success words", ({ kind, lang, finalState }) => {
    // Fabricate an audit at the desired terminal state via the transition
    // helper, using only LEGAL paths so the audit is realistic.
    let a = createAudit({
      kind, requestedByMessage: "t",
      target: kind === "contact_via_whatsapp" ? targetWithWhatsapp : targetWithId,
      authorization: grantedAuth, at: NOW(),
    });
    if (finalState === "BLOCKED") {
      a = transition(a, "BLOCKED", "test", NOW(), { blockedReason: "no auth" });
    } else if (finalState === "FAILED") {
      a = transition(a, "AUTHORIZED", "ok", NOW());
      a = transition(a, "EXECUTING", "start", NOW());
      a = transition(a, "FAILED", "adapter rejected: test", NOW(), {
        verification: { state: "UNVERIFIABLE", checks: [], evidence: [], reason: "adapter rejected: test" },
      });
    } else {
      // UNKNOWN
      a = transition(a, "AUTHORIZED", "ok", NOW());
      a = transition(a, "EXECUTING", "start", NOW());
      a = transition(a, "EXECUTED", "returned", NOW());
      a = transition(a, "UNKNOWN", "no proof", NOW(), {
        verification: { state: "UNKNOWN", checks: [], evidence: [], reason: "no proof" },
      });
    }

    const reply = composeActionReply(a, lang);
    const leaks = findSuccessLanguageLeaks(reply);
    if (leaks.length > 0) {
      throw new Error(
        `Success-language leak in ${kind}:${finalState}:${lang} → "${reply}" · leaked: ${leaks.join(", ")}`,
      );
    }
  });

  it("VERIFIED phrasing IS allowed to use 'delivered' / 'verified' / 'confirmed'", () => {
    // Sanity · we only forbid these words on non-VERIFIED paths.
    let a = createAudit({
      kind: "contact_via_whatsapp", requestedByMessage: "t",
      target: targetWithWhatsapp, authorization: grantedAuth, at: NOW(),
    });
    a = transition(a, "AUTHORIZED", "ok", NOW());
    a = transition(a, "EXECUTING", "s", NOW());
    a = transition(a, "EXECUTED", "r", NOW());
    a = transition(a, "VERIFIED", "confirmed", NOW(), {
      verification: {
        state: "VERIFIED", checks: [], evidence: [
          { kind: "delivery_receipt", at: NOW(), detail: "twilio delivered" },
        ], at: NOW(), reason: "delivered",
      },
    });
    const reply = composeActionReply(a, "en");
    expect(reply.toLowerCase()).toContain("delivered");
  });
});
