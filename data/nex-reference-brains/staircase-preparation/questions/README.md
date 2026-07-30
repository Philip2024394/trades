# Staircase Reference Brain — Questions Catalogue

> **Purpose:** the questions customers, tradespeople, architects, and property owners actually ask NEX Staircase. AI-curated per Rule B's permitted activities: *organise · dedupe · suggest-topics · adversarial-question*.
>
> **This is not answers.** These are questions. Answers require Layer 2 expert authorship. But knowing the FULL space of questions the Brain must eventually address is the first step toward coverage-driven authoring.

---

## Rule B compliance — why questions can be AI-curated

Per Chief Reference Brain Engineer HARD LAW · Rule B (Philip 2026-07-28):

> *"AI CAN organise / dedupe / find-contradictions / suggest-topics / adversarial-question — AI NEVER authors trade content."*

**A question is a topic suggestion.** Extracting questions from raw research transcripts, rewording them into clean NEX-standard phrasing, deduping repeated phrasings, and grouping by topic — all four are explicitly permitted AI activities.

The moment an AI writes the *answer* to one of these questions, Rule B kicks in and human authorship is required.

---

## Format for each question

```markdown
### Q### — Canonical question form
- (natural homeowner variant, when meaningfully different)
- (technical trade variant, when meaningfully different)

**Notes:** (optional — stage of conversation this arrives in · answer register · related components)
**Related:** Q###, Q### (cross-references to closely-linked questions)
```

**Rules for wording:**

1. **UK English.** *"Timber"*, *"lorry"*, *"specialise"*, *"colour"*, *"grey"*.
2. **Natural human speech.** Match how a customer at a builder's counter would actually phrase it — not documentation-page style. Contractions welcome.
3. **Concise.** One line per variant. No marketing prose, no philosophy, no *"how does one appreciate..."*.
4. **Present tense.** *"What's the maximum rise?"* not *"What would be the maximum rise?"*
5. **No embedded claims.** *"Why does BWF specify 12mm housings?"* is fine (it names a claim to explore). *"Why is 12mm the industry standard?"* isn't (that presupposes a claim we haven't yet verified).

---

## Topic files

The catalogue is grouped into topic files, each covering one domain of the customer conversation. Numbering is stable — retire an entry with *(retired · reason)* rather than renumbering.

| File | Topic | Question range | Status |
|---|---|---|---|
| `01-fit-and-regulations.md` | Space fit · rise · going · pitch · headroom · flight length · UK vs Ireland | Q001–Q043 | ✅ shipped |
| `02-construction-and-craft.md` | Strings · housings · wedges · newels · joinery · timber selection | Q044–Q072 | ✅ shipped |
| `03-handrails-and-balustrades.md` | Handrail heights · positions · baluster gaps · newel spacing · glass · metal | Q073–Q090 | ✅ shipped |
| `04-installation-and-safety.md` | Flooring · trimmer · plasterboard · top step · radiators · squeaks · repairs | Q091–Q110 | ✅ shipped |
| `05-drawings-quotes-and-service.md` | Drawings · surveys · deposits · complaints · disputes · aftercare | Q111–Q125 | ✅ shipped |
| `06-value-and-property.md` | Cost · house value · replacement value · what makes a staircase valuable | Q126–Q137 | ✅ shipped |
| `07-heritage.md` | Titanic · period stairs · restoration · rare designs · when old is valuable | Q138–Q151 | ✅ shipped |
| `08-historic-construction-methods.md` | How staircases were made in past eras — jointing · tools · timber · apprenticeship-era practice | (Q198+ reserved) | ⬜ placeholder — no questions curated yet |
| `09-materials-and-finishes.md` | Wood vs timber · species · finishes · colour changes · maintenance | Q152–Q165 | ✅ shipped |
| `10-commercial-vs-domestic.md` | Commercial widths · nosings · slip resistance · public buildings | Q166–Q175 | ✅ shipped |
| `11-learning-and-career.md` | Apprenticeships · joiner earnings · trade paths · becoming a staircase maker | Q176–Q187 | ✅ shipped |
| `12-nex-identity-and-limits.md` | Who Nex is · what Nex can/can't do · sources · advisory boundaries | Q188–Q197 | ✅ shipped |

**Total shipped: 197 curated questions across 11 shipped files + 1 placeholder (`08`).**

> **Restructure note (Philip 2026-07-30):** `07-heritage-and-history.md` split into `07-heritage.md` (heritage-value + restoration) and `08-historic-construction-methods.md` (craft technique in past eras). Files 08→09, 09→10, 10→11, 11→12 renumbered accordingly. Q001–Q197 numbers are stable — no question renumbered.

---

## How the catalogue is used

1. **Coverage tracking.** Every published Layer 2 module links to the question numbers it answers. Questions with zero linked modules = coverage gap.
2. **Adversarial evaluation.** The Validation v1.0 protocol (200 diverse questions) draws from this catalogue.
3. **Answer-shape guidance.** The homeowner-vs-trade variants remind the composer that the same intent needs different registers.
4. **Deduplication reference.** Before adding a new question elsewhere in the platform (Golden Reply Library, etc.), check if it's already here.

---

## What is NOT in the catalogue

- **Marketing-style meta-questions** — *"How do I choose a designer?"* is fine; *"How does one experience the journey of craftsmanship?"* is not.
- **Trivia not relevant to customer decisions** — the Titanic staircase weight is a legitimate curiosity question; *"Which trade union governed Titanic's joiners?"* isn't.
- **Duplicates across topic files** — pick the most natural topic for each question. Cross-reference via `**Related:**` rather than copying.

---

## Source transcripts

Every question extraction cites the raw research source in the topic file's front matter. First source (2026-07-29):

- `candidates/2026-07-29-chatgpt-session-dump.md` — Philip's ChatGPT question-discovery session, spanning geometry, regulations, construction, Titanic history, installation, safety, and career topics. AI-generated answers discarded per Rule B; questions extracted and reworded.

Add subsequent sources here as they arrive.
