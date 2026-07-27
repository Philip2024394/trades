# UK Staircase Plan-Size Reference

**Purpose:** Working reference for Nex to compute typical footprint requirements for UK staircase layouts, based on Approved Document K (England, 2013 revision) minimum requirements.

**IMPORTANT DISCLAIMERS:**

1. This reference reflects **Approved Doc K (England)**. Wales has its own AD K; Scotland uses the **Technical Handbook Section 4**; Northern Ireland uses **Technical Booklet H**. Regional variations apply.
2. Doc K sets **MINIMUMS, not maximums**. Comfort, available space and budget set the upper end. A staircase can always be larger, wider or grander than the minimums shown here.
3. **Verify against the current published Doc K on gov.uk** before finalising any design. This reference is a starting point, not a Building Control substitute.
4. Historic staircases in **listed buildings** may retain non-compliant originals where Building Control accepts the historic character.

---

## 1. Key Approved Doc K numbers (private stair — with clause references)

Current version: **Approved Document K (2013 edition incorporating 2015 amendments)** — the current England published version.

**Canonical PDF source:** https://assets.publishing.service.gov.uk/media/60d5bdcde90e07716f516cfd/Approved_Document_K.pdf

| Item | Value | Doc K clause | Notes |
|---|---|---|---|
| Uniformity rule | All steps same rise + same going | **Clause 1.1** | Compliance requirement |
| "Private" stair definition | Intended for one dwelling only | **Clause 1.2** | Different rules apply to common stairs |
| Rise | 150-220mm | **Clause 1.3 + Table 1.1** | Every rise same across the flight |
| Going | ≥220mm | **Clause 1.3 + Table 1.1** | Measured along walking line on winders |
| Pitch | ≤42° | **Clause 1.3 + Table 1.1** | Angle of the string to horizontal |
| 2R + G rule | 550-700mm | **Clause 1.4** | Comfort formula (rise × 2 + going) |
| Headroom | ≥2000mm above pitch line | **Clause 1.6** | Continuous, unobstructed |
| Loft-conversion headroom exception | 1900mm at central axis, 2000mm at one side | **Clause 1.7** | Only for loft conversions where space is limited |
| Handrail sides | 1 side if width <1m, 2 sides if width ≥1m | **Clause 1.36** | Continuous over the flight |
| 100mm sphere rule | Max 100mm gap in guarding | **Clause 1.39** | Prevents children slipping through or climbing |
| Tapered treads / winders | See specific rules for walking line | **Clauses 1.9-1.12** | Compliance for winder steps |
| Alternating-tread (space-saver) stairs | Loft-conversion allowance only | **Clauses 1.27-1.28** | Restricted use — not main staircase |
| Handrail height | 900-1000mm above pitch line | (clause TBC) | Well-established but clause not yet confirmed |
| Balustrade height on stair | 900mm above pitch line | (clause TBC) | Well-established but clause not yet confirmed |
| Balustrade height on landing | 1100mm where drop >600mm | (clause TBC) | Well-established but clause not yet confirmed |
| Landing min dimension | ≥ flight width in both directions | (clause TBC) | For direction-change landings |
| Width (private) | No legal minimum since 2010 revision | | Practical min 800mm, recommended 900mm |

---

## 1a. The measurement rules that professionals actually use (from real trade workflow)

Doc K sets the numbers. But real staircase makers apply five extra rules that the regulations don't spell out. Miss any of them and the staircase either doesn't fit or the top/bottom step is wrong.

**Rule 1 — Rise is FINISHED-floor to FINISHED-floor.** If the floors aren't laid yet (very common on new-builds and extensions), the maker must ASK the homeowner exactly what will be laid on the ground floor AND upstairs floor, in writing. Typical UK flooring thickness impact:

| Flooring type | Typical thickness (mm) |
|---|---|
| Solid timber flooring | 18-22 |
| Engineered timber (floating on underlay) | 14-18 |
| Engineered timber on battens | 30-50+ |
| Laminate with underlay | 8-12 |
| Luxury vinyl tile (LVT) | 5-8 |
| Ceramic or porcelain tile (with adhesive) | 10-15 |
| Carpet with underlay | 15-25 |
| Self-levelling concrete | 3-10 |

**Rule 2 — Nosing overhang is NOT part of the going.** The GOING is measured riser-front to riser-front. The typical 22-25 mm bullnose overhang on the tread doesn't count. A Doc K minimum 220 mm going + 25 mm nosing = 245 mm total tread depth, but only 220 mm counts as compliance.

**Rule 3 — Rises = Goings + 1 (default).** You walk up each going and the final rise takes you from the top step onto the landing itself. So a flight with 12 goings has 13 risers. Exception: if the top tread is designed to sit LEVEL with the landing, rises = goings — but this must be specified at drawing stage.

**Rule 4 — Reduce the run for ARCHITRAVE at any doorway top or bottom.** Typical 20-25 mm per side. On a tight run, 40-50 mm total reduction can force a shorter going or shift a landing position.

**Rule 5 — Note skirting height so the stringer can be CUT for the skirting to continue past.** The bottom of the string is rebated to give clearance for the skirting board to run through underneath. Machined in the workshop, not hacked on site.

**Fitting tolerance:** Experienced makers allow ~25 mm fitting tolerance on L-shape staircases to absorb the small out-of-square of most stair openings (trimmer beams are rarely perfectly square with walls below, especially in renovation work). Straight flights are less forgiving.

---

## 2. Footprint calculation formula

For any straight-flight or straight-section-of-turn:

```
number_of_rises   = ceil(floor_to_floor_height ÷ chosen_rise)
number_of_goings  = number_of_rises - 1
flight_length     = number_of_goings × chosen_going
flight_footprint  = width × flight_length
```

Add landings, thresholds and understair usable space as needed.

**Typical calculation for a modern UK new-build:**
- Floor-to-floor: 2500mm
- Rise: 192mm (well within Doc K 150-220mm)
- Number of rises: 13 (13 × 192 = 2496mm ≈ 2500mm)
- Going: 250mm (well above Doc K min 220mm)
- Flight length: 12 × 250 = 3000mm
- Width: 900mm
- **Straight-flight footprint: 900mm × 3000mm + landing = ~2.7-3.2m²**

---

## 3. Footprints per layout type

All footprints below assume:
- **Modern-typical**: 2500mm floor-to-floor, 192mm rise, 250mm going, 900mm width, 13 rises total.
- **Doc K minimum**: 2500mm floor-to-floor, 220mm max rise, 220mm min going, 800mm min width, 12 rises.

### 3.1 Straight staircase

**Description:** One continuous flight, no turn.

| Config | Width | Length | Footprint |
|---|---|---|---|
| Doc K min | 800mm | 12 × 220 = 2640mm + top landing 800mm = **3440mm** | **2.75 m²** |
| Modern typical | 900mm | 12 × 250 = 3000mm + top landing 900mm = **3900mm** | **3.51 m²** |
| Generous / luxury | 1100mm | 12 × 280 = 3360mm + landing 1100mm = **4460mm** | **4.91 m²** |

**Handrail side:** Not relevant to footprint — same either side. Mirror flip only affects direction of view.

**Best for:** Long narrow houses (Victorian terraces, hallway-run staircases). Simple, cheapest, easiest to install.

---

### 3.2 Quarter-turn with LANDING (L-shape)

**Description:** Two flights at 90°, joined by a small landing.

| Config | Footprint calculation | Total |
|---|---|---|
| Doc K min | 800 × 1600 (main flight, 7 rises) + 800 × 800 landing + 800 × 1000 (return flight, 5 rises) = 800×800 + arrangement | **~2.9 m²** |
| Modern typical | 900 × 2000 + 900 × 900 landing + 900 × 1300 return = arranged L | **~3.6 m²** |

**Best for:** Rectangular hallway with an internal corner. Very common in UK Edwardian/1930s semis.

**Mirror flip:** Turn-direction changes. Right-turning L becomes left-turning L. Fully flippable.

---

### 3.3 Quarter-turn with WINDERS (L-shape space-saver)

**Description:** Same 90° change, but the turn uses 2-3 wedge-shaped WINDER steps instead of a landing.

| Config | Footprint | Notes |
|---|---|---|
| Doc K min | ~2.3 m² | Walking-line going must still be ≥220mm |
| Modern typical | ~2.7 m² | 3 winders typical for the turn |

**Compared to landing version:** Saves roughly 0.6-0.9 m² of floor area, but the turn feels tighter and less comfortable for carrying anything up or down.

**Mirror flip:** Fully flippable (winder direction reverses).

---

### 3.4 Half-turn with HALF-LANDING (U-shape / dogleg)

**Description:** Two parallel flights heading opposite directions, joined by a half-landing (approximately 2× flight width).

| Config | Footprint |
|---|---|
| Doc K min | 1600 × 1600 = **2.56 m²** (approx) |
| Modern typical | 1800 × 2000 = **3.60 m²** |
| Generous | 2200 × 2400 = **5.28 m²** |

**Best for:** Compact terraces where you want the staircase to double back on itself. Also common at the top of Victorian terrace basements.

**Mirror flip:** Fully flippable (up-then-down direction reverses).

---

### 3.5 Half-turn with WINDERS (compact dogleg)

**Description:** 180° change achieved with a set of winder steps rather than a half-landing.

| Config | Footprint |
|---|---|
| Doc K min | 1600 × 1700 = **2.72 m²** |
| Modern typical | 1800 × 1800 = **3.24 m²** |

**Compared to half-landing version:** Saves roughly 0.4-0.6 m². Trade-off: winder turn feels tighter, walking-line going must be checked carefully.

**Mirror flip:** Fully flippable.

---

### 3.6 Straight-with-QUARTER-LANDING (single 90° turn near top or bottom)

**Description:** Mostly straight, with a small landing near the top or bottom where the last few steps turn 90° onto a bedroom or landing area.

**Footprint:** Straight-flight footprint + ~1 m² for the landing area.

**Best for:** When the upper floor plan requires the staircase to arrive facing a different direction than the ground-floor hallway runs.

---

### 3.7 Split staircase (double-return)

**Description:** One wide central flight from ground floor to a large half-landing, then splits into two flights heading opposite directions to the upper floor.

| Config | Footprint |
|---|---|
| Modern typical | 3500 × 3500 = **12.25 m²** |
| Grand-manor | 4500 × 5000 = **22.5 m²** |

**Best for:** Country manors, large hotels, larger luxury new-builds. Needs a wide, tall entrance hall to breathe.

**Mirror flip:** Symmetrical by design — flipping doesn't change the visible layout.

---

### 3.8 Spiral staircase

**Description:** Circular flight around a central column.

| Config | Diameter | Footprint |
|---|---|---|
| Doc K compliant (with restrictions) | 1400-1500mm | **1.54-1.77 m²** |
| Comfortable diameter | 1800-2000mm | **2.54-3.14 m²** |

**Doc K note:** Spiral staircases are permitted as the ONLY staircase to a habitable floor only under specific conditions. Usually best specified as secondary access (loft, mezzanine).

**Mirror flip:** Handedness reverses (clockwise ↑ becomes anticlockwise ↑).

---

### 3.9 Curved (helical) staircase

**Description:** Sweeping continuous curve without a central column.

| Config | Diameter / dimensions | Footprint |
|---|---|---|
| Tight helical | 2500mm diameter | **~4.9 m²** |
| Generous helical | 3500mm diameter | **~9.6 m²** |
| Grand helical | 4500mm diameter | **~15.9 m²** |

**Best for:** Top-of-the-market bespoke joinery. Walking-line going stays generous even on tight designs (the point of a helical vs a spiral).

**Mirror flip:** Handedness reverses.

---

### 3.10 Floating cantilever staircase

**Description:** Treads project directly from a load-bearing wall or a hidden steel spine, no visible outer support.

**Footprint:** Same as equivalent straight/half-turn layout in the layout table above. What "floats" is the visible structure, not the footprint requirement.

**Structural note:** Requires engineered steel structure and load-tested plate brackets. Never a DIY specification.

---

## 4. Landings — separate space allocation

Every direction-change point needs a landing at least the width of the flight in both directions:

| Flight width | Min landing footprint |
|---|---|
| 800mm | 800 × 800 = 0.64 m² |
| 900mm | 900 × 900 = 0.81 m² |
| 1000mm | 1000 × 1000 = 1.00 m² |
| 1100mm | 1100 × 1100 = 1.21 m² |

Double landings (where a flight turns twice) need proportionally more space.

---

## 5. Handrail-side and the mirror rule

Approved Doc K requires a handrail on at least ONE side (up to 1000mm width) or BOTH sides (over 1000mm width). Which side the single handrail sits on is a design choice — usually against the wall side for narrow staircases, on the show side for open-plan layouts.

Handrail-side choice does NOT change the footprint calculation — it's an aesthetic and practical decision, not a spatial one.

**The paired-neighbour mirror rule** (see `project_nex_uk_property_type_awareness.md`): UK terraced houses typically mirror their internal layouts pair-by-pair to reduce inter-house sound transfer. This means:
- Right-side of the pair: staircase usually on left of your ground-floor plan; handrail typically against the party wall
- Left-side of the pair: staircase usually on right; handrail typically against the party wall

When Nex shows a reference image, she can horizontally MIRROR the image (see `feedback_nex_image_selection_transparency.md`) so the staircase runs in the direction the user's actual staircase runs.

---

## 6. Common "how much space do I actually have?" questions

To compute for a real user, Nex needs:

1. **Floor-to-floor height** (finished floor to finished floor). Measure from top of ground-floor finished surface to top of first-floor finished surface. Get this exact.
2. **Available floor area at the bottom of the flight.** Rough rectangle: width available × length available.
3. **Position of the top of the flight.** Where does the flight need to arrive? Is there a landing at first-floor level already, or does the flight determine the landing position?
4. **Any constraints on where the flight starts or ends** (doorways, columns, windows).

Given those, Nex can compute which layouts fit, which are borderline, and which are ruled out.

---

## 7. Sources

Primary source: **Approved Document K — Protection from falling, collision and impact**, currently published by the Department for Levelling Up, Housing and Communities on gov.uk. **Check the current published version before designing to it — this reference reflects the 2013 revision and does not track subsequent amendments.**

Regional equivalents:
- **Wales:** Approved Document K (Welsh version)
- **Scotland:** Technical Handbook — Domestic, Section 4 (Safety)
- **Northern Ireland:** Technical Booklet H

All are free to download from the respective government websites.

---

## 8. Update history

- **2026-07-25:** Reference created for the NEX Staircase Brain (Batch 22).
