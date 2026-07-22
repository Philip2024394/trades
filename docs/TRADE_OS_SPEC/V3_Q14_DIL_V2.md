# Trade Operating System · Volume 3 · Question 14
## Design Intelligence Layer v2 — The Knowledge Engine

**Audience:** Senior AI Platform Engineers, Design Systems Architects, AI Compiler Engineers
**Source:** ChatGPT design-brief architecture series, V3 Q14.

---

## Philosophy

The biggest mistake AI platforms make: **storing design knowledge inside prompts.**

That makes knowledge:
- Impossible to version
- Impossible to test
- Impossible to improve independently
- Duplicated everywhere

**Trade OS separates knowledge from prompts.**

The Prompt Compiler does not know design. The Design Intelligence Layer (DIL) knows design. The compiler simply **asks the DIL for rules**.

---

## Architecture

```
Merchant Request
        ↓
Prompt Compiler
        ↓
Design Intelligence Layer
        ├──────────────┬──────────────┐
        ▼              ▼              ▼
   Layout       Typography        Colour
        ▼              ▼              ▼
   Vehicle      Photography       Trade
        ▼              ▼              ▼
   Print       Accessibility     Motion
        ↓
Compiled Prompt
```

**The DIL becomes the platform's design brain.**

---

## Core Principle

The DIL **never generates prompts**. It generates **design rules**.

Instead of *"Create a premium van wrap"*, it returns:

```
Layout Pattern:            Luxury Split Panel
Hero Image:                62%
Negative Space:            18%
Logo Width:                11%
Phone Position:            Lower Third
Colour Density:            28%
Typography:                Swiss Sans
Photography:               One hero image only
Maximum Info Groups:       3
```

The Prompt Compiler converts these into model-specific prompts.

---

## Module Architecture

Every module follows the same interface:

```ts
interface IntelligenceModule {
  id:         string;
  version:    string;
  category:   string;
  supports:   string[];
  evaluate(context: DesignContext): DesignRules;
}
```

**Each module is independent.**

---

## Module 1 — Layout Intelligence ⭐⭐⭐⭐⭐

**Owns:** Grid Systems · Golden Ratio · Rule of Thirds · Negative Space · Margins · Alignment · Hierarchy · Information Density · Reading Order · Panel Systems.

Outputs:
```ts
LayoutRules {
  grid:                  "12-column";
  heroRatio:             0.62;
  negativeSpace:         0.18;
  maxInformationGroups:  3;
  logoArea:              "top-left";
}
```

## Module 2 — Colour Intelligence

**Owns:** Trade Colour Psychology · Contrast · Accessibility · Print Limits · Pantone · CMYK · RGB · Brand Harmony · Seasonal Colours · Luxury Colours.

```ts
ColourRules {
  primary:         "#111111";
  secondary:       "#C9A227";
  contrast:        4.8;
  paletteDensity:  3;
}
```

## Module 3 — Typography Intelligence

**Owns:** Hierarchy · Scale · Line Height · Tracking · Kerning · Letter Spacing · Print Sizes · Embroidery Limits · Vehicle Legibility · Reading Distance.

```ts
TypographyRules {
  heading:              "Manrope";
  body:                 "Inter";
  logoWeight:           700;
  minimumVehicleText:   "80mm";
}
```

## Module 4 — Vehicle Intelligence

**Owns:** Wheel Arches · Door Seams · Fuel Caps · Light Positions · Safe Zones · Printable Areas · Driving Legibility · Rear Visibility · Fleet Consistency.

```ts
VehicleRules {
  safeZones:      [...];
  forbiddenZones: [...];
  phoneArea:      "rear-centre";
}
```

## Module 5 — Photography Intelligence

**Owns:** Hero Images · Lighting · Perspective · Background Blur · Colour Temperature · Trade Photography · Composition · Cropping · Image Priority.

Rules: Max 1 hero photo · Soft background · Natural perspective · Daylight lighting.

## Module 6 — Logo Intelligence

**Owns:** Minimum Size · Protection Zone · Placement · Scalability · Contrast · Monochrome Rules · Clear Space · Embroidery Rules · Vehicle Placement.

## Module 7 — Trade Intelligence

**One module per trade.** Example — Joinery:
- Preferred Layout: Luxury Split
- Photography: Finished staircase
- Colours: Black · Gold · White
- Trust Elements: Craftsmanship · Wood Grain · Luxury Homes

Repeat for: Plumbing · Electrical · Roofing · Landscaping · Bricklaying · Scaffolding · Groundworks · Decorating · Windows · Loft Conversions · and every supported trade.

## Module 8 — Print Intelligence

**Owns:** Bleed · Safe Area · CMYK · Pantone · Crop Marks · DPI · Vinyl · Embroidery · Foil · Lamination · File Formats.

```ts
PrintRules {
  bleed:      3;
  dpi:        300;
  safeArea:   5;
  colourMode: "CMYK";
}
```

## Module 9 — Accessibility Intelligence

**Checks:** Contrast · Colour Blindness · Font Sizes · Touch Targets · Reading Distance · Mobile · Print · Vehicle Readability.

## Module 10 — UI Intelligence

**Used by App Studio.** 8pt Grid · Cards · Buttons · Spacing · Navigation · Material · Human Interface Guidelines · Responsive Rules · Forms · Tables.

## Module 11 — Motion Intelligence

**Later.** Animation Speed · Duration · Spring · Transitions · Micro Interactions · Loading States.

## Module 12 — Premium Scoring

**Measures:** Luxury · Trust · Modern · Cleanliness · Sophistication · Professionalism.

Outputs: `Premium Score: 94`. Compiler can request a minimum premium score.

---

## Versioning

Every module versions independently:

```
Layout      v7
Colour      v4
Vehicle     v9
Typography  v5
Trade       v18
```

**Updating typography does not affect vehicle intelligence.**

---

## Rule Storage

```ts
interface DesignRule {
  id:          string;
  module:      string;
  version:     string;
  conditions:  Condition[];
  outputs:     Rule[];
  confidence:  number;
}
```

### Rule Example

```json
{
  "id":         "vehicle.logo.size",
  "module":     "Vehicle",
  "version":    "9.1",
  "conditions": [
    { "trade":   "joinery"   },
    { "vehicle": "transit"   }
  ],
  "outputs": {
    "logoWidth": "11%"
  }
}
```

---

## Compiler Integration

The Prompt Compiler never hardcodes values:

```ts
const layout      = DIL.layout.get(context);
const colours     = DIL.colour.get(context);
const typography  = DIL.typography.get(context);
const vehicle     = DIL.vehicle.get(context);
```

The compiler assembles them.

---

## Testing

Each module is unit-testable independently.

Input: `Trade: Plumber` → Expected: Blue palette → PASS

Modules improve without changing prompt templates.

---

## Knowledge Graph

Modules depend on each other but communicate through well-defined interfaces:

```
Trade → Colour · Vehicle · Photography · Typography → Layout
```

**No direct prompt edits between modules.**

---

## Rule Priority (conflict resolution)

```
Merchant Preference    ← always wins (unless breaks print/safety)
      ↓
Brand DNA
      ↓
Capability Rules
      ↓
Trade Rules
      ↓
Global Defaults
```

---

## Analytics

Track rule performance:

```
Rule:                   Luxury Split Panel
Used:                   18,400
Approval:               97%
Average Critic Score:   96.4
```

**Poor-performing rules retire without touching the Prompt Compiler.**

---

## Future Modules

Sustainability · Fleet Branding · Packaging · Exhibition Stand · Retail Signage · Wayfinding · AI Photography Direction · Cultural & Regional Design · Conversion Optimisation · Trend Intelligence.

---

## Architectural Principle

**The Prompt Compiler is a translator. The Design Intelligence Layer is the expert.**

The compiler asks how to express something. The DIL decides what good design actually is.

By separating design knowledge into independently versioned intelligence modules, Trade OS gains a maintainable, testable, and continuously improving design brain that can outlive any individual AI model or prompt format.

---

## Networkers-specific implementation notes

- **Location:** `src/lib/design/dil/` (new folder). Each module = one file: `layout.ts` · `colour.ts` · `typography.ts` · `vehicle.ts` · `photography.ts` · `logo.ts` · `trade.ts` · `print.ts` · `accessibility.ts` · `ui.ts` · `motion.ts` · `premium-scoring.ts`.
- **Trade Intelligence** = one file per trade under `src/lib/design/dil/trades/*.ts` (joinery, plumbing, electrical, roofing, etc.). Auto-registered by convention.
- **Rules stored as data files, not code.** Each rule is a JSON/TS constant with `id`, `module`, `version`, `conditions`, `outputs`. `evaluate()` is deterministic function.
- **Compiler integration** — the Compiler's Stage 4 (Brand Injection), Stage 5 (Trade Injection), Stage 6 (Layout Injection) query these modules via `DIL.layout.get(context)` etc.
- **Versioning** — each module file exports a `VERSION` constant. Bumping requires a spec review.
- **Rule provenance** — every `evaluate()` output carries `_source: "module.rule-id.vX"` so the Decision Engine can cite exactly why a rule fired.
- **Analytics** — a nightly cron aggregates `hammerex_van_generations.score_breakdown` per rule ID and computes approval rates + avg score. Powers the "retire poor rules" workflow.
