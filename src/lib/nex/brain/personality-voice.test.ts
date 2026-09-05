// src/lib/nex/brain/personality-voice.test.ts
//
// Stage 3.40 · Personality voice layer doctrine tests (Philip 2026-08-31).
//
// CONSTITUTIONAL guarantees (must ALL stay green):
//
//   V1  · Mode auto-selection is deterministic per intent
//   V2  · TASK intents (action/auth) → TASK mode by default
//   V3  · HANGOUT intents (discovery/reasoning/etc) → HANGOUT by default
//   V4  · Manual mode override honored
//   V5  · G7 preserved · no success language when intent != action_verified
//   V6  · Anti-slang · no BROOO / LETS GO / 3+ emoji stacks / 3+ !!! stacks
//   V7  · Honest-gap phrasing appears when missingFields present
//   V8  · No corporate stock phrases in HANGOUT ("How may I assist...")
//   V9  · Bilingual · every intent has both EN + ID output (no empty)
//   V10 · Renderer THROWS if a phrasing accidentally leaks success words

import { describe, expect, it } from "vitest";
import {
  renderVoice,
  selectMode,
  findOverSlang,
  OVER_SLANG_BLACKLIST,
  type VoiceIntent,
} from "./personality-voice";
import { findSuccessLanguageLeaks } from "./action-composer";

// ─── V1 · V2 · V3 · V4 · deterministic mode selection ─────────────

describe("V1-V4 · mode selection is deterministic", () => {
  const taskIntents: VoiceIntent[] = [
    "propose_action", "auth_ambiguous", "auth_declined",
    "action_verified", "action_unknown", "action_failed", "action_blocked",
  ];
  const hangoutIntents: VoiceIntent[] = [
    "greeting", "acknowledge_slot", "discovery_hit", "discovery_empty",
    "recommendation_pick", "recommendation_no_signal",
    "comparison_result", "reasoning_partial", "reasoning_full", "reasoning_zero",
    "clarify_ambiguous", "unsupported", "honest_gap",
  ];

  it.each(taskIntents)("V2 · task intent '%s' → TASK mode", (intent) => {
    expect(selectMode(intent)).toBe("TASK");
  });
  it.each(hangoutIntents)("V3 · hangout intent '%s' → HANGOUT mode", (intent) => {
    expect(selectMode(intent)).toBe("HANGOUT");
  });
  it("V4 · manual override honored · propose_action forced to HANGOUT", () => {
    expect(selectMode("propose_action", "HANGOUT")).toBe("HANGOUT");
  });
  it("V4 · manual override honored · greeting forced to TASK", () => {
    expect(selectMode("greeting", "TASK")).toBe("TASK");
  });
  it("V1 · same intent same override always yields same mode", () => {
    for (const i of [...taskIntents, ...hangoutIntents]) {
      const first  = selectMode(i);
      const second = selectMode(i);
      expect(first).toBe(second);
    }
  });
});

// ─── V5 · G7 preserved · no success language when non-VERIFIED ────
//
// THE LOAD-BEARING RULE. Sweeps every phrasing in every mode/lang
// combination against the composer's SUCCESS_LANGUAGE_BLACKLIST.
// If ANY hangout/task string produces a leak on a non-VERIFIED intent,
// this test fails · fixing it means rewording the phrasing, never
// weakening the blacklist.

describe("V5 · G7 preserved · voice never smuggles success language into non-VERIFIED", () => {
  const nonVerifiedIntents: VoiceIntent[] = [
    "greeting", "acknowledge_slot", "discovery_hit", "discovery_empty",
    "recommendation_pick", "recommendation_no_signal",
    "comparison_result", "reasoning_partial", "reasoning_full", "reasoning_zero",
    "propose_action", "auth_ambiguous", "auth_declined",
    "action_unknown", "action_failed", "action_blocked",
    "clarify_ambiguous", "unsupported", "honest_gap",
  ];

  it.each(nonVerifiedIntents)("no success words in '%s' · EN + ID", (intent) => {
    const out = renderVoice({
      intent,
      content: {
        targetName:    "Gaotama Hotel",
        count:         3,
        pickName:      "Gaotama Hotel",
        pickDetail:    "closest at 0.14km",
        missingFields: ["price", "rating"],
        reason:        "test reason",
        message:       "test body",
        slotSummary:   "cheap · near Malioboro",
        items:         ["A", "B", "C"],
      },
    });
    expect(findSuccessLanguageLeaks(out.en)).toEqual([]);
    expect(findSuccessLanguageLeaks(out.id)).toEqual([]);
  });

  it("action_verified · IS allowed to say 'delivered' / 'verified' / 'terverifikasi'", () => {
    const out = renderVoice({ intent: "action_verified", content: { targetName: "X" } });
    expect(out.en.toLowerCase()).toContain("delivered");
    // ID reply may say "terverifikasi" · not "terkirim" alone
    expect(out.id.toLowerCase()).toContain("sudah nyampai");
  });
});

// ─── V6 · anti-slang · no desperate-teenager style ────────────────

describe("V6 · anti-slang · no BROOO / LETS GO / emoji stacks", () => {
  const allIntents: VoiceIntent[] = [
    "greeting", "acknowledge_slot", "discovery_hit", "discovery_empty",
    "recommendation_pick", "recommendation_no_signal",
    "comparison_result", "reasoning_partial", "reasoning_full", "reasoning_zero",
    "propose_action", "auth_ambiguous", "auth_declined",
    "action_verified", "action_unknown", "action_failed", "action_blocked",
    "clarify_ambiguous", "unsupported", "honest_gap",
  ];

  it.each(allIntents)("no over-slang in '%s' output", (intent) => {
    const out = renderVoice({
      intent,
      content: {
        targetName: "Gaotama Hotel", count: 3,
        pickName: "Gaotama Hotel", pickDetail: "closest at 0.14km",
        missingFields: ["price"], reason: "x", message: "hi",
        slotSummary: "cheap", items: ["A", "B"],
      },
    });
    expect(findOverSlang(out.en)).toEqual([]);
    expect(findOverSlang(out.id)).toEqual([]);
  });

  it("findOverSlang catches the anti-patterns explicitly (self-test)", () => {
    expect(findOverSlang("BROOOO LET'S GOOOO 🔥🔥🔥")).not.toEqual([]);
    expect(findOverSlang("YAAAS LIT 😂😂😂😂")).not.toEqual([]);
    expect(findOverSlang("!!!! ????")).not.toEqual([]);
    expect(findOverSlang("fr fr")).not.toEqual([]);
  });

  it("blacklist has meaningful entries (regression against silent shrinkage)", () => {
    expect(OVER_SLANG_BLACKLIST.length).toBeGreaterThanOrEqual(10);
  });
});

// ─── V7 · honest gap phrasing when missingFields present ──────────

describe("V7 · honest-gap phrasing renders the 'can't see X, not gonna BS you' line", () => {
  it("EN recommendation with missing price → honest gap sentence present", () => {
    const out = renderVoice({
      intent: "recommendation_pick",
      content: { pickName: "Indonesia Hotel", pickDetail: "closest at 0.14km", missingFields: ["price"] },
    });
    expect(out.en).toContain("Indonesia Hotel");
    expect(out.en).toContain("0.14km");
    expect(out.en).toMatch(/can't see price/);
    expect(out.en).toMatch(/not gonna make that part up/);
  });

  it("ID recommendation with missing price + rating → honest gap sentence in ID", () => {
    const out = renderVoice({
      intent: "recommendation_pick",
      content: { pickName: "Indonesia Hotel", pickDetail: "paling dekat 0.14km", missingFields: ["price", "rating"] },
    });
    expect(out.id).toContain("Indonesia Hotel");
    expect(out.id).toContain("belum kelihatan");
    expect(out.id).toContain("nggak akan saya karang");
  });

  it("honest_gap intent alone renders just the gap sentence", () => {
    const out = renderVoice({
      intent: "honest_gap",
      content: { missingFields: ["price"] },
    });
    expect(out.en).toMatch(/can't see price/);
    expect(out.id).toMatch(/price belum kelihatan/);
  });

  it("no missingFields → no honest-gap sentence appended (never invents one)", () => {
    const out = renderVoice({
      intent: "recommendation_pick",
      content: { pickName: "X", pickDetail: "closest" },
    });
    expect(out.en).not.toMatch(/can't see/);
    expect(out.id).not.toMatch(/belum kelihatan/);
  });
});

// ─── V8 · no corporate stock phrases ──────────────────────────────

describe("V8 · no corporate stock phrases in HANGOUT", () => {
  const CORPORATE_BLACKLIST: RegExp[] = [
    /how may I assist you/i,
    /your request has been processed/i,
    /I have identified/i,
    /I would like to inform you/i,
    /please be advised/i,
    /pada kesempatan ini/i,
    /dengan hormat/i,
    /perkenankan saya/i,
  ];
  const hangoutIntents: VoiceIntent[] = [
    "greeting", "acknowledge_slot", "discovery_hit", "discovery_empty",
    "recommendation_pick", "recommendation_no_signal",
    "comparison_result", "reasoning_partial", "reasoning_full", "reasoning_zero",
    "clarify_ambiguous", "unsupported", "honest_gap",
  ];

  it.each(hangoutIntents)("no corporate phrasing in HANGOUT '%s'", (intent) => {
    const out = renderVoice({
      intent,
      content: {
        pickName: "X", pickDetail: "y", missingFields: ["price"],
        count: 2, slotSummary: "cheap · near Malioboro",
        items: ["A", "B"], targetName: "Z",
      },
    });
    for (const rx of CORPORATE_BLACKLIST) {
      expect(out.en).not.toMatch(rx);
      expect(out.id).not.toMatch(rx);
    }
  });
});

// ─── V9 · bilingual · every intent produces non-empty EN and ID ───

describe("V9 · every intent produces non-empty EN and ID output", () => {
  const allIntents: VoiceIntent[] = [
    "greeting", "acknowledge_slot", "discovery_hit", "discovery_empty",
    "recommendation_pick", "recommendation_no_signal",
    "comparison_result", "reasoning_partial", "reasoning_full", "reasoning_zero",
    "propose_action", "auth_ambiguous", "auth_declined",
    "action_verified", "action_unknown", "action_failed", "action_blocked",
    "clarify_ambiguous", "unsupported", "honest_gap",
  ];
  it.each(allIntents)("'%s' has non-empty EN + ID", (intent) => {
    const out = renderVoice({
      intent,
      content: {
        targetName: "X", pickName: "Y", pickDetail: "closest",
        missingFields: ["price"], reason: "r", message: "m",
        slotSummary: "s", items: ["a"], count: 1,
      },
    });
    expect(out.en.length).toBeGreaterThan(0);
    expect(out.id.length).toBeGreaterThan(0);
  });
});

// ─── V10 · renderer safety net · throws if a phrasing leaks ───────

describe("V10 · renderer THROWS if a future phrasing accidentally leaks G7", () => {
  it("known-clean phrasings never throw", () => {
    for (const intent of ["greeting", "discovery_hit", "propose_action", "action_unknown", "action_blocked"] as VoiceIntent[]) {
      expect(() => renderVoice({
        intent,
        content: { targetName: "X", pickName: "Y", pickDetail: "z", message: "hi", count: 1 },
      })).not.toThrow();
    }
  });
});

// ─── V11 · semantic-preservation · HANGOUT cannot change the meaning ───
//
// From Philip 2026-08-31:
//   "Never allow HANGOUT mode to change the semantic meaning of the
//    underlying answer."
//
// Truth: Price unknown.
// ❌ "Looks cheap!"  (semantic upgrade · forbidden regardless of tone)
// ✅ "Can't see the price, so I'm not gonna BS you"  (same truth,
//    friendlier voice · this is what NEX does)
//
// This test locks the rule at the boundary: when the structured
// content says a field is missing/unknown, the voice output MUST NOT
// contain a positive claim about that same field.

describe("V11 · semantic-preservation · HANGOUT never upgrades an UNKNOWN into a positive claim", () => {
  // Words that would constitute a POSITIVE CLAIM about the missing field.
  // We sweep the voice output for these anytime the field appears in missingFields.
  const POSITIVE_CLAIMS: Record<string, RegExp[]> = {
    price:  [/\bcheap\b/i, /\baffordable\b/i, /\bbudget\b/i, /\bexpensive\b/i, /\bmurah\b/i, /\bmahal\b/i, /\bekonomis\b/i],
    rating: [/\btop[- ]?rated\b/i, /\bbest[- ]?rated\b/i, /\bhighly\s+rated\b/i, /\bexcellent\s+ratings?\b/i, /\bbintang\s+lima\b/i, /\brating\s+tinggi\b/i],
    reviews:[/\bwell[- ]?reviewed\b/i, /\bmany\s+reviews\b/i, /\bpopular\b/i, /\bbanyak\s+ulasan\b/i, /\bpopuler\b/i],
    distance:[/\bright\s+next\s+to\b/i, /\bwalking\s+distance\b/i, /\bvery\s+close\b/i, /\bnearby\b/i, /\bsangat\s+dekat\b/i],
  };

  const missingFieldCases: Array<{ field: string; content: import("./personality-voice").VoiceContent }> = [
    { field: "price",    content: { pickName: "Indonesia Hotel", pickDetail: "closest at 0.14km", missingFields: ["price"] } },
    { field: "rating",   content: { pickName: "Griya Sentana",   pickDetail: "cheapest at Rp 300k", missingFields: ["rating"] } },
    { field: "reviews",  content: { pickName: "Gaotama Hotel",   pickDetail: "walking distance to the tram", missingFields: ["reviews"] } },
    { field: "distance", content: { pickName: "Summer Season",   pickDetail: "rated 4.7", missingFields: ["distance"] } },
  ];

  it.each(missingFieldCases)("recommendation_pick · missing $field → no positive claim about that field in EN or ID", ({ field, content }) => {
    const out = renderVoice({ intent: "recommendation_pick", content });
    const claims = POSITIVE_CLAIMS[field];
    for (const rx of claims) {
      const enHit = out.en.match(rx);
      const idHit = out.id.match(rx);
      if (enHit) throw new Error(`SEMANTIC UPGRADE (EN): missing "${field}" but voice said "${enHit[0]}" · ${out.en}`);
      if (idHit) throw new Error(`SEMANTIC UPGRADE (ID): missing "${field}" but voice said "${idHit[0]}" · ${out.id}`);
    }
  });

  it("honest-gap sentence is what appears instead of any positive claim", () => {
    const out = renderVoice({
      intent: "recommendation_pick",
      content: { pickName: "Indonesia Hotel", pickDetail: "closest at 0.14km", missingFields: ["price"] },
    });
    // The gap sentence is the RIGHT way to talk about the missing field.
    expect(out.en).toContain("I can't see price");
    expect(out.en).toContain("not gonna make that part up");
  });

  it("HANGOUT reasoning_partial · missing price → gap sentence, never 'looks cheap' or 'looks affordable'", () => {
    const out = renderVoice({
      intent: "reasoning_partial",
      content: { pickName: "Griya Sentana", pickDetail: "0.20km from Malioboro", missingFields: ["price"] },
    });
    for (const rx of POSITIVE_CLAIMS.price) {
      expect(out.en).not.toMatch(rx);
      expect(out.id).not.toMatch(rx);
    }
    expect(out.en).toMatch(/can't see price/);
  });
});

// ─── Sample outputs · human-review the personality ────────────────
//
// These aren't assertions, they're documentation that ship in the
// test file so a reader can see what the personality sounds like.

describe("sample outputs · human-inspectable", () => {
  it("HANGOUT · discovery_hit · 'Yep — found 3.' / 'Sip — ketemu 3.'", () => {
    const out = renderVoice({ intent: "discovery_hit", content: { count: 3 } });
    expect(out.en).toBe("Yep — found 3.");
    expect(out.id).toBe("Sip — ketemu 3.");
    expect(out.mode).toBe("HANGOUT");
  });

  it("HANGOUT · recommendation with honest gap · the signature NEX line", () => {
    const out = renderVoice({
      intent: "recommendation_pick",
      content: { pickName: "Indonesia Hotel", pickDetail: "closest at 0.14km from Malioboro", missingFields: ["price"] },
    });
    expect(out.en).toBe(
      "I'd start with Indonesia Hotel — closest at 0.14km from Malioboro. I can't see price, so I'm not gonna make that part up.",
    );
  });

  it("TASK · propose_action · asks with buttons-friendly phrasing", () => {
    const out = renderVoice({
      intent: "propose_action",
      content: { targetName: "Gaotama Hotel", message: "Hello, do you have a room tonight?" },
    });
    expect(out.en).toContain("I've got a message ready for Gaotama Hotel");
    expect(out.en).toContain("Want me to fire it off?");
    expect(out.mode).toBe("TASK");
  });

  it("TASK · action_unknown · never claims success · the constitutional line survives", () => {
    const out = renderVoice({ intent: "action_unknown", content: { targetName: "Gaotama Hotel" } });
    expect(out.en).toContain("no delivery confirmation");
    expect(out.en).toContain("Not gonna claim it landed");
    expect(findSuccessLanguageLeaks(out.en)).toEqual([]);
  });
});
