# Trade Operating System · Volume 3 · Question 13
## Prompt Compiler Architecture — The Heart of the Platform

**Audience:** Senior AI Platform Engineers, Compiler Engineers, Systems Architects
**Source:** ChatGPT design-brief architecture series, V3 Q13.

---

## Philosophy

**Never let Studios write prompts.**

Studios express **intent**, not prompt text.

```
Van Studio
    ↓
Design Intent
    ↓
Prompt Compiler
    ↓
Model Specific Prompt
    ↓
GPT Image
```

**The compiler owns all prompt generation.**

### Why?

Without a compiler, every Studio slowly drifts. Thousands of prompts. Impossible to maintain.

With a compiler:

```
Brand DNA + Capability Manifest + Layout Grammar +
Merchant Memory + Vehicle Intelligence + Trade Intelligence
                        ↓
                Prompt Compiler
                        ↓
                Compiled Prompt
```

**One place. Everything consistent.**

---

## Compiler Architecture — 14 Stages

```
Merchant Request
       ↓
1  Intent Parser
       ↓
2  Intermediate Representation (IR)
       ↓
3  Constraint Resolver
       ↓
4  Brand Injection
       ↓
5  Trade Injection
       ↓
6  Layout Injection
       ↓
7  Model Optimiser
       ↓
8  Prompt Generator
       ↓
9  Prompt Validator
       ↓
10 Model Router
       ↓
GPT Image
```

The compiler is a **pipeline**.

---

## Stage 1 — Intent Parser

**Input:** "Create me a luxury black van."

**Output:**
```ts
Intent {
  surface: "vehicle",
  style:   "luxury",
  colour:  "black",
  vehicle: "Ford Transit",
  goal:    "lead generation"
}
```

No prompts yet.

---

## Stage 2 — Intermediate Representation (IR)

The compiler **never works directly from English**. Everything becomes structured.

```ts
interface DesignIR {
  surface:      "vehicle" | "logo" | "website" | "business-card" | "workwear" | "signage" | "social" | "print";
  trade:        string;
  vehicle:      string;
  brand:        BrandDNA;
  layout:       LayoutIntent;
  photography:  PhotographyIntent;
  typography:   TypographyIntent;
  colour:       ColourIntent;
  constraints:  Constraint[];
  outputs:      OutputSpec[];
}
```

**Everything downstream consumes IR.**

### Why IR?

Today: GPT Image. Tomorrow: GPT Image 2, Flux, Recraft, Adobe, future models.

**IR stays. Only generators change.**

---

## Stage 3 — Brand Injection

Compiler reads Brand DNA and injects:
- Primary Colours
- Logo
- Fonts
- Brand Personality
- Premium Level
- Photography Style
- Spacing Scale
- Patterns
- Tone
- Tokens

**Automatically. Studios never specify these.**

---

## Stage 4 — Trade Intelligence

Compiler queries Trade Database.

**Example — trade: "plumber"** returns:
- Photography: Copper · Boilers · Bathrooms · Minimal tools · Premium kitchen
- Trust colours: Blue
- Emergency hierarchy: Large phone number

**Automatically injected.**

---

## Stage 5 — Surface Intelligence

Each surface loads its own rules.

**Vehicle** → Vehicle Database → Ford Transit Custom → Printable Areas · Door Gaps · Wheel Arches · Mirror Locations · Fuel Cap · Rear Handles.

**Website** → Hero Layout · Navigation · Grid · CTA · SEO · Accessibility.

**Business Card** → Bleed · Margins · QR Rules · CMYK · Typography Scale.

Every surface has different rules.

---

## Stage 6 — Layout Grammar

Instead of prompting "Premium", the compiler injects **rules**:

- Hero Image: 62%
- Negative Space: 18%
- Phone: Bottom Third
- Three Information Groups
- Logo Width: 11%
- Diagonal: 24°

These become prompt fragments.

---

## Stage 7 — Constraint Injection

Every capability contributes constraints.

**Vehicle:**
Never cover wheel arches, door handles, fuel cap, lights, number plates, door seams.

**Business Card:**
Minimum font 8pt · CMYK · Safe Area · QR Size · Bleed.

**Website:**
Accessibility · Contrast · Mobile First · Performance.

**No Studio needs to know these.**

---

## Stage 8 — Merchant Memory Injection

Compiler reads history:
- Merchant always chooses Concept 2
- Merchant dislikes gradients
- Merchant enlarges phone number
- Merchant prefers dark backgrounds
- Merchant rejected orange

**Automatically injected.**

---

## Stage 9 — Style Anchors

**Don't inject huge prompts. Inject style tokens.**

**Example — Style Anchor "Luxury Minimal"** expands internally to:
Premium spacing · Large hero · Muted palette · Low visual noise · Swiss hierarchy · Geometric panels · Matte finish.

Compiler expands token → full guidance.

---

## Stage 10 — Capability Manifest

Every Studio contributes outputs.

**Vehicle Studio** outputs: Side · Rear · Front · Printer Pack · Fleet · Preview.
**Website** outputs: Landing · Services · Contact · Gallery.

Prompt generated accordingly per requested outputs.

---

## Stage 11 — Prompt Assembly

Instead of concatenating strings, use **sections**. Each section versioned independently.

```
[IDENTITY]
Luxury staircase manufacturer.

------------------

[VEHICLE]
Ford Transit Custom L2H1.

------------------

[TRADE]
Premium residential joinery.

------------------

[LAYOUT]
Premium diagonal split.

------------------

[COLOUR]
Black
Gold
White

------------------

[TYPOGRAPHY]
Swiss modern.

------------------

[OUTPUT]
Photorealistic wrap.

------------------

[CONSTRAINTS]
No graphics over wheel arches.
```

**Very deterministic.**

---

## Stage 12 — Model Optimiser

Every model behaves differently. Compiler adapts:

- **GPT Image** — natural language, long descriptions
- **Ideogram** — typography emphasis
- **Recraft** — vector emphasis

**Same IR. Different compiler backend.**

---

## Stage 13 — Prompt Validator

Checks:
- Brand present?
- Vehicle present?
- Logo present?
- Typography present?
- Negative constraints present?
- Output resolution present?
- Printer rules present?

**Nothing missing.**

---

## Stage 14 — Cost Optimiser

Compiler decides:
- Need GPT-5 reasoning?
- Need GPT Image?
- Need Recraft?
- Need deterministic code?
- Need cached asset?

**Not every request needs every model.**

---

## Prompt Versioning

Every compiled prompt stored:

```ts
PromptVersion {
  id:              string;
  compilerVersion: "4.2";
  layoutVersion:   "8";
  tradeVersion:    "15";
  vehicleVersion:  "27";
  brandVersion:    "18";
  criticVersion:   "12";
}
```

**Reproduce designs months later.**

---

## Prompt Caching

Hash the inputs:

```
Brand DNA + Vehicle + Capability + Layout + Request = SHA256
```

If unchanged, reuse prior generation or skip redundant reasoning.

---

## Explainability

Every compiled prompt includes **metadata (not sent to the image model)** explaining why each section exists:

```json
{
  "section": "Vehicle Constraints",
  "source": "Vehicle Intelligence",
  "reason": "Prevent graphics over door seams and wheel arches",
  "version": "v3.1"
}
```

Debugging dramatically easier.

---

## TypeScript Interfaces

```ts
interface PromptCompiler {
  compile(
    request: MerchantRequest,
    brand: BrandDNA,
    capability: CapabilityManifest,
    memory: MerchantMemory
  ): CompiledPrompt;
}

interface CompiledPrompt {
  model:               "gpt-image" | "ideogram" | "recraft" | "flux";
  systemPrompt:        string;
  userPrompt:          string;
  negativeConstraints: string[];
  references:          ReferenceAsset[];
  qualityProfile:      string;
  estimatedCost:       number;
  estimatedTokens:     number;
  compilerVersion:     string;
}
```

---

## The Most Important Principle

**The compiler should never generate prompts from scratch.** It composes prompts from versioned knowledge modules:

- Brand Intelligence
- Trade Intelligence
- Vehicle Intelligence
- Print Intelligence
- Layout Grammar
- Typography Intelligence
- Colour Intelligence
- Merchant Memory
- Capability Manifest
- Output Profile

**Prompts become compiled artifacts, not handwritten text.**

---

## Bonus — Prompt Recipes

Add a reusable Recipe layer **above** the compiler:

```
Merchant Intent
       ↓
Recipe (Luxury Van Wrap v5)
       ↓
Compiler
       ↓
Compiled Prompt
```

A Recipe defines the overall creative strategy (e.g., "Premium Split Panel", "Minimal Fleet Branding", "Luxury Joinery Website") **without embedding model-specific wording**. Recipes reference Layout Grammar, Design Intelligence, and Capability modules by version.

Three benefits:
1. **Improve a recipe once, every future generation benefits.**
2. **A/B test recipes** independently of the compiler.
3. **Introduce new AI models** without rewriting creative strategies.

**Intent → Recipe → Compiler → Model** is how to architect for long-term maintainability.

---

## Networkers-specific implementation notes

- **Location:** `src/lib/design/compiler/`
- **File structure:**
  - `ir.ts` — IR types (DesignIR, LayoutIntent, PhotographyIntent, etc.)
  - `types.ts` — CompiledPrompt, PromptVersion, ReferenceAsset, Constraint
  - `index.ts` — public API (`compile()` entry point + compiler version constant)
  - `stages/` — one file per stage of the 14-stage pipeline
  - `recipes/` — Prompt Recipes as data files (Luxury Van Wrap · Minimal Fleet · etc.)
  - `backends/` — model-specific compilers (gpt-image.ts · ideogram.ts · recraft.ts)
- **Prompt storage:** compiled prompts persist to `hammerex_van_generations.prompt_text` (already exists) plus new `hammerex_compiled_prompts` table for global compiler analytics (V3 Q28 Prompt Analytics territory).
- **Caching:** in-memory LRU keyed by input hash, fallback to Postgres `hammerex_compiled_prompts.hash` lookup. Invalidate on compilerVersion bump.
- **Explainability metadata** persists as JSONB alongside every prompt. Powers Mate's "why did you pick gold?" answer via `getPromptExplanation(promptId)`.
- **The compiler is what unlocks real generation.** Every Studio App's generator function now calls `promptCompiler.compile(...)` → `imageGen.generateImage(prompt.userPrompt, ...)`. Van Wrap App's placeholder generator becomes real code the moment this compiler + OPENAI_API_KEY are live.
