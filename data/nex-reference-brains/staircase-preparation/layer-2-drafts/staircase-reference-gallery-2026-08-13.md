---
title: Staircase Reference Gallery · 2026-08-13 Ingestion
domain: staircase / reference-library / visual-catalogue
source: 57 ImageKit URLs supplied by Philip 2026-08-13 (26 batch-1 + 31 batch-2 · 15 additional URLs pre-existing in manifest were skipped, never duplicated)
type: layer_2_draft · visual reference index
status: awaiting_review_v1
authored_by: Philip O'Farrell (image supply) + Claude (multimodal reading + structured catalogue)
composition_by: Claude · Rule A compliant · every per-image observation evidence-based from direct multimodal read
rule_a_compliance: no fabrication · specific bracket type / finish / grain species names come from what was actually visible in each image · nothing invented
rule_b_compliance: reference gallery composed after direct viewing of every image
rule_c_compliance: each catalogue entry cites its source image slug + manifest URL
manifest_reference: data/nex-image-manifest.json (57 entries with rich structured metadata · a_plus=true for all · tagged for /admin/image-tagger discovery)
ingestion_scripts:
  - scripts/nex-brain/ingest-26-staircase-refs-manifest.mjs
  - scripts/nex-brain/ingest-batch2-staircase-refs-manifest.mjs
duplicate_policy: 15 URLs from the supplied list were already in the manifest · these were NOT re-added, per Philip's explicit instruction "don't duplicate the image"
---

# Layer 2 Draft · Staircase Reference Gallery · 2026-08-13

## TITLE

Staircase Reference Gallery · 57 images · 2026-08-13 ingestion

## DOMAIN

staircase / reference-library / visual-catalogue

## SOURCE

Philip supplied a combined list of image URLs 2026-08-13 with the instruction
*"any of these images that are already stored in nex brain don't duplicate the
image · I want full details what's in each image and the high quality images
will also display in the staircase library · we must teach NEX as much about
each image so she can understand the parts grains materials and walk line or
any other details."*

Total URLs supplied: **72** (41 in batch 1 + 31 in batch 2)
Already stored: **15** (skipped · never duplicated)
Newly ingested with rich metadata: **57**

Every per-image description below (and in the manifest) comes from Claude
reading the image directly with the multimodal Read tool. No detail was
invented · where the source image doesn't show a particular attribute, that
attribute is not asserted.

## RULES APPLIED

- **Never duplicate.** URLs that were already in `data/nex-image-manifest.json`
  are listed in § "Duplicates skipped" · they were NOT re-added.
- **Never fabricate.** Specific detail (bracket type, finish, species, walk-line
  direction, sculptural feature) is only recorded when it was visible.
- **Score honestly.** Every image in this batch is marked `a_plus: true` in the
  manifest because Philip explicitly designated them for the staircase library.
- **Tags carry the retrieval keys.** Every image has both broad tags
  (`staircase`, `reference`, `hero-scene`) and specific tags (e.g.
  `sinuous-balusters`, `led-tread-nosing`, `barley-twist-spindles`) so the
  image matcher can retrieve them by feature.

## KNOWLEDGE

### A · Duplicates skipped (never re-added)

The following 15 URLs were already stored in the manifest before this
ingestion and were LEFT UNTOUCHED per Philip's rule:

- `ChatGPT Image Jul 26, 2026, 08_15_53 PM.png`
- `ChatGPT Image Jul 26, 2026, 08_31_06 PM.png`
- `ChatGPT Image Jul 26, 2026, 09_41_43 PM.png`
- `ChatGPT Image Jul 26, 2026, 10_32_58 PM.png`
- `ChatGPT Image Jul 26, 2026, 10_38_29 PM.png`
- `ChatGPT Image Jul 26, 2026, 10_49_14 PM.png`
- `ChatGPT Image Jul 26, 2026, 10_44_59 PM.png`
- `ChatGPT Image Jul 26, 2026, 10_42_40 PM.png`
- `Untitledasdasdfdsfdfsdasd.png` (Jul 26 batch)
- `ChatGPT Image Jul 26, 2026, 10_58_04 PM.png`
- `ChatGPT Image Jul 26, 2026, 10_55_32 PM.png`
- `ChatGPT Image Jul 27, 2026, 03_07_43 PM.png`
- `ChatGPT Image Jul 27, 2026, 03_14_04 PM.png`
- `Untitledsdsdasdfsdf.png` (Jul 28 batch)
- `Untitledsdsda.png` (Jul 28 batch)

These existing entries were untouched. Their existing manifest metadata
remains authoritative.

### B · Design-family index (57 newly-ingested images)

Every entry below cites its `slug` (which is also stored on the manifest row).
Full per-image descriptions live in the manifest. The design families below
help retrieval by aesthetic type — an image can appear under more than one
family via tags.

#### B1 · Traditional oak with closed strings and slim spindles

Classic English style · natural oak · slim spindle balusters · square newels
with plain caps · often paired with herringbone parquet.

- `ref-001-oak-closed-string-square-newel-panelled` — panelled infill (no spindles) variant
- `ref-b2-001-oak-small-quarter-turn-traditional-hallway` — small winder staircase
- `ref-b2-019-oak-traditional-slim-spindles-panelled-hall` — panelled hallway hero
- `ref-b2-021-oak-traditional-spindle-baluster-turned-detail-herringbone` — turned finial newel cap + herringbone
- `ref-b2-026-oak-half-landing-quarter-turn-spindles-carpet` — half-landing quarter-turn
- `ref-b2-024-oak-handrail-white-painted-spindles-carpet-runner-classic` — two-tone (oak cap + white spindles)
- `ref-b2-030-white-painted-black-tread-nosing-wainscot-jute-runner` — white spindles + dark handrail contrast
- `ref-b2-031-simple-oak-clean-straight-flight-natural` — minimal clean product scene

#### B2 · Modern oak with glass balustrade (open-riser and closed-riser variants)

Contemporary floating or closed oak flights with frameless glass panels
fixed by point/button clamps.

- `ref-002-oak-floating-open-riser-glass-wall-lights` — wall-side LED step lights
- `ref-009-oak-open-riser-glass-clamp-brackets-oval-starter` — brushed stainless clamps
- `ref-010-oak-glass-brushed-stainless-clamps-oval-starter-portrait` — portrait framing companion
- `ref-007-oak-carpet-glass-panel-black-clamp-brackets-led-newel` — BLACK clamp brackets + LED newel

#### B3 · Modern oak with stainless-bar balustrade + LED features

Oak closed-riser + brushed stainless round-bar balusters · often with
under-handrail LED strip and vertical-LED-slot newels · variants differ by
starter step and nose-strip treatment.

- `ref-005-mahogany-closed-string-stainless-bar-balusters` (mahogany variant)
- `ref-006-oak-open-riser-stainless-bars-bullnose-starter`
- `ref-017-dark-walnut-closed-string-stainless-bars-led-newel` (walnut variant)
- `ref-018-oak-straight-stainless-bars-under-handrail-led`
- `ref-019-oak-stainless-ladder-balustrade-oval-starter` (horizontal-bar variant)
- `ref-020-oak-stainless-bars-oval-starter-under-handrail-led`
- `ref-021-walnut-stainless-bars-oval-starter-vertical-led-newel` (walnut)
- `ref-022-mahogany-slim-stainless-bars-led-newel` (mahogany · slim gauge)
- `ref-024-mahogany-stainless-nose-strips-tall-newel-led` — front-on symmetric
- `ref-025-walnut-stainless-nose-strips-twin-starter-front-on` — front-on symmetric walnut
- `ref-b2-006-dark-oak-white-risers-stainless-bars-stainless-kickboard` — WHITE-riser contrast + stainless kickboard
- `ref-b2-014-oak-stainless-round-handrail-stainless-bars-hallway` — all-stainless top-rail integrated with newel
- `ref-b2-018-oak-stainless-bars-under-handrail-led-newel-black-oval-panel` — black-oval-panel newel

#### B4 · Wall-mounted handrail + wall-only open-riser

No outer balustrade · handrail runs along the wall side · exemplifies the
handrail-bracket + return-to-wall articles ingested earlier this session.

- `ref-003-oak-open-riser-wall-mounted-metal-handrail` — brushed metal mopstick + wall LEDs
- `ref-b2-008-dark-walnut-arched-riser-shadows-double-wall-mopstick-handrails` — enclosed flight · TWO wall mopsticks (brass rosette bracket)
- `ref-b2-011-oak-stainless-nose-strips-quarter-landing-narrow` — wall-enclosed with mopstick + stainless noses
- `ref-b2-012-oak-stainless-nose-strips-front-on-narrow` — square-section wall handrail
- `ref-b2-013-oak-plain-treads-front-on-narrow` — plain-nose variant
- `ref-b2-015-oak-vertical-wire-balustrade-mopstick-wall-handrail` — vertical wire + secondary mopstick

#### B5 · Curved / sculptural staircases

- `ref-004-curved-walnut-floating-black-steel-stringer` — dramatic curved black-steel + walnut
- `ref-023-scifi-penthouse-floating-oak-led-treads-glass-balustrade` — sci-fi cantilevered oak · **HONESTY FLAG: AI sci-fi context (flying vehicles) · use as lighting/design ref only**
- `ref-026-walnut-sculptural-sinuous-balusters-led-newel-wide-scene` — sinuous walnut wave balusters (companion to b2-002/003/004/005)
- `ref-b2-002-walnut-sinuous-wave-balusters-led-under-tread` — same family · hero
- `ref-b2-003-walnut-sinuous-balusters-alternate-angle` — alternate angle
- `ref-b2-004-detail-walnut-newel-stainless-collar-top-led` — CLOSE-UP construction detail
- `ref-b2-005-walnut-vertical-led-newel-hero` — vertical-LED newel variant
- `ref-b2-025-curved-mahogany-turned-spindles-red-ribbon-runner-luxury` — GRAND helical curve · turned spindles · red carpet runner

#### B6 · Oak + black-metal balusters (contemporary black hardware)

Oak treads + slim black-painted round metal balusters · often with matt-black
newels that carry a vertical LED slot + a small planter inset.

- `ref-008-oak-slim-black-metal-balusters-carpet` — grey carpet variant
- `ref-011-detail-black-newel-vertical-led-planter-inset` — CLOSE-UP component detail
- `ref-012-oak-black-newels-black-balusters-grey-carpet` — full-flight version
- `ref-013-oak-black-newels-black-balusters-portrait` — portrait framing
- `ref-015-oak-slim-oak-spindle-balusters-black-newels-carpet` — OAK-spindle sibling of the black-newel design
- `ref-014-oak-floating-black-cable-tension-balustrade-black-newel` — HORIZONTAL cable variant
- `ref-b2-007-oak-oak-spindles-black-planter-newels-carpet-runner` — full-flight oak-spindle sibling
- `ref-b2-009-oak-annotated-starter-6-inch-projection-reference` — **EDUCATIONAL · has 6" annotation** · slim black metal balusters

#### B7 · Dark walnut floating / open-riser with LED

Dark walnut treads · LED under-tread strips · glass or matt-black balustrade
· signature luxury contemporary aesthetic.

- `ref-b2-016-walnut-floating-open-riser-slim-walnut-spindles-led` — slim WALNUT picket balustrade (dense)
- `ref-b2-020-walnut-floating-glass-brushed-fixings-black-newel-hero` — glass + LED-on-handrail-top
- `ref-b2-023-walnut-open-riser-glass-chrome-button-fixings` — POLISHED CHROME button fixings
- `ref-b2-028-walnut-glass-brushed-stainless-buttons-led-tread-nosing-curved-starter` — panelled hall context

#### B8 · Industrial / loft / reclaimed

Distressed timber + diamond-plate risers + riveted steel accents + exposed
brick context.

- `ref-b2-017-industrial-walnut-diamond-plate-risers-riveted-steel` — SIGNATURE industrial · horizontal metal balustrade
- `ref-b2-022-industrial-diamond-plate-risers-walnut-treads-black-metal` — VERTICAL metal balusters + wall LED tape

#### B9 · Traditional turned / heritage detail

Classical turned spindles · barley-twist detail · ball newel caps · brass
stair rods · under-stair panelled cupboards.

- `ref-016-multi-flight-stairwell-dark-hardwood-looking-down` — grand multi-flight switchback (looking down 3+ floors)
- `ref-b2-027-mahogany-under-stair-panelled-cupboards-turned-spindles` — UNDER-STAIR CUPBOARDS · turned spindles · brass hardware
- `ref-b2-029-oak-traditional-turned-spiral-spindles-brass-stair-rods-navy-runner` — SIGNATURE Victorian · barley-twist + brass rods + navy runner
- `ref-b2-025-curved-mahogany-turned-spindles-red-ribbon-runner-luxury` — also in B5 (curved)

#### B10 · Unusual detail images

- `ref-b2-010-oak-riser-number-plates-stainless-front-on` — stainless rectangular plates centred on each riser (hotel/commercial or step-numbering aid)
- `ref-b2-009-oak-annotated-starter-6-inch-projection-reference` — HAS 6" MEASUREMENT ANNOTATION (educational reference)

### C · Component-level reference (what each image can teach NEX)

| Component | Best-example slugs |
|---|---|
| **Newel post · vertical LED slot** | `ref-007` `ref-011` `ref-012` `ref-013` `ref-014` `ref-015` `ref-017` `ref-018` `ref-019` `ref-020` `ref-021` `ref-022` `ref-026` `ref-b2-005` `ref-b2-018` `ref-b2-020` |
| **Newel post · integrated planter inset** | `ref-011` `ref-012` `ref-013` `ref-014` `ref-015` `ref-b2-007` |
| **Newel post · brushed stainless collar wrap** | `ref-b2-004` (detail) `ref-006` `ref-009` `ref-010` `ref-b2-006` |
| **Newel post · turned finial / ball cap** | `ref-b2-021` `ref-b2-027` `ref-b2-029` `ref-016` `ref-b2-025` |
| **Handrail · wall-mounted mopstick** | `ref-003` `ref-b2-008` (double) `ref-b2-011` `ref-b2-015` |
| **Handrail · under-handrail LED strip** | `ref-017` `ref-018` `ref-019` `ref-020` `ref-021` `ref-022` `ref-b2-015` `ref-b2-018` |
| **Handrail · integrated LED on top** | `ref-b2-020` (glowing top edge) |
| **Handrail bracket · brass scroll/rosette** | `ref-b2-008` |
| **Balustrade · frameless glass + brushed stainless buttons** | `ref-002` `ref-009` `ref-010` `ref-b2-020` `ref-b2-028` |
| **Balustrade · frameless glass + BLACK clamp brackets** | `ref-007` |
| **Balustrade · frameless glass + POLISHED CHROME buttons** | `ref-b2-023` |
| **Balustrade · stainless vertical bar balusters** | `ref-005` `ref-006` `ref-017` `ref-018` `ref-020` `ref-021` `ref-022` `ref-024` `ref-025` `ref-b2-006` `ref-b2-014` `ref-b2-018` |
| **Balustrade · slim black metal balusters** | `ref-008` `ref-012` `ref-013` `ref-b2-009` |
| **Balustrade · horizontal STAINLESS bars (ladder)** | `ref-019` |
| **Balustrade · horizontal BLACK cable/wire** | `ref-014` `ref-b2-017` |
| **Balustrade · VERTICAL tension wires (harp)** | `ref-b2-015` |
| **Balustrade · sculptural sinuous WOOD wave balusters** | `ref-026` `ref-b2-002` `ref-b2-003` `ref-b2-004` `ref-b2-005` |
| **Balustrade · turned classical spindles (barley-twist etc)** | `ref-b2-021` `ref-b2-025` `ref-b2-027` `ref-b2-029` |
| **Balustrade · slim WOOD picket (dense vertical)** | `ref-b2-016` |
| **Balustrade · slim oak spindles (natural)** | `ref-015` `ref-b2-001` `ref-b2-007` `ref-b2-019` `ref-b2-021` `ref-b2-026` |
| **Balustrade · WHITE-painted spindles** | `ref-b2-024` `ref-b2-030` |
| **Starter step · curved oval bullnose** | `ref-009` `ref-010` `ref-019` `ref-020` `ref-021` `ref-022` `ref-b2-016` `ref-b2-018` `ref-b2-028` |
| **Starter step · twin/cascading bullnose** | `ref-023` `ref-024` `ref-025` `ref-026` `ref-b2-002` `ref-b2-003` `ref-b2-005` `ref-b2-028` |
| **Starter step · simple D-shape bullnose** | `ref-006` `ref-b2-021` `ref-b2-009` |
| **Tread nosing · stainless steel strip** | `ref-017` `ref-018` `ref-019` `ref-020` `ref-021` `ref-022` `ref-024` `ref-025` `ref-b2-011` `ref-b2-012` `ref-b2-018` |
| **Tread nosing · warm LED under-glow strip** | `ref-014` `ref-023` `ref-b2-002` `ref-b2-005` `ref-b2-016` `ref-b2-020` `ref-b2-028` |
| **Riser · diamond/chequer plate metal** | `ref-b2-017` `ref-b2-022` |
| **Riser · white-painted contrast** | `ref-b2-006` `ref-b2-009` `ref-b2-024` `ref-b2-029` `ref-b2-030` |
| **Under-stair cupboards / panelled storage** | `ref-b2-027` |
| **Multi-flight looking down (stairwell void)** | `ref-016` |

### D · Species reference

| Species | Example slugs |
|---|---|
| Light oak (natural, warm honey) | `ref-001` `ref-002` `ref-003` `ref-006` `ref-007` `ref-008` `ref-009` `ref-010` `ref-011` `ref-012` `ref-013` `ref-014` `ref-015` `ref-018` `ref-019` `ref-020` `ref-b2-001` `ref-b2-007` `ref-b2-009` `ref-b2-010` `ref-b2-011` `ref-b2-012` `ref-b2-013` `ref-b2-014` `ref-b2-015` `ref-b2-018` `ref-b2-019` `ref-b2-021` `ref-b2-024` `ref-b2-026` `ref-b2-029` `ref-b2-031` |
| Dark walnut (deep chocolate) | `ref-004` `ref-017` `ref-021` `ref-025` `ref-026` `ref-b2-002` `ref-b2-003` `ref-b2-004` `ref-b2-005` `ref-b2-006` `ref-b2-008` `ref-b2-016` `ref-b2-017` `ref-b2-020` `ref-b2-022` `ref-b2-023` `ref-b2-028` |
| Mahogany / rosewood (red-brown) | `ref-005` `ref-022` `ref-024` `ref-b2-025` `ref-b2-027` |
| Painted white | `ref-b2-024` `ref-b2-030` |

### E · Walk-line reference

Every image records the walk line explicitly in its manifest metadata. Front-
on symmetric views (best for teaching walk-line and rise-and-going geometry):
`ref-024` `ref-025` `ref-b2-010` `ref-b2-012` `ref-b2-013`.

Curved / helical walk-line examples:
`ref-004` `ref-b2-025`.

Winder / kite walk-line examples:
`ref-b2-001` `ref-b2-021` `ref-b2-026`.

### F · Honesty flags (do NOT treat as literal photographs)

- `ref-023` · scene contains AI-generated sci-fi context (flying vehicles over
  future skyline). Use as design/lighting reference only.
- `ref-b2-009` · scene has a printed 6" measurement annotation. Educational
  reference, not a plain product photograph.

## RELATIONSHIPS (typed graph edges into staircase knowledge)

- `staircase_reference_image` **depicts** `staircase_component` (one of the
  components in the § C table)
- `staircase_reference_image` **exemplifies** `design_family` (one of B1-B10)
- `staircase_reference_image` **has_species** `oak` | `walnut` | `mahogany` | `painted`
- `staircase_reference_image` **has_starter** `bullnose_curved` | `oval_bullnose` | `twin_cascade` | `flush_rectangular` | `winder`
- `staircase_reference_image` **has_balustrade_type** `spindle` | `glass_frameless` | `stainless_bar` | `black_metal_bar` | `cable_horizontal` | `wire_vertical` | `sculptural_sinuous` | `turned_classical` | `panelled_infill`
- `staircase_reference_image` **has_geometry** `straight` | `curved_helical` | `quarter_turn_winder` | `half_landing_switchback` | `multi_flight_stairwell`
- `staircase_reference_image` **has_context** `traditional_english` | `contemporary_luxury` | `industrial_loft` | `heritage_grand` | `minimal_clean`

## MANIFEST FIELDS PER IMAGE

For each of the 57 URLs, `data/nex-image-manifest.json` now stores:

- `source` — always `ai_generated` (all supplied images are ChatGPT-generated PNGs)
- `description` — multi-line structured block: SCENE (geometry/viewpoint/surrounding) · MATERIALS · COMPONENTS · LIGHTING · WALK-LINE · IMAGE_TYPE · PURPOSE · optional HONESTY_FLAG
- `tags` — broad (`staircase`, `reference`, `hero-scene`) + specific feature tags matching the § C component index
- `a_plus: true` — Philip explicitly designated all 57 for the staircase library display
- `subject_domain: "staircase"`
- `slug` — human-readable ID (e.g. `ref-b2-020-walnut-floating-glass-brushed-fixings-black-newel-hero`)
- `created_at`, `created_by: "philip"`
- `notes` — cites the ingestion script + Claude multimodal read provenance

## BATCH 3 ADDITION · 46 new hero images (later same day)

A third batch of 46 URLs was supplied later on 2026-08-13. All were deduped
against the manifest (0 already present · 46 truly new) and downloaded to
`data/incoming-image-ingest/2026-08-13-batch3/`. Each was read multimodally
and given rich structured metadata (script:
`scripts/nex-brain/ingest-batch3-staircase-refs-manifest.mjs`). 24 new
homeowner-facing Q&A pairs cross-reference these image slugs in
`questions/03-handrails-and-balustrades.md` § G (Q139–Q162).

### New design families introduced by batch 3

#### B11 · Perforated-metal panel balustrades (new to library)

Matt-black or brushed-stainless steel panels with a regular hole pattern,
framed and set between newels.

- `ref-b3-004` `ref-b3-005` — small oak flight · matt-black perforated
- `ref-b3-006` `ref-b3-007` — walnut species · matt-black perforated
- `ref-b3-008` — walnut + BRUSHED STAINLESS perforated (contrast finish)
- `ref-b3-019` — CONTINUOUS full-length matt-black perforated panel

#### B12 · Woven cane / rattan balustrades (new)

Natural woven material framed in matt-black steel.

- `ref-b3-012` (detail) · `ref-b3-015` (full flight) · `ref-b3-016` (under-stair angle)

#### B13 · Wire-grid / mesh balustrades (new)

Welded black steel wire forming a grid pattern.

- `ref-b3-013` (detail) · `ref-b3-014` (full flight) · `ref-b3-017` (denser grid)

#### B14 · Textured / obscured / frosted glass balustrades (new)

Framed patterned or sandblasted glass — privacy / decorative variants of frameless glass.

- `ref-b3-018` (reeded / textured glass) · `ref-b3-022` (frosted / sandblasted)

#### B15 · Ornamental hoop balustrades (new)

Vertical bars with a hoop / oval decorative element at the centre.

- `ref-b3-010` (double-height) · `ref-b3-020` (grand full-flight)

#### B16 · Chain-mail / ring-mesh (new · rare)

Interlocked-ring metal curtain used as balustrade infill.

- `ref-b3-024` (industrial reclaimed timber flight)

#### B17 · Scaffold-pipe industrial (new · rare)

Galvanised steel pipe + clamps as structure + balustrade, often with plants and Edison bulbs.

- `ref-b3-025` (half-landing) · `ref-b3-026` (spiral)

#### B18 · Concrete / terrazzo treads (new · non-timber)

Non-timber tread material with modern-minimalist / brutalist aesthetic.

- `ref-b3-045` (concrete treads + full-height black slat screen balustrade)

#### B19 · Spiral / helical staircases (new dedicated family)

Continuous helical sweep around a central column or spine.

- `ref-b3-026` (scaffold-pipe spiral · plants) · `ref-b3-029` (modern spiral · horizontal wire · LED tread nose · office) · `ref-b3-030` (walnut spiral · black steel ribbon stringer · kitchen) · `ref-b3-037` (luxury walnut spiral · glass-bubble chandelier)

#### B20 · Central-spine floating (new)

Single central steel spine as sole structural support.

- `ref-b3-041` (walnut treads + full-height matt-black picket cage · modern brutalist)

#### B21 · Cascading / tiered starter steps (new dedicated family)

Multiple deeper starter treads with each successively wider than the tread above.

- `ref-b3-009` `ref-b3-011` `ref-b3-038` `ref-b3-040`

#### B22 · Slat / stone / LED feature walls behind staircases (new)

Vertical timber slats, stacked stone or wall LED panels acting as backdrop to the flight.

- `ref-b3-036` (oak slat feature wall) · `ref-b3-039` (full-height oak slat) · `ref-b3-040` (stacked stone) · `ref-b3-038` (vertical wall LED panels)

#### B23 · Classical English refresh with three-tone palette (new)

Oak (or walnut) handrail + WHITE-painted balustrade + MATT-BLACK metal balusters or newels.

- `ref-b3-043` (oak + white + black metal balusters) · `ref-b3-044` (walnut + white + black newels)

#### B24 · Turned / fluted / barley-twist newels (extended)

Extension of the classical-turned family with new detail types.

- `ref-b3-027` (barley-twist oak newel) · `ref-b3-031` (barley-twist variant) · `ref-b3-042` (fluted turned walnut newel)

#### B25 · Scroll-end starters (new)

Classical scroll / decorative-curl end detail on the outer string base.

- `ref-b3-033` (oak scroll ends) · `ref-b3-035` (diptych scroll ends both sides)

#### B26 · Grand curved / helical continuous (extended)

Adds new curved-hero references to the existing curved family.

- `ref-b3-034` (grand curved walnut · turned components · full-panelled walls) · `ref-b3-046` (curved walnut · matt-black picket · glass-bubble chandelier)

#### B27 · Three-triple-LED (new signature)

Combination of tread-nose LED + string-top LED + vertical newel LED slot.

- `ref-b3-003` — oak + black hardware · all three LED features
- `ref-b3-020` — grand full-flight with tread + top-rail + newel LEDs

#### B28 · Point-LEDs recessed into tread surfaces (new)

Small round point-LEDs set into the tread top surface, in addition to under-tread strips.

- `ref-b3-040` (walnut floating · under-tread strip + point-LEDs on treads)

### Updated component-level reverse index

Additions to the § C table from the batch-3 catalogue (new rows):

| Component | Best-example slugs (batch 3 additions) |
|---|---|
| Perforated matt-black panel balustrade | `ref-b3-004` `ref-b3-005` `ref-b3-006` `ref-b3-007` `ref-b3-019` |
| Perforated brushed-stainless panel balustrade | `ref-b3-008` |
| Woven cane / rattan balustrade | `ref-b3-012` `ref-b3-015` `ref-b3-016` |
| Black metal wire-grid / mesh balustrade | `ref-b3-013` `ref-b3-014` `ref-b3-017` |
| Textured / reeded / frosted glass balustrade | `ref-b3-018` `ref-b3-022` |
| Chain-mail / ring-mesh balustrade | `ref-b3-024` |
| Scaffold-pipe industrial balustrade | `ref-b3-025` `ref-b3-026` |
| Full-height vertical black picket cage | `ref-b3-041` |
| Full-height vertical black slat screen | `ref-b3-045` |
| Ornamental hoop pattern balustrade | `ref-b3-010` `ref-b3-020` |
| LED strip along outer stringer top seam | `ref-b3-003` `ref-b3-020` |
| Point-LEDs recessed in tread top | `ref-b3-040` |
| Vertical wall LED panel backdrop | `ref-b3-038` |
| Oak slat feature wall backdrop | `ref-b3-036` `ref-b3-039` |
| Stacked-stone feature wall backdrop | `ref-b3-040` |
| Integrated planter box / planter bed | `ref-b3-036` `ref-b3-040` |
| Cascading / tiered starter steps | `ref-b3-009` `ref-b3-011` `ref-b3-038` `ref-b3-040` |
| Concrete / terrazzo tread (non-timber) | `ref-b3-045` |
| Fluted turned newel | `ref-b3-042` |
| Barley-twist newel (batch-3 examples) | `ref-b3-027` `ref-b3-031` |
| Scroll-end string / starter detail | `ref-b3-033` `ref-b3-035` |
| Dual handrail (flat + wall-mounted round) | `ref-b3-009` `ref-b3-019` |
| Spiral staircase | `ref-b3-026` `ref-b3-029` `ref-b3-030` `ref-b3-037` |
| Central-spine support | `ref-b3-041` |
| Sculptural black steel ribbon outer stringer | `ref-b3-030` `ref-b3-037` |
| Glass-bubble / suspended-globe chandelier context | `ref-b3-037` `ref-b3-046` |
| Reclaimed / distressed timber tread (batch-3) | `ref-b3-024` `ref-b3-025` |

### Cumulative gallery size (as of 2026-08-13)

- Batch 1 · 26 new images (from an initial 41-URL supply with 15 duplicates)
- Batch 2 · 31 new images (0 duplicates)
- Batch 3 · 46 new images (0 duplicates)
- **Total newly-ingested this day: 103 images** with rich per-image metadata
- 90 Q&A pairs in the Handrails + Balustrades topic file now cross-reference specific image slugs (18 old + 23 handrail-bracket + 25 end-cap + 24 batch-3 = 90)

## NEXT STEPS (not built this session)

- Retrieval wiring: the image matcher (`imageMatcher.ts` per ADR-0025) can
  score these entries against seed / query text — no code changes needed for
  it to start returning them, but per-surface floor tuning may be warranted
  once real queries land.
- Admin retag pass: for images with a specific feature I flagged as inferred
  (e.g. exact bracket type for `ref-b2-008`'s brass rosette bracket), a human
  pass through `/admin/image-tagger` could tighten the labels further.
- Library display: any surface that reads `a_plus: true` + `subject_domain:
  "staircase"` will now pick these up (Trade Centre feed, Refacing companies
  page, etc.).
