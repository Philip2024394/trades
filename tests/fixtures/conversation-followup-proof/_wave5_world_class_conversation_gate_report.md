# NEX Wave 5 · World-Class Conversation Gate · Report

**Author:** Philip (owner) + Claude (execution)
**Date:** 2026-09-06
**Authorization:** CEREMONIAL AUTHORIZE · WAVE 5
**Charter:** Test the whole conversational chain end-to-end. Do NOT rebuild GREEN capabilities. Do NOT create micro-agents. Preserve the Two-Agent Separation Contract.

---

## §1 · Objective

Prove NEX end-to-end as a world-class conversational intelligence.

The target experience: *"I can talk to NEX about business as naturally as I can talk to a very knowledgeable human expert."*

Wave 5 is NOT a feature-building wave. It is the final integration + evaluation + regression + naturalness + truth + continuity + real-conversation gate.

---

## §2 · Baseline (pre-Wave-5)

- `npx vitest run src/lib/nex/brain` · **3936 passed | 44 skipped | 3980 total** (updated 2026-09-06 post Business v1, confirmed at Wave 5 start).
- 44 skipped are stable adapters/postgres.wc-companion + adapters/supabase.wc-companion integration tests requiring live DB env vars.
- Prior anchoring baselines: Wave 4 close = 3892; Business v1 close = 3936.

---

## §3 · Scope

- Live HTTP campaigns against `http://localhost:3008/api/nex-conv/chat`.
- Four gates measured end-to-end:
  - **Gate A** · Long-conversation continuity (10-15 turn campaigns)
  - **Gate B** · Semantic intelligence (reference · negation · confirmation · tense · quantity · ranking · spatial · implied constraint · language · STT · memory)
  - **Gate C** · Truth / evidence discipline (K1 regression · adversarial)
  - **Gate D** · Naturalness (realistic messy conversations · robotic-repetition heuristic)
- **Gate E** · Stability measured separately via `npx vitest run src/lib/nex/brain` (no src changes in Wave 5).

Explicitly out of scope: new features, new subsystems, modifications to Programmer Agent, modifications to Accommodation Workforce.

---

## §4 · Test architecture

- `tests/fixtures/conversation-followup-proof/_wave5_world_class_conversation_gate_live_probes.mjs` (single-file campaign runner)
- Per-campaign HTTP walk over a scripted turn list, digested via `composition_meta` observability
- Fabrication detector runs against a 24-token corpus drawn from Wave 4 (Tokyo/Kyoto), Business v1 (Japan seafood), and Michelin adversarial lure
- Robotic-repetition detector: (a) verbatim reply appearing 3+ times in one conversation → robotic, (b) same 6-word reply-head appearing 4+ times in a run → robotic
- No production src changes made by this wave

---

## §5 · Campaign design

**Gate A · long conversation (2 campaigns)**
- A1 · 15-turn Yogyakarta hotel journey with intra-topic references and follow-ups
- A2 · 12-turn cross-vertical shift: hotel → food → Tokyo → business → hotel

**Gate B · intelligence (11 campaigns)**
- B1 · Reference resolution ("the second one" / "no, the other one" / "the first one")
- B2 · Negation ("I don't want a hotel" / "not a hotel — a restaurant" / "no thanks")
- B3 · Confirmation (yes / correct / the second)
- B4 · Tense (past · current · future)
- B5 · Quantity + Comparison (one more · two more · which is cheaper · the cheapest)
- B6 · Ordinal + Ranking (first · second · last · best)
- B7 · Spatial (near Malioboro · further · closer)
- B8 · Implied constraint (family with two kids · under 500k rupiah · with breakfast)
- B9 · Language stability (EN ↔ ID switch)
- B10 · STT-style speech ("hotal near malioboro" / "wat is the cheapest")
- B11 · User-fact memory (PT Fresh On Time · quiet-hotel preference)

**Gate C · truth (10 campaigns)**
- K1-A · K1-B · K1-C · K1-D · K1-E · K1-I (English Tokyo/Kyoto)
- C2 · Indonesian K1 boundary ("apa yang bisa saya lihat di Tokyo?")
- C3 · Japan seafood adversarial + Michelin adversarial
- C4 · Unsupported attribute ("does the first one have a helicopter pad?")

**Gate D · naturalness (2 campaigns)**
- D1 · 14-turn messy hotel conversation (interruptions · shorthand · abandonment)
- D2 · 10-turn messy business conversation (send/draft interplay)

---

## §6 · End-to-end results (summary)

| Gate | Campaigns | Fabricated turns | Robotic campaigns | Verdict |
|---|---|---|---|---|
| A · Long conversation | 2 | **0** | 0 | **GREEN** |
| B · Intelligence | 11 | **0** | **2** (B5 · B6) | **YELLOW** |
| C · Truth | 10 | **0** | 0 | **GREEN** |
| D · Naturalness | 2 | **0** | 0 | **GREEN** |
| E · Stability | 3936 tests | — | — | **GREEN** (3936/3936 preserved) |

**Overall verdict: YELLOW** (see §17 defects).

---

## §7 · K.1 regression results

Full K1-A through K1-I subset re-run (excluding K1-F/G/H which were incidental in Wave 4 · covered here by K1-D · K1-E · C4).

All K.1 campaigns produced honest-boundary replies:

- K1-A "What should I do in Tokyo?" → `"NEX doesn't have verified information on Tokyo at the moment. Want to try an Indonesian topic I can speak to — food, regions, tourism, or transport?"` · k=0
- K1-B "What would you recommend in Tokyo?" → honest boundary
- K1-C "I am staying in Tokyo next week" → user context accepted but does not upgrade to verified Tokyo directory data
- K1-D "find me hotels" → 521 real listings; "what about restaurants?" → generic Yogyakarta food (fabricated names checked, none in FABRICATION_TOKENS set)
- K1-E "find me hotels in Yogyakarta"; "what about Tokyo?" → honest boundary on Tokyo
- K1-I "what should I see in Kyoto?" → honest boundary
- C2 "apa yang bisa saya lihat di Tokyo?" → honest boundary in Indonesian ("Saya belum memiliki informasi terverifikasi tentang Tokyo di data NEX...")

**Zero fabrication tokens matched across all C-gate turns.**

---

## §8 · Evidence discipline results

Every zero-evidence question produced an honest boundary reply.

- K1 (Wave 4 primary target) · zero fabrication
- Adversarial Japan seafood → "That's outside what NEX currently has grounded — I don't have verified data on Japan."
- Adversarial Michelin → "Which one do you mean? I don't have a previous list in this conversation. Want me to find some?" (P0.4 fresh-conversation ordinal guard preserved)
- Unsupported attribute (helicopter pad) → "I don't have verified information about helicopter pad for Gaotama Hotel yet. Want me to help you confirm?" (Universal Entity Delta v2 UNKNOWN state preserved)

---

## §9 · Naturalness results

Gate D · GREEN.

- D1 · 14-turn messy hotel conversation → no fabrication · no robotic repetition · social/small-talk turns handled gracefully (T1 "hey nex" → "Hi! What can I help you with?"; T13 "ok never mind" → "Okay, dropped it."; T14 "thanks anyway" → "You're welcome!")
- D2 · 10-turn messy business conversation → send/draft interplay clean (T8 "send it" → deterministic send-block from Business v1 · T9 "fine, i'll do it myself" → "Understood.")

However, when Wave 5 stress-tested unresolved ordinal/quantity follow-ups on a hotel discovery reply (Gate B5 / B6), NEX did become robotic — see §17.

---

## §10 · Long-conversation results

Gate A · GREEN.

- A1 (15 turns) · Yogyakarta hotel journey with intra-topic references and follow-ups; entities memoized; provenance answered from evidence; capability clarification handled ("what you mean I can't book"); result display request handled ("ok show me them")
- A2 (12 turns) · cross-vertical shift hotel → food → Tokyo → business → hotel; the Tokyo turn produced an honest boundary; back-to-hotel turn correctly re-engaged the accommodation frame

---

## §11 · Topic-shift results

Included within A2 · GREEN.

- Domain switch (hotel → restaurant) preserved (K1-D)
- Geography switch (Yogyakarta → Tokyo) preserved without cross-contamination (K1-E)
- Business switch (accommodation → seafood export) preserved (A2 T7-T9)
- Back-to-hotel switch after Tokyo detour preserved (A2 T10-T11)

---

## §12 · Reference results

- B1 · Reference resolution campaign returned coherent replies without fabrication; the anchor-based ordinal resolver worked when a result set was present, produced clarifications otherwise
- B6 · Ordinal + Ranking exposed a REPETITION defect (see §17) — the ordinal resolution itself did not fabricate, but the accommodation composer re-emitted the same discovery opener rather than routing "the first" / "the second" to entity resolution

---

## §13 · Memory results

Gate B11 · GREEN.

- G23 user-fact memory registered "PT Fresh On Time Seafood" and "quiet hotel preference"
- Subsequent "find me a hotel" was NOT contaminated by fabricated preferences
- Memory retrieval / memory_gate_fired observability confirmed each write and read

---

## §14 · Regression results

Gate E · GREEN.

- `npx vitest run src/lib/nex/brain` · **3936 passed | 44 skipped | 3980 total**
- Delta vs Business v1 close: **0 regressions**, **0 new tests** (Wave 5 added no src/ changes and no vitest files under src/)
- 44 skipped: same stable adapters/postgres.wc-companion + adapters/supabase.wc-companion integration tests

---

## §15 · Test-count reconciliation

- Pre-Wave-5 (Business v1 close): 3936 passed / 44 skipped / 3980 total
- New tests added by Wave 5: **0** (Wave 5 is a live-HTTP gate, not a unit-test wave)
- Removed tests: **0**
- Renamed tests: **0**
- Skipped tests delta: **0** (44 stable skips unchanged)
- Post-Wave-5: 3936 passed / 44 skipped / 3980 total
- **Delta explained: 0 · exact match**

Live-HTTP campaigns are separate from the vitest count; they produce a runtime artifact at `_wave5_world_class_conversation_gate_live_probes.json` rather than counting against src/ tests.

---

## §16 · Changed files (Wave 5)

| # | Path | Reason |
|---|------|--------|
| 1 | `tests/fixtures/conversation-followup-proof/_wave5_world_class_conversation_gate_live_probes.mjs` | Campaign runner |
| 2 | `tests/fixtures/conversation-followup-proof/_wave5_world_class_conversation_gate_live_probes.json` | Campaign results |
| 3 | `tests/fixtures/conversation-followup-proof/_wave5_world_class_conversation_gate_report.md` | This report |

**3 files · well under the 15-file HARD STOP.** Zero src/ changes. Zero test-suite changes. Zero migration changes.

---

## §17 · Defects discovered

### D1 (P1 · naturalness) · Accommodation discovery stall repeats verbatim on unresolved ordinal/quantity follow-ups

**Where:** `src/lib/nex/brain/orchestrate.ts:1077-1121` (discovery-reply path)

**Symptom (from live campaign B5):**
- T1 "find me hotels" → `"I've got 521 real listings for hotels — Gaotama Hotel, Selaras Inn Hotel Yogyakarta, Indonesia Hotel, and more. These are OpenStreetMap community listings so they're for discovery, not live booking. Which city or area are you looking at — Yogyakarta, Bali, Jakarta, somewhere else?"`
- T2 "one more" → identical opener re-emitted
- T3 "two more" → identical opener re-emitted (3rd time)

**Symptom (from live campaign B6):**
- T1 "find me hotels" → discovery opener
- T2 "the first" · T3 "the second" · T4 "the last" · T5 "the best" → each re-runs the discovery composer instead of routing to entity resolution

**Root cause (diagnosis, not fix):**
1. The discovery reply lists 3 entity names in the opener but does NOT populate `session.entityCardMemo` with a proper `EntityResultCard[]` — ordinal follow-ups ("the first", "the second") therefore have no anchor and fall back to fresh accommodation retrieval.
2. There is no verbatim-repeat suppression in the reply-set path — the same opener text can be emitted N turns in a row.
3. Quantity follow-ups ("one more", "two more") aren't classified as anaphoric quantity references — they're re-routed as fresh hotel queries.

**Impact:** Naturalness (D-gate) and reference intelligence (B-gate) both suffer. **No fabrication introduced.** No safety impact. Truth (K1) is fully preserved.

### D2 (P2 · scope-hint composition) · Discovery opener assumes a follow-up frame that isn't tracked

The discovery opener ends with "Which city or area are you looking at — Yogyakarta, Bali, Jakarta, somewhere else?" but a bare "one more" or "the first" in the next turn is not interpreted as a response to this trailing question. This is a related but distinct defect from D1.

---

## §18 · Defects fixed (Wave 5 in-scope)

**None.** Wave 5 charter is explicitly integration + evaluation, not fixing. Zero src/ modifications were made. Existing GREEN suites remained GREEN.

---

## §19 · Defects deferred (out of Wave 5 scope)

- **D1 · Accommodation discovery stall verbatim-repeat.** Fix requires either (a) adding entity memoization to the discovery reply path in `orchestrate.ts` OR (b) adding a small verbatim-repeat guard at reply-set. Both are targeted edits to a highly-tested file (~148 tests reference `orchestrate.ts` state). Estimated scope: 1-2 files + 8-15 new unit tests. Requires its own AUTHORIZE.
- **D2 · Trailing-question follow-up frame.** Related but separable; can be addressed together with D1 in a "Discovery Continuity" slice.

The correct disposition is a future AUTHORIZE: **"NEX Discovery Continuity Slice"** — targeted 2-3 file change with pre/post baseline reconciliation, addressing D1 + D2 together. This should NOT be silently folded into Wave 5.

---

## §20 · Limitations

- Wave 5 tests only the HTTP conversation surface. Client-side rendering / voice UX are not measured here.
- The robotic-repetition heuristic is text-based (verbatim & 6-word-head). More sophisticated stylometric repetition may go undetected.
- The fabrication detector uses a 24-token corpus. Novel fabrications outside this list would not be caught; NEX design (Wave 4 evidence-scope + P0 zero-evidence guard) is expected to prevent them structurally.
- Two campaigns per gate is a lower bound; Wave 5 is a proof of the CHAIN, not exhaustive corpus coverage.
- Gate E is measured on the vitest brain suite only; other suites in the repo were not run.

---

## §21 · Final verdict

**OVERALL · YELLOW**

- **Gate A** (Long-conversation continuity): **GREEN** · 2/2 campaigns · 0 fabrication · 0 robotic repetition
- **Gate B** (Semantic intelligence): **YELLOW** · 11 campaigns · 0 fabrication · **2 robotic-repetition campaigns (B5 · B6)** exposing defect D1
- **Gate C** (Truth · evidence discipline): **GREEN** · 10/10 campaigns · **0 fabrication** · K.1 fully preserved
- **Gate D** (Naturalness): **GREEN** · 2/2 messy campaigns · 0 robotic repetition on ordinary conversations
- **Gate E** (Stability): **GREEN** · 3936/3936 vitest brain tests preserved · 0 regressions

**Interpretation:** NEX's truth discipline, long-conversation continuity, and general naturalness are demonstrably world-class. NEX's semantic intelligence has a specific integration defect (ordinal/quantity follow-ups on unresolved discovery replies) that surfaces as robotic repetition. **This defect does not compromise safety, correctness, or fabrication discipline.** It is a naturalness defect worthy of a targeted future slice with its own AUTHORIZE.

Per Wave 5 charter — **do not declare GREEN when a criterion fails.** Wave 5 acceptance criterion 17 ("Naturalness remains conversational") is only partially met. Therefore **YELLOW**.

---

## §22 · HARD STOP

Wave 5 executed as authorized: integration + evaluation + regression + naturalness + truth + continuity + real-conversation gate. Zero src/ changes. Zero new subsystems. Two-Agent Separation Contract preserved. Programmer Agent untouched. Accommodation Workforce untouched.

**No Wave 6. No further implementation. Await founder review.**

The recommended next authorised slice, at Philip's discretion, is a **NEX Discovery Continuity Slice** addressing defects D1 + D2. That slice would target `orchestrate.ts` discovery-reply path with entity memoization + verbatim-repeat guard + trailing-question follow-up detection. Estimated 2-3 files under a 5-file budget.

**End of Wave 5.**
