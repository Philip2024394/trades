# Staircase Brain · Authoring Backlog v0.1

**Purpose:** Per-module status showing what's already captured (from memory + `docs/brains/` briefings) vs what needs to be authored by an expert. This is the concrete roadmap for reaching Phase 3 Definition of Done.
**Reference:** ADR-0039 (Phase 3 · Reference Brain Engineering) · `docs/brains/staircase-phase-3-definition.md` · `feedback_nex_chief_brain_engineer_role.md` (anti-fabrication HARD LAW)
**Anti-fabrication rule:** "Gaps to author" describes TOPICS the module should cover. It does NOT prescribe the content. Actual answers must come from Philip or a certified expert — never invented by the Chief Reference Brain Engineer to fill space.
**Legend:** ✅ Strong · ◐ Partial · ○ Empty · ⛔ Blocked (needs directive to unblock)

---

## Module status

### ✅ `materials`
- **Captured strongly:** American White Oak PBR values locked v1 · 21-material master library at `data/staircase-materials.json` · same-material back-sheeting HARD RULE
- **Gaps to author:** humidity/moisture behaviour per species · finish compatibility matrix · sustainability + FSC/PEFC data · reclaimed / historic timber notes · aged patina considerations
- **Priority next entry:** humidity/movement per species (unlocks Timber Movement adversarial category)

### ✅ `construction`
- **Captured strongly:** housed-string discipline · riser-tread-wedge joint rules · angle blocks width rule · newel-string 4 canonical joint rules · handrail + baserail + baluster sizing (41 mm UK standard) · stringer dimensions UK · baluster count rule · double round starting step · T&G back-sheeting rules
- **Gaps to author:** cut-string construction (historic + modern feature) · curved handrail wreath geometry · winder construction rules · commercial-scale variants · steel-frame + timber-tread hybrid
- **Priority next entry:** cut-string construction (unlocks Historic + Geometry categories)

### ◐ `manufacturing`
- **Captured partial:** some component notes (angle blocks, wedge sizing, veneer wrapping on double round step)
- **Gaps to author:** shop process descriptions (mortice-and-tenon jig setup · housing router setups · sanding schedule · finishing bench) · tolerance targets · pre-assembly checks · flat-pack vs pre-assembled decisions
- **Priority next entry:** tolerance targets — professionals rate a maker on tolerances more than any single output

### ◐ `installation`
- **Captured partial:** back-side sheeting options (T&G · panelling · plasterboard) with pin/batten rules · warnings about softwood 32 mm strings bouncing
- **Gaps to author:** site prep checklist · sequence (which flight first, when to fix newel bases) · tool checklist · snag list handling · moisture equalisation on-site · protection during other trades · handover checklist · warranty rules
- **Priority next entry:** install sequence (unlocks Site Problems category)

### ✅ `design`
- **Captured strongly:** staircase design system prompt (5 future trends · Timber+Metal, Glass Integration, Lighting, Floating, Feature) · property-type awareness (Victorian/1930s/Georgian/etc.) · design philosophy (reference → understanding → original) · plan-size reference tied to Doc K
- **Gaps to author:** traditional-property design guidance (opposite of the current contemporary lean) · rules for matching an existing stair when replacing a section · when to design vs when to preserve · dealing with over-designed client briefs
- **Priority next entry:** traditional-property design (reduces the current bias toward modern)

### ◐ `regulations`
- **Captured partial:** Doc K plan-size reference · England 2013 focus · property-type awareness of hallway widths and floor-to-floor
- **Gaps to author:** Doc B (fire escape) intersection · Doc M (accessibility) intersection · Doc E (sound) intersection · Scotland (Technical Handbook) equivalents · Wales/NI equivalents · listed-building & conservation-area rules (LBC · Article 4) · HMO fire triggers · commercial + institutional variants
- **Priority next entry:** Doc B intersection (unlocks Commercial category)

### ○ `maintenance`
- **Captured:** nothing
- **Gaps to author:** re-oil / re-lacquer schedules per finish · squeak prevention post-install · winter/summer humidity mitigation · balustrade-tightening intervals · fixings inspection · finish repair (spot vs full)
- **Priority next entry:** re-oil / re-lacquer schedules (highest-frequency post-install question)

### ○ `fault_finding` *(Chief Brain Engineer Report #2 · Finding K1)*
- **Captured:** nothing
- **Gaps to author:** six primary failure modes (tread split · wedge failure · squeaks · riser detachment · newel movement · finish cracking) each covering: symptom · likely causes · diagnostic order · repair vs replace decision · customer-communication guidance
- **Priority next entry:** tread split (most common site-callout)

### ⛔ `estimating` *(Chief Brain Engineer Report #3 · Finding K2)*
- **Blocked by:** `feedback_nex_no_prices_unless_facts` HARD LAW — no specific figures
- **Unblock strategy:** reframe as *estimating METHOD*, not prices. Content shape: material take-off methodology · labour hour categories · complexity multipliers · cost drivers (hardwood vs softwood, curved vs straight, glass balustrade multiplier) · quote-adjustment triggers · relative comparisons in prose
- **Priority next entry:** requires Philip's decision to greenlight the methodology reframe

### ◐ `terminology`
- **Captured implicit:** terms used throughout construction/materials memory (tread, riser, going, rise, string, newel, baluster, baserail, handrail, wedge, angle block, housing, mortice, tenon, wreath, winder, bullnose)
- **Gaps to author:** proper glossary with definitions, synonyms, and disambiguation notes (e.g., "going" ≠ "run" but often confused). Should be a first-authored module because every other module references it.
- **Priority next entry:** the whole module — small effort, unlocks explainability of every other answer

### ○ `safety`
- **Captured implicit:** Doc K deference (rise/going/handrail/balustrade dimensions), warnings about softwood 32 mm bounce
- **Gaps to author:** on-site safety (working at height on the flight, edge protection during install, dust management for sanding) · tool safety (router, table saw, plunge) · finish safety (VOC exposure, cure times before re-occupation) · customer safety after handover (children under 5, mobility, pet gates)
- **Priority next entry:** dust management for sanding — universally applicable and often mishandled

### ○ `tools`
- **Captured:** nothing beyond incidental mentions
- **Gaps to author:** essential shop tools · essential site tools · consumables · specialty jigs (housing router, tenoning jig, wreath template) · sharpening & maintenance · budget vs pro tier per category
- **Priority next entry:** essential site tools (installers use this list first)

---

## Suggested authoring order (per Filter 4 — highest trust-multiplier first)

1. **`terminology`** — every other module cites it. Small effort. Immediate explainability win.
2. **`fault_finding`** — unlocks the installer/repair audience (K1).
3. **`materials` humidity guidance** — unlocks Timber Movement adversarial category.
4. **`construction` cut-string + winders + curved wreath** — unlocks Historic + Geometry categories.
5. **`installation` sequence + snag handling** — unlocks Site Problems category.
6. **`regulations` Doc B / M / E intersections + devolved-jurisdiction variants** — unlocks Commercial category.
7. **`design` traditional-property guidance** — corrects current contemporary bias.
8. **`maintenance` re-oil schedules** — highest-frequency post-install question.
9. **`safety` dust management + finish cure** — universally applicable.
10. **`estimating` methodology reframe** — requires Philip's directive to unblock.
11. **`manufacturing` tolerances** — highest peer-respect factor for makers.
12. **`tools` site-first list** — installer-facing.

---

## How to use this backlog

- Every authoring session picks the next entry from this list (or a real unknown surfaced by users, per the Lifetime Loop).
- When an entry is authored → mark ✅ on this file · move the entry from "gaps" to "captured" · add the specific `modules_json` path where the content now lives.
- When a new gap is discovered → add it here with the same shape.
- When Philip approves the identity draft and the Founding Reference Brain Package is loaded, the initial Coverage Map will reflect this backlog automatically.
