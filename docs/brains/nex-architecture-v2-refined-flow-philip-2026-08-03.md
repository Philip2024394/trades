---
authored_by: Philip O'Farrell (10-point architecture refinement + 13-step flow)
authored_role: Founder architecture refinement · Master AI Engineer synthesis
captured_at: 2026-08-03
capture_medium: written contribution
governance:
  rule_a_anti_fabrication: pass · doctrine authored by Philip
  rule_b_no_ai_authored:   pass on doctrine · synthesis marked
  rule_c_attributable_origin: pass · origin = Philip O'Farrell 2026-08-03
architecture_layer: L2 · SUPERSEDES the previous 10-step Untouchable Flow with a refined 13-step flow
document_version: 2.0
document_type: MEGA_DOCTRINE · governs the refined Untouchable Plan
composes_with:
  - docs/brains/nex-foundation-brains-roadmap-philip-2026-08-03.md (Phase A · shipped)
  - docs/brains/nex-master-intent-library-v1-philip-2026-08-03.md (Phase B doctrine)
  - docs/brains/nex-universe-catalog-philip-2026-08-03.md (Phase D-G doctrine)
  - docs/brains/nex-global-knowledge-domains-catalog-philip-2026-08-03.md (companion · 100+ domains)
  - docs/brains/nex-domain-template-philip-2026-08-03.md (companion · repeatable structure)
  - docs/brains/nex-authoring-workflow-philip-2026-08-03.md (companion · questions→drafts→review)
supersedes: nex-untouchable-plan-v1 (in earlier constitutional pin)
---

# NEX Architecture v2 · The Refined Untouchable Flow

## The Doctrine Refinement

Philip 2026-08-03: *"There are a few additions I would make before you lock it as the long-term architecture."*

Ten specific refinements are integrated below into a single coherent 13-step flow. Every existing pin composes with this document; nothing is discarded, only refined.

## The 13-Step Long-Term Flow (SUPERSEDES the 10-step v1 flow)

```
Customer
    ↓
Identity              (who is this · homeowner/architect/builder/business-owner)
    ↓
Goal                  ("what are you trying to achieve today?" · 7 goal cards)
    ↓
Intent                (10 universal verbs · Create/Communicate/Decide/Plan/Manage/Automate/Analyse/Learn/Improve/Monitor)
    ↓
Domain                (100+ global knowledge domains · 13 categories)
    ↓
Knowledge Layer       (NEW · FAQs · Images · Videos · Drawings · Standards · Components · Articles · Calculators · Specifications)
    ↓
Reasoning             (evidence gathered · confidence scored · trade-offs weighed)
    ↓
Planner               (decompose into steps · sequence dependencies · estimate cost & time)
    ↓
Skills                (declared capabilities · Knowledge Needed · Tools · Permissions · Outputs · Cost · Time)
    ↓
Action Engine         (NEW · Question → Reason → Plan → Actions → Result · executes, doesn't just answer)
    ↓
Workspace             (long-term memory · every action creates a durable artefact)
    ↓
Memory                (patterns stored · preferences learned)
    ↓
Continuous Learning   (NEW · each interaction improves future recommendations)
```

Compared to v1: **NEW** at steps 5 (Knowledge Layer), 10 (Action Engine), 13 (Continuous Learning). The other 10 refinements below describe HOW each step must behave.

## The 10 Architecture Refinements (each is a HARD RULE)

### 1 · Knowledge Layer Inserted Between Router and Brains

**Rule:** The Brain does NOT contain everything. Knowledge is a separate layer BETWEEN Router and Brain.

```
Router → KNOWLEDGE LAYER → Brain → AI Specialists
```

Knowledge contains: FAQs · Images · Drawings · Videos · Standards · Components · Articles · Rules · Case studies · Calculators · Specifications. The Brain USES that knowledge — it doesn't ARE that knowledge.

**Why:** Brains stay small and cognitively focused. Knowledge grows unboundedly without bloating the Brain. Multiple Brains can share the same Knowledge (e.g. Staircase Brain + Kitchen Brain both consult the Timber Knowledge Layer).

### 2 · Split Knowledge Into Two Types · Universal vs Workspace

**Rule:** Never mix. Two clearly-separated stores.

- **Universal Knowledge** — Staircase standards · Panel designs · Timber species · Lighting principles · Regulations · FAQs. Shared by all users.
- **Workspace Knowledge** — John's quotes · John's customers · John's drawings · John's measurements · John's emails · John's suppliers. Isolated per user, never shared.

**Why:** Legal (privacy) · Trust (customer data must stay theirs) · Scale (universal knowledge cached globally, workspace data stays regional) · Cognitive (Brains reason over both but never confuse them).

### 3 · Action Engine Replaces "Answer-Only" Behaviour

**Rule:** Nex does NOT just answer. Nex executes.

```
v1 model (broken):  Question → Answer
v2 model (correct): Question → Reason → Plan → Actions → Result
```

Example: User says *"Create my website"*. Nex does not describe how. Nex:
1. Reasons about their business + industry + goal
2. Plans the sequence (domain → design → content → SEO → publish)
3. Executes each step (buys domain · designs pages · writes copy · runs SEO · publishes)
4. Returns the RESULT (a live website), not the DESCRIPTION

Composes with Fifth Law (Completion) — Action Engine is the runtime that makes Fifth Law tangible.

### 4 · Capabilities Declare Everything They Need

**Rule:** Every Skill has a mandatory declaration schema.

```yaml
skill_id: website_builder
knowledge_needed:
  - SEO
  - HTML
  - Branding
tools_needed:
  - Image AI
  - Website Builder
  - Payments
permissions_needed:
  - domain_purchase (Fourth Law · standing_permission)
  - image_generation (session_scoped)
  - website_publish (per_action_confirmation)
outputs:
  - Website
  - Images
  - Copy
  - Forms
estimated_cost_usd: 15-45
expected_time_minutes: 20-45
```

Every Skill · every Industry Pack · every AI Specialist follows this schema. The Router uses it to pre-flight: does the user have the permissions? · is the cost budget approved? · will the time fit their patience?

### 5 · Every Response Carries Internal Confidence Scores

**Rule:** Every Nex response computes and (when useful) surfaces confidence per layer:

```
Intent      99%    ← Router 1 · which verb
Domain      96%    ← Router 2 · which knowledge domain
Knowledge   94%    ← retrieved knowledge relevance
Recommendation 91% ← overall answer confidence
Missing     None   ← or lists the gaps
```

If overall <70% → Nex asks a clarifying question (Brain 14 · Never-Guess). Composes with existing ADR-0025 image matcher thresholds and ADR-0033 quality gates.

### 6 · Every Recommendation Carries Evidence

**Rule:** Nex is EXPLAINABLE, not a black box. Every recommendation carries a WHY chain:

```
Recommend: Oak treads
Evidence:
  - Customer requested luxury (from conversation)
  - Budget allows (from stated £2,800-£3,800 range)
  - Indoor staircase (from photo analysis)
  - Matches existing flooring (from uploaded reference)
  - Low maintenance (customer stated preference)
```

Composes with Brain 6 (Recommendations · every reco has explained reasoning) and Brain 11 (Trust · citing evidence builds trust).

### 7 · Learning Loops After Every Completed Task

**Rule:** Every completed task produces a learning signal that improves future recommendations.

```
Task completed → Customer happy?
                     ↓
                    YES  → Store pattern · improve future recommendations
                     ↓
                    NO   → Store what went wrong · avoid the pattern
                     ↓
              Customer edited output? → Learn preferred style · apply next time
```

Composes with ADR-0028 Rule #12 (Nex Never Loses Knowledge · `learning_signals[]` per row) and the existing Learning Queue in `nex-supabase-master-data-architecture-v1.md`.

### 8 · Domain Template (THE BIGGEST REFINEMENT)

**Rule:** Every domain MUST follow the exact same template. See dedicated doc `nex-domain-template-philip-2026-08-03.md`.

Every domain (Staircases · Kitchens · Marketing · Finance · Health · Travel · anything) has the same 4 required components: **Knowledge** (FAQs · Images · Videos · Components · Rules · Calculators · Articles · Gallery · Manufacturers · Standards) · **AI Specialists** (Designer · Engineer · Quoter · Installer or domain-equivalent quartet) · **Router Tags** (Design · Build · Repair · Compare · Learn) · **Workspace Objects** (Quotes · Projects · Images · Measurements · Customers).

**Why:** Adding a new domain becomes copy-the-template + fill-in-the-content. No special cases. No architectural drift. Router logic stays identical across all 100+ domains.

### 9 · Separate Knowledge from Execution

**Rule:** Two layers, never blurred.

- **Knowledge Layer** — knows things. Retrieves. Compares. Explains.
- **Execution Layer** — does things. Generates quotations. Books surveys. Emails customers. Creates CAD files. Orders materials.

Example:
- Knowledge Layer: *"How to build a staircase"* (returns article + reference images + component data).
- Execution Layer: *"Generate the quotation for THIS staircase"* (produces a PDF, emails it, logs to Workspace).

Both layers are used in the same conversation, but they are architecturally distinct. Composes with the Action Engine (refinement #3).

### 10 · Long-Term Vision Flow (the full 13 steps · see top of document)

**Rule:** The 13-step flow at the top of this doc is the CANONICAL long-term architecture. Every new capability tests against it.

## The Router Trace (composes with #5 + #6)

Every conversation produces a "Router Trace" — a machine-readable + human-visible breadcrumb showing every routing decision Nex made:

```
User: "I need a luxury staircase for my self-build in Manchester"

TRACE
  Intent      → Create (0.98)
  Domain      → Staircase (0.99)
  Sub-Domain  → Contemporary Premium Tier (0.87)
  Knowledge   → 815 reference images · 1980 FAQs · panel design catalog (0.94)
  Skills      → design · quote · image-match · recommend (0.92)
  Confidence  → 0.92 · no clarification needed
  Evidence    → Manchester (from message) · luxury (from message) · self-build (from message) · staircase (from message)
  Missing     → floor-to-floor height (would improve quote precision by 15%)
  Action Plan →
    1. Retrieve 3 reference specimens matching "luxury contemporary staircase"
    2. Ask floor-to-floor height (optional refiner)
    3. Compose recommendation with 3 alternatives
    4. Offer next step: quote / sample / video call
```

This trace serves two purposes: **debugging** (Philip + engineers can see every routing decision) and **explainability** (advanced users can request the trace when they want to know WHY Nex recommended X).

## The Untouchable Test v2 (updated from v1)

Any proposed feature from today onwards must pass ALL of these:

1. Does it strengthen one of the 9 Constitution Principles?
2. Does it fit somewhere in the 13-step flow?
3. Can it be described as one of the 10 universal verbs?
4. Does it output a visible artefact into a Workspace?
5. Does it use a Foundation Brain to speak?
6. **NEW · Does it follow the Domain Template if it's a new domain?**
7. **NEW · Does it separate Knowledge from Execution?**
8. **NEW · Does it declare Skill capabilities in the mandatory schema?**
9. **NEW · Does it carry Evidence for every recommendation?**
10. **NEW · Does it feed a Learning Loop after completion?**

If any answer is no → back to backlog.

## Build Order (refined from v1)

Existing Phase A (Foundation Brains · 15 shipped) and Phase B (Intent Library runtime · shipped) unchanged.

**New phase inserted after B:**

**Phase B.5 · Knowledge Layer Separation** — extract Knowledge from the existing Brain files into a dedicated retrieval layer. Every Brain doc becomes an INDEX of the Knowledge it consults; the Knowledge lives in `data/nex-knowledge/{domain}/`.

**Phase C · Identity + Goal Layer UI** (unchanged from v1).

**Phase D · First 3 Industry Packs** (unchanged from v1) · but every Pack now uses the Domain Template.

**Phase E · AI Specialists Persona Layer** (unchanged from v1) · but each Specialist now declares Capabilities per refinement #4.

**Phase F · Workspace persistence + long-term memory** · plus **Learning Loops** (refinement #7).

**Phase F.5 · Action Engine** (NEW) — the runtime that turns "answer" into "execute." Composes with Fourth Law authority prompts.

**Phase G · Skills Marketplace** (unchanged from v1) · but every Skill uses the mandatory declaration schema.

## Enhancement Opportunity

The v1 flow described a scalable operating system. The v2 flow describes a scalable operating system with:

- Knowledge that scales without bloating Brains
- Universal vs Workspace privacy separation
- Execution that ACTUALLY completes work (not describes it)
- Every Skill self-describes its cost + time + permissions
- Confidence scored per layer (debuggable + explainable)
- Every recommendation carries evidence (auditable + trusted)
- Learning loops that improve every day (compounding advantage)
- Domain Template that eliminates special cases (100+ domains, one architecture)
- Knowledge and Execution never blurred (clean layer boundaries)
- 13-step flow that anticipates the next 5 years of capability growth

**This is the architecture that lets Nex scale to 500,000+ images (per ADR-0028) · 100+ domains · millions of users · without ever fragmenting or slowing down.** That is untouchable.
