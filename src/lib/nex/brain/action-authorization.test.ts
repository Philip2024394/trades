// src/lib/nex/brain/action-authorization.test.ts
//
// Stage 3.37 · Action authorization doctrine tests (Philip 2026-08-31).
//
// Covers all 24 acceptance criteria from the brief that live at the
// module level (in-orchestrate criteria live in the orchestrate test
// suite). This module owns:
//   · fingerprint identity
//   · pending-proposal freshness/staleness/CONSUMED
//   · confirmation → authorization gating
//   · required-evidence check
//
// CONSTITUTIONAL: authorization A must never authorize action B.
// Locked here.

import { describe, expect, it } from "vitest";
import {
  proposalFingerprint,
  isProposalFresh,
  checkRequiredEvidence,
  decideAuthorization,
  composeProposalPrompt,
  composeAmbiguousReprompt,
  composeDeclineAck,
  composeStaleAck,
  composeMissingEvidenceReply,
  PROPOSAL_MAX_TURN_AGE,
  type PendingProposal,
} from "./action-authorization";
import { parseConfirmation } from "./confirmation-parser";
import { findSuccessLanguageLeaks } from "./action-composer";
import type { ActionChainTarget } from "./action-audit";

const NOW = () => "2026-08-31T10:00:00.000Z";

const targetWithWhatsapp: ActionChainTarget = {
  canonical: "Gaotama Hotel",
  refId: "biz_gaotama",
  contactChannel: { kind: "whatsapp", value: "+62 812 3456 7890", source: "world_record" },
  resolvedAt: NOW(),
};

const targetWithoutContact: ActionChainTarget = {
  canonical: "Griya Sentana",
  refId: "biz_griya",
  resolvedAt: NOW(),
};

// ─── Fingerprint identity ──────────────────────────────────────────

describe("proposalFingerprint · action-bound identity", () => {
  it("same inputs → same fingerprint (stable)", () => {
    const a = proposalFingerprint({
      kind: "contact_via_whatsapp",
      target: targetWithWhatsapp,
      messageBody: "Hello, do you have a room tonight?",
    });
    const b = proposalFingerprint({
      kind: "contact_via_whatsapp",
      target: targetWithWhatsapp,
      messageBody: "Hello, do you have a room tonight?",
    });
    expect(a).toBe(b);
  });

  it("different target refId → different fingerprint", () => {
    const a = proposalFingerprint({ kind: "contact_via_whatsapp", target: targetWithWhatsapp, messageBody: "m" });
    const b = proposalFingerprint({
      kind: "contact_via_whatsapp",
      target: { ...targetWithWhatsapp, refId: "biz_other", canonical: "Other Hotel" },
      messageBody: "m",
    });
    expect(a).not.toBe(b);
  });

  it("different message body → different fingerprint", () => {
    const a = proposalFingerprint({ kind: "contact_via_whatsapp", target: targetWithWhatsapp, messageBody: "tonight" });
    const b = proposalFingerprint({ kind: "contact_via_whatsapp", target: targetWithWhatsapp, messageBody: "tomorrow" });
    expect(a).not.toBe(b);
  });

  it("different phone number → different fingerprint", () => {
    const a = proposalFingerprint({ kind: "contact_via_whatsapp", target: targetWithWhatsapp, messageBody: "m" });
    const b = proposalFingerprint({
      kind: "contact_via_whatsapp",
      target: {
        ...targetWithWhatsapp,
        contactChannel: { kind: "whatsapp", value: "+62 999 9999 9999", source: "world_record" },
      },
      messageBody: "m",
    });
    expect(a).not.toBe(b);
  });

  it("different kind → different fingerprint", () => {
    const a = proposalFingerprint({ kind: "contact_via_whatsapp", target: targetWithWhatsapp, messageBody: "m" });
    const b = proposalFingerprint({ kind: "open_directory", target: targetWithWhatsapp, messageBody: "m" });
    expect(a).not.toBe(b);
  });
});

// ─── Required-evidence gate ────────────────────────────────────────

describe("checkRequiredEvidence · blocks BEFORE proposal", () => {
  it("whatsapp intent WITHOUT contact channel → insufficient", () => {
    const r = checkRequiredEvidence("contact_via_whatsapp", targetWithoutContact);
    expect(r.sufficient).toBe(false);
    if (!r.sufficient) expect(r.reason).toContain("no verified whatsapp");
  });

  it("whatsapp intent WITH valid channel → sufficient", () => {
    const r = checkRequiredEvidence("contact_via_whatsapp", targetWithWhatsapp);
    expect(r.sufficient).toBe(true);
  });

  it("open_directory with refId → sufficient", () => {
    const r = checkRequiredEvidence("open_directory", targetWithoutContact);
    expect(r.sufficient).toBe(true);
  });

  it("empty whatsapp value → insufficient (never guesses)", () => {
    const r = checkRequiredEvidence("contact_via_whatsapp", {
      canonical: "X",
      contactChannel: { kind: "whatsapp", value: "   ", source: "world_record" },
      resolvedAt: NOW(),
    });
    expect(r.sufficient).toBe(false);
  });
});

// ─── decideAuthorization · the single decision point ──────────────

describe("decideAuthorization · outcome=AWAIT_CONFIRMATION on first action turn", () => {
  it("no pending proposal · fresh action request → AWAIT_CONFIRMATION · mints proposal · does NOT authorize", () => {
    const decision = decideAuthorization({
      requestedKind: "contact_via_whatsapp",
      requestedTarget: targetWithWhatsapp,
      messageBody: "Hello, do you have a room tonight?",
      message: "message this hotel and ask about tonight",
      currentTurn: 1,
      pendingProposal: null,
      confirmationResult: undefined,
      now: NOW,
    });
    expect(decision.outcome).toBe("AWAIT_CONFIRMATION");
    if (decision.outcome === "AWAIT_CONFIRMATION") {
      expect(decision.proposal.status).toBe("AWAITING");
      expect(decision.proposal.fingerprint).toHaveLength(16);
    }
  });
});

describe("decideAuthorization · outcome=PROCEED_WITH_AUTH on explicit CONFIRM against matching fingerprint", () => {
  it("pending proposal + CONFIRM + matching fingerprint → GRANTED", () => {
    const fp = proposalFingerprint({
      kind: "contact_via_whatsapp", target: targetWithWhatsapp, messageBody: "hi",
    });
    const pending: PendingProposal = {
      fingerprint: fp,
      actionId: "act_x",
      kind: "contact_via_whatsapp",
      target: targetWithWhatsapp,
      messageBody: "hi",
      proposedAt: Date.now(),
      proposedInTurn: 1,
      status: "AWAITING",
    };
    const decision = decideAuthorization({
      requestedKind: "contact_via_whatsapp",
      requestedTarget: targetWithWhatsapp,
      messageBody: "hi",
      message: "yes send it",
      currentTurn: 2,
      pendingProposal: pending,
      confirmationResult: parseConfirmation("yes send it"),
      now: NOW,
    });
    expect(decision.outcome).toBe("PROCEED_WITH_AUTH");
    if (decision.outcome === "PROCEED_WITH_AUTH") {
      expect(decision.auth.state).toBe("GRANTED");
      if (decision.auth.state === "GRANTED") {
        expect(decision.auth.evidence).toContain(pending.fingerprint);
      }
    }
  });
});

describe("decideAuthorization · CONSUMED proposal · REPLAY GUARD", () => {
  it("user says 'yes' again after CONSUMED · outcome=STALE_OR_MISMATCHED · never re-authorizes", () => {
    const fp = proposalFingerprint({ kind: "contact_via_whatsapp", target: targetWithWhatsapp, messageBody: "hi" });
    const consumed: PendingProposal = {
      fingerprint: fp,
      actionId: "act_x",
      kind: "contact_via_whatsapp",
      target: targetWithWhatsapp,
      messageBody: "hi",
      proposedAt: Date.now(),
      proposedInTurn: 1,
      status: "CONSUMED",
    };
    const decision = decideAuthorization({
      requestedKind: "contact_via_whatsapp",
      requestedTarget: targetWithWhatsapp,
      messageBody: "hi",
      message: "yes",
      currentTurn: 3,
      pendingProposal: consumed,
      confirmationResult: parseConfirmation("yes"),
      now: NOW,
    });
    expect(decision.outcome).toBe("STALE_OR_MISMATCHED");
    if (decision.outcome === "STALE_OR_MISMATCHED") {
      expect(decision.reason.toLowerCase()).toContain("replay protection");
    }
  });
});

describe("decideAuthorization · fingerprint mismatch never authorizes", () => {
  it("pending is for Hotel A · user confirms while target is Hotel B → STALE_OR_MISMATCHED (auth does NOT carry across)", () => {
    const pending: PendingProposal = {
      fingerprint: proposalFingerprint({ kind: "contact_via_whatsapp", target: targetWithWhatsapp, messageBody: "hi" }),
      actionId: "act_x",
      kind: "contact_via_whatsapp",
      target: targetWithWhatsapp,          // Gaotama
      messageBody: "hi",
      proposedAt: Date.now(),
      proposedInTurn: 1,
      status: "AWAITING",
    };
    const differentTarget: ActionChainTarget = {
      canonical: "Indonesia Hotel",
      refId: "biz_indonesia",
      contactChannel: { kind: "whatsapp", value: "+62 999 8888 7777", source: "world_record" },
      resolvedAt: NOW(),
    };
    const decision = decideAuthorization({
      requestedKind: "contact_via_whatsapp",
      requestedTarget: differentTarget,     // Indonesia · DIFFERENT
      messageBody: "hi",
      message: "yes",
      currentTurn: 2,
      pendingProposal: pending,
      confirmationResult: parseConfirmation("yes"),
      now: NOW,
    });
    expect(decision.outcome).toBe("STALE_OR_MISMATCHED");
  });

  it("message body changes · old auth invalidated · new AWAIT_CONFIRMATION (implicit through NOT PROCEED)", () => {
    const pending: PendingProposal = {
      fingerprint: proposalFingerprint({ kind: "contact_via_whatsapp", target: targetWithWhatsapp, messageBody: "tonight" }),
      actionId: "act_x",
      kind: "contact_via_whatsapp",
      target: targetWithWhatsapp,
      messageBody: "tonight",
      proposedAt: Date.now(),
      proposedInTurn: 1,
      status: "AWAITING",
    };
    // User says yes but this turn's request is a DIFFERENT message body
    const decision = decideAuthorization({
      requestedKind: "contact_via_whatsapp",
      requestedTarget: targetWithWhatsapp,
      messageBody: "tomorrow",              // CHANGED
      message: "yes",
      currentTurn: 2,
      pendingProposal: pending,
      confirmationResult: parseConfirmation("yes"),
      now: NOW,
    });
    expect(decision.outcome).toBe("STALE_OR_MISMATCHED");
  });
});

describe("decideAuthorization · AMBIGUOUS never authorizes", () => {
  it.each(["okay", "sure", "fine", "maybe", "oke"])(
    "pending proposal + '%s' → AMBIGUOUS_NEEDS_CLARIFICATION (no GRANT)",
    (word) => {
      const pending: PendingProposal = {
        fingerprint: "fp1", actionId: "a1", kind: "contact_via_whatsapp",
        target: targetWithWhatsapp, messageBody: "hi", proposedAt: 0, proposedInTurn: 1, status: "AWAITING",
      };
      const decision = decideAuthorization({
        requestedKind: "contact_via_whatsapp", requestedTarget: targetWithWhatsapp, messageBody: "hi",
        message: word, currentTurn: 2, pendingProposal: pending,
        confirmationResult: parseConfirmation(word), now: NOW,
      });
      expect(decision.outcome).toBe("AMBIGUOUS_NEEDS_CLARIFICATION");
    },
  );
});

describe("decideAuthorization · DECLINE → DENIED", () => {
  it("pending proposal + 'no' → outcome=DECLINED · auth.state=DENIED", () => {
    const pending: PendingProposal = {
      fingerprint: "fp1", actionId: "a1", kind: "contact_via_whatsapp",
      target: targetWithWhatsapp, messageBody: "hi", proposedAt: 0, proposedInTurn: 1, status: "AWAITING",
    };
    const decision = decideAuthorization({
      requestedKind: "contact_via_whatsapp", requestedTarget: targetWithWhatsapp, messageBody: "hi",
      message: "no", currentTurn: 2, pendingProposal: pending,
      confirmationResult: parseConfirmation("no"), now: NOW,
    });
    expect(decision.outcome).toBe("DECLINED");
    if (decision.outcome === "DECLINED") expect(decision.auth.state).toBe("DENIED");
  });
});

describe("decideAuthorization · missing evidence blocks BEFORE proposal", () => {
  it("whatsapp intent + target with no contact channel → BLOCKED_MISSING_EVIDENCE · no proposal minted", () => {
    const decision = decideAuthorization({
      requestedKind: "contact_via_whatsapp",
      requestedTarget: targetWithoutContact,
      messageBody: "hi",
      message: "message this hotel",
      currentTurn: 1,
      pendingProposal: null,
      confirmationResult: undefined,
      now: NOW,
    });
    expect(decision.outcome).toBe("BLOCKED_MISSING_EVIDENCE");
  });
});

// ─── Freshness ─────────────────────────────────────────────────────

describe("isProposalFresh · staleness gate", () => {
  const base: PendingProposal = {
    fingerprint: "fp", actionId: "a", kind: "contact_via_whatsapp",
    target: targetWithWhatsapp, messageBody: "hi", proposedAt: 0, proposedInTurn: 1, status: "AWAITING",
  };

  it("within max age · fresh", () => {
    expect(isProposalFresh(base, 1)).toBe(true);
    expect(isProposalFresh(base, 1 + PROPOSAL_MAX_TURN_AGE)).toBe(true);
  });

  it("beyond max age · stale", () => {
    expect(isProposalFresh(base, 1 + PROPOSAL_MAX_TURN_AGE + 1)).toBe(false);
  });

  it("CONSUMED never fresh regardless of turn age", () => {
    expect(isProposalFresh({ ...base, status: "CONSUMED" }, 2)).toBe(false);
  });

  it("EXPIRED never fresh", () => {
    expect(isProposalFresh({ ...base, status: "EXPIRED" }, 2)).toBe(false);
  });
});

describe("decideAuthorization · beyond max turn age · STALE_OR_MISMATCHED", () => {
  it("user says 'yes' but proposal is 6+ turns old → STALE", () => {
    const pending: PendingProposal = {
      fingerprint: proposalFingerprint({ kind: "contact_via_whatsapp", target: targetWithWhatsapp, messageBody: "hi" }),
      actionId: "a1", kind: "contact_via_whatsapp",
      target: targetWithWhatsapp, messageBody: "hi",
      proposedAt: 0, proposedInTurn: 1, status: "AWAITING",
    };
    const decision = decideAuthorization({
      requestedKind: "contact_via_whatsapp", requestedTarget: targetWithWhatsapp, messageBody: "hi",
      message: "yes", currentTurn: 1 + PROPOSAL_MAX_TURN_AGE + 1,
      pendingProposal: pending,
      confirmationResult: parseConfirmation("yes"), now: NOW,
    });
    expect(decision.outcome).toBe("STALE_OR_MISMATCHED");
  });
});

// ─── Composer texts obey G7 ───────────────────────────────────────

describe("composers · no success language in prompts / declines / stale / missing-evidence", () => {
  const pending: PendingProposal = {
    fingerprint: "fp", actionId: "a", kind: "contact_via_whatsapp",
    target: targetWithWhatsapp, messageBody: "Hello, do you have a room tonight?",
    proposedAt: 0, proposedInTurn: 1, status: "AWAITING",
  };

  it("composeProposalPrompt EN · no success words", () => {
    const t = composeProposalPrompt(pending, "en");
    expect(findSuccessLanguageLeaks(t)).toEqual([]);
    expect(t).toContain("Shall I send it?");
  });

  it("composeProposalPrompt ID · no success words", () => {
    const t = composeProposalPrompt(pending, "id");
    expect(findSuccessLanguageLeaks(t)).toEqual([]);
    expect(t).toContain("Kirim?");
  });

  it("composeDeclineAck · no success words · bilingual", () => {
    for (const lang of ["en", "id"] as const) {
      const t = composeDeclineAck(pending, lang);
      expect(findSuccessLanguageLeaks(t)).toEqual([]);
    }
  });

  it("composeAmbiguousReprompt · no success words · bilingual", () => {
    for (const lang of ["en", "id"] as const) {
      const t = composeAmbiguousReprompt(pending, lang);
      expect(findSuccessLanguageLeaks(t)).toEqual([]);
    }
  });

  it("composeStaleAck · no success words · bilingual", () => {
    for (const lang of ["en", "id"] as const) {
      const t = composeStaleAck("proposal expired", lang);
      expect(findSuccessLanguageLeaks(t)).toEqual([]);
    }
  });

  it("composeMissingEvidenceReply · never claims a number · never says 'sent'", () => {
    for (const lang of ["en", "id"] as const) {
      const t = composeMissingEvidenceReply("no verified whatsapp channel", targetWithoutContact, lang);
      expect(findSuccessLanguageLeaks(t)).toEqual([]);
      expect(t.toLowerCase()).toContain(lang === "id" ? "tidak akan mengarang nomor" : "won't guess a number");
    }
  });
});
