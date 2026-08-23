# NEX Directory Factory · Calibration Report

**Generated:** 2026-08-22T23:46:04.707Z
**Scorer version:** `era1-v1`
**Total candidates:** 3
**Tier distribution:** 🟢 HIGH=0 · 🟡 MEDIUM=0 · 🔴 LOW=3 · ⚪ UNSCORED=0

## Placeholder thresholds in use
| Tier | quality_score | safety_score |
|---|---|---|
| 🟢 HIGH | ≥ 0.85 | ≥ 0.9 |
| 🟡 MEDIUM | ≥ 0.5 | ≥ 0.5 (and not HIGH) |
| 🔴 LOW | anything else | |

> ⚠️ **Do NOT lock these thresholds against this report.** Purpose is to observe scorer behaviour against real candidates, not to invent numbers. Philip 2026-08-23.

> ⚠️ **Nothing is auto-activated.** The scorer runs and records · Factory activation (Phase 3) is not yet built · kill switch would be OFF by default even when it is.

## Natural score gap analysis

Sorted by `quality_score` DESC. Largest adjacent gap suggests a natural threshold.

| Rank | proposed_id | quality | safety | tier | gap to next |
|---|---|---|---|---|---|
| 1 | `restaurant` | 0.5984 | 0.0000 | 🔴 LOW | 0.0455 |
| 2 | `coffee-cafe` | 0.5529 | 0.4590 | 🔴 LOW | 0.2263 |
| 3 | `fast-food` | 0.3266 | 0.0000 | 🔴 LOW | — |

---

## Per-candidate detail

### Candidate 1 · `restaurant` (food)

- **Candidate id:** `8801e9af-be3f-4631-a54d-c726fcde41d1`
- **Countries:** ID
- **Proposed by:** `factory:manual:run-scorer`
- **Candidate created:** 2026-08-22T23:37:01.730Z
- **Admin decision:** `pending`

#### Score
| | Value |
|---|---|
| Quality score | **0.5984** |
| Safety score | **0.0000** |
| Provisional tier | 🔴 **LOW** |
| Primary hazard | keyword-collision |
| Scorer version | `era1-v1` |
| Scored at | 2026-08-22T23:40:43.241Z |

#### Signals (all 14 Era-1 inputs)
| Signal | Value |
|---|---|
| `superseded` | ❌ false |
| `cycle_count` | 7 |
| `business_count` | 889 |
| `osm_tag_strength` | fuzzy |
| `language_coverage` | en-only |
| `coord_completeness` | 1 |
| `address_completeness` | 0.193 |
| `contact_completeness` | 0.11 |
| `image_evidence_count` | 0 |
| `route_collision_risk` | ❌ false |
| `duplicate_of_existing` | ❌ false |
| `geographic_clustering` | 0.487 |
| `observation_span_days` | 0.111 |
| `keyword_collision_risk` | ✅ true |

#### Quality breakdown (weighted contributions)
| Signal | Weight | Raw | Contribution |
|---|---|---|---|
| cycle_count | 0.2 | 0.875 | 0.175 |
| completeness | 0.1 | 0.435 | 0.0435 |
| business_count | 0.3 | 1 | 0.3 |
| osm_tag_strength | 0.15 | 0.2 | 0.03 |
| geographic_clustering | 0.1 | 0.487 | 0.0487 |
| observation_span_days | 0.15 | 0.008 | 0.0012 |

#### Safety penalties applied
| Penalty | Multiplier | Reason |
|---|---|---|
| fuzzy_osm | 0.6 | osm_tag_strength=fuzzy · signal is name-based not tag-based |
| keyword_collision | 0 | brain_keyword overlaps with active Registry entry |
| no_image_evidence | 0.9 | no image_candidates on the row |
| language_not_bilingual | 0.85 | brain_keywords are en-only only |

#### Evidence
```json
{
  "city": "Yogyakarta",
  "source": "walker-classifier-primary",
  "country": "ID",
  "vertical": "food",
  "thresholds": {
    "cycle_count_observed": 7,
    "cycle_count_required": 2,
    "business_count_observed": 889,
    "business_count_required": 50
  },
  "observed_at": "2026-08-22T23:37:01.728Z",
  "pattern_key": "primary=restaurant",
  "cycle_run_id": "cf24865a-41b1-4b99-a0cb-e6997692cb4e",
  "classifier_primary": "restaurant"
}
```

#### Sample businesses (8/15)
- `#FL-2026-00001` — Kedai Kebun (Yogyakarta) · osm/node/1640337574
- `#FL-2026-00002` — Nanamia Pizzeria (Yogyakarta) · osm/node/2837092409
- `#FL-2026-00009` — Mediterranea by Kamil (Yogyakarta) · osm/node/3487442212
- `#FL-2026-0000A` — GIB GIB Calzone (Yogyakarta) · osm/node/5346914521
- `#FL-2026-0000B` — Kantin Calsita (Yogyakarta) · osm/node/1362917046
- `#FL-2026-0000C` — Gadri (Yogyakarta) · osm/node/1366438104
- `#FL-2026-0000D` — Lotus Garden (Yogyakarta) · osm/node/1640337576
- `#FL-2026-0000G` — RM Padang AMBO (Yogyakarta) · osm/node/1748289552

#### Human calibration question
> Would you actually trust NEX to create the directory `/restaurant` automatically for ID · vertical=food?  🔴 scorer says **LOW**.

#### Calibration annotations · human verdicts
| Annotator | Verdict | Reason | When |
|---|---|---|---|
| `philip@nex` | 🔴 **LOW** (✅ agrees) | parent-overlap with active /food · Era-1 correctly blocks · Era-3 revisit if commercial signals justify a focused /restaurant subdirectory | 2026-08-22T23:45:54.333Z |

---

### Candidate 2 · `coffee-cafe` (food)

- **Candidate id:** `f9702846-f3b9-4499-baf7-7922947ca922`
- **Countries:** ID
- **Proposed by:** `factory:manual:run-scorer`
- **Candidate created:** 2026-08-22T23:37:01.776Z
- **Admin decision:** `pending`

#### Score
| | Value |
|---|---|
| Quality score | **0.5529** |
| Safety score | **0.4590** |
| Provisional tier | 🔴 **LOW** |
| Primary hazard | fuzzy-osm-signal |
| Scorer version | `era1-v1` |
| Scored at | 2026-08-22T23:40:43.248Z |

#### Signals (all 14 Era-1 inputs)
| Signal | Value |
|---|---|
| `superseded` | ❌ false |
| `cycle_count` | 8 |
| `business_count` | 225 |
| `osm_tag_strength` | fuzzy |
| `language_coverage` | en-only |
| `coord_completeness` | 1 |
| `address_completeness` | 0.222 |
| `contact_completeness` | 0.08 |
| `image_evidence_count` | 0 |
| `route_collision_risk` | ❌ false |
| `duplicate_of_existing` | ❌ false |
| `geographic_clustering` | 0.533 |
| `observation_span_days` | 0.111 |
| `keyword_collision_risk` | ❌ false |

#### Quality breakdown (weighted contributions)
| Signal | Weight | Raw | Contribution |
|---|---|---|---|
| cycle_count | 0.2 | 1 | 0.2 |
| completeness | 0.1 | 0.434 | 0.0434 |
| business_count | 0.3 | 0.75 | 0.225 |
| osm_tag_strength | 0.15 | 0.2 | 0.03 |
| geographic_clustering | 0.1 | 0.533 | 0.0533 |
| observation_span_days | 0.15 | 0.008 | 0.0012 |

#### Safety penalties applied
| Penalty | Multiplier | Reason |
|---|---|---|
| fuzzy_osm | 0.6 | osm_tag_strength=fuzzy · signal is name-based not tag-based |
| no_image_evidence | 0.9 | no image_candidates on the row |
| language_not_bilingual | 0.85 | brain_keywords are en-only only |

#### Evidence
```json
{
  "city": "Yogyakarta",
  "source": "walker-classifier-primary",
  "country": "ID",
  "vertical": "food",
  "thresholds": {
    "cycle_count_observed": 8,
    "cycle_count_required": 2,
    "business_count_observed": 225,
    "business_count_required": 50
  },
  "observed_at": "2026-08-22T23:37:01.775Z",
  "pattern_key": "primary=coffee-cafe",
  "cycle_run_id": "cf24865a-41b1-4b99-a0cb-e6997692cb4e",
  "classifier_primary": "coffee-cafe"
}
```

#### Sample businesses (8/15)
- `#FL-2026-00003` — Awor Gallery & Coffee (Yogyakarta) · osm/node/6507784886
- `#FL-2026-00004` — Ngoopsky Street Coffee Sleman Yogyakarta (Yogyakarta) · osm/node/12337486177
- `#FL-2026-0000F` — Kopi Jos (Yogyakarta) · osm/node/1697828567
- `#FL-2026-0000N` — LIQUID (Yogyakarta) · osm/node/1848017150
- `#FL-2026-00014` — Jogja Milk (Yogyakarta) · osm/node/3215024599
- `#FL-2026-00017` — Rumah Bawah Coffee & Chill (Yogyakarta) · osm/node/3229480991
- `#FL-2026-00018` — Warung Kopi Lidah Ibu (Yogyakarta) · osm/node/3229480992
- `#FL-2026-0001B` — Melu Cafe (Yogyakarta) · osm/node/3229516709

#### Human calibration question
> Would you actually trust NEX to create the directory `/coffee-cafe` automatically for ID · vertical=food?  🔴 scorer says **LOW**.

#### Calibration annotations · human verdicts
| Annotator | Verdict | Reason | When |
|---|---|---|---|
| `philip@nex` | 🔴 **LOW** (✅ agrees) | parent-overlap with active /food · fuzzy OSM signal · Era-1 correctly blocks · Era-3 revisit if coffee demand justifies focused /coffee-cafe subdirectory | 2026-08-22T23:45:54.362Z |

---

### Candidate 3 · `fast-food` (food)

- **Candidate id:** `77acd916-b681-468f-801b-27776a3f0e6d`
- **Countries:** ID
- **Proposed by:** `factory:manual:run-scorer`
- **Candidate created:** 2026-08-22T23:37:01.787Z
- **Admin decision:** `pending`

#### Score
| | Value |
|---|---|
| Quality score | **0.3266** |
| Safety score | **0.0000** |
| Provisional tier | 🔴 **LOW** |
| Primary hazard | keyword-collision |
| Scorer version | `era1-v1` |
| Scored at | 2026-08-22T23:40:43.252Z |

#### Signals (all 14 Era-1 inputs)
| Signal | Value |
|---|---|
| `superseded` | ❌ false |
| `cycle_count` | 4 |
| `business_count` | 111 |
| `osm_tag_strength` | fuzzy |
| `language_coverage` | en-only |
| `coord_completeness` | 1 |
| `address_completeness` | 0.171 |
| `contact_completeness` | 0.081 |
| `image_evidence_count` | 0 |
| `route_collision_risk` | ❌ false |
| `duplicate_of_existing` | ❌ false |
| `geographic_clustering` | 0.432 |
| `observation_span_days` | 0.064 |
| `keyword_collision_risk` | ✅ true |

#### Quality breakdown (weighted contributions)
| Signal | Weight | Raw | Contribution |
|---|---|---|---|
| cycle_count | 0.2 | 0.5 | 0.1 |
| completeness | 0.1 | 0.417 | 0.0417 |
| business_count | 0.3 | 0.37 | 0.111 |
| osm_tag_strength | 0.15 | 0.2 | 0.03 |
| geographic_clustering | 0.1 | 0.432 | 0.0432 |
| observation_span_days | 0.15 | 0.005 | 0.0007 |

#### Safety penalties applied
| Penalty | Multiplier | Reason |
|---|---|---|
| fuzzy_osm | 0.6 | osm_tag_strength=fuzzy · signal is name-based not tag-based |
| keyword_collision | 0 | brain_keyword overlaps with active Registry entry |
| no_image_evidence | 0.9 | no image_candidates on the row |
| language_not_bilingual | 0.85 | brain_keywords are en-only only |

#### Evidence
```json
{
  "city": "Yogyakarta",
  "source": "walker-classifier-primary",
  "country": "ID",
  "vertical": "food",
  "thresholds": {
    "cycle_count_observed": 4,
    "cycle_count_required": 2,
    "business_count_observed": 111,
    "business_count_required": 50
  },
  "observed_at": "2026-08-22T23:37:01.786Z",
  "pattern_key": "primary=fast-food",
  "cycle_run_id": "cf24865a-41b1-4b99-a0cb-e6997692cb4e",
  "classifier_primary": "fast-food"
}
```

#### Sample businesses (8/15)
- `#FL-2026-00007` — Tunqu Nangkring (Yogyakarta) · osm/node/6824534685
- `#FL-2026-00008` — Dapur Umi Ami Empal Gentong & Ayam Kremes (Yogyakarta) · osm/node/7660028785
- `#FL-2026-0000E` — HokBen (Yogyakarta) · osm/node/1646580099
- `#FL-2026-0000J` — Jogja Chicken (Yogyakarta) · osm/node/1748292226
- `#FL-2026-0000P` — Hoka-Hoka Bento (Yogyakarta) · osm/node/1848508829
- `#FL-2026-0000Q` — Burjo Murni (Yogyakarta) · osm/node/1848508837
- `#FL-2026-0000Y` — Dunkin' (Yogyakarta) · osm/node/2564076661
- `#FL-2026-0000Z` — Olive Fried Chicken (Yogyakarta) · osm/node/2647353737

#### Human calibration question
> Would you actually trust NEX to create the directory `/fast-food` automatically for ID · vertical=food?  🔴 scorer says **LOW**.

#### Calibration annotations · human verdicts
| Annotator | Verdict | Reason | When |
|---|---|---|---|
| `philip@nex` | 🔴 **LOW** (✅ agrees) | parent-overlap with active /food · Era-1 correctly blocks · Era-3 revisit if fast-food demand justifies focused subdirectory | 2026-08-22T23:45:54.364Z |

---

## Scorer-vs-annotator agreement (using latest annotation per candidate)

- Candidates with annotations: **3**
- Scorer verdict matches annotator: **3**
- Scorer verdict disagrees: **0**

## Obvious anomaly callouts

- 🚩 candidate `restaurant` is LOW despite 889 businesses — check for false-LOW (primary hazard: keyword-collision).

## What to do with this report

1. Read each candidate's "Human calibration question" and jot your own verdict (approve as HIGH · approve as MEDIUM · reject).
2. Compare your verdict to the scorer's provisional tier.
3. Look at the "Natural score gap analysis" — is there a clean quality/safety gap between the candidates you'd approve as HIGH vs those you'd send to MEDIUM?
4. If the gap is clean, that's your calibrated HIGH threshold. Encode it in a doctrine amendment; do NOT hot-patch the code.
5. Same for MEDIUM vs LOW.

Until Philip explicitly approves calibrated thresholds, Phase 3 stays not-started and no candidate is auto-activated.
