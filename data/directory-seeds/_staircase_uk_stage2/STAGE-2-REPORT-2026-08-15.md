# UK Staircase Trade Market · Stage 2 · Report

_Generated 2026-08-15 · observed numbers only · no forecasts · Stage 3 blocked until Philip signs off._

## Coverage (real candidate businesses discovered / reached)

- Agents run: 12
- Total raw candidate rows across all agents: 366
- Canonical unique companies after deduplication: 311
- Duplicate rows merged into existing: 55

### Per-agent output

| Agent file | Rows |
|---|---:|
| agent-1-england-north | 45 |
| agent-10-glass-metal-lighting | 25 |
| agent-11-components-parts | 22 |
| agent-12-refacing-deep | 21 |
| agent-2-england-south | 39 |
| agent-3-england-midlands | 33 |
| agent-4-scotland | 35 |
| agent-5-wales | 30 |
| agent-6-northern-ireland | 31 |
| agent-7-national-manufacturers | 26 |
| agent-8-refurbishment-refacing | 29 |
| agent-9-handrail-balustrade-newel | 30 |

## Quality (evidence bands · independent of coverage)

- Band A (website + phone + address + ≥2 capabilities): 239
- Band B (website + phone or email + ≥1 capability): 19
- Band C (website only · minimal evidence): 48
- Band D (no verifiable website): 5
- Records requiring manual review (Band C + D): 53

- Companies with verified website: 306
- Companies with public phone number: 252
- Companies with public business email: 143
- Companies with public postcode: 231

## Capability evidence (a company may have several)

| Capability | Companies with evidence |
|---|---:|
| manufacture (raw · agent-reported) | 270 |
| manufacture (Philip-scope · includes staircase maker, stair supply, stairs producer, bespoke build) | 276 |
| _· of which promoted by expansion pass_ | 6 |
| installation | 211 |
| refurbishment (raw · agent-reported) | 93 |
| refurbishment (Philip-scope · includes handrail/spindle/baluster replacement + upgrade + renovation + restoration) | 95 |
| _· of which promoted by expansion pass_ | 2 |
| refacing | 35 |
| balustrade | 152 |
| handrail | 121 |
| glass | 106 |
| metal | 117 |
| bespoke | 274 |
| design | 239 |

## Geographic distribution

### By region

| Region | Count |
|---|---:|
| NW | 39 |
| Scotland | 38 |
| NI | 33 |
| Yorkshire | 32 |
| Wales | 31 |
| W Mids | 29 |
| SW | 24 |
| E | 23 |
| SE | 23 |
| London | 17 |
| E Mids | 13 |
| NE | 8 |
| _(unspecified)_ | 1 |

### By county (top 20)

| County | Count |
|---|---:|
| Greater Manchester | 14 |
| South Yorkshire | 14 |
| West Yorkshire | 13 |
| Antrim | 12 |
| Staffordshire | 9 |
| Cheshire | 8 |
| Essex | 8 |
| Down | 8 |
| Merseyside | 6 |
| Lancashire | 6 |
| Greater London | 6 |
| Hampshire | 6 |
| West Midlands | 6 |
| Somerset | 6 |
| Warwickshire | 5 |
| Shropshire | 5 |
| Kent | 5 |
| West Glamorgan | 5 |
| Armagh | 5 |
| Tyne and Wear | 4 |

### By town (top 20)

| Town | Count |
|---|---:|
| London | 14 |
| Sheffield | 9 |
| Stockport | 5 |
| Manchester | 5 |
| Edinburgh | 5 |
| Belfast | 5 |
| Liverpool | 4 |
| Oswestry | 4 |
| Stoke-on-Trent | 4 |
| Cardiff | 4 |
| Doncaster | 3 |
| Bradford | 3 |
| East Kilbride | 3 |
| Glasgow | 3 |
| Nottingham | 3 |
| Birmingham | 3 |
| Swansea | 3 |
| Newport | 3 |
| Middleton | 2 |
| Wigan | 2 |

## Coverage vs Quality — kept separate

> Per standing rule (project_nex_coverage_vs_quality_separation_2026_08_14.md), these two numbers are NEVER combined into a single "success" percentage.
>
> **Coverage** = 311 unique companies discovered.
> **Quality**  = 258 passed evidence threshold (bands A + B), 53 require manual review (C + D).

## Manufacture scope clarification (Philip 2026-08-15)

> Manufacture vocabulary variants: **staircase maker · stair supply · stairs producer · staircase manufacture · staircase · stairs · bespoke build · in-house workshop**.

- Agent-reported manufacture: 270
- Expanded (Philip-scope) manufacture: 276
- Newly-promoted records: 6

### Sample of manufacture promotions (first 10)

| Business | Matched signal | Evidence snippet |
|---|---|---|
| Bann Joinery | `\b(bespoke|custom|handmade|hand[- ]crafted|made[- ]to[- ]measure)\s+stair` | Bann Joinery designs, supplies and installs bespoke stair cladding systems (oak, veneer, painted) across London and the … |
| Lucas Kane Carpentry | `\b(bespoke|custom|handmade|hand[- ]crafted|made[- ]to[- ]measure)\s+stair` | Page title: "Custom Stairs & Bannisters Renovations \| Bristol & Bath & North Somerset". WebSearch summary: "Offers soli… |
| The Glasgow Staircase Company | `\b(bespoke|custom|handmade|hand[- ]crafted|made[- ]to[- ]measure)\s+stair` | Website presents company as a premier source for exquisite bespoke staircases in Glasgow, with dedicated pages for glass… |
| Cloud Nine Installs | `\b(bespoke|custom|handmade|hand[- ]crafted|made[- ]to[- ]measure)\s+stair` | Site states Cloud Nine Installs design and install high-quality bespoke staircases (including glass) for homes in Edinbu… |
| LM Joinery | `\b(bespoke|custom|handmade|hand[- ]crafted|made[- ]to[- ]measure)\s+stair` | Belfast-based joinery designing and installing custom staircases with oak, pine or MDF options. Offer bespoke stair desi… |
| Axton's Staircases | `\b(bespoke|custom|handmade|hand[- ]crafted|made[- ]to[- ]measure)\s+stair` | Kent bespoke staircase specialist offering staircase makeovers/transformations across Kent and South London. Portfolio i… |

## Refurbishment scope clarification (Philip 2026-08-15)

> Refurbishment INCLUDES: handrail replacement · baluster/spindle replacement · staircase upgrade · renovation · restoration.

Agents varied in interpretation. Some set refurbishment=true only when the site literally said the word "refurbish". The expansion pass at consolidation time scanned evidence_notes for the broader signals above and promoted refurbishment=true accordingly.

- Agent-reported refurbishment: 93
- Expanded (Philip-scope) refurbishment: 95
- Newly-promoted records: 2

### Sample of promotions (first 10)

| Business | Matched signal | Evidence snippet |
|---|---|---|
| DC & Sons Joinery | `\brefac(e|ing|ed)\b` | Site markets 'Staircase Cladding in Wakefield, Leeds and Across Yorkshire' and 'Staircase Installation in Wakefield, Lee… |
| KwikClad (Kwikstairs Ltd) | `\bexisting\s+stair(case)?\b` | KwikClad (part of the Kwikstairs Group) supplies moulded vinyl stair cladding kits designed to transform old stairs into… |

## What was NOT done

- No companies contacted (email / phone / form). Rule: never contact in Stage 2.
- No writes to Supabase directory_seeds. Rule: staging file first, dry-run before any production write.
- No records invented to hit a target. Rule: never fabricate.
- No directory-profile URLs (Yell / Checkatrade / Bark / Houzz) written as company records. Rule: those are discovery bookmarks, not companies.
- Stage 3 sample review not started · waiting for Philip's sign-off.

## Next step (blocked pending Philip's review)

Stage 3 · pick 20 records from the canonical set for manual inspection (fields · evidence quality · classification correctness). Requires explicit approval before proceeding.