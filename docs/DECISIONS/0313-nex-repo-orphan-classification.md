# 0313 · NEX Repo Orphan Classification

**Status:** Proposed · classification doctrine only · database freeze remains in force · no imports · no physical homes committed
**Founder:** Phillip · directive 2026-09-11 · ADR-0312 approved
**Depends on:**
- ADR-0310 · Knowledge Router + Multi-Substrate Domain Authority
- ADR-0311 · Router Reference Interface
- ADR-0312 · Semantic ↔ Domain Knowledge Bridge
- ADR-0309.1 · Logical Authority Model
- `data/nex-english-source-map/reconciliation-2026-09-11.md`
- `data/nex-english-source-map/path-c-overlap-analysis-2026-09-11.md`

---

## Context

The reconciliation audit and Path C overlap analysis identified four founder-authored files in the repo that hold English/knowledge content NOT present in any database substrate. Each carries `authored_by=philip` provenance and a `verified_at` / `captured_at` timestamp.

Path C proved these are **unique authorities** for their content — zero row-level duplicates in either `nex_dev` or Supabase. Therefore:

- They are not redundant.
- They are not derivative.
- They are not scrapes.
- They are founder-authored source material by explicit provenance.

**ADR-0313 classifies them. It does not move them.** Physical home decisions are deferred to per-orphan follow-up ADRs, each founder-authorised.

## The four orphans

| # | File | Rows | Authored | Provenance |
|---|---|---:|---|---|
| 1 | `data/nex/human-language-map.json` | 16 staircase concepts + 6 diagnostic symptoms | Philip O'Farrell · 2026-07-30 | Governance file itself declares Rule B (no AI authored) + Rule C (attributable origin) + anti-scrape rule |
| 2 | `data/nex-knowledge/kitchen/faqs.jsonl` | 55 UK homeowner kitchen consultative Q&A | Philip · 2026-08-03 | Each row carries `authored_by=philip` + `captured_at` |
| 3 | `data/nex-knowledge/_shared/trade-business/faqs.jsonl` | 12 UK trade business-process FAQs | Philip · 2026-08-03 | Same |
| 4 | `data/nex-intent-phrasings.jsonl` | 164 wide-domain intent phrasings | Philip · 2026-08-03 | Same · additional metadata: `layer1_verb` / `layer2_domain` / `layer3_capability` |

## Decision

Each orphan is classified along **two axes** simultaneously:

- **Axis A · Founder-authored source material?** — YES for all four. Preserved regardless of technical utility. LAM Rule 12 applied: never silently discarded.
- **Axis B · Technical role in the NEX brain architecture** — one of:
  - **Canonical knowledge** · becomes authoritative content in a NEX substrate (with status ladder, promotion pipeline, Guardian + Truth Engine gate)
  - **Supporting retrieval material** · helps queries find canonical content (indexes, aliases, phrasing corpora) · never authoritative
  - **Training data** · used to calibrate NEX intent classification or worker models · never becomes NEX truth
  - **Pure source material** · preserved for audit / historical / re-derivation purposes only

The two axes coexist. All four orphans are founder-authored source material (Axis A YES). Their Axis B role varies.

### Classification per orphan

#### Orphan 1 · `data/nex/human-language-map.json`

| Attribute | Value |
|---|---|
| **Axis A** | ✅ Founder-authored source material · Philip O'Farrell · 2026-07-30 · Rule B enforced |
| **Axis B** | 🟢 **CANONICAL KNOWLEDGE** · People-Say layer (LAM object type 3) |
| **LAM object type** | People-Say translation (folk phrase → canonical trade concept) |
| **Authority** | The file IS the authority today · repo-file substrate |
| **Provisional physical home** | `nex_dev.nex.people_say` (or similarly-named table under `nex.*`) per ADR-0310 Rule R3 (new canonical knowledge → NEX Storage) · deferred to ADR-0313a |
| **Router integration** | `Router.resolveKnowledge` returns People-Say matches when Chat/NEX1 supply a folk phrase (e.g. "wooden bit on the side") · bridge references (ADR-0312) may link a People-Say row to a Supabase trade record |
| **Special rules** | Rule B (no AI authored) inherits from the file · every entry must carry `authored_by` + `verified_at` even after import · anti-scrape rule inherits |
| **6 symptoms** | Sub-classification: the 6 diagnostic symptom patterns (`squeaks_or_creaks` · `movement_or_flex` · `separation_or_gaps` · `damage_or_decay` · `uneven_or_inconsistent` · `finish_failure`) with empty `probable_causes_by_expert` are AWAITING FOUNDER AUTHORING · classified as **draft canonical knowledge · founder-blocked** · they do not import until causes are authored |

#### Orphan 2 · `data/nex-knowledge/kitchen/faqs.jsonl`

| Attribute | Value |
|---|---|
| **Axis A** | ✅ Founder-authored source material · Philip · 2026-08-03 |
| **Axis B** | 🟢 **CANONICAL KNOWLEDGE** · Domain Knowledge (UK kitchen · homeowner-facing consultative Q&A) |
| **LAM object type** | Domain Knowledge record (LAM object type 4) · sub-shape: Q&A pair · not Markdown article |
| **Authority** | The file IS the authority today · repo-file substrate |
| **Provisional physical home** | Two candidates deferred to ADR-0313b: **(a)** `nex_dev.nex.knowledge_faqs` (new table under NEX Storage per Rule R3) · **(b)** Supabase `knowledge_records` with `category="NEX kitchen · Homeowner FAQ"` (co-located with existing UK Trade Knowledge). Founder decides. |
| **Router integration** | `Router.searchKnowledge({query, logical_layer:"domain_knowledge", domain:"ukTrades.kitchen.homeowner_faq"})` returns candidates · bridge references (ADR-0312) may link a kitchen FAQ row to a Supabase kitchen trade article when the topics overlap |
| **Special rules** | Distinct from Supabase `knowledge_records` category "NEX kitchen" (which are trade-technical Markdown articles · 458 rows · different audience) · both may coexist with `describes` or `related` bridges |

#### Orphan 3 · `data/nex-knowledge/_shared/trade-business/faqs.jsonl`

| Attribute | Value |
|---|---|
| **Axis A** | ✅ Founder-authored source material · Philip · 2026-08-03 |
| **Axis B** | 🟢 **CANONICAL KNOWLEDGE** · Domain Knowledge (UK trade business-process · cross-cutting) |
| **LAM object type** | Domain Knowledge record (LAM object type 4) · sub-shape: Q&A pair · cross-cutting (not product-specific) |
| **Authority** | The file IS the authority today · repo-file substrate |
| **Provisional physical home** | Same candidates as Orphan 2 (ADR-0313b decides) · same table would host it since shape is identical |
| **Router integration** | `Router.searchKnowledge({query, logical_layer:"domain_knowledge", domain:"ukTrades.business_process"})` returns candidates |
| **Special rules** | 12 subjects (site visits · quotations · deposits · warranties · snagging · variations · updates · lateness · insurance · preparation · warranties) currently unique to this file — Supabase has zero equivalents |

#### Orphan 4 · `data/nex-intent-phrasings.jsonl`

| Attribute | Value |
|---|---|
| **Axis A** | ✅ Founder-authored source material · Philip · 2026-08-03 |
| **Axis B** | 🟡 **CANONICAL · Intent phrasing corpus** OR 🔷 **Supporting retrieval material** — genuinely ambiguous. Founder decides in ADR-0313c. |
| **LAM object type** | Candidate 1: extension of Semantic layer (LAM object type 2) · specifically new subtype "intent phrasing" alongside `nex.questions` surface_pattern. Candidate 2: Supporting retrieval material used to train intent classifiers · never authoritative. |
| **Authority interpretation** | Philip explicitly authored 164 rows and tagged each with `layer1_verb` (Create/Communicate/Decide) · `layer2_domain` (Design/Website/Marketing/Business/Staircase/Kitchen/…) · `layer3_capability` (Design/Generate/Quote/…). This IS a canonical taxonomy for how founders/customers phrase intents. It is not a scrape. It is not derived. It is not machine-generated. |
| **Provisional physical home** | Candidates deferred to ADR-0313c: **(a)** `nex_dev.nex.intent_phrasings` (new canonical table under NEX Storage) · **(b)** Extension of `nex_dev.nex.questions` with a new `pattern_kind='intent_phrasing'` variant · **(c)** Non-DB · loaded into a runtime supporting cache at process start |
| **Router integration** | If canonical: `Router.searchKnowledge({logical_layer:"semantic", domain:"ukTrades.intent"})` returns phrasings for the resolved verb+domain+capability triple. If supporting: they seed an intent-classifier's training input · never returned by Router directly. |
| **Recommendation (founder decides)** | Treat as **CANONICAL · Intent phrasing corpus** because (i) Philip authored 164 rows deliberately · (ii) taxonomy is explicit and named by founder · (iii) LAM Rule 12 says founder-authored knowledge must never be silently discarded. But leave the door open for a supporting-role classification if founder's intent was training-only. |
| **Special rules** | Wide domain (Design · Website · Marketing · Business · Staircase · Kitchen · Interior Design · Construction · Home · Sales · Finance · Personal · Customer Service · etc.) · some domains overlap Supabase categories (Kitchen · Staircase · Interior Design) — bridges (ADR-0312) may link intent phrasings to Supabase records when semantics align |

## Classification summary table

| Orphan | Founder-authored source? | Technical role | LAM object type | Router path |
|---|---|---|---|---|
| human-language-map.json | ✅ YES | 🟢 CANONICAL | 3 · People-Say | `resolveKnowledge` (folk-phrase input) |
| kitchen/faqs.jsonl (55) | ✅ YES | 🟢 CANONICAL | 4 · Domain Knowledge (Q&A) | `searchKnowledge(domain:"ukTrades.kitchen.homeowner_faq")` |
| trade-business/faqs.jsonl (12) | ✅ YES | 🟢 CANONICAL | 4 · Domain Knowledge (Q&A) | `searchKnowledge(domain:"ukTrades.business_process")` |
| nex-intent-phrasings.jsonl (164) | ✅ YES | 🟡 CANONICAL (recommended) / 🔷 supporting (alt) | 2 · Semantic extension OR supporting | `searchKnowledge(logical_layer:"semantic", domain:"ukTrades.intent")` if canonical |

## Preservation rules (locked)

### Rule OP1 · Founder-authored source material is preserved regardless of technical role

The four repo files stay on disk. Even if some or all are imported into a database substrate later, the original file survives with commit history intact. This mirrors LAM Rule 12 (existing knowledge is preserved; migration is additive and reversible).

### Rule OP2 · Provenance follows the row into any future physical home

If Orphan N is imported later, every imported row must carry:
- `source_ref` pointing at the original file path
- `source_reference` naming the specific row / line / key
- `authored_by = "philip"` (or the founder's stated identity)
- `captured_at` / `verified_at` preserving the original timestamp
- `licence_terms` if the file declares them (only human-language-map.json currently declares governance rules explicitly)

### Rule OP3 · No silent transformation of founder content

If Orphan N is imported, the founder's exact wording (phrasing · question · concept name · people_say entry) is preserved verbatim in a body/text field. Any AI-generated normalisation is stored in a separate field. The founder's authorship remains the anchor.

### Rule OP4 · Rule B (no-AI-authored) propagates for People-Say

Orphan 1's `human-language-map.json` declares `rule_b_no_ai_authored`. This rule inherits into any physical home. AI may cluster / dedupe / propose new entries · never author them.

### Rule OP5 · Rule C (attributable origin) propagates

Every row imported from any orphan must carry `authored_by` + `verified_at` in the target substrate.

### Rule OP6 · Anti-scrape rule propagates for People-Say

Orphan 1 declares that People-Say entries come only from own customer conversations + expert authoring · never scrapes. Any future People-Say enlargement respects this.

### Rule OP7 · Orphans do not import until per-orphan founder authorisation

No orphan lands in a database substrate until its per-orphan follow-up ADR (0313a · 0313b · 0313c · 0313d) is drafted, reviewed, and founder-authorised. Guardian check + Truth Engine sign-off apply on the import path.

## What ADR-0313 does NOT do

- ❌ Does not import any orphan into any database substrate.
- ❌ Does not create any table.
- ❌ Does not commit a physical home for any orphan.
- ❌ Does not modify any orphan file.
- ❌ Does not decide whether Orphan 4 is Canonical or Supporting (founder decides in ADR-0313c).
- ❌ Does not write bridge references from any orphan to any Supabase or `nex.*` row.
- ❌ Does not open Gate 3.

## Follow-up ADRs (numbered slots reserved · each founder-authorised)

- **ADR-0313a · People-Say Physical Home** — target table for `human-language-map.json`. Recommended: `nex_dev.nex.people_say` under NEX Storage (per ADR-0310 Rule R3). Doctrine + schema DDL draft only · no rows populated. Guarded by Rule B inheritance.
- **ADR-0313b · FAQ Q&A Physical Home** — target table for `kitchen/faqs.jsonl` + `trade-business/faqs.jsonl` (same shape). Two candidates for founder review: (i) `nex_dev.nex.knowledge_faqs` (new NEX Storage table) · (ii) Supabase `knowledge_records` co-location (categories `NEX kitchen · Homeowner FAQ` + `NEX Trade · Business Process FAQ`).
- **ADR-0313c · Intent Phrasing Corpus Physical Home + Role** — canonical vs supporting decision + physical home for `nex-intent-phrasings.jsonl`. Founder decides Axis-B role first.
- **ADR-0313d · Staircase Symptoms Expert Authoring Path** — the 6 symptom patterns in `human-language-map.json` have empty `probable_causes_by_expert`. Founder-authored causes are required before this content leaves draft state. ADR-0313d defines the authoring workflow (draft → expert → Truth Engine → authoritative).
- **ADR-0313e · Guardian Rules for Orphan Import** — the deterministic Guardian checks that run on any orphan import (shape · required provenance · Rule B/C/anti-scrape enforcement · no silent transformation).

## Consequences

### Positive

- **Every founder-authored asset is now formally classified** without being touched.
- **Provenance preservation rules (OP1-OP7) are locked** before any migration is contemplated. Every future ADR-0313a/b/c/d/e inherits them.
- **The 164 intent phrasings are recognised as canonical or supporting**, but not silently discarded regardless of the axis-B decision.
- **The 6 draft staircase symptoms are recognised as blocked on founder authoring** and cannot silently import.
- **Router path per orphan is sketched** — each orphan has a named future retrieval interface.
- **Bridge references (ADR-0312) can link kitchen FAQs to Supabase kitchen articles** and staircase People-Say to Supabase staircase articles when founder authorises · without duplicating content.

### Negative

- **Chat and NEX1 cannot yet call the Router for these orphans** because their physical homes are unbuilt. Orphans remain repo-file-accessible only. Until ADRs 0313a-e land, direct file reads by application code are technically permitted (existing pattern for `human-language-map.json` via `src/lib/nex/reflex/trade-terminology.ts`) but non-Router paths are officially deprecated for future work.
- **The 6 staircase symptoms remain unusable** until founder authors probable_causes. This is by design — better than silent import with empty cause arrays.

### Rejected alternatives

- **Import all four orphans now** — Rejected. Founder directive: doctrine only · no imports.
- **Delete or ignore orphans not yet in DB** — Rejected. Violates LAM Rule 12 · founder-authored knowledge preserved.
- **Treat `human-language-map.json` as supporting retrieval material** — Rejected. It is founder-authored canonical knowledge for the People-Say layer per ADR-0309 and ADR-0310. Its data shape is fundamentally different from a retrieval index.
- **Treat FAQ Q&A pairs as unstructured "articles" to fit Supabase `knowledge_records` schema** — Rejected without founder input. ADR-0313b lets founder decide.

## Open founder decisions (unblock follow-up ADRs · not gate this one)

1. **Axis-B role for intent phrasings** — canonical or supporting? (ADR-0313c)
2. **Physical home for FAQ Q&A** — `nex.knowledge_faqs` (NEX Storage) or Supabase co-location? (ADR-0313b)
3. **Timing for staircase symptom probable_causes** — when does founder plan to author them? (ADR-0313d)
4. **Guardian check tightness for orphan import** — how strict? (ADR-0313e)
5. **Bridge scaffolding** — should ADR-0313a-c include example bridge references (ADR-0312) to Supabase, or defer to a separate ADR-0313f?

## Freeze status · post-ADR-0313

Unchanged.

- Hard freeze on writes to `nex_dev`.
- Hard freeze on writes to Supabase.
- No source files under `src/` touched.
- No new tables.
- No orphan imported.
- No orphan file modified.
- No bridge row created.
- No cross-substrate copies.
- Repo orphans stay exactly where they are on disk.
- English Brain expansion frozen (permanent · founder directive 2026-09-11).
- Gate 3 remains CLOSED.

## References

- ADR-0028 · NEX Intelligence Constitution
- ADR-0300 · NEX own storage migration blueprint
- ADR-0308 · English Brain v1 · semantic schema
- ADR-0309 · Layered architecture
- ADR-0309.1 · Logical Authority Model
- ADR-0310 · Knowledge Router + Multi-Substrate Domain Authority
- ADR-0311 · Router Reference Interface
- ADR-0312 · Semantic ↔ Domain Bridge
- `data/nex-english-source-map/reconciliation-2026-09-11.md`
- `data/nex-english-source-map/path-c-overlap-analysis-2026-09-11.md`

---

**End of ADR-0313 · classification doctrine only.**
**Zero orphans imported. Zero tables created. Zero content copied. Repo files untouched.**
**Freeze in force across all substrates.**
