# ADR-0314c · Cross-Substrate Contradiction Detection · 🔒 STRUCTURE + RECONCILIATION-FRAMEWORK LOCKED · Specific per-substrate policies PENDING founder authoring

**Status:** 🔒 STRUCTURE + RECONCILIATION-FRAMEWORK LOCKED · founder-authored 2026-09-11 · specific per-substrate policies PENDING · Gate 3 remains CLOSED · zero substrate mutation · doctrine only
**Founder:** Philip (structure locked via Stage 1 · specific per-substrate policies authored in future ADR)
**Consumes:** R-20.v1.0.0 (single-source contradictions · ADR-0314a.2.r) · ADR-0312 Bridge (reference not copy) · ADR-0310 Knowledge Router (multi-substrate) · §7.8 J1 (Physical ≠ logical authority · Rule 15) · §7.5 D1 (Commerce ↔ Business cross-Domain identity) · §7.9 L1 (Services ↔ Business cross-Domain)

**Rule version:** N/A (this is a detection mechanism · consumes R-20 rules) · **Cross-substrate detection version:** `cross_substrate_detection.v1.0.0` (locks when per-substrate reconciliation policies authored)

---

## Section 1 · Purpose

Detect contradictions across NEX substrates (Supabase legacy `knowledge_records` · nex_dev specialist tables · repo-hardcoded knowledge · Lab-harvest verified rows) via Bridge-mediated same-subject comparison. Single-source contradictions are handled by R-20 (ADR-0314a.2.r) · this ADR handles **cross-substrate** cases.

---

## Section 2 · Reconciliation framework (locked)

**Bridge-mediated same-subject detection (per ADR-0312 · reference not copy):**

- Resolve same real-world entity across substrates via Bridge relations
- E.g. `nex.mp_seller ↔ nex.business_lead_directory` when same `business_name + city + phone` OR `subject_ref` match
- E.g. Supabase `knowledge_records.category='NEX door'` ↔ nex_dev canonical Category `door` (per §7.8 J1 physical→logical mapping · future ADR-0314a.2.aa)
- E.g. `nex.food_business ↔ nex.accommodation_business` when same business operates as both restaurant and hotel

**Reconciliation priority (locked · from §7.8 J1):**

1. **Physical Supabase value = EVIDENCE (not authoritative)** per §7.8 J1 Rule 15
2. **Logical Domain value = AUTHORITATIVE** per constitutional layer
3. **When Supabase legacy value contradicts nex_dev specialist substrate** → contradiction recorded · Bridge resolves in favour of specialist substrate (post-migration per ADR-0314a.2.aa)
4. **When two specialist substrates disagree** → contradiction recorded · founder review required · no autonomous resolution
5. **When Lab-harvest verified row contradicts specialist substrate** → contradiction recorded · treated as evidence for founder review

**Idempotency (locked):** same contradiction detected twice → same contradiction row (no duplicates) via deterministic `contradiction_id` derived from `(subject_bridge_id · attribute · substrate_A · substrate_B · value_A · value_B)` composite.

---

## Section 3 · Pending founder-authoring blocks

Master AI does NOT invent per-substrate policies. Founder authors in future ADR (candidate slot ADR-0314c.pop):

**Per-substrate-pair reconciliation policies · pending:**

| Substrate A | Substrate B | Reconciliation policy (illustrative · founder authors) |
|---|---|---|
| Supabase `knowledge_records` | nex_dev `nex.accommodation_business` | Physical Supabase = evidence · logical nex_dev = authoritative · post-ADR-0314a.2.aa migration reduces this class of contradictions |
| Supabase `knowledge_records` | nex_dev `nex.food_business` | Same pattern |
| nex_dev `mp_seller` | nex_dev `business_lead_directory` | Founder authors priority when same entity appears in both |
| nex_lab_food.verified | nex.food_business | Lab-verified is evidence · specialist substrate is authoritative post-promotion via business-lead-executor |
| ... | ... | ... |

Founder authors per-substrate-pair specific rules.

**Bridge relation names · pending (per ADR-0314a.2.l extensions):**
- `bridges_to` (candidate · same real-world entity across substrates)
- `physical_representation_of` (candidate · per §7.8 J1 Rule 15)
- `cross_substrate_alias` (candidate · Supabase legacy ↔ nex_dev specialist)

Founder authors specific Bridge relation names in ADR-0314a.2.l.bridge (a §7.4 C1 extension to R-13 vocabulary).

---

## Section 4 · Constitutional invariants (locked)

1. **Bridge-mediated same-subject detection** (per ADR-0312 · reference not copy)
2. **Physical value = evidence · logical value = authoritative** (per §7.8 J1 Rule 15)
3. **Cross-substrate contradiction recorded in `nex.contradictions`** with substrate-pair identification
4. **Idempotent detection** · same contradiction detected N times = 1 contradiction row
5. **No autonomous reconciliation** when two specialist substrates disagree · founder review required
6. **Missing evidence · Bridge unresolvable · substrate unavailable** → UNKNOWN · **never CONTRADICTION** (per §7.7 H1)
7. **Read-only during detection** · writes to `nex.contradictions` only · never modifies source substrates
8. **Amendment path** requires explicit founder-authored versioning-policy ADR

---

## Section 5 · Enforcement implications (doctrine · not implemented)

- Guardian rule: cross-substrate write-boundary check runs when a promotion event touches multiple substrates (business-lead-executor · Lab-promotion · etc.)
- Guardian rule: contradictions recorded in `nex.contradictions` with `cross_substrate: true` flag · substrate_A · substrate_B · attribute
- Guardian rule: contradiction recording BLOCKS promotion to AUTHORITATIVE across substrates until founder review
- Truth Engine cross-substrate verdict records `cross_substrate_detection_version` per evaluation
- Router boundary applies §7.8 J1 physical→logical translation before cross-substrate comparison

**Substrate impact by this ADR:** 0.

- No `nex.contradictions` rows written (schema-ready · 0 rows · remains 0)
- No Bridge relations invented (ADR-0314a.2.l extension work)
- No physical→logical mapping installed (ADR-0314a.2.aa work)
- No Guardian rule installed
- Gate 3 CLOSED

---

## Section 6 · Decision provenance footer

| Field | Value |
|---|---|
| **Decision** | Cross-substrate contradiction detection · STRUCTURE + RECONCILIATION-FRAMEWORK locked · Bridge-mediated same-subject detection · physical=evidence + logical=authoritative per §7.8 J1 · idempotent per composite contradiction_id · no autonomous reconciliation when specialists disagree · specific per-substrate policies PENDING founder authoring in ADR-0314c.pop |
| **Decided by** | Philip (structure) · founder authors per-substrate policies in future ADR |
| **Decision date** | 2026-09-11 (structure) · policies pending |
| **ADR** | 0314c · consumes future 0314c.pop · ADR-0314a.2.l.bridge · ADR-0314a.2.aa |
| **Effective from** | cross_substrate_detection.v1.0.0 (structure) · policies pending v1.0.0 population |
| **Supersedes** | none |
| **Reason** | R-20.v1.0.0 established deterministic contradiction detection · ADR-0312 established Bridge as reference not copy · §7.8 J1 established physical vs logical authority · this ADR combines those constitutional locks into a cross-substrate detection framework · specific per-substrate policies require founder-authored population. |

---

## Section 7 · What this ADR did NOT do

- ❌ No per-substrate-pair policies authored (founder authors in future ADR)
- ❌ No Bridge relation names authored (ADR-0314a.2.l.bridge · extension ADR)
- ❌ No physical→logical mapping installed (ADR-0314a.2.aa · migration ADR)
- ❌ No `nex.contradictions` rows written · schema-ready 0 rows preserved
- ❌ No Guardian rule installed · no cross-substrate detection code
- ❌ No Gate 3 opened

---

## Section 8 · Cross-references

**Consumed by:** ADR-0314e (verifier applies cross-substrate detection) · Stage 4 autonomous growth loop (contradictions surface during promotion) · ADR-0314a.1 (fixture tests cross-substrate cases)

**Consumes:** R-20.v1.0.0 · ADR-0312 · ADR-0310 · §7.8 J1 · §7.5 D1 · §7.9 L1 · §7.7 H1 · ADR-0314a.2.l · ADR-0314a.2.r · ADR-0314a.2.aa · D-17 amendment clause · feedback_other_vs_unknown_never_silently_converted.md · feedback_observation_is_not_constitutional_authority.md

---

**End of ADR-0314c · structure + reconciliation-framework locked · per-substrate policies pending.**

Master AI STOPS. Awaiting founder review + separate GATE 3 OPEN authorisation.
