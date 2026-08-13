---
authored_by: Philip O'Farrell (Pattern Library concept + Pattern DNA + Design Genome + 7-staircase training specimens) · Master AI Engineer (schema + contracts)
authored_role: Founder platform doctrine + Master AI Engineer implementation architecture
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L2 · Visual Pattern Library · Pattern DNA · Design Genome
document_version: 1.0
document_type: MEGA_DOCTRINE · Visual Pattern Library + Pattern DNA + Design Genome
composes_with:
  - docs/brains/nex-phase-e16-visual-learning-object-dna-philip-2026-08-04.md (Object Library + Object DNA)
  - docs/brains/nex-loft-ladder-marketing-collection-philip-2026-08-04.md (first pattern seed)
  - docs/brains/nex-four-layer-distinction-philip-2026-08-04.md (Pattern Library lives in Knowledge)
---

# Visual Pattern Library + Pattern DNA + Design Genome

## The Distinction (Philip 2026-08-04)

*"Not Object Library. Different."*

| Library | Stores | Example |
|---------|--------|---------|
| **Object Library** | Physical objects (Object DNA) | Handrail · Newel · Spindle · Cabinet Door · Chair |
| **Visual Pattern Library** | Reusable design PATTERNS (Pattern DNA) | Kitchen marketing layout · Loft Ladder Banner Layout · Traditional Staircase Advert · Instagram Carousel |

Both use the same DNA-with-versioning + reinforcement-on-observation approach. They differ in what they normalise: OBJECTS vs COMPOSITIONS.

## Pattern DNA Schema

```
Pattern ID · TRADE_BANNER_001
    ├── layout
    ├── alignment
    ├── spacing grammar
    ├── safe zones
    ├── colour hierarchy
    ├── typography hierarchy
    ├── icon spacing
    ├── CTA placement
    ├── conversion history
    ├── best industries
    ├── best audience
    ├── best platforms
    ├── best aspect ratios
    ├── banner example asset ids (evidence)
    └── object slot bindings (which ObjectDNA families slot into which regions)
```

**Rule:** "Use Pattern TRADE_BANNER_001 but swap in Loft Ladder hero" · "Use Kitchen Pattern but convert to Facebook Story." **No redesign necessary** — the pattern already encodes the successful composition.

## The Design Genome

Philip 2026-08-04: *"Every image uploaded teaches one or more of these layers."*

```
Objects        (Object Library · Object DNA)
    ↓
Patterns       (Visual Pattern Library · Pattern DNA · this doctrine)
    ↓
Scenes         (Scene Intelligence Platform · Room composition)
    ↓
Campaigns      (Campaign Intelligence · linked patterns across a customer journey)
    ↓
Knowledge      (Authored + inherited domain knowledge)
    ↓
Rendering     (Delivery Platform · registered exporters)
```

Every phase of the platform contributes to a Design Genome that grows with every upload.

## Pattern Library Runtime

**Location:** `src/lib/nex/pattern-library/` (SHIPPED this session).

**Contract:**
- `register(pattern)` · `get(id)` · `all()` · `byFamily(family)` · `findMatches(candidate, min_similarity)` · `reinforce(id, delta, evidence)` · `applyPattern(id, bindings) → PatternApplication` · `count()` · `clear()`.
- `PatternDNA` carries versioned history + observation_count + aggregate_confidence · like ObjectDNA.
- Similarity function scores pattern candidates by layout/hero position/CTA placement/aspect ratio agreement.

## Seed Patterns

**PREMIUM_TRADE_BANNER_V1** (SHIPPED this session · registered from the 4 loft ladder banners + Philip's staircase/kitchen/joinery templates):

- Layout: 2 columns · left-marketing-panel + right-hero-image · bottom-strip.
- Hero position: right · width ~60%.
- CTA: bottom_right_contact_box.
- Safe zones: hero image · headline · feature icons · contact box.
- Colour hierarchy: theme_pack.primary → theme_pack.secondary → theme_pack.accent.
- Typography hierarchy: headline (extra_bold_uppercase) → subheadline (medium) → features (regular) → CTA (bold).
- Best industries: joinery · kitchens · staircases · loft ladders · under-stair storage.
- Best platforms: Facebook feed · Instagram feed · website hero · print flyer A4.
- Best aspect ratios: 1.91:1 · 1:1 · 4:3.
- Object slot bindings: `hero_slot → LOFT_LADDER | STAIR_* | KITCHEN_ISLAND | KITCHEN_CABINET` · `logo_slot → BRAND_LOGO` · `feature_icon_slots → ICON_SET (4-6)` · `contact_slot → CONTACT_BLOCK`.

## 7 Staircase Training Specimens (Philip 2026-08-04)

Ingested this session as A+ staircase-domain Object Library entries:

1. **Traditional Victorian carved-bracket staircase** — closed string · turned balusters · carved leaf-scroll brackets · 45° mitred tread/string joint.
2. **Baluster-to-tread joint detail** — dowel vs haunched-tenon fixing methods · mitred bullnose wrap.
3. **Open-riser closed-string walnut** — modern minimalist · housed treads · walnut · single closed string.
4. **Mono-string steel spine floating staircase** — powder-coated steel · walnut treads · hidden brackets · base plate anchor.
5. **Open-riser double housed-string** — twin timber strings · no risers · CNC housings.
6. **Closed-riser housed-string** — twin timber strings · closed risers · maximum rigidity.
7. **Closed-box fascia string · canonical reference** — twin continuous fascia strings · closed risers · concealed joinery · front-three-quarter view.

Each becomes a reusable ObjectDNA in the Object Library. Visual Learning Platform reinforces them every time a similar staircase is uploaded.

## Governance

- Every new marketing/product layout uploaded to Nex is a candidate for a new Pattern DNA · not a new file.
- Every existing Pattern DNA reinforces on evidence match · never re-invents.
- New Pattern families extend the taxonomy · never fork the schema.
- Pattern Library and Object Library MUST stay in separate `src/lib/nex/` modules (pattern-library/ vs object-library/) · never merge.
- Both live in the Knowledge layer (Four-Layer Distinction · `feedback_nex_evidence_observations_knowledge_decisions.md`).

## Maturity Scorecard (Philip 2026-08-04)

| Platform | Maturity |
|----------|----------|
| Knowledge Architecture | 10/10 |
| Object Model | 10/10 |
| Design History | 10/10 |
| Reality Advisor | 10/10 |
| Construction Intelligence | 9.5/10 |
| Vision Intelligence | 9/10 |
| Sketch Intelligence | 9/10 |
| Visual Learning | 9/10 |
| Pixel Rendering | 7.5/10 (intentionally lower · renderer is one endpoint) |
| **Pattern Learning** | **shipping in this session** |

Philip: *"The real competitive advantage is everything that happens before rendering (knowledge · reasoning · planning) and after rendering (editing · learning · delivery). Those are much harder for competitors to replicate than a renderer alone."*
