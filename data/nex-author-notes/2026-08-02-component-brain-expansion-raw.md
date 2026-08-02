# Component Brain Expansion · Philip 2026-08-02 (huge)

Raw index of Philip's Component Brain expansion covering Parts 2-14.

## Priority order (Philip's stated build sequence)

1. **Balustrade Brain (highest)** — Newel · Handrail · Baluster · Glass balustrade
2. **Stringer Brain** — determines staircase construction
3. **Tread + Riser Brain** — materials + manufacturing
4. **Installation Brain** — measuring · fitting · fixing · site problems
5. **Conversation Brain Layer 0** — context memory

## Destinations

| File | Coverage | Approx Qs |
|---|---|---|
| `data/nex-component-qa/newel.json` | Anchor of the balustrade · types · fixing · alignment · out-of-plumb diagnosis | 30 |
| `data/nex-component-qa/handrail.json` | Profiles · transitions · continuous flow · wall-mounted | 18 |
| `data/nex-component-qa/baluster.json` | Square vs turned · weak points · dowel fixings · spacing · strength depends on connection | 22 |
| `data/nex-component-qa/balustrade-glass.json` | Frameless · framed · post system · base channel · glass ≠ no structure | 15 |
| `data/nex-component-qa/stringer.json` | Closed / cut / mono / twin · wall stringers · concealed structure · floating | 18 |
| `data/nex-component-qa/tread.json` | Solid oak · engineered · MDF · glass · squeaks · cracks · thickness | 18 |
| `data/nex-component-qa/riser.json` | Open vs closed · materials · relationship to tread · proportion | 8 |
| `data/nex-component-qa/landing.json` | Half / top / balcony · structural role · connection to staircase | 12 |
| `data/nex-universal-qa.json` | Geometry — rise · going · angle · headroom · universal principles | 18 |
| Memory | 2 new immutable rules (COMPONENT_IDENTITY_RULE + NEX ANATOMY MODEL) | — |

## Golden principles preserved (verbatim)

- *"A staircase is not individual parts. It is one engineered system."*
- *"The visible material is not always the structural material."*
- *"Appearance does not confirm strength."*
- *"Hidden does not mean stronger."*
- *"A staircase component can identify a staircase system even when the complete staircase is not visible."*
- *"All staircases use the same basic geometry rules."*
- *"Rise determines how high · Going determines how far · Angle determines the slope · Headroom determines whether the person can safely occupy that space."*
- *"When a newel is not plumb, diagnose the complete staircase system — the cause may be the newel itself (twist/bow), the fixing, or the string."*

## NEX ANATOMY 5-System Model (verbatim)

```
SYSTEM_1_STRUCTURE     stringers · steel frames · supports · brackets
SYSTEM_2_WALKING_SURFACE   tread · nosing · riser
SYSTEM_3_SAFETY        handrail · balusters · glass · balcony railing
SYSTEM_4_CONNECTION    fixings · joints · newels
SYSTEM_5_FINISH        timber · paint · metal finishes
```

## Load path (verbatim)

```
PERSON → HANDRAIL → NEWEL → BALUSTRADE → STRINGER → TREAD → STRUCTURE
```

## Universal Geometry Formula

- **Angle = tan⁻¹(rise ÷ going)**
- Rise = vertical height per step (or total rise = floor-to-floor)
- Going = horizontal depth per step (or total going = total run)
- All staircase types (straight · quarter turn · half turn · spiral · helical · floating · steel · timber · glass · concrete) use the same underlying calculation

## Angle classification (verbatim from Philip)

- Very steep: ~45°+ — compact, ladder-like feeling
- Standard residential: ~35°–42° — comfortable, common
- Gentle: ~30°–35° — luxury feel, more space
- Very shallow: <30° — ramp-like, large footprint

## Headroom principles

- Measured from tread nosing (pitch line) upward to lowest obstruction
- Follows the walking line — must be checked at every point
- 3D problem: vertical (floor height + risers + headroom) · horizontal (going + stair run + opening length) · width (stair width + wall + balustrade space)
- Common failure areas: top of stair · under floor edge · near beams · at landings
- Solutions: increase opening · reduce angle · adjust rise/going · modify structure — never make steps uneven

## Newel alignment causes (verbatim from Part 14)

Post out of plumb can be caused by:
1. Newel post twist (timber movement · incorrect machining · poor storage · moisture)
2. Newel post bow (curve along length)
3. Stringer out of plumb (controls staircase line — leaning string = leaning newel)
4. Uneven floor level
5. Incorrect fixing (loose · not fully seated · insufficient support)
6. Staircase structure movement (timber movement · settlement · weak connection)
7. Manufacturing tolerance (inaccurate cutting · incorrect machining)

Inspection order: post itself → fixing → staircase structure → handrail continuity.

Do NOT immediately adjust the newel without checking cause — forcing a straight newel when the stringer is wrong misaligns everything else.

## Component Identity Rule (NEW · immutable)

*"A staircase component can identify a staircase system even when the complete staircase is not visible."*

Extends the prior Vision Rule ("a staircase remains a staircase even when the image is incomplete"). Both live in memory together as Nex's visual identity policy.
