# Staircase Canonical Knowledge — Philip's Trade Briefings (v1)

**Source:** Philip's specifications delivered during the mat-002 3D preview build, 24–26 July 2026.
**Purpose:** Turn Philip's raw trade knowledge into professional trade-quality reference text that Nex can quote directly to homeowners, joinery firms, installing carpenters, and specialist staircase manufacturers.
**Confirmation legend:**
- **✓ Confirmed** — Aligns with UK trade standard practice / Approved Doc K / recognised joinery convention.
- **⚑ Flag** — Trade-craft detail; consistent with practice but not a universal rule. Cite Philip as source or verify with a second maker before publishing to Nex.
- **⚠ Discrepancy** — Contradicts either Approved Doc K, another Philip briefing, or the current 3D model — resolve before publishing.

---

## 1. Overall staircase width (UK domestic)

> A standard UK domestic staircase measures 800–860 mm across the outside faces of both stringers ("over strings"). This range represents the typical range for a private stair in a house of ordinary hallway width. Approved Document K sets no maximum, and a minimum clear-width of 600 mm is permitted for a private stair — but 800–860 mm remains what is normally specified and built.

**✓ Confirmed.**

---

## 2. Stringers (housed strings)

### 2.1 Thickness options

> Stringer thickness for a housed staircase falls into these grades:
> - **32 mm** — the standard cladding / housed-string dimension, used on the majority of private stairs.
> - **38 mm** — mid-weight, suitable for cut strings or busier traffic.
> - **50 mm** — heavy structural cut-string construction.
> - **40 mm and 44 mm** — offered by some makers on request; ask the specific manufacturer as not all stock these gauges.

**✓ Confirmed.**

### 2.2 Stringer depth

> A standard raw stringer is around **275 mm** deep (top edge to bottom edge, perpendicular to the pitch line) for a standard 20–25 mm bullnose overhang. The actual depth is determined by the rise, the going, and the bullnose overhang selected (see §3.5 — a heavier overhang requires a deeper string). For the 28 mm heavy-lighting overhang, the string depth must be increased accordingly.

**✓ Confirmed** by Philip as trade authority.

### 2.3 Softwood 32 mm bounce warning

> Softwood stringers at 32 mm thickness can produce a slight perceptible bounce when two people pass one another on the flight. The severity depends on the timber's country of origin, because different growing conditions produce different densities and stiffness. For staircases where two-person passing is expected regularly — busy family homes, HMOs, or commercial installations — the recommendation is to specify one of:
> - a thicker string (38 mm or greater),
> - a hardwood string (oak, ash, beech) in place of softwood, or
> - a metal-reinforced backing behind the string.

**✓ Confirmed** as trade experience. Nex should surface this warning automatically when the configurator combines softwood + 32 mm + wide flight.

### 2.4 Lamwood strings — the modern UK standard for oak

> **Lamwood** (laminated wood) is now the default UK choice for oak staircase strings, replacing solid natural timber on most modern installations. The reasons are practical:
> - Sourcing solid oak in the long lengths and thick sections needed for a stringer is difficult; suppliers rarely hold certified defect-free stock at scale.
> - Thick solid timber needs very long kiln-drying cycles, and rushed drying leaves hidden internal stresses.
> - Solid stock often contains hidden shakes (splits along the grain) that surface inspection cannot detect. Once the staircase is installed and the house is heated, moisture equilibrates and internal stresses release — new shakes can appear months after installation.
> - Lamwood cancels these risks: each lamination is small enough to be dried thoroughly and defect-checked individually, and the grain-matched glue-up cancels warping and shakes across the finished piece.
> - The visible face of a lamwood string is a full oak veneer with proper grain — at normal viewing distance it is indistinguishable from solid oak.
>
> Solid oak strings remain the appropriate choice for heritage restoration (Victorian, Georgian) or where a fully solid staircase is a specific design requirement. In those cases, expect longer lead times, higher cost, and a real risk of post-install shakes as the house is heated. For a new build or a modern retrofit, lamwood delivers the oak look without the failure risk.

**✓ Confirmed** as growing UK trade practice.

---

## 3. Treads, risers and their joinery (housed-string construction)

### 3.1 Riser-to-tread joint

> The top edge of each riser board carries a **tongue** that projects approximately **12 mm** upward into a matching groove machined into the underside of the tread above. This joint prevents any light leak visible from beneath the staircase and locks the tread against forward movement.

**✓ Confirmed** as traditional housed-string practice.

### 3.2 Tread and riser into string

> Both the tread and the riser slot **12–15 mm** into housings routed into the inner face of each string. The housings are cut before assembly and hold the timber captive without visible fixings.

**✓ Confirmed.**

### 3.3 Wedges (housed-string wedging)

> Each tread and riser is locked into its housing with a **pine wedge** driven from the underside of the flight. Wedges are typically **9–12 inches (230–305 mm)** long, cut to suit each step's rise and going. The wedge's width must remain **inside** the string thickness so it does not project through the outer face of the string. One wedge sits under the tread and one is driven upward against the riser, at each string end (so four wedges per step in total: one under-tread and one riser-side, on each side of the flight).

**✓ Confirmed.**

### 3.4 Bullnose / nosing overhang — three trade values

> The tread bullnose projects forward past the face of the riser below by the nosing dimension. Three trade-standard values are offered:
> - **20 mm** — standard.
> - **25 mm** — standard, slightly more generous foot feel and modern proportion.
> - **28 mm** — used only when a **heavy strip-lighting profile** is specified (an aluminium LED channel or wider recessed strip) needs additional bullnose material to accommodate the groove without weakening the tread.
>
> The 28 mm value is not a customer choice — it is triggered by the lighting specification.

**✓ Confirmed** by Philip as trade authority (2026-07-26). Nex configurator: default 20 mm; step up to 25 mm on customer preference; auto-step to 28 mm when a heavy-lighting profile is selected.

### 3.5 Cascading rule — overhang increase → riser back → deeper string

> Increasing the bullnose overhang is **not** an isolated change. It cascades through the flight geometry:
> 1. Additional overhang forward means the tread projects further past the riser face.
> 2. To keep the going (horizontal step-to-step distance) constant, the **riser pushes back** by the additional overhang.
> 3. The riser pushing back forces the string housings (routed cuts for treads and risers) to move accordingly.
> 4. To maintain adequate timber around each housing, the **stringer depth** (top-to-bottom dimension, perpendicular to the pitch line) must **increase** to compensate.
>
> Nex Stairplan must apply this cascade automatically — the customer picks the bullnose overhang (or the lighting spec picks it for them), and every downstream dimension (riser position, string housing layout, string depth, BOM material length) is recalculated. A staircase with 28 mm bullnose cannot be built on the same stringer stock as a 20 mm bullnose without weakening the string.

**✓ Confirmed** by Philip as trade authority (2026-07-26). This is a first-class rule for the Nex Stairplan geometry engine.

---

## 4. Angle blocks (glue blocks)

> Angle blocks are small triangular wooden blocks — approximately **60 × 60 × 90 mm** — glued into the interior corner where the underside of each tread meets the back face of its riser. They reinforce the joint against racking and eliminate squeaking under load. Trade rule for count:
> - Staircase width **≤ 1000 mm** — **two blocks per step**, one near each string.
> - Staircase width **> 1000 mm** — **three blocks per step**, adding a middle block.
>
> Every Nex output (geometry, render, BOM, CNC list, install pack) must include the correct number of angle blocks for the staircase width.

**✓ Confirmed** as UK trade rule.

---

## 5. Newel posts and caps

### 5.1 Cross-section standards

> Newel posts are typically **75 mm, 90 mm, or 120 mm square** in cross-section. **90 mm** is the modern spec-standard size for most private stairs. Larger newels (120 mm) are specified where heavier balusters (50 mm and above) are used, or to match a traditional/heritage staircase.

**✓ Confirmed.**

### 5.2 String centred on newel

> The stringer thickness is **centred on the newel cross-section**, regardless of the newel's own dimension. On a 90 mm newel with a 32 mm string, the newel projects 29 mm on each side of the string. This maintains a symmetrical proportion between newel and string across every configuration.

**✓ Confirmed** as traditional joinery practice.

### 5.3 String-to-newel joint

> The string enters the newel through a **haunched mortice-and-tenon** joint. The tenon extends approximately **50 mm** into the newel body. This depth carries the string's downward load into the newel column without splitting.

**✓ Confirmed.**

### 5.4 First tread and first riser into newel

> The bullnose of the first tread is **haunched 12 mm** into the newel body at **25 mm back from the front edge of the tread**. The first riser is haunched into the newel back **45–50 mm** from the newel edge. Both joints are cut before assembly and glued during erection.

**✓ Confirmed** by Philip as trade authority.

### 5.5 Newel cap — flat American white oak

> The **flat American white oak newel cap** is a **114 × 30 × 114 mm** timber slab with softened edges (arris eased, not sharp), used mainly on modern square newel posts to finish the top of the newel with a clean architectural detail. It is glued and pinned to the top of the newel.

**✓ Confirmed** as one of the recognised cap styles.

### 5.6 Cap orientation — top and inverted at base

> When a flat cap is specified for the top of a newel, an inverted (upside-down) copy is also fitted at the **base** of the newel to sit against the floor. This gives a matching architectural detail top and bottom and reads as a considered piece of joinery rather than a plain post.

**✓ Confirmed** by Philip as trade authority.

### 5.7 Cap recess

> The cap is set **7 mm inside** the newel outer face on each side (i.e. cap footprint is inset from the newel face by 7 mm), giving a small reveal that reads as an intentional shadow line.

**✓ Confirmed** by Philip as trade authority.

---

## 6. Baserails and handrails

### 6.1 Grooved-profile system (UK / Ireland)

> UK and Ireland balustrades typically use a **grooved handrail** (groove machined into the underside) and a matching **grooved baserail** (groove on the top face). Balusters slot into these grooves at each end, and cut-to-length **filler slips** (also called spacer strips) are pushed into the remaining groove length between balusters to lock the spacing. The result is a clean rail-to-baluster junction with no visible fixings.

**✓ Confirmed.**

### 6.2 Handrail height

> Handrail height on a private stair must be at least **900 mm** measured vertically from the pitch line (the line joining the front edges of the nosings) — this is the minimum required by Approved Document K in England (Building Regulations). Wales, Scotland and Northern Ireland use their own versions with the same 900 mm floor.

**✓ Confirmed** against Approved Doc K.

### 6.3 Baserail — bottom rail of the balustrade

> The baserail is the horizontal rail that sits on top of the string between the bottom newel and the top newel. Its top face carries the same profile groove as the handrail so that balusters slot in cleanly. Filler slips (short lengths of the same section) fill the groove between balusters. The baserail is only fitted on closed-string staircases — it is a natural part of the system wherever a handrail with grooved profile is used.

**✓ Confirmed.**

### 6.4 Sizing rule for grooved system

> All four components of the grooved system — **baluster + handrail + baserail + newel post** — must be **proportionally sized to each other**. When the baluster steps up from the standard 41 mm to a heavier size (50 mm, 60 mm), the handrail, baserail and newel post must scale up in matching proportion. A 60 mm baluster in a 32 mm handrail groove looks wrong and pulls the whole balustrade out of proportion. Nex Stairplan auto-scales the other three when the baluster crosses 44 mm and warns the user of any mismatched sizing that the customer overrides.

**✓ Confirmed** as trade practice.

---

## 7. Balusters

### 7.1 Standard sizes

| Size (mm) | Description |
|---|---|
| 32 | Slim / contemporary |
| **41** | **Current UK/Ireland standard** |
| 44 | Traditional |
| 50 | Heavy |
| 60 | Very heavy / heritage |

**✓ Confirmed.**

### 7.2 Standard modern baluster — 41 × 41 × 900 mm

> The most widely-used modern UK baluster is **41 mm × 41 mm × 900 mm**, with a **full chamfer** along the four vertical arrises (a stop-chamfer variant is also common — see 7.4). It is cut to the pitch angle at both top and bottom so it slots cleanly into the baserail top groove and the handrail underside groove.

**✓ Confirmed.**

### 7.3 Grain direction — always along the length

> Baluster grain **always runs along the length of the piece (top-to-bottom on the fitted stair), never across it**. Grain running across the baluster is a manufacturing defect — the piece will be weak and prone to splitting. This is a traditional woodworking rule and applies to any baluster regardless of profile or size.

**✓ Confirmed** as standard practice; a baluster cross-cut across the grain is defective.

### 7.4 Stop-chamfer variant (white sprayed balusters)

> A stop-chamfer baluster has **150 mm (6 inches) square at the bottom and 150 mm square at the top**, with only the middle section chamfered on the four vertical arrises. The chamfer "stops" short of both ends, leaving clean rectangular ends at the newel-side and rail-side joints. This is a traditional profile commonly seen on white-sprayed balusters and heritage installations.

**✓ Confirmed** as a recognised traditional profile.

### 7.5 Colour finish options

> The 41 × 41 × 900 mm baluster is offered in three standard finishes:
> - **Oak** (fully chamfered) — natural timber, clear varnish.
> - **White sprayed** (stop-chamfered) — typically pine or hardwood underneath, sprayed white for a painted-finish scheme.
> - **Cream sprayed** (fully chamfered) — pine standard, hardwood optional; sprayed cream. Same underlying construction as the white variant.

**✓ Confirmed** as standard trade offering. Nex configurator should offer all three at spec time.

### 7.6 Fit — 10 mm inside handrail and baserail grooves

> When a baluster is fitted, its top and bottom ends slot approximately **10 mm inside** both the handrail groove and the baserail groove. The cuts at top and bottom are made to the pitch angle of the flight (or to the handrail run angle on a landing). When correctly fitted, the corner arrises of the baluster are **not visible** at either end — the groove face conceals them.

**✓ Confirmed.**

### 7.7 Baluster count rule

> **Two balusters per step** is the baseline rule. Where a newel post lands on a step, only **one baluster** is fitted on that step (the newel occupies the second position). If the counted total for a flight leaves one or two balusters over from the pack quantity, **buy them and store them** — baluster designs change with interior-design trends and matching replacements may not be available years later.

**✓ Confirmed** as trade practice. The two-per-step baseline is the natural consequence of the Doc K 100 mm sphere rule at typical goings — a 220 mm going with two balusters at 41 mm each leaves gaps of roughly 46 mm, which passes Doc K comfortably.

### 7.8 Doc K 100 mm sphere rule

> The balustrade must not allow a **100 mm sphere** to pass through any opening at any point on the flight or landing — measured **horizontally**, not perpendicular to the pitch. This is a requirement of Approved Document K in England (and equivalents in Wales, Scotland and Northern Ireland). It applies to the gaps between balusters, the gap under the baserail, and any triangular gap at the bottom of the flight.

**✓ Confirmed** against Approved Doc K.

---

## 8. Tongue-and-groove (T&G) sheeting for the back of the staircase

### 8.1 When it is used

> T&G sheeting is one of three options for finishing the back / underside of a staircase (the alternatives being fixed panelling and plasterboard). It is used where the back of the staircase will be visible — typically an open-plan hallway or a staircase against a feature wall — and where the customer wants a warm timber finish rather than plasterboard.

**✓ Confirmed** as standard trade practice.

### 8.2 Plank width

> Standard T&G plank width for staircase backing is **75 mm** face width per plank. This gives a visible T&G rhythm at a scale that reads well on the back of a domestic flight without looking either too fine or too heavy.

**✓ Confirmed** as common trade default. Other widths (100, 125 mm) are available for larger installations or as a design choice.

### 8.3 Thickness options

| Thickness | Application |
|---|---|
| 9 mm | Light — suitable for staircase backing where kept dry |
| **12 mm** | **Standard default for staircase backing** |
| 15 mm | Larger areas or where extra rigidity is wanted |
| 18 mm | Large areas or where sound-deadening is a priority |

**✓ Confirmed.**

### 8.4 Grain direction

> T&G plank grain **always runs along the full length of the plank**. Cross-grain is a manufacturing defect and any plank with grain running across the face should be rejected at delivery.

**✓ Confirmed.**

### 8.5 Colour match to the rest of the staircase — HARD RULE

> **HARD RULE (Philip 2026-07-26).** The T&G sheeting on the back of the staircase **must have the same material, colour and grain as the rest of the staircase — no other colour is acceptable.** The customer must read the finished staircase as one continuous piece of joinery; the back must not look like a different job glued on afterwards.
>
> Applies to every Nex Stairplan output: BOM, spec sheet, quotation, 3D preview, marketing renders. Any request from a customer to specify a different sheeting species/finish is a design mismatch and Nex should flag it before quoting.

**✓ Confirmed as HARD RULE** by Philip as trade authority. Never accept an override without an explicit second confirmation from Philip.

### 8.6 Expansion gaps

> Leave **7–10 mm expansion gaps at both ends** of the sheeting run (top and bottom). Timber expands as it acclimatises to the room's heating and humidity; without expansion gaps the boards will bow, split, or push against adjacent walls.

**✓ Confirmed.**

### 8.7 Hidden-nailing technique

> Never pin T&G sheeting through the face. Pin at the **tongue side** of each board — drive the pin at an angle through the tongue where the next board's groove will slot in and cover the pin hole. The result is a finished surface with no visible fixings. An air compressor and brad nailer make this fast; a hammer and nail-punch will also achieve it.

**✓ Confirmed.**

### 8.8 Battens behind the sheeting

> Fix **2" × 2" (approximately 50 × 50 mm) rough-drywood battens** to the inner back of the staircase framework. The battens run perpendicular to the sheeting planks and provide the fixing ground.

**✓ Confirmed.**

### 8.9 Angle-slip edge cover

> Cover the raw sheeting edges on both sides of the flight with **2–3 angle slips** (short lengths of moulded angle trim), depending on staircase length. Angle slips are available at hardware-shop moulding racks or from a local joinery shop ordered along with the sheeting.

**✓ Confirmed.**

### 8.10 Chamfered visible edges

> The visible edges of each T&G plank carry a small **chamfer** where the boards meet — the chamfer articulates each plank line at close viewing distance and gives the finished sheeting its characteristic tactile look. This is standard on machined T&G stock.

**✓ Confirmed.**

---

## 9. Double round starting step

> Used **when the staircase is not supported by wall or partition on either side** — i.e. the flight opens into an open room rather than being enclosed by walls on the flanks. The purpose is to give:
> - additional points of entry from the left and right sides,
> - a wide, generous entrance appearance that reads as a design feature rather than a purely functional element.
>
> **Construction:**
> - Each step is made from **solid blocks of wood** — the tread and riser of the round step are machined from solid stock, not built up as a hollow tread + riser assembly.
> - A **riser board or veneer** is wrapped around the curved outer edge and glued in position with clamps until dry. When done properly the block-marks are invisible and the finished step reads as one continuous piece.
> - Fixing to the newel post is a **15–18 mm haunch into the newel body** plus **screw-fixing through the riser** into the newel from behind. The screws are covered by the veneer and are not visible on the finished piece.
>
> **Newel-post rule:** when a round starting step is applied to the flight, the **bottom newel post is made long enough to sit on floor level** (rather than sitting on the first tread as in some housed-string configurations). Both bottom newels get the extended length.
>
> **Footprint rule:** the round double step **passes out past the two bottom newel outer edges** — i.e. the step is wider than the newel-to-newel span, so it visually contains the newels rather than being contained by them.

**✓ Confirmed** as traditional bespoke joinery for open-side stairs.

---

## 10. LED strip lighting under the bullnose

> LED strip lighting on stair treads is fitted into a **3 mm deep × 7 mm wide groove** routed into the underside of the bullnose overhang. The strip sits recessed into the groove with its emitting face flush with the underside plane — the strip is invisible from the front elevation but casts a warm downward wash onto the riser and the tread below. The 20–25 mm bullnose overhang provides the space for the groove without weakening the tread.

**✓ Confirmed** as one common installation detail (of several — aluminium channels, extruded profiles, and larger 8 × 15 mm grooves are all in use). Publish Philip's spec as the Nex-recommended default.

---

## 11. Nex Stairplan implementation checklist

Every staircase produced through Nex must clear the following before it goes to CNC / production:

- [ ] Overall width in 800–860 mm typical range (or explicit customer override)
- [ ] Stringer thickness selected (32 / 38 / 50 mm), with bounce warning if softwood + 32 mm + ≥ 900 mm width
- [ ] Stringer material (**lamwood default for oak**; solid oak only for heritage restoration with warning)
- [ ] Bullnose overhang set (20 mm default / 25 mm customer preference / **28 mm auto-triggered by heavy lighting spec** — see §3.4)
- [ ] Cascade applied: overhang change → riser back → stringer depth recalculated (see §3.5)
- [ ] Angle blocks count correct for width (2 if ≤ 1000 mm, 3 if > 1000 mm)
- [ ] Newel size proportional to baluster (auto-scale above 44 mm baluster)
- [ ] Handrail height ≥ 900 mm from pitch line
- [ ] Baluster spacing passes 100 mm sphere rule (measured horizontally)
- [ ] Two balusters per step, one where newel lands
- [ ] Baluster grain along length on every piece
- [ ] Handrail + baserail + newel + baluster proportionally matched
- [ ] Wedges specified in the BOM per housed-string rule (pine, 9–12", 4 per step)
- [ ] T&G sheeting (if specified) matches flight species and finish, correct plank width and thickness, expansion gaps in install pack
- [ ] Round starting step (if flight is not wall-supported): both bottom newels extended to floor; step footprint wider than newel-to-newel span
- [ ] LED groove detail included on the tread underside CAD if lighting option ordered

---

## Discrepancies — all resolved (2026-07-26)

Philip confirmed all trade-craft details on 2026-07-26 ("yes confirm all"). Every item previously flagged is now ✓ Confirmed under Philip's trade authority. Bullnose overhang resolved with a three-value trade rule (20 / 25 / 28 mm — see §3.4) plus a first-class cascade rule (§3.5).

**Consequential change for the 3D model:** the current mat-002 preview uses `NOSING = 0.020` (20 mm). This is now valid as one of three trade values and requires no change unless Philip elects to demo the 25 mm or 28 mm variant in the same preview. If the preview is upgraded to switch between the three values live, the string depth also needs to recompute per §3.5.

---

## Items published to the Nex knowledge brain

Batches already loaded into `knowledge/staircase.json` (as of 2026-07-26, 655 entries):
- Batch 44 — T&G thickness options + grain-along-length rule
- Batch 45 — Lamwood strings as modern UK standard
- Earlier batches — baluster count, stringer dimensions, angle block rules, newel-string joinery, riser-tread-wedge joints, back-side sheeting options, plan-size reference, property-type awareness, adversarial-robustness guidance

Next batches (recommended, from this consolidation):
- Double round starting step — construction + when-to-use
- Stop-chamfer baluster profile
- Cream sprayed baluster finish option
- LED strip lighting groove detail
- Newel cap flat American white oak variant
- Handrail grooved profile canonical description
- Baserail canonical description with filler slips
