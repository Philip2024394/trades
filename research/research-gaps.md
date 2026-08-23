# Staircase Research · Gaps & UNKNOWNS

**Version:** v1 · 2026-08-17
**Rule from spec:** "UNKNOWN or NEEDS_REVIEW preferred to invention." Every item flagged low-confidence in the regional agent output is captured here. Each gap has a proposed closure path.

---

## Category A — Concept mergers we did NOT resolve

### A1 · French spiral vs helical
**Gap:** French practice frequently uses `escalier hélicoïdal` and `escalier en colimaçon` interchangeably. Product photos are the only reliable disambiguator.
**Impact:** A French customer selecting "helical" may in fact mean spiral, or vice versa.
**Confidence:** MEDIUM — the distinction exists in DTU documentation but is not enforced in trade speech.
**Closure path:** in the wizard, when a French customer picks either spiral or helical, always show a side-by-side visual (column vs open well) and reconfirm before submitting.

### A2 · Spanish `helicoidal` in LatAm context
**Gap:** In LatAm Spanish, `escalera helicoidal` is frequently used for central-column type — opposite to Spain usage.
**Impact:** If the Trade Centre extends to LatAm markets (Mexico, Argentina, Colombia, Chile), the same term flips meaning.
**Confidence:** MEDIUM.
**Closure path:** flag LatAm as separate regional pack when it launches — do not reuse ES pack for LatAm without a term-by-term re-review.

### A3 · Swedish vindeltrappa / spiraltrappa / spindeltrappa synonym cluster
**Gap:** Swedish Academy treats these three as full synonyms. Some SE trade sites do distinguish (spindeltrappa = central column, vindeltrappa = open well) but this is inconsistent.
**Impact:** SE customer's word choice does not reliably indicate their intent.
**Confidence:** MEDIUM (dictionary evidence is HIGH; trade practice evidence is MEDIUM).
**Closure path:** SE wizard always shows visual disambiguation.

### A4 · Nordic cross-border false friends
**Gap:** SE `vindeltrappa` ≠ DK/NO `vindeltrappe/vindeltrapp` in structural meaning. Multi-Nordic customers may misread.
**Confidence:** MEDIUM.
**Closure path:** never translate directly between SE and DK/NO without a structural qualifier.

---

## Category B — Regulatory / metric anchor uncertainty

### B1 · UK Approved Doc K minimum going / max rise numeric values
**Gap:** deliberately NOT captured in the taxonomy. NEX is a sales tool, not a compliance authority.
**Confidence:** N/A — intentional exclusion.
**Closure path:** none needed — professional review handles this.

### B2 · French NF P01-012:2026 revision terminology shift
**Gap:** the 2026 revision replaces `garde-corps` with `EDP — Élément de Protection`. Adoption timeline in industry-speak is uncertain.
**Confidence:** LOW — the revision is confirmed but the trade adoption phase is in progress.
**Closure path:** support both terms simultaneously in FR pack until at least 2028; revisit annually.

### B3 · Dutch Bbl (Besluit bouwwerken leefomgeving) transition
**Gap:** Bbl succeeds Bouwbesluit 2012 (transition ongoing). Terminology continuity confirmed, article numbering not.
**Confidence:** MEDIUM.
**Closure path:** cite both regulations in the NL sources list; revisit article numbering after full transition (target 2027 review).

### B4 · Belgian tri-lingual code coverage
**Gap:** NBN B 03-004 exists in NL, FR, DE. We covered NL + FR. DE-BE (German-speaking east cantons) not researched.
**Confidence:** LOW for DE-BE.
**Closure path:** add a DE-BE terms note when Belgian coverage becomes commercially active.

### B5 · Swiss language coverage in one country
**Gap:** CH has DE + FR + IT (+ Romansh). We noted the split but did not fully anchor SIA 358's tri-lingual terminology mapping.
**Confidence:** MEDIUM.
**Closure path:** for CH launch, cross-check SIA 358 terms in all three languages before wizard release.

### B6 · US IBC 2024 alternating tread specifics
**Gap:** IBC 1011.14 restrictions on alternating tread devices are complex (varies by occupancy classification). We recorded that they are RESTRICTED, not the full restriction table.
**Confidence:** N/A — intentional exclusion (compliance authority not in scope).
**Closure path:** professional review handles.

---

## Category C — Regional term coverage weakness

### C1 · Finnish trade vocabulary depth
**Gap:** RT 88-10129 is a strong anchor, but the coverage of contemporary architectural terms (bolt-fixed, cantilever variants) in Finnish is thinner than DE/FR/IT.
**Confidence:** MEDIUM.
**Closure path:** flag for a native FI trade review before FI wizard launch.

### C2 · Norwegian nynorsk vs bokmål
**Gap:** Norwegian has two written standards. We covered predominantly bokmål terms.
**Confidence:** LOW for nynorsk.
**Closure path:** add nynorsk labels alongside bokmål when NO wizard launches.

### C3 · Australian carpet-to-timber conversion process vocabulary
**Gap:** Commercial anchor identified but the exact process vocabulary (subfloor prep, tread replacement, riser overlay, board type) is company-specific rather than standardised.
**Confidence:** MEDIUM.
**Closure path:** collect actual AU specialist glossaries when AU trade launches; extend AU pack.

### C4 · New Zealand rimu / matai sourcing constraints
**Gap:** Native NZ species have complex sourcing rules (some heritage-restricted). Recorded protected status for Kauri but not full sustainability constraints for Rimu / Matai.
**Confidence:** MEDIUM.
**Closure path:** cross-check with NZ Timber Design Society / MPI before offering these as customer-selectable options.

### C5 · Regional woodworking traditions inside single countries
**Gap:** Country-level packs treat each country as a single unit. Regional traditions (Bavaria vs North Germany, Tuscany vs Piedmont, Andalusia vs Basque Country) not captured.
**Confidence:** LOW.
**Closure path:** deferred — not needed for v1 wizard. Revisit if regional trade specialists request.

---

## Category D — Compatibility rules we suspect but did not fully verify

### D1 · Structural glass tread minimum thickness by country
**Gap:** Every country has a structural glass code (BS 6180, AS 1288, DIN 18008, NF DTU 39, etc.) with different minimum thicknesses for glass treads. NOT captured — belongs to specialist review.
**Confidence:** N/A — intentional exclusion.

### D2 · Balustrade opening (sphere) rule per country
**Gap:** We captured indicative sphere rules per country in the compatibility file. These are indicative only — occupancy type modifiers not applied.
**Confidence:** MEDIUM (indicative values are correct, occupancy adjustment not modelled).
**Closure path:** ALWAYS route balustrade opening decisions to specialist — do not calculate compliance in the wizard.

### D3 · Fire escape and secondary means-of-egress rules
**Gap:** Deliberately not covered. Massively country-specific and occupancy-specific.
**Confidence:** N/A — intentional exclusion.

### D4 · Cantilever engineering limits
**Gap:** Cantilever staircases have practical maximum tread projection determined by material strength, tread depth, and fixing detail. NOT modelled.
**Confidence:** N/A — intentional exclusion; always specialist review.

---

## Category E — Ambiguity flags carried forward from regional drafts

### E1 · Italian `scala autoportante` — commercial term abuse
Flagged in IT draft. Recorded in terminology as `commercial term — treat with caution`. Not a resolved definition.

### E2 · French `escalier autoportant` — commercial term abuse
Same status as E1 for French.

### E3 · Spanish `pasamanos` colloquial usage
CTE-strict = handrail only. Colloquial = sometimes the whole assembly. We recorded strict definition.

### E4 · French `rampe` polysemy
Recorded in FR pack. `rampe` in a stair context = balustrade+handrail, but `rampe` alone = ramp. Wizard uses `main courante` for the strict handrail sense.

### E5 · Italian `ringhiera vs balaustra vs parapetto` register split
Commercial vs code registers. Wizard uses `ringhiera` on customer-facing screens (commercial) and `parapetto` on any code-adjacent language.

### E6 · Italian `alzata` polysemy
Recorded — technically riser face, colloquially sometimes whole step-height.

### E7 · Spanish `meseta / descansillo / rellano` synonym set
RAE lists as synonyms. CTE uses `meseta`. Wizard uses `meseta` for CTE alignment, offers `descansillo / rellano` as accepted variants.

### E8 · Italian `scala a incasso` — no code definition
Commercial only. Wizard treats as a look-tag not a construction category.

### E9 · Spanish `escalera japonesa` — no code definition
Commercial term for alternating-tread. Wizard maps to `escalera compacta` / `escalera de peldaños compensados`.

### E10 · US "banister" — vernacular imprecision
Colloquial US term meaning either handrail or whole balustrade assembly. Wizard avoids the word entirely; uses `handrail` or `balustrade / railing`.

---

## Category F — Data we cannot deliver in a taxonomy pass

### F1 · Actual customer term-frequency data
**Gap:** We rely on trade documentation. Real customer search-query frequency (what customers actually type in) not measured.
**Closure path:** capture search-query telemetry once the wizard is live; iterate label wording.

### F2 · Voice / phone conversation vocabulary
**Gap:** Voice conversations use even looser terminology than typed. Not modelled.
**Closure path:** deferred until NEX voice channels ship.

### F3 · Regional micro-market pricing anchors
**Gap:** Every region has commercially typical pricing (e.g., UK £5k-£25k for typical loft-to-first-floor timber L-shape). NOT captured — pricing is a specialist output.
**Closure path:** N/A — intentional exclusion.

### F4 · Historical / period-style staircase vocabulary
**Gap:** Georgian, Victorian, Art Deco, Bauhaus, Mid-Century, contemporary — style-family terminology not captured in this pass.
**Closure path:** add a style-family dimension in v2 once the core taxonomy is validated.

### F5 · Bespoke architectural stair vocabulary
**Gap:** Sculptural / architectural / installation stairs (as installed by Bianchini & Capponi, Siller Stairs, etc.) have their own vocabulary largely outside standard codes.
**Closure path:** for the wizard's `bespoke` route, defer entirely to the specialist — no attempt to catalogue.

---

## Category G — Meta gaps in the research approach

### G1 · No native-speaker validation pass
**Gap:** All regional drafts were compiled from documentary sources by agents. No native-speaker trade professional has reviewed each pack.
**Confidence risk:** MEDIUM.
**Closure path:** before any wizard goes live in a given country, have at least one native-speaker specialist review the pack for that country.

### G2 · No customer-usability test on the decision tree
**Gap:** The decision tree is logically consistent but has not been tested with real customers.
**Closure path:** run a usability pass on the wizard before any commercial launch.

### G3 · No historical revision testing
**Gap:** We did not test what happens if a country updates its code between now and wizard launch. No versioning system on the terminology packs.
**Closure path:** add version metadata + change-log per country pack when this reaches v2.

### G4 · Time-sensitive information
**Gap:** Some flagged items (NF P01-012:2026 rev, Dutch Bbl transition) are time-sensitive. This document is dated 2026-08-17; treat any age >6 months on regulatory content as suspicious.
**Closure path:** annual regulatory review cadence per country.

---

## Summary of confidence distribution

Rough split across the terminology database:
- **HIGH confidence:** ~75% of entries (major geometry / structural / material terms in all researched countries with strong Tier 1 anchor)
- **MEDIUM confidence:** ~20% (regional trade vocabulary, less-standardised terms, terms in second languages of multilingual countries)
- **LOW confidence:** ~5% (specialist / historical / rare terms — flagged individually)

Every LOW confidence entry appears in this file. Every MEDIUM entry has been cross-checked with at least one Tier 2+ source. HIGH-confidence entries have Tier 1 anchor + Tier 2 corroboration.

---

## Corpus additions pending (data · not research)

### H1 · Compare-card images for the wizard's visual comparison overlay
**Status:** NEEDS CURATION.
**Consumer:** `staircase-terminology-global.json` ConceptRecord's optional `image_url` field. Adapter surfaces it via `getAlternatives()`. Wizard renders it when present, neutral placeholder gradient when absent.
**Coverage needed (v1 targets):**
- Geometry: straight · quarter_turn · half_turn · winder · spiral · helical · curved (7 images)
- Structural: closed_string · cut_string · mono_stringer · cantilever (4 images)
- Balustrade: timber_traditional · metal_stainless · glass_frameless · cable_horizontal (4 images)
- Riser: closed · open (2 images)
- Tread material: solid_timber · stone · glass · carpet_runner (4 images)
- Material family: timber · mixed_timber_metal · mixed_timber_glass · mixed_metal_glass (4 images)
**Total for MVP:** 25 curated compare-card images.
**Rule (Philip 2026-08-17):** *"Before you judge whether the wizard is genuinely good, the comparison cards need the actual staircase images. Because the whole point is: customer doesn't need to know the technical word. They can recognise the staircase visually."*
**Constraint:** never fabricate — every image must be authentically that staircase type. See ADR-0022 (no third-party image copy without authorisation).
**Suggested source:** NEX image manifest at `data/nex-image-manifest.json` — tag with `taxonomy:geometry.spiral` etc, matcher pulls the top-rated A+ for each concept.

---

## Next research pass priorities (proposed)

1. **Native-speaker review** in each country BEFORE that country's wizard launches (highest priority).
2. **LatAm-Spanish** pack when Trade Centre extends there (per A2).
3. **CH tri-lingual** cross-check before CH launch (per B5).
4. **AU carpet-to-timber conversion** vocabulary from real AU specialists (per C3).
5. **Nynorsk** labels for NO (per C2).
6. **Style-family** dimension (Georgian / Victorian / Bauhaus / contemporary etc. — per F4).
7. **Voice-query** vocabulary once voice channels ship (per F2).

Everything else is intentional exclusion (compliance authority, structural engineering, pricing).
