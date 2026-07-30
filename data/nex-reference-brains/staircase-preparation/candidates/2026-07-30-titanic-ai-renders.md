---
topic:               Titanic Grand Staircase — AI-generated renders (NOT authoritative)
source_type:         ai_generated_image
source_document:     ChatGPT image generation (timestamps embedded in URL)
source_person:       —
source_date:         2026-07-29
verification_status: held_in_candidates_awaiting_authoritative_source
promoted_to_evidence: false                        # NEVER `true` unless matched against Harland & Wolff / Titanic Belfast / NMM archive
rule_b_flag:         AI-generated content · CANNOT enter Reference Brain evidence per Rule B
---

# Titanic Grand Staircase — AI-generated renders held in candidates

Philip provided three ChatGPT-generated Titanic staircase images 2026-07-30. Held in candidates only. Not filed in `evidence/heritage/` because they fail every one of Philip's own Titanic-authenticity criteria:

- **Not** Harland & Wolff documentation
- **Not** Titanic Belfast source material
- **Not** National Maritime Museum archive material
- **Not** a recognised historical publication
- **Yes** AI-generated content → Rule B block

## URLs held

```
https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2029,%202026,%2006_33_19%20PM.png?updatedAt=1785324826547
https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2029,%202026,%2006_58_59%20PM.png?updatedAt=1785326359752
https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2029,%202026,%2007_18_55%20PM.png?updatedAt=1785327558152
```

## Why they can't be promoted to evidence

Philip's stated rule for Titanic content (this conversation 2026-07-30):

> *"I'd only add Titanic after evidence exists from sources such as: Harland & Wolff documentation, Titanic Belfast, National Maritime Museum, recognised historical publications."*

Three-Layer Architecture rules that block promotion:

- **Rule A (Anti-Fabrication):** an AI-generated image is not documentation of the original 1912 interior. The wreck condition means no photographs of the original survive in a way that matches these renders. Presenting them as "the Titanic staircase looked like this" would be fabrication.
- **Rule B (No AI-Authored):** AI-generated content cannot enter the Reference Brain. Full stop.
- **Rule C (Attributable Origin):** no named archive, historian, or recognised publication behind these renders.
- **ADR-0040 (Professional Test):** a master joiner couldn't verify these against Harland & Wolff drawings, so peer recommendation of the Brain would be at risk.

## What would unlock promotion

The URLs could be paired with an authoritative source — for example:

- A photograph or drawing from the Harland & Wolff archive that the render closely matches
- A verified reproduction (e.g. Titanic Belfast recreation) with documented lineage back to original sources
- A recognised historical publication with corresponding illustration

At that point the URLs move from `candidates/` to `evidence/heritage/titanic-grand-staircase.md` and the render becomes *"an AI-generated illustration derived from [authoritative source], not a photograph of the original."*

## What NOT to do

- Do NOT quietly attach these URLs to Q138-Q144 in `questions/07-heritage.md` as "reference imagery"
- Do NOT surface these in the runtime NEX chat under Titanic questions
- Do NOT include them in Golden Reply pairs about the Titanic staircase
- Do NOT use them as marketing imagery labelled *"the Titanic Grand Staircase"* — a labelling breach of Rule A

## Legitimate non-Titanic uses (would need re-filing outside this directory)

These same URLs could be legitimate content if the Titanic label is dropped:

- Modern Edwardian-style / grand-curved-staircase inspiration reference (not claiming original)
- Marketing surface OUTSIDE the Reference Brain (advertising a modern reproduction service, with clear "modern reproduction" wording)

Neither of those uses is what this file holds — they'd need re-filing under `data/nex-staircase-inspiration/` or a marketing directory, and are Philip's decision, not the Reference Brain's.

## Audit trail

| Date | Actor | Action |
|------|-------|--------|
| 2026-07-30 | Philip | Provided 3 URLs |
| 2026-07-30 | Claude (Chief Reference Brain Engineer) | Flagged Rule B block; asked where to file |
| 2026-07-30 | Philip | Confirmed: hold in candidates/, do not file |
| 2026-07-30 | Claude | Wrote this file. Not promoted. Not extracted. Zero downstream references. |
