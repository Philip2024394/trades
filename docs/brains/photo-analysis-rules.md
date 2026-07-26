# Staircase Photo Analysis Rules — V1

**Purpose:** Structured ruleset an AI image model uses to turn a customer-submitted staircase photo into actionable NEX intelligence — stair type, materials, condition, defects, upgrade opportunities.

Not a full computer-vision spec — a **decision framework** the vision model applies to what it sees. The rules define what NEX *asks the image* for, in what order, and what conclusions it draws.

---

## The three-question framework

Every photo analysis answers three questions, in order:

1. **What is this staircase?** (identification)
2. **What condition is it in?** (assessment)
3. **What could it become?** (recommendation)

Skipping straight to "what could it become" is the failure mode — recommending upgrades before understanding what already exists produces bad advice.

---

## Required photos for a complete analysis

Ask the customer for these five, in this priority order:

1. **Full staircase front view** — the whole flight in frame from the bottom
2. **Looking down the staircase** from the top landing
3. **Side profile** — pitch, string, newel visible
4. **Close-up of a joint** — tread/riser junction, or string/newel junction
5. **Under-stair area** — structure, any existing storage, access

With fewer photos, NEX makes weaker inferences and must say so.

**Never** ask for measurements from a photo — camera distortion makes photo-based dimensions unreliable. Photos identify; surveys measure.

---

## Step 1 — Identify the stair type

Look for these signatures in the frontal + top-down photos:

| Signature | Type |
|---|---|
| Single unbroken run, no direction change | Straight |
| Single 90° direction change with a small landing or wedge-shaped treads | Quarter turn (landing) or Winder |
| Two flights meeting at a large landing, U-shape overall | Half turn |
| Central column with radially arranged treads | Spiral |
| Treads appear to project from a single wall with no visible structure | Floating (cantilever) |
| Treads visible on both sides with no closed string | Open riser (may combine with any of the above) |
| Curved sweep in plan view | Curved |

If more than one signature is present, name both (e.g. "half turn with open risers").

---

## Step 2 — Identify materials

For each visible component (tread, riser, string, newel, handrail, balustrade), assign a material category:

### Timber
Look for grain pattern, colour, joint lines, character marks.
- Grain flowing straight + medium-brown tone → likely oak (European or American)
- Grain darker with rich contrast → likely walnut
- Very pale + fine grain → likely ash or maple
- Yellow-to-warm-orange with visible knots → likely pine
- Painted surface, no grain visible → painted MDF or timber (cannot distinguish reliably without seeing edge)

### Glass
- Transparent panel with visible edges → likely toughened or laminated safety glass
- Cannot determine thickness or safety rating from photo — flag for confirmation

### Metal
- Matte finish, black → powder-coated steel
- Reflective, silver → stainless steel or aluminium
- Wrought pattern / traditional profile → wrought iron (may be original or reproduction)

### Substrate materials (usually visible only from below)
- Smooth, uniform brown-grey, no grain → MDF (typical for painted risers)
- Layered edge visible → plywood
- Chunky flake pattern → OSB (unusual on visible surfaces, common on hidden platforms)

**When unsure — say so.** "Appears to be oak" is honest; "definitely oak" without an edge or joint close-up is guessing.

---

## Step 3 — Identify design style

Cross-reference the materials + form + context:

| Signals | Style |
|---|---|
| Glass balustrade + oak treads + painted string + minimal detail | Modern minimal |
| Painted string + turned spindles + oak or painted treads + carpet runner | Farmhouse / traditional |
| Dark stained hardwood + turned spindles + detailed newels + cornicing visible | Victorian / classic period |
| Steel stringer + oak treads + black metal or cable balustrade + exposed brick nearby | Industrial |
| Floating treads + frameless glass + integrated lighting + walnut or smoked oak | Luxury contemporary |
| Panelled string + hardwood treads + traditional profile + adjacent panelling | Classic period |

Style identification feeds the design recommendation engine — a modern floating stair upgrade proposal is wrong for a Victorian terrace even if the customer likes the photo they saw on Pinterest.

---

## Step 4 — Detect condition and defects

Scan the photos for visible signals:

### Movement / structural signals
- Gap between tread and riser above → possible loose tread joint
- Handrail visibly separated from wall or newel → loose fixing
- Newel visibly out of vertical → loose newel base
- Sagging string (curved when should be straight) → structural under-support
- Cracked landing board → structural or fixing issue

### Damage signals
- Visible splits or cracks in treads → impact or seasonal movement damage
- Water staining pattern → historic leak or spill
- Dented nosing → impact damage
- Soft-looking wood, discolouration at base → possible rot
- Chipped glass edge → structural risk (see diagnosis engine diag-028)

### Finish signals
- Peeling paint → poor prep or wrong paint over unsuitable substrate
- Uneven sheen → poor sanding or inconsistent application
- Yellow discolouration on white → oil-paint aging or tannin bleed
- Faded stain patches → UV damage

### Regulation signals (visible from photo)
- Balustrade with gaps that appear wider than a fist → possible 100mm sphere rule failure
- Missing handrail → non-compliance in most jurisdictions
- Uneven riser heights visible in side profile → serious safety issue
- Head-strike hazard visible (low beam over stair line) → headroom failure

Every detected defect maps to a `diag-XXX` entry in `data/staircase-diagnosis-engine.json`. NEX cross-links so the user can dig into the diagnostic detail.

---

## Step 5 — Recommend upgrade opportunities

Only after identification + condition assessment. Format recommendations in tiers:

**Option A — Budget upgrade**
Minimal replacement, maximum cosmetic impact. Examples:
- Paint the existing string + risers in a fresh colour
- Replace the handrail with a modern profile
- Sand and re-finish existing treads

**Option B — Mid upgrade**
Structural surface replacement. Examples:
- Fit oak stair caps over existing pine treads
- Replace spindles with a modern profile
- New balustrade retaining existing newels

**Option C — Premium upgrade**
Significant reconstruction. Examples:
- Full oak or walnut refit
- Glass balustrade replacement
- LED lighting integration
- Under-stair transformation (wine cellar / office / storage)

Every recommendation must cross-check against the style-identification result — do not propose a modern glass balustrade for a Victorian stair without flagging the style mismatch first.

---

## Video analysis rules

If the customer submits a short video (walking up/down the stairs) NEX additionally checks:

- **Bounce** — visible flex in the landing or treads → structural or fixing issue (diag-013)
- **Movement** — handrail deflection under normal use → loose handrail (diag-012)
- **Noise** — squeaks located to specific treads → diagnosable via diag-001 to diag-010

Video is stronger evidence than photos for movement-related defects. If the user reports "the staircase moves", ask for video not more photos.

---

## What photos cannot reliably determine

Be explicit about limits. The rules must flag these as "requires site survey":

- Exact dimensions (rise, going, headroom)
- Structural adequacy of hidden framing
- Timber species when only painted surfaces are visible
- Glass thickness and safety-grade certification
- Wall substrate behind handrail brackets
- Live load capacity
- Compliance with local building regulations (requires measurement)

Any of these questions in a customer conversation triggers "we need a site survey" as the honest answer.

---

## The final rule

A normal AI sees a staircase photo. **NEX sees structure + materials + style + condition + opportunity — with honest limits about what a photo can and cannot tell it.**

Confidence signals in the output:
- **Certain** — signature is unambiguous (e.g. "this is a straight stair")
- **Likely** — best inference with evidence (e.g. "likely oak based on grain pattern")
- **Possible** — one of several candidates (e.g. "possibly a Victorian original")
- **Cannot determine** — need survey or additional photos

Weak-confidence inferences never become bold recommendations. Better to say "we would need to see the tread edge to confirm" than to guess and lose the customer's trust.

---

## Cross-references

- Consumes: `data/staircase-diagnosis-engine.json` — every detected defect maps to a diagnostic entry
- Consumes: `data/staircase-design-recommendation-rules.json` — style identification feeds design recommendations
- Consumes: `data/staircase-country-packs/*.json` — regulation checks (100mm sphere, headroom, handrail height) use country-appropriate values
- Consumes: `knowledge/staircase.json` — deeper explanation of any concept flagged in the analysis

---

## Not in V1

- Actual vision model integration (this doc defines the rules; connecting to a vision API is a separate implementation task)
- Automatic dimension extraction (deliberately excluded — see limits section)
- Automated Doc K compliance certification (needs site survey data)
- Photo-based cost estimation (needs regional pricing + accurate takeoff)
- Historic/period restoration recommendations (needs specialised knowledge layer)
