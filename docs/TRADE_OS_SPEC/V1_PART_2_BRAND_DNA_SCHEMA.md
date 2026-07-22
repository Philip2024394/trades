# Trade Operating System · Volume 1 · Part 2
## Brand DNA Schema v2.0

**Audience:** Senior Platform Engineers, Database Architects, AI Engineers
**Source:** ChatGPT design-brief architecture series, Part 2 of 5.

---

## Philosophy

The biggest mistake is thinking Brand DNA is just JSON.

**It isn't.**

Brand DNA is your **Business Operating System**. Everything else (logo, van, website, invoice, app) is generated from it.

```
Merchant
      │
      ▼
 Brand DNA
      │
      ├── Design Tokens
      ├── Layout Rules
      ├── Prompt Compiler
      ├── Memory
      ├── Assets
      ├── Brand Guide
      └── AI Models
```

Everything references Brand DNA. Nothing duplicates Brand DNA.

---

## Entity Relationship

```
Organisation
    │
    ├──────────────┐
    ▼              ▼
Merchant      Subscription
    │
    ▼
Brand
    │
    ├────────────┐
    ▼            ▼
Brand Version   Assets
    │
    ├──────┬──────────┬────────┬────────┐
    ▼      ▼          ▼        ▼        ▼
Identity Position Style Tokens Memory
    │
    ▼
Generated Assets
```

**Assets DO NOT contain branding. They REFERENCE branding.**

---

## Database Model

```
Organisation → Brand → Brand Version → Brand Sections → Assets → Asset Versions → Exports
```

### `organisations`
`id · name · owner_id · subscription_id · created_at · updated_at`

### `brands`
`id · organisation_id · current_version · status · created_at · updated_at`

Never stores colours. Never stores logos. Only version pointer.

### `brand_versions`
`id · brand_id · version · published · parent_version · created_by · created_at`

Every change = new row. Never update.

---

## Brand Sections

Instead of one massive JSON document, split it into 12 sections:

```
Brand Version
│
├── Identity
├── Positioning
├── Colour
├── Typography
├── Logo
├── Photography
├── Vehicles
├── Marketing
├── UI
├── Documents
├── Trade Rules
└── Tokens
```

Much easier to maintain.

---

## Section TypeScript Interfaces

```ts
interface Identity {
  companyName: string;
  tagline: string;
  industry: string;
  trade: string;
  website: string;
  phone: string;
  email: string;
  socials: string[];
}

interface Positioning {
  targetMarket: string;
  priceLevel: "Budget" | "Mid" | "Premium" | "Luxury";
  tone: string[];
  usp: string[];
  keywords: string[];
}

interface BrandColour {
  name: string;
  hex: string;
  rgb: string;
  cmyk: string;
  pantone?: string;
  role: "Primary" | "Secondary" | "Accent";
}

interface Typography {
  heading: string;
  body: string;
  display: string;
  weights: number[];
  letterSpacing: number;
}

interface Logo {
  masterSvg: string;
  horizontal: string;
  stacked: string;
  icon: string;
  favicon: string;
  mono: string;
  reverse: string;
}

interface Photography {
  style: string;
  lighting: string;
  heroRatio: string;
  overlay: boolean;
  grain: boolean;
  borderRadius: number;
}

interface VehicleRules {
  preferredLayout: string;
  coverage: number;
  photoCoverage: number;
  logoScale: number;
  roofColour: string;
  panelRules: string[];
}

interface Marketing {
  tone: string;
  ctaStyle: string;
  headlineStyle: string;
  offerStyle: string;
  imagery: string;
}

interface UIRules {
  radius: number;
  spacing: number;
  iconStyle: string;
  buttonStyle: string;
  shadowStyle: string;
  animationStyle: string;
}

interface DesignTokens {
  spacingScale: number[];
  radiusScale: number[];
  colourTokens: unknown;
  fontTokens: unknown;
  iconTokens: unknown;
}

interface BrandMemory {
  preferredLayouts: string[];
  acceptedColours: string[];
  rejectedColours: string[];
  likedLogos: string[];
  dislikedLogos: string[];
  confidence: number;
}
```

---

## Three-Layer Field Model — the critical design decision

**1. Authoritative fields** — merchant-entered or approved. Company name, colours, logo, positioning.
**2. Derived fields** — computed by deterministic code. Design tokens, luxury score, contrast score, affected assets.
**3. Learned fields** — built over time by AI. Preferences, accepted layouts, rejected concepts, confidence scores.

This separation makes the system **explainable, testable, and easy to evolve** as AI capabilities grow.

---

## Relationship Graph

```
Trade
  ↓
Positioning
  ↓
Colour Palette
  ↓
Typography
  ↓
Photography
  ↓
Layout Grammar
  ↓
Prompt Compiler
  ↓
Assets
```

**Trade affects everything.** Change trade → cascades.

---

## Derived Fields (system-computed, never merchant-edited)

- Luxury Score
- Colour Contrast
- Trust Score
- Premium Score
- Accessibility Score
- Readability Score
- Print Score

These become AI inputs.

Example: merchant enters `Trade=Staircases`, `Average Job=£22,000`, `Area=Chelsea`.
System derives: `Premium · Luxury · Residential · Architectural · Natural Wood · Large Photography`. Merchant never answers those directly.

---

## Validation Rules

- **Company Name** — required, 3-80 characters
- **Phone** — E164 or UK Mobile or UK Landline
- **Website** — must be HTTPS
- **Colours** — minimum contrast AA, no duplicate roles, max 5 brand colours
- **Typography** — max 2 primary fonts, max 3 font families total
- **Logo** — SVG required, transparent PNG, minimum 1000px

---

## Versioning — two levels

**Record level:** Brand v1 → v2 → v3
**Field level:** Colour v1 → v2 → v3

This allows: Logo unchanged, Colour changed. **No unnecessary regeneration.**

---

## Snapshot Model

Every generation references:
- Brand Version
- Prompt Version
- Memory Version
- DIL Version

Therefore **every output can be regenerated forever**.

---

## Inheritance (franchises)

```
Head Office
    ↓
Master Brand
    ↓
Branches (override phone, address, manager, coverage, vehicles)
```

**Cannot override without permission:** logo, fonts, colours, typography, icons, tone.

---

## Migration v1 → v2

v1 shape:
```json
{ "name": "Hammerex", "colour": "#FFD400" }
```

v2 shape:
```json
{
  "identity": {...},
  "positioning": {...},
  "colours": [...],
  "typography": {...},
  "tokens": {...},
  "memory": {...}
}
```

Migration: Read v1 → Create Sections → Generate Tokens → Validate → Store v2 → Archive v1.

---

## Master Brand DNA type

```ts
interface BrandDNA {
  identity:      Identity;
  positioning:   Positioning;
  colours:       BrandColour[];
  typography:    Typography;
  logo:          Logo;
  photography:   Photography;
  vehicle:       VehicleRules;
  marketing:     Marketing;
  ui:            UIRules;
  tokens:        DesignTokens;   // derived
  memory:        BrandMemory;    // learned
  version:       string;
}
```

---

## Brand DNA Lifecycle

```
Business Discovery
        ↓
Brand DNA Created
        ↓
Validation Engine
        ↓
Design Intelligence Layer
        ↓
Derived Fields Calculated
        ↓
Design Tokens Generated
        ↓
Brand Version Stored
        ↓
Event Published (BrandCreated / BrandUpdated)
        ↓
Studios React
```

---

## Networkers-specific implementation notes

- **Refactor `src/lib/design/brand/schema.ts`** from flat BrandRecord into 12 sectioned schemas once all 5 parts of V1 are received.
- **Sectioned tables OR one JSONB per section** — decide after V1 Part 3 (App Manifest) so we know how Apps consume sections. Leaning toward one JSONB per section for query performance + partial updates.
- **The existing `hammerex_brand_identity` table** already has `brand_json JSONB` — good for the initial shape. We'll add per-section version tracking + a `brand_derived` table for computed fields once we know the full schema.
- **Three-layer separation** enforced in code: `AuthoritativeFields` / `DerivedFields` / `LearnedFields` as distinct TS types so no one can write a derived field from user input.
