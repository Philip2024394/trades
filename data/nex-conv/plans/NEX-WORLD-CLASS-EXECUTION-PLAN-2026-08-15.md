# NEX · Path to World-Class Human-Level Conversation · Execution Plan

**Date:** 2026-08-15
**Author:** Claude (world-class AI-engineer role) + Philip (accepting owner)
**Bar being aimed at:** *"a normal customer, doing an unscripted 15-20 turn staircase conversation, cannot reliably tell they're talking to AI."*
**Where we are today:** Pilot-quality conversational assistant · mechanics correct (state · corrections · references · meta · emotion · anti-fabrication · handoff · condensation) · Qwen 3B ceiling visible past turn ~22 and on technical-definition depth · corpus 865 items (208 live) · never tested on a real customer.

## Success gate (unchanging)

**Blind user test · 10+ real staircase customers · 15-20 turn free-form conversations · target < 30 % correctly identify "this is AI".** That number is the world-class verdict, not any internal probe score.

## Four milestones · sequential dependencies

```
M1 · Software polish              (1-2 days · code only · zero infra change)
   ↓
M2 · Model + hardware upgrade      (blocks on hardware or GPU-rental decision)
   ↓
M3 · Real conversation collection  (blocks on M2 for good quality data · needs 100+ real convos)
   ↓
M4 · Blind user test               (blocks on M3 for real data · the world-class verdict)
```

M1 can start immediately. M2 requires a hardware/rental decision from Philip. M3 depends on M2 (bad model → users don't come back → no data). M4 depends on M3 (real corpus).

---

## M1 · Software polish · 1-2 days · no infra change

**Goal:** Finish the last software-only quality improvements the current architecture makes possible. Get NEX to the ceiling of what Qwen 3B can deliver.

### M1 acceptance criteria (all must pass · same test harness we already have)

- Regression suite still 15/15 (no regressions from any of the changes)
- Phase A suite still 5/5
- Phase B suite still 19/19
- **New** · "Given the ... you mentioned" appears in ≤ 3 turns per 30-turn conversation (currently 6/30 — halve it)
- **New** · handoff signal, once flipped, actually appears in NEX's rendered prose within 2 turns (currently the flag flips but Qwen doesn't always act — needs a stricter packet gate)
- **New** · reply variety score (auto-audited: distinct sentence-open-tokens across a 30-turn convo) ≥ 15 different openers out of 30 replies
- **New** · zero factual mix-ups on the 10 core staircase terminology probes (base rail, closed vs cut, open riser vs open string, bullnose, curtail, base rail vs handrail, string vs stringer, tread vs going, riser vs rise, nosing)

### M1 subtasks (in order)

1. **Callback rate-limit tuner.** Currently anchors are gated every-3rd-turn but the LLM sometimes overuses them. Add a `callback_used_this_turn` flag + system-prompt rule "if callback was used in the last 2 turns, do NOT open with 'Given the ...'". Est: 1 hour.
2. **Handoff action gate.** When `HANDOFF_RECOMMENDED=true`, replace the KNOWLEDGE_PACKET section with a shorter forced-handoff mini-packet so Qwen literally cannot reach for staircase advice on that turn. Currently the model has too much distraction to follow rule #13. Est: 2 hours.
3. **Reply variety enforcement.** Track last-3-reply opening tokens in state (already tracking closers · add openings). Ban repeats. Est: 1.5 hours.
4. **Terminology-guardrail packet block.** For any turn whose primary intent is `ask_definition` on a locked term (base rail, closed string, cut string, open riser, etc.) add a `LOCKED_TERMINOLOGY` block with the CANONICAL one-line definition from the reference brain, with instruction "MUST paraphrase this definition · never contradict". This kills the T15 "vertical board" wobble class of failure. Est: 3 hours.
5. **Summary-confirmation intent + packet.** Detect summary-shaped messages ("summary: X, Y, Z. sound right?") as a new intent `confirm_summary` · packet gets the customer's items paired against `established_facts` with instruction "list what matches AND what needs checking". Fixes T29. Est: 2 hours.
6. **Response-length shape rules.** Backchannel < 120 chars, meta < 200 chars, close < 100 chars, normal < 400 chars. Enforce as post-generation trim if Qwen overshoots. Est: 1 hour.
7. **Full re-run.** All 3 test suites + a fresh 30-turn natural + the new probes. Report before/after per metric. Est: 45 min.

### M1 total effort: ~11 hours · about 2 dev days

### M1 what's NOT in scope
- No model swap (that's M2)
- No new corpus (that's M3)
- No live-user testing (that's M4)
- No architectural changes to ADR-0044

---

## M2 · Model + hardware upgrade · unblocked by decision, not code

**Goal:** Move from Qwen 3B (which hit ceiling on definitions, summary confirms, long-drift) to a model that reliably clears those bars. Same NEX brain · bigger renderer.

### M2 hardware options (Philip picks one)

| Option | Description | Cost | Ongoing | Time to ready |
|---|---|---:|---:|---:|
| **A · Upgrade this Victus RAM + external GPU** | e-GPU enclosure + RTX 4060 8GB (or 4070 12GB) via Thunderbolt/OCuLink | ~£400-700 (4060) / ~£800-1,100 (4070) one-time | £0 | 3-5 days ship + setup |
| **B · Replace machine** | Any laptop/desktop with 8+ GB VRAM discrete GPU (RTX 4060 mobile 8GB from £900, or 4070 desktop 12GB from £1,400) | £900-2,000+ | £0 | 3-14 days |
| **C · Cloud GPU rental for pilot windows** | RunPod / Vast.ai · RTX 4090 24GB @ ~£0.40/hr on-demand · spin up during pilot user sessions, stop when idle | £0 up front | ~£10-40/mo depending on pilot volume | Same day |
| **D · Accept 3B ceiling + iterate corpus first** | Do M3 (real conversation collection) on Qwen 3B, use insight to focus a fine-tune later that closes the gap on the exact things customers actually notice | £0 | £0 | Now |

**My recommendation: C (cloud GPU for pilots) THEN A/B later if the numbers justify.**

Rationale: C is the only zero-upfront path that gets us to the world-class bar quickly. Pilot conversations run on rented GPU. If measured blind-test rate proves world-class quality is reachable at 7B/14B, we then buy hardware to bring it in-house.

### M2 model options once VRAM is available

| VRAM | Model | Approx VRAM used | Quality tier |
|---:|---|---:|---|
| 6 GB | Qwen 2.5 7B Q4_K_M | 5 GB | ★★★★ (closes definition + summary-confirm) |
| 8 GB | Qwen 2.5 7B Q6_K | 6.5 GB | ★★★★★ (near-lossless 7B) |
| 12 GB | Qwen 2.5 14B Q4_K_M | 9 GB | ★★★★★ (approaches Sonnet on structured rendering) |
| 24 GB | Qwen 2.5 32B Q4_K_M / DeepSeek Chat 34B | ~20 GB | ★★★★★+ (indistinguishable from mid-tier hosted on this domain) |

### M2 acceptance criteria

- Same 3 test suites still pass (regression 15/15 · Phase A 5/5 · Phase B 19/19) on the new model
- New probe · terminology probes 10/10 correct (currently 3B fails 2-3 of 10)
- New probe · summary-confirmation returns matching-facts-vs-mismatches list (currently 3B pivots to advice)
- Turn 20-30 latency stays ≤ 5s P95 on the chosen setup
- Cost per conversation < £0.05 (cloud) or £0 (owned hardware)

### M2 total effort · pipeline side
- If cloud GPU: ~4 hours to wire Ollama-remote (or vLLM) into `respond-local.mjs` as a new provider · add `NEX_RESPONSE_PROVIDER=ollama-remote` env
- If owned hardware: ~1 hour · same `ollama pull qwen2.5:7b` command · already-tested pipeline

---

## M3 · Real conversation collection · Step 4 of the V1 ladder

**Goal:** Replace synthetic-fixture-only training with 100+ real staircase customer conversations, so NEX corpus reflects actual customer language, not what I (or Philip) imagine customers say.

### M3 collection channels

| Channel | Volume/week | Effort | Quality |
|---|---:|---|---|
| Live MT-1 chat on staging (soft-launch to a small group) | 5-15 | Low | High (real intent, real language) |
| Recorded phone-call transcripts from the actual Summit business (with permission) | 20-50 | Medium | Very high |
| WhatsApp/SMS enquiry threads (with permission) | 5-15 | Low | High |
| Historical email enquiries anonymised | 30-100 (backlog) | Low | Medium (asymmetric — email tends to be more formal) |
| Prompted volunteers (10 friends/family "you're renovating your staircase, talk to Summit") | 10 in one afternoon | Low | Low (they know it's a test — behaviour differs) |

**My recommendation: mix of live-chat + phone-transcripts + email-backlog to hit 100+ · avoid the prompted-volunteers channel** (behaves too differently from real).

### M3 pipeline additions needed

1. Ingest-from-chat-history · pulls `nex.conv_turns` rows from the live pilot + turns them into new `nex.conv_knowledge_items` for future retrieval. Est: 3 hours.
2. Phone-transcript ingest (accepts a `.txt` / `.md` / `.json` transcript file · runs it through the same extract → embed → link pipeline). Est: 4 hours.
3. Manual-tag admin view (light UI at `/nex-app/nex-brain/inbox`) for approving/rejecting new items before they go live. Est: 6 hours (Step 3 of the ADR ladder covers this).
4. Corpus-growth dashboard (extend the four existing NEX vitals). Est: 2 hours.

### M3 acceptance criteria

- 100+ real conversation turns ingested (across at least 20 unique conversations)
- Live retrieval on new turns hits at least top-8 with score ≥ 0.65 for their own follow-ups (proves the graph learned from the addition)
- Corpus grows from 208 → 400+ live items
- No regressions on existing test suites
- Owner review queue at ≤ 20 items pending at any time

### M3 total effort: ~2 weeks part-time collection + 15 hours pipeline work

---

## M4 · Blind user test · the world-class verdict

**Goal:** Give the honest answer to "is this world-class". Not a synthetic probe. A real experiment.

### M4 test design

- **Recruit** 12-15 people who are potential Summit customers (Facebook groups, local marketing, neighbours renovating) · offer £30 Amazon voucher for a 20-min session.
- **Two conditions**, blind:
  - Condition H (human) · a real Summit team member types replies over the same MT-1 chat UI
  - Condition N (NEX) · the current pipeline · same UI
  - Each participant does 2 conversations · assigned randomly (H then N, or N then H, counterbalanced) · no participant knows which is which
- **After each convo**, participant answers:
  1. "Do you think you were talking to a person or an AI?" (Person / AI / Unsure)
  2. "How confident are you?" (1-5 Likert)
  3. Free-text: "What made you think that?"
  4. NPS · "How likely to recommend Summit based on this interaction?"

### M4 acceptance criteria (world-class threshold)

- **Primary** · < 30% of N-condition participants correctly identify AI with confidence ≥ 4
- **Primary** · NPS on N-condition ≥ NPS on H-condition minus 15 points (accept a small human-preference gap)
- **Secondary** · zero conversations where participant explicitly said "clear AI" reasons like "repetitive phrasing", "avoided the question", or "invented a price"
- **Secondary** · at least 3 conversations where a participant said "genuinely helpful, would use again"

### M4 total effort
- Recruitment: 3-5 days elapsed (2-3 hours active)
- Sessions: 12-15 × 20 min = ~5 hours of session time (parallelisable · scheduled)
- Analysis + write-up: 1 day
- Prize budget: £360-450

---

## Total timeline options

### Aggressive · 3 weeks to blind-test result
- Week 1: M1 (2 days polish) + M2 decision + set up cloud GPU (C)
- Week 2: Live pilot at reduced volume · M3 collection ongoing
- Week 3: M3 hits 100+ · M4 recruitment starts week 3 · test in week 4

### Measured · 6 weeks to blind-test result
- Week 1-2: M1 polish + M2 hardware order (A or B) shipping
- Week 3-4: M3 collection at moderate pace · hardware arrives · Qwen 7B/14B installed
- Week 5: M3 hits 100+ · corpus solid · re-run all suites on bigger model
- Week 6: M4 recruitment + test

**Blocker on the whole plan · M2 hardware/rental decision from Philip.** Everything downstream is easier with the bigger model in place.

---

## Decision gates (Philip picks · not Claude)

1. **M1 · Go / hold** — Do the 2-day software polish now? (recommended yes · unlocks the ceiling of the current model · no infra needed)
2. **M2 · Hardware path** — Option A (e-GPU) / B (new machine) / C (cloud rental) / D (accept 3B ceiling)
3. **M3 · Collection channels** — Which real-conversation channels to enable? Live pilot? Phone transcripts? Email backlog?
4. **M4 · Test scope** — How many participants? Real Summit business team member as human control, or a Claude-driven human control?

---

## Where this plan lives + how it stays current

- **Canonical file** · `data/nex-conv/plans/NEX-WORLD-CLASS-EXECUTION-PLAN-2026-08-15.md` (this file)
- **Memory pointer** · added to `MEMORY.md` under Pinned so future sessions load it
- **Milestone tracker** · updated in this same doc as items complete (dated status blocks at the top of each milestone section)

---

## What to do RIGHT NOW to move forward

1. **You decide M2 (hardware/rental)** — this is the biggest blocker. Cloud C is the fastest zero-risk path.
2. **Green-light M1** — I execute the 11-hour software polish immediately after.
3. **Free the disk** — see the parallel cleanup proposal separately · nothing deleted without your approval.

That's the plan.
