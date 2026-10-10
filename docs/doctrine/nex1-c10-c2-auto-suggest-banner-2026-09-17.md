# C10→C2 Auto-Suggest Banner · Closure Doctrine

**Date:** 2026-09-17
**Batch:** Frontier §17 queue · seventeenth slice · after C10 Phase 4c (turn transcripts persistence).
**Authority:** Founder "continue" after Phase 4c · closes the C10→C2 self-improvement loop the persistence work was building toward.
**Author:** master_ai_engineer (Claude Opus 4.7)

---

## §1 · Target

Turn the durable state built by Phases 4a/4b/4c into a **self-improvement loop**:

- **Observe** — the C10 graph now durably captures every refused prompt across conversations.
- **Detect** — when the same first-2-token prefix appears in refused_prompts ≥ 2 times, that's a signal NEX1 keeps failing on the same phrasing.
- **Suggest** — surface a banner in the Notes panel: *"you've said `wibble the` 3 times · shall I map it to `fix_bug`?"*
- **Teach** — one click POSTs to `/api/nex1/paraphrase` (Phase 1 wire) → next time the same prefix arrives, the paraphrase library catches it → no more refusal.

This is the loop the last five slices have been building toward. C10 collects refusals; C2 owns paraphrases; the banner is the one-click bridge.

### Founder view (before / after)

Before: refused prompts accumulate in the Notes panel with no action. The founder can click **Teach** per-refusal (Phase 4 §5) but has to remember to do it.

After: as soon as a prefix appears twice, a banner appears at the top of the "Refused prompts" section with the suggested slug pre-filled. **"Teach as fix_bug →"** is one click.

---

## §2 · Mutation (files touched)

| File | Kind | LOC | Purpose |
|------|------|-----|---------|
| `src/app/nex1/workstation-live/agent/NotesPanel.tsx` | Modified · ~110 lines added | 4 new state slots · `prefixOf` memoiser · `banners` derived list · `useEffect` that fetches suggestions per new banner · `dismissBanner` + `acceptBanner` handlers · new render block above the "Refused prompts" section |
| `src/app/nex1/workstation-live/agent/nex-agent-workstation.css` | Modified · ~70 LOC added | 8 new classes for the banner surface (background gradient · yellow-amber accent · dismiss/accept button pair · hint line for matched keywords) |

**Zero touches on:**
- `capability-paraphrase-library.ts` (Phase 1-4a unchanged)
- `capability-paraphrase-persistence.ts` (Phase 4a unchanged)
- `capability-conversation-context.ts` (Phase 4b/4c unchanged)
- `capability-conversation-graph.ts` (Phase 4b unchanged)
- `/api/nex1/paraphrase/*` endpoints (already ship what we need)
- `/api/nex1/paraphrase/suggest` (already ships the suggestion contract)
- Truth Engine · Q7/Q8 · safety gate · pricing.ts · tierCatalog.ts

**Purely a UI slice.** All the plumbing was already in place from prior phases.

---

## §3 · Design

### §3.1 · Prefix extraction (client-side · matches Phase 4 §5 `deriveInitialSource`)

```typescript
const prefixOf = (prompt: string): string => {
  const cleaned = prompt.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter((w) => w.length > 1);
  return words.slice(0, 2).join(" ");
};
```

Same shape as the per-refusal Teach button's default source — so if the founder clicks the banner and then clicks a specific Teach button, they get consistent behaviour.

### §3.2 · Banner threshold: 2 occurrences

Why not 1? Because a single refusal might just be a typo. Two occurrences of the same prefix mean the founder is CONSISTENTLY using that phrasing — that's when a paraphrase is genuinely worth teaching.

Why not 3+? Because the founder has already suffered TWO refusals by then. Two is the smallest signal that says "this is a pattern, not a one-off".

### §3.3 · Suggestion loading

For each banner, one `POST /api/nex1/paraphrase/suggest` call — cached in `bannerSuggestions` (Map<prefix, Suggestion>). Never re-fetched. The suggest endpoint is deterministic per phrase, so the cache is safe.

Suggestion may return `suggested_slug: null` (honest abstain, §3.4 of Phase 4). Banner still renders — it just defaults to `fix_bug` and shows a helpful hint: *"(no keyword hit · pick a slug and I'll teach it)"*.

Note: the current UX doesn't yet let the founder change the slug from the banner directly — they'd click "Not this one" and use the per-refusal Teach button (Phase 4 §5) which has a full slug picker. Small next-slice improvement: add a mini-select in the banner too.

### §3.4 · Dismiss vs Accept

- **Dismiss** ("Not this one") — adds prefix to `bannerDismissed` set. Prefix hides for this session only. Not persisted (a new session starts fresh so a truly-repeated pattern re-surfaces).
- **Accept** ("Teach as X →") — POST to `/api/nex1/paraphrase`. On success, prefix moves to `bannerTaught`. Banner disappears. The library entry is durable (Phase 4a persistence).

### §3.5 · Non-blocking · non-modal · non-scary

Banner sits in its own section with amber accent (distinct from red refusals and green resolved-questions). It never blocks the rest of the Notes panel. It never opens a dialog. It's a suggestion, not an interrupt.

### §3.6 · Turbopack hot-reload safety

Banner state is component-local · `useState` + `useMemo`. React handles component teardown/re-mount cleanly. No globalThis pins needed.

---

## §4 · Verification · real HTTP · data-plane end-to-end

The banner UI itself is React state · rendered client-side. My probe verifies the DATA PLANE the banner depends on. UI rendering is verifiable by opening the workstation in a browser.

### §4.1 · Inject 3 same-prefix refusals

```
POST /api/nex1/conversation-graph op=addRefusedPrompt  ×3
  → prompt="wibble the widget number 1" · turn=1
  → prompt="wibble the widget number 2" · turn=2
  → prompt="wibble the widget number 3" · turn=3
```

### §4.2 · Snapshot confirms grouping logic

Client-side `prefixOf` applied to the snapshot returns:
```
prefix="wibble the" · count=3 · example="wibble the widget number 1" · would_banner=true
```

Threshold `count >= 2` fires · banner would render.

### §4.3 · Suggest endpoint · honest abstain

```
POST /api/nex1/paraphrase/suggest { phrase: "wibble the widget number 1" }
  → suggested=null · matched=[]
```

"wibble" isn't in the keyword table. Banner renders with default `fix_bug` slug and the *"(no keyword hit · pick a slug…)"* hint. **This is the honest-abstain path** — the banner does NOT fabricate a confident slug.

### §4.4 · Accept path · POST teach

```
POST /api/nex1/paraphrase
  { source: "wibble the", target_slug: "fix_bug",
    provenance: "founder taught via auto-suggest banner",
    kind: "founder_correction" }
  → stored: wibble the → fix_bug · kind=founder_correction
```

### §4.5 · Loop closed · the taught paraphrase catches the next request

```
POST /api/nex1/intent/classify { founder_goal: "wibble the widget again" }
  → ✓ CLASSIFIED · verb=FIX · paraphrase_fallback · "wibble the" → verb_family=FIX · via prefix
```

**The very phrase that just refused 3 times now classifies cleanly.** The self-improvement loop is closed and proven with runtime evidence.

### §4.6 · Regression

```
POST /api/nex/agent/submit { prompt: "hello" }
  → verdict=confirmed · status=plan_ready   (unchanged)
```

### §4.7 · Zero-LLM audit

```
NotesPanel.tsx → CLEAN (0 llm markers)
```

Scanned for `openai`, `anthropic`, `ollama`, `claude-`. All zero.

---

## §5 · Honest limits

1. **UI verified via data-plane, not headed browser.** My environment cannot run a headed browser. The React state transitions (state slots update, banners derive, useEffect fires) are standard React patterns; the data plane I DID verify is what makes them meaningful. Founder can open `/nex1/workstation-live` and see the banners live — but this batch does not claim a browser-render probe.
2. **Banner slug picker isn't editable within the banner itself.** Founder clicks "Not this one" and then uses the per-refusal Teach button (Phase 4 §5) if they want a slug other than the suggested one. Next-slice improvement: add an inline slug select. ~15 LOC.
3. **Dismiss state is session-only, not persisted.** If you dismiss "wibble the" and restart, the banner returns. This is deliberate — the graph is durable but "founder said no to this suggestion" is UX state, not truth-state. If it becomes annoying, we can persist dismissals to a separate JSONL.
4. **Threshold is fixed at 2.** Config would be a founder decision · not exposed. If we want configurable thresholds per taste, that's a separate slice.
5. **`bannerTaught` is component-local.** If founder navigates away from the Notes tab and back, `bannerTaught` resets — but the paraphrase itself is durable (Phase 4a), so the banner won't re-appear because the founder's next refusal (if any) would already classify cleanly.

---

## §6 · What this batch means

Prior slices delivered the **data**. This slice delivers the **feedback loop**:

- **Observation** — refusals captured in durable C10 graph (§4b)
- **Detection** — client groups by prefix, threshold=2
- **Interpretation** — suggest endpoint proposes a target_slug (honest null if unclear)
- **Action** — one click writes the paraphrase to durable storage (§4a)
- **Verification** — next matching prompt classifies via the paraphrase-fallback trace (Phase 2/3)

**Every step measurable via real HTTP.** No architecture-only claim. No fabrication.

---

## §7 · Registry classification update

| Capability | State | Evidence |
|-----------|-------|----------|
| C10→C2 self-improvement loop | **RUNTIME_VERIFIED (data plane)** | §4.5 · the exact phrase that refused 3 times now classifies cleanly |
| Auto-suggest banner UI render | **AVAILABLE_NOT_FULLY_VERIFIED_IN_BROWSER** | React state + useMemo + useEffect are standard patterns · headed test blocked in this env · founder verifies visually |
| Deterministic prefix grouping | **RUNTIME_VERIFIED** | §4.2 |
| Suggest→POST→classify roundtrip | **RUNTIME_VERIFIED** | §4.3 → §4.4 → §4.5 |

**Application-wide zero-LLM** remains not-claimed as an all-app property. This batch is purely native + deterministic.

---

## §8 · Try it live

```bash
# 1. Force a refusal pattern:
for i in 1 2 3; do
  curl -X POST http://localhost:3008/api/nex1/conversation-graph \
    -H "Content-Type: application/json" \
    -d "{\"conversation_id\":\"demo\",\"op\":\"addRefusedPrompt\",\"payload\":{\"turn\":$i,\"prompt\":\"gubbins the panel test $i\",\"reason\":\"refused_no_verb_recognised\"}}"
done

# 2. Open the workstation, switch to the Notes tab, session_id "demo"
#    → you should see: 💡 NEX1 noticed a pattern
#    → "You've said 'gubbins the' 3 times · shall I map it to fix_bug?"

# 3. Click "Teach as fix_bug →"

# 4. Immediately verify:
curl -X POST http://localhost:3008/api/nex1/intent/classify \
  -H "Content-Type: application/json" \
  -d '{"founder_goal":"gubbins the widget"}'
# → verb=FIX via paraphrase_fallback
```

---

## §9 · What is NOT in this batch

- Headed-browser UI probe (ENVIRONMENT_BLOCKED)
- Editable slug picker inside the banner (~15 LOC next-slice)
- Configurable threshold
- Persistent dismiss state
- Multi-tenant banner priority
- Truth Engine · Q7/Q8 · safety gate · pricing.ts changes

---

## §10 · Queue after this

- **Log rotation / compaction** — squash conversations older than N days. ~60 LOC.
- **Verdict-history panel** — sidebar with every C11 envelope for the current task. ~120 LOC.
- **Chip click-to-expand modal** — full envelope inspector. ~150 LOC.
- **In-banner slug picker** — small dropdown so founder can override the suggestion without leaving the banner. ~15 LOC.
- **Persist dismissals** — new JSONL file `data/nex1-notes-panel/dismissals.jsonl`. ~30 LOC.
- **C6 Rule Algebra** — parse doctrine markdown into gating rules. ~800 LOC.

Say **"continue"** for the **in-banner slug picker** (smallest slice · directly improves the UX just built · 15 LOC) or the **verdict-history panel** (bigger visual improvement) or name a different item.
