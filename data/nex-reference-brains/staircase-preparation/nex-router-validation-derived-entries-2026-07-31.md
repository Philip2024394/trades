---
title: NEX Router Validation Suite · derived entries · 2026-07-31
generated_by: scripts/derive-nex-router-validation-entries.mjs
source_directory: data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/staircase-instances/
total_derived_entries: 5
regenerate: node scripts/derive-nex-router-validation-entries.mjs
purpose: |
  Automatically derived validation entries from existing Layer 1 evidence frontmatter.
  Every artefact authored with Standard v1 metadata (brain · domain · intent · information_type · topics) becomes a Router test row.
  Composes with NEX-ROUTER-VALIDATION-SUITE-v1.md (starter corpus = 6 · derived corpus = 5 · combined available).
philip_directive_2026_07_31: |
  "If you already have 7,000 lines, don't manually create another 7,000 validation entries.
   Instead, write a small converter."
regeneration: |
  This file is regenerated on every knowledge update.
  Do NOT hand-edit rows here — modify the source frontmatter and re-run the converter.
---

# NEX Router Validation Suite · Derived Entries (5 rows)

Every row below was derived automatically from the frontmatter of an existing Layer 1 evidence artefact. The Router expected values come from the metadata fields Philip has been authoring under Standard v1 discipline. **Do not hand-edit this file** — modify the source frontmatter and re-run the converter.

| User Question | Expected Intent | Expected Subject | Expected Brain | Expected Domain | Expected Info Type | Clarify? | Evidence Used | Pass/Fail | Source Artefact |
|---|---|---|---|---|---|---|---|---|---|
| Can I supply my own timber for my staircase? | Advise | Reclaimed timber | Staircase | Customer FAQ | Best Practice | No | *derived* |  | `nex-customer-faq-can-i-supply-my-own-timber-for-my-staircase.md` |
| Can my site carpenter install my new staircase instead of the staircase company's installers? | Advise | Site carpenter | Staircase | Customer FAQ | Best Practice | No | *derived* |  | `nex-customer-faq-can-my-site-carpenter-install-my-staircase.md` |
| Can my staircase maker also make a matching hallway table or other furniture? | Advise | Matching furniture | Staircase | Customer FAQ | Function | No | *derived* |  | `nex-customer-faq-can-my-staircase-maker-make-matching-furniture.md` |
| Can the staircase installation team fit my loft ladder while they're on site? | Advise | Loft ladder | Staircase | Customer FAQ | Best Practice | No | *derived* |  | `nex-customer-faq-can-staircase-team-fit-loft-ladder.md` |
| Is installing a staircase on a new build just the responsibility of the staircase company? | Explain | New build | Staircase | Customer FAQ | Function | No | *derived* |  | `nex-customer-faq-new-build-staircase-multi-trade-coordination.md` |

---

## Regeneration

```
node scripts/derive-nex-router-validation-entries.mjs
```

Every time a new authored artefact is added to `staircase-instances/` with proper Standard v1 frontmatter, run this script and the validation corpus grows automatically. Zero manual maintenance.

## Composition with Standard v1

The converter reads these frontmatter fields per Standard v1 Part 5:

- `title` → User Question (fallback when Customer Question section not present)
- `intent[0]` → Expected Intent (primary of multi-value)
- `topics[0]` → Expected Subject (primary of multi-value)
- `brain` → Expected Brain
- `domain` → Expected Domain
- `information_type[0]` → Expected Info Type (primary of multi-value)
- Customer Question section (`> ***…***`) → User Question (overrides title for Customer FAQ articles)
- Clarify heuristic: Buy/Enquire/Quote intents on short (<4 word) questions → Yes/Maybe

## Growth ladder position (per Philip's revised 2026-07-31 ladder)

- v1 = 6 diagnostic questions (starter corpus in the main Suite)
- v2 = 100 representative questions
- v3 = 1,000 questions
- v4 = 7,000 existing staircase questions (source: existing Q&A corpus · use this converter pattern to derive)
- v5 = Live production questions (after launch · new questions Nex hasn't seen · measures generalisation)

The derived corpus above bootstraps v4-style growth from whatever authored evidence exists at any point in time.
