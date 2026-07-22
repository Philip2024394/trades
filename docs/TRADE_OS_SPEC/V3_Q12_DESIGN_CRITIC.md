# Trade Operating System · Volume 3 · Question 12
## AI Design Critic — Creative Director Quality Gate

**Audience:** Senior AI Engineers, Platform Architects, Design Systems Engineers
**Source:** ChatGPT design-brief architecture series, V3 Q12.

---

## Philosophy

The biggest mistake AI design platforms make:

```
Prompt → Image → Merchant
```

**No review. No creative direction. No quality gate.**

Professional agencies work like this:

```
Designer → Creative Director → Client
```

Trade OS does the same. **Every generated asset passes through an AI Creative Director before the merchant ever sees it.**

---

## Architecture

```
Merchant Request
        ↓
Prompt Compiler
        ↓
Image Generator
        ↓
AI Design Critic ⭐
        │
   ┌────┴────┐
   ▼         ▼
 PASS      FAIL
   │         │
   ▼         ▼
Merchant   Regeneration
              ↓
      Prompt Improvements
              ↓
      Image Generator
```

**The Critic is a completely separate AI. It never generates images. It only judges.**

---

## Philosophy of the Critic

The Critic thinks like: Creative Director · Brand Consultant · Vehicle Wrap Specialist · Print Production Expert · Typography Expert · Marketing Consultant.

**Not like an image model.**

---

## Twelve Scoring Categories

Every asset receives a score out of 100.

| Category | Weight |
|-|-|
| Brand Consistency | 10 |
| Visual Hierarchy | 10 |
| Layout & Composition | 10 |
| Spacing & Balance | 8 |
| Typography | 10 |
| Colour Harmony | 8 |
| Trade Suitability | 8 |
| Premium Feel | 10 |
| Trust & Professionalism | 8 |
| Legibility | 10 |
| Printability | 10 |
| Commercial Effectiveness | 8 |
| **Total** | **100** |

### Example Score

```
Brand      96
Hierarchy  98
Spacing    91
Typography 94
Colour     97
Trade     100
Premium    96
Trust      98
Legibility 95
Print     100
Commercial 92

Overall   96.3
```

---

## Quality Thresholds

| Range | Meaning |
|-|-|
| 98-100 | Exceptional · Agency quality |
| 95-97 | Production Ready |
| 92-94 | Good · Automatic improvements suggested |
| 90-91 | Regenerate once |
| Below 90 | Reject · Regenerate automatically |

**Merchant should rarely see anything below 92.**

---

## Critic Prompt Structure

The Critic never receives only the image. It receives:

```
Brand DNA + Capability Manifest + Layout Grammar +
Merchant Request + Generated Image + Output Constraints
```

**It knows what the design was supposed to achieve.**

---

## Critic Prompt (template)

```
You are the Creative Director of a world-class design consultancy.

Review this design as if it were being presented to a paying commercial client.

Evaluate:
• Brand consistency
• Visual hierarchy
• Typography
• Spacing
• Colour harmony
• Trust
• Professional appearance
• Commercial effectiveness
• Print readiness
• Trade suitability
• Premium quality

Return ONLY structured JSON.

Do not redesign. Critique.
Explain every deduction. Suggest improvements. Assign scores out of 100.
```

---

## Output Schema

```ts
interface CriticResult {
  overall: number;
  scores: {
    brand:        number;
    hierarchy:    number;
    spacing:      number;
    typography:   number;
    colour:       number;
    trust:        number;
    premium:      number;
    legibility:   number;
    printability: number;
    trade:        number;
    commercial:   number;
  };
  strengths:    string[];
  weaknesses:   string[];
  actions:      string[];
  approved:     boolean;
}
```

---

## Automatic Regeneration Loop

```
Prompt → Image → Critic → 89 → Feedback → Compiler → Prompt Adjustment
                → Image → Critic → 96 → Merchant
```

**The merchant never sees Version 1.**

Max **3 attempts**. After three, escalate to human review.

---

## Regeneration Strategy

Never regenerate randomly. **Only regenerate failing sections.**

- Problem: Typography → Compiler increases font hierarchy
- Problem: Vehicle Layout → Adjust logo placement
- Problem: Premium Feel → Increase spacing, reduce clutter

**Small corrections. Not full redesigns.**

---

## Surface-Specific Rubrics

Every capability contributes additional rules.

### Vehicle Wrap
Wheel arches clear · Door seams respected · Number plate visible · Rear phone readable · Driving legibility · Safe print zones · Logo prominence

### Logo
Scalability · Distinctiveness · One-colour version · Recognition · Vector suitability · Trademark risk

### Business Card
Bleed · Margins · Font size · QR size · Print contrast · CMYK suitability

### Website
Accessibility · Responsive hierarchy · CTA visibility · Navigation · Reading flow · Contrast

---

## Design Smells (pattern checks)

Too many colours · Too many fonts · Low contrast · Weak hierarchy · Busy composition · Tiny logo · Tiny phone number · Low trust appearance · Stock-photo look · Amateur spacing · Crowded layout · Unreadable typography.

## Positive Recognition
Excellent hierarchy · Premium spacing · Strong photography · Outstanding colour balance · Excellent readability · Luxury aesthetic · Professional trust · Clear CTA.

---

## Learning Integration

Every critique updates memory:

- Merchant approved Vehicle 96 → Memory: "Successful Layout: Premium Split" · Confidence +8%
- Rejected Busy Layout → Confidence -12%

**The system evolves.**

---

## Human Review Trigger

Escalate when:
- Score below 85, OR
- Typography unreadable, OR
- Print risk, OR
- Brand mismatch, OR
- Merchant requested review

---

## Critic Dashboard (per generated asset)

Generation · Score · Revision Count · Time · Weaknesses · Strengths · Approved · Critic Version.

**Quality becomes measurable.**

---

## Critic API

```ts
interface DesignCritic {
  review(
    image:      GeneratedImage,
    brand:      BrandDNA,
    capability: CapabilityManifest
  ): CriticResult;
}
```

---

## Versioning

Critic v1 → v2 → v3. Every generation records: Compiler Version · Layout Version · Trade Version · **Critic Version**.

Historical designs remain reproducible.

---

## Continuous Improvement

Analyse thousands of critiques:
- Luxury layouts avg: 96
- Minimal layouts: 98
- Busy layouts: 84
- Dark backgrounds: 94
- White backgrounds: 89

Insights feed back into: Design Intelligence Layer · Prompt Compiler · Trade Intelligence · Layout Grammar.

---

## Architectural Principle

**Generation should be creative. Critique should be deterministic.**

By separating creation from evaluation, Trade OS gains a self-improving quality loop: designers explore ideas, creative directors enforce standards, only polished work reaches the client.

**That quality gate is one of the strongest long-term differentiators of the platform.**

---

## Networkers-specific implementation notes

- **Location:** `src/lib/design/critic/`
- **Files:**
  - `critic.ts` — main `review()` implementation
  - `prompts/creative-director.ts` — the critic prompt template
  - `rubrics/` — surface-specific rubrics per V1 Part 3 App Manifest QA rules
  - `regenerate-loop.ts` — the 3-attempt regeneration state machine
- **Model:** GPT-5 tier for text-based critique (cheap). Optional GPT Vision pass for image-level checks (add later, ~$0.005 per critique).
- **Cost per critique:** ~$0.005 medium (text only) → ~$0.020 with vision. Worth it — prevents merchant seeing sub-92 output.
- **Persistence:** every critique persists to `hammerex_van_generations.quality_score` (already exists) + new `score_breakdown JSONB` column (already added in the foundation migration).
- **Feedback injection:** the critic's `actions[]` array feeds back into the compiler as `MODIFICATION_REQUEST` sections for the next attempt.
- **Ensemble critique** (multi-persona) deferred — start with one Creative Director persona, add Landor + Wolff Olins later if scoring drift observed.
- **Human escalation** → surfaced in `/admin/mate/gaps` (already exists) as a new category "design-critic-escalation".
