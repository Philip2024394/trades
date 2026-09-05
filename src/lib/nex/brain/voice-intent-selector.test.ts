// src/lib/nex/brain/voice-intent-selector.test.ts
//
// Stage 3.41 · Voice intent selector doctrine tests.

import { describe, expect, it } from "vitest";
import { selectVoiceIntent } from "./voice-intent-selector";
import type { BrainReply } from "./orchestrate";
import type { PendingProposal } from "./action-authorization";
import { renderVoice } from "./personality-voice";
import { findSuccessLanguageLeaks } from "./action-composer";

function makeBrain(overrides: Partial<BrainReply>): BrainReply {
  return {
    reply: "",
    intent: null,
    intent_reason: null,
    suggestions: [],
    ...overrides,
  } as BrainReply;
}

const NOW = "2026-08-31T10:00:00.000Z";

// ─── Terminal action audit takes precedence ───────────────────────

describe("selector · action_audit terminal state wins", () => {
  it.each([
    ["VERIFIED", "action_verified"],
    ["UNKNOWN",  "action_unknown"],
    ["FAILED",   "action_failed"],
    ["BLOCKED",  "action_blocked"],
  ] as const)("finalState=%s → intent=%s", (finalState, intent) => {
    const brain = makeBrain({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      action_audit: {
        finalState, stage: finalState,
        target: { canonical: "Gaotama Hotel", resolvedAt: NOW },
        verification: { state: "VERIFIED", checks: [], evidence: [], reason: "test" },
      } as any,
    });
    const plea = selectVoiceIntent({ brain, message: "yes" });
    expect(plea.intent).toBe(intent);
    // Render it and verify G7 still holds
    const voice = renderVoice(plea);
    if (finalState !== "VERIFIED") {
      expect(findSuccessLanguageLeaks(voice.en)).toEqual([]);
      expect(findSuccessLanguageLeaks(voice.id)).toEqual([]);
    }
  });
});

// ─── Awaiting proposal ────────────────────────────────────────────

describe("selector · pending AWAITING proposal → propose_action", () => {
  it("mints propose_action intent with target + message body", () => {
    const brain = makeBrain({ reply: "I can send a WhatsApp to Gaotama Hotel: '...' Shall I send it?" });
    const pending: PendingProposal = {
      fingerprint: "fp", actionId: "a1", kind: "contact_via_whatsapp",
      target: { canonical: "Gaotama Hotel", resolvedAt: NOW,
        contactChannel: { kind: "whatsapp", value: "+62812", source: "world_record" } },
      messageBody: "Hello?",
      proposedAt: 0, proposedInTurn: 1, status: "AWAITING",
    };
    const plea = selectVoiceIntent({ brain, pendingProposal: pending, message: "message this hotel" });
    expect(plea.intent).toBe("propose_action");
    expect(plea.content.targetName).toBe("Gaotama Hotel");
    expect(plea.content.message).toBe("Hello?");
  });
});

// ─── Reasoning coverage ───────────────────────────────────────────

describe("selector · world_reasoning · partial vs full vs zero coverage", () => {
  it("partial coverage → reasoning_partial + missingFields threaded", () => {
    const brain = makeBrain({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      world_reasoning: {
        reasoned: true, evidenceCoverage: 0.33,
        constraints: [], unsupportedGlobally: ["price", "rating"],
        pick: { name: "Indonesia Hotel" },
        pickEvaluation: {
          constraintEvaluations: [
            { evidence: "supported", constraint: { kind: "distance_from_area", detail: "malioboro" } },
          ],
        },
      } as any,
    });
    const plea = selectVoiceIntent({ brain, message: "which is best" });
    expect(plea.intent).toBe("reasoning_partial");
    expect(plea.content.pickName).toBe("Indonesia Hotel");
    expect(plea.content.missingFields).toEqual(["price", "rating"]);
    // The gap sentence should appear in the friend-voice output
    const voice = renderVoice(plea);
    expect(voice.en).toMatch(/can't see price, rating|can't see price/i);
  });

  it("full coverage → reasoning_full", () => {
    const brain = makeBrain({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      world_reasoning: { reasoned: true, evidenceCoverage: 1.0, constraints: [], unsupportedGlobally: [], pick: { name: "X" } } as any,
    });
    expect(selectVoiceIntent({ brain, message: "which is best" }).intent).toBe("reasoning_full");
  });

  it("zero coverage → reasoning_zero", () => {
    const brain = makeBrain({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      world_reasoning: { reasoned: true, evidenceCoverage: 0, constraints: [], unsupportedGlobally: ["price", "rating"] } as any,
    });
    expect(selectVoiceIntent({ brain, message: "which is best" }).intent).toBe("reasoning_zero");
  });
});

// ─── Recommendation ───────────────────────────────────────────────

describe("selector · world_recommendation.recommended → recommendation_pick", () => {
  it("threads honestGaps as missingFields", () => {
    const brain = makeBrain({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      world_recommendation: {
        recommended: true, pick: { name: "Griya Sentana" },
        primarySignal: "area_proximity", honestGaps: ["price"],
        pickReason: "closest at 0.20km from malioboro",
      } as any,
    });
    const plea = selectVoiceIntent({ brain, message: "what would you recommend" });
    expect(plea.intent).toBe("recommendation_pick");
    expect(plea.content.pickName).toBe("Griya Sentana");
    expect(plea.content.missingFields).toEqual(["price"]);
  });

  it("no_ranking_signal → recommendation_no_signal", () => {
    const brain = makeBrain({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      world_recommendation: { recommended: false, reason: "no_ranking_signal" } as any,
    });
    expect(selectVoiceIntent({ brain, message: "recommend one" }).intent).toBe("recommendation_no_signal");
  });
});

// ─── Discovery ────────────────────────────────────────────────────

describe("selector · discovery", () => {
  it("world_cards with records → discovery_hit with count", () => {
    const brain = makeBrain({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      world_cards: { records: [{}, {}, {}] } as any,
    });
    const plea = selectVoiceIntent({ brain, message: "hotels near malioboro" });
    expect(plea.intent).toBe("discovery_hit");
    expect(plea.content.count).toBe(3);
  });

  it("wired world + zero records → discovery_empty", () => {
    const brain = makeBrain({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tool_selection: { category: "world", toolId: "world:accommodation", reason: "x", precedenceRank: 6, requiredInputs: [], optionalInputs: [], evidenceRequirements: [], readOnly: true, performsExternalAction: false, verificationRequired: false, parameters: {} } as any,
    });
    expect(selectVoiceIntent({ brain, message: "hotels" }).intent).toBe("discovery_empty");
  });
});

// ─── Tool router fallbacks ────────────────────────────────────────

describe("selector · tool_selection fallbacks", () => {
  it("ambiguous → clarify_ambiguous", () => {
    const brain = makeBrain({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tool_selection: { category: "ambiguous" } as any,
    });
    expect(selectVoiceIntent({ brain, message: "help" }).intent).toBe("clarify_ambiguous");
  });

  it("unsupported → unsupported", () => {
    const brain = makeBrain({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tool_selection: { category: "unsupported" } as any,
    });
    expect(selectVoiceIntent({ brain, message: "please arrange dry cleaning" }).intent).toBe("unsupported");
  });
});

// ─── Greeting / fallback ──────────────────────────────────────────

describe("selector · greeting fallback", () => {
  it.each(["hi", "hello", "hey", "halo", "hai", "yo", "  "])("'%s' with no signals → greeting", (msg) => {
    expect(selectVoiceIntent({ brain: makeBrain({}), message: msg }).intent).toBe("greeting");
  });

  it("unmatched non-greeting → clarify_ambiguous fallback", () => {
    expect(selectVoiceIntent({ brain: makeBrain({}), message: "xyzabc123" }).intent).toBe("clarify_ambiguous");
  });
});

// ─── Precedence (audit beats everything) ──────────────────────────

describe("selector · precedence · action_audit beats reasoning/recommendation/discovery", () => {
  it("both audit and reasoning present → audit wins", () => {
    const brain = makeBrain({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      action_audit: { finalState: "UNKNOWN", stage: "UNKNOWN",
        target: { canonical: "X", resolvedAt: NOW },
        verification: { state: "UNKNOWN", checks: [], evidence: [] } } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      world_reasoning: { reasoned: true, evidenceCoverage: 1.0, pick: { name: "Y" }, constraints: [], unsupportedGlobally: [] } as any,
    });
    expect(selectVoiceIntent({ brain, message: "yes" }).intent).toBe("action_unknown");
  });
});
