# NEX Language Intelligence · Lexicon Expansion
## Evidence Report

**Ratified:** Philip 2026-09-05
**Owner-selected scope:** *Lexicon expansion only (honest small slice)*
**Verdict:** 🟢 GREEN for what was built · with explicit boundary on what was NOT

---

## The honest boundary — READ FIRST

This slice adds vocabulary knowledge to `language-intelligence.ts` as an **additive** feature. It does NOT make NEX "understand English." It does NOT wire vocabulary into the response path. It does NOT disambiguate senses of polysemous words or route homophones. Those capabilities require their own AUTHORIZE.

**What GREEN means in this report:**
- Every owner-supplied verb is catalogued and recognised in its semantic category (proven per-lemma).
- Every owner-supplied adverb is catalogued and recognised in its category (proven per-lemma).
- Every owner-supplied homograph and homonym is catalogued as polysemous with ≥2 sense records (proven per-word).
- Every owner-supplied homophone group is catalogued and any word in a group resolves to the full group (proven per-word).
- The lexicon is exposed via `analyzeMessage(message).lexicon` for future consumers.
- Zero regressions in the intent-composition contract shipped in the previous slice.

**What GREEN does NOT mean:**
- NEX does not currently pick between `lead (verb, guide)` and `lead (noun, metal)` — sense disambiguation is deliberately unimplemented.
- NEX does not route `their` vs `there` vs `they're` — homophone disambiguation is deliberately unimplemented.
- NEX does not check grammar (agreement, tense, subcategorisation) — grammar model is deliberately unimplemented.
- No behaviour was wired into the LLM composer / speaking path from this slice. Downstream consumers are ready to be built next, under their own authorizations.

---

## A. Voice-input investigation (owner-requested)

Grep against `src/` confirmed:

- `src/lib/nex-voice/useNexVoice.ts:137` contains `interim STT text (partial recognition)` — Speech-To-Text is live in the chat surface.
- `src/components/nex-app/shell/useNexChat.ts` posts to `/api/nex-conv/chat` from `NexAppShell`, which uses `useNexVoice`.

**Finding:** voice input DOES land on the endpoint that hosts the language classifier. Homophone disambiguation is a real signal for the future. This slice therefore **catalogues** homophone groups so a future disambiguation layer can consume them; it does NOT attempt STT-context rescoring.

---

## B. Files changed · budget accounting

**Budget: 5/5 (owner-set)**

| # | File | Kind | LOC |
|---|------|------|-----|
| 1 | `src/lib/nex/brain/language-lexicon.ts` | NEW | 356 |
| 2 | `src/lib/nex/brain/language-lexicon.test.ts` | NEW | 235 |
| 3 | `src/lib/nex/brain/language-intelligence.ts` | MODIFIED (additive — `LexiconAnnotation` type + `annotateLexicon()` + `analyzeMessage` populates `lexicon` field) | +36 |
| 4 | `src/lib/nex/brain/language-intelligence.test.ts` | MODIFIED (lexicon integration + explicit REGRESSION guard) | +90 |
| 5 | `tests/fixtures/conversation-followup-proof/_language_lexicon_expansion_report.md` | NEW | this report |

`src/app/api/nex-conv/chat/route.ts` — **UNTOUCHED**. The lexicon expansion is not wired into the response path in this slice.

---

## C. Verbs catalogued (owner-supplied vocabulary · every lemma tested)

Organised into 14 semantic categories. `verbCategory(token)` returns the primary category; `verbCategories(token)` returns all matching categories.

| Category | Lemmas |
|----------|--------|
| motion | run, jump, walk, swim, fly, drive, ride, sit, stand, sleep, wake, fall, rise, arrive, depart, enter, exit, leave, chase, escape |
| consumption | eat, drink |
| creation | create, build, make, break, fix, mend, cook, bake, draw, paint, write, sing, dance |
| sensory | see, hear, watch, look, touch, feel, listen |
| cognition | think, believe, know, understand, remember, forget, misunderstand |
| emotion | love, hate, like, dislike, want, need, wish, hope |
| communication | speak, talk, tell, ask, answer, reply, explain, describe, define, translate, interpret, argue, debate, discuss, agree, disagree, demand, offer |
| transaction | buy, sell, pay, cost, spend, save, earn |
| possession | give, take, bring, carry, push, pull, lift, drop, receive |
| maintenance | clean, wash, dirty, soil |
| provenance | find, seek, hide, show, source, retrieve, pull, come, came, coming, discover, get, got, getting, gets, lose |
| state | change, stay, remain, continue, repeat, copy, paste, delete, erase, grow, shrink, open, close, shut, lock, unlock, start, begin, stop, end, finish |
| evaluation | test, check, verify, confirm, deny, refuse, accept, try, attempt, fail, succeed, win |
| pedagogical | study, learn, teach, guide, lead, follow, work, play, read |

**Coverage proof:** `describe("owner-supplied verbs · exhaustive membership")` fires one test per lemma from the owner-supplied list — every lemma must both (a) be in `ALL_VERB_LEMMAS` and (b) return a non-null category. All pass.

---

## D. Adverbs catalogued (owner-supplied vocabulary · every lemma tested)

Organised into 7 categories:

| Category | Lemmas |
|----------|--------|
| speed | quickly, slowly, fast, rapidly, suddenly, abruptly, immediately, instantly, promptly |
| time | early, late, now, then, soon, later, yesterday, today, tomorrow, tonight |
| frequency | always, never, sometimes, often, rarely, seldom, frequently, occasionally, usually, generally, normally, typically |
| manner | perfectly, terribly, wonderfully, beautifully, uglily, loudly, softly, quietly, silently, noisily, politely, rudely, kindly, meanly, gently, harshly, roughly, smoothly, easily, well, badly, poorly, correctly, incorrectly, wrongly, rightly, truly, falsely, honestly, dishonestly, bravely, cowardly, carefully, carelessly, safely, dangerously, hard |
| intensity | highly, lowly, deeply, shallowly, widely, narrowly, broadly, closely, distantly |
| location | far, near, nearby, here, there, everywhere, nowhere, somewhere, anywhere, inside, outside, indoors, outdoors, upstairs, downstairs, ahead, behind, forward, backward, sideways |
| difficulty | difficulty, hard |

**Grammatical note recorded in code:** `difficulty` is grammatically a noun; the true adverbial form is `with difficulty` / `difficultly`. It is catalogued per the owner-supplied list; the category exists but is not asserted grammatically correct.

**Coverage proof:** `describe("owner-supplied adverbs · exhaustive membership")` fires one test per adverb. All pass.

---

## E. Homographs & homonyms · polysemy catalogue

Every owner-supplied word is catalogued in `POLYSEMOUS_WORDS` with ≥2 sense records, each carrying:

- `sense_id` (globally unique identifier e.g. `lead.guide.v` / `lead.metal.n`)
- `pos` (verb / noun / adjective / adverb)
- `gloss` (one-line definition)
- `distinct_pronunciation` (`true` for heteronym / homograph; `false` for homonym — same spelling AND sound)

**Homographs catalogued (15):** lead, tear, wind, live, bow, minute, bass, desert, content, object, row, sow, close, refuse, wound. All flagged with `distinct_pronunciation: true`.

**Homonyms catalogued (15):** bark, bat, mean, well, watch, fly, scale, bank, match, right, rock, spring, fair, trip, palm. All flagged with `distinct_pronunciation: false`.

Public API: `isPolysemous(word)` · `sensesOf(word)`.

**Coverage proof:** `describe("owner-supplied homographs · catalogued as polysemous")` + `describe("owner-supplied homonyms · catalogued as polysemous")` fire one test per word. Additional quality tests assert sense_id uniqueness, POS presence, and gloss content. All pass.

---

## F. Homophones · group catalogue

15 owner-supplied groups catalogued in `HOMOPHONE_GROUPS`:

| Group |
|-------|
| their · there · they're |
| to · too · two |
| your · you're |
| its · it's |
| here · hear |
| see · sea |
| break · brake |
| flour · flower |
| weak · week |
| right · write |
| sun · son |
| buy · by · bye |
| cell · sell |
| meat · meet |
| piece · peace |

Public API: `hasHomophones(word)` · `homophonesOf(word)`.

**Coverage proof:** for every word in every group, `homophonesOf(word)` must return the full group. Self-consistency (every alternate resolves back to the same length) explicitly tested. All pass.

---

## G. Integration into language-intelligence.ts

`analyzeMessage(message: string)` now returns an additional `lexicon: LexiconAnnotation` field:

```typescript
export type LexiconAnnotation = {
  verbs: Array<{ token: string; categories: VerbCategory[] }>;
  adverbs: Array<{ token: string; categories: AdverbCategory[] }>;
  polysemous_tokens: Array<{ token: string; senses: ReadonlyArray<WordSense> }>;
  homophone_tokens: Array<{ token: string; alternates: ReadonlyArray<string> }>;
};
```

Example (`analyzeMessage("their meat is here")`):

```json
{
  "verbs": [],
  "adverbs": [{ "token": "here", "categories": ["location"] }],
  "polysemous_tokens": [],
  "homophone_tokens": [
    { "token": "their", "alternates": ["their", "there", "they're"] },
    { "token": "meat",  "alternates": ["meat", "meet"] },
    { "token": "here",  "alternates": ["here", "hear"] }
  ]
}
```

**Additivity guarantee:** the intent-composition rules (`interpretIntent`) do NOT reference the `lexicon` field. Regression tests explicitly assert that every previously-passing intent classification still passes byte-identically. See § I.

---

## H. Tests

### Language + lexicon suite

```
$ npx vitest run src/lib/nex/brain/language-lexicon.test.ts \
    src/lib/nex/brain/language-intelligence.test.ts \
    src/lib/nex/brain/result-followup.test.ts

Test Files  3 passed (3)
Tests       442 passed (442)
```

Delta vs. prior slice: 89 → 442 = +353 new lexicon-level tests. The bulk of the increase is per-lemma coverage of the owner-supplied vocabulary (every verb, every adverb, every homograph, every homonym, every homophone in every group is individually asserted).

### Full brain + programmer regression

```
$ npx vitest run src/lib/nex/brain src/lib/nex/programmer-learning \
    src/lib/nex/programmer-review src/lib/nex/programmer-benchmark \
    src/lib/nex/programmer-stability

Test Files  129 passed | 2 skipped (131)
Tests       3210 passed | 44 skipped (3254)
Duration    10.05s
```

Delta from prior GREEN: 2857 → 3210 = +353 (matches the lexicon test additions exactly).

**Zero newly introduced failures. All 5 programmer phases + all brain slices preserved.**

### Live-server sanity (post-expansion)

The result-follow-up reproduction runner was executed after the expansion. Live behaviour unchanged:

- PRIMARY `where you find them` → provenance answer ✅
- Semantic variants (`where did you find these?` / `where are these from?` / `how did you find them?`) → provenance answers ✅
- CONTEXT T3 `tell me more about the first one` → Gaotama Hotel resolved (P0.3 preserved) ✅
- FRESH-CONV `where did you find them?` → honest boundary (no fabrication) ✅
- P0.4 PRESERVED `Tell me about the first hotel.` → boundary reply ✅

---

## I. REGRESSION guard · intent-composition contract

`REGRESSION · intent composition unchanged after lexicon expansion` in `language-intelligence.test.ts` asserts every result-followup, location, and ordinary sample still classifies identically. All pass. This is the check-in-code that additivity was preserved.

---

## J. What NEX now knows (honest inventory)

For any single word from the owner-supplied lists, NEX can now answer:

- **Verb?** Which semantic category (motion / cognition / …).
- **Adverb?** Which category (speed / time / frequency / …).
- **Polysemous?** Yes/no, plus a structured record of every known sense with POS + gloss + pronunciation-distinction flag.
- **Homophone?** Yes/no, plus the full set of same-sounding alternate spellings.

That is the entire capability delivered by this slice. It is a first-class lookup — not a claim of understanding.

---

## K. What is deliberately NOT built (locked, needs its own AUTHORIZE)

- Sense disambiguation for polysemous words (which sense of "lead" is meant in a given message?)
- Homophone routing via STT context (was the user's spoken "there" actually "their"?)
- POS tagging beyond the lexicon's static per-sense POS annotation
- Agreement / tense / subcategorisation grammar checking
- Wiring of `lexicon` field into the LLM composer (`response-composition.ts`) or deterministic reply paths
- Multilingual coverage (Indonesian lexicon)
- Morphological expansion (running / ran / runs beyond what's in each set)
- Word-embedding / semantic-similarity retrieval
- Any autonomous behaviour · scheduler · workforce activation

The lexicon module is the **substrate** these future capabilities will consume. It is not itself any of them.

---

## L. Final claim

🟢 **Owner-supplied vocabulary catalogued, individually tested, additively integrated into `analyzeMessage()`. 0 regressions across brain + all 5 programmer phases (3210 tests). Sense disambiguation, homophone routing, and grammar-model work explicitly deferred and require their own AUTHORIZE.**

**HARD STOP · LEXICON EXPANSION COMPLETE · AWAITING REVIEW**
