---
author: Philip O'Farrell
role: Founder · constitutional author for NEX architecture
captured_at: 2026-07-31
type: nex_governance_ruling
subtype: constitutional_level · tenth_ruling_of_the_day · router_diagnostic_failures_five_six · new_intents_purchase_quote_service · estimator_brain_candidate · confidence_dimension
status: CONSTITUTIONAL_LEVEL_RULING · TENTH_RULING_OF_THE_DAY · EXTENDS_ROUTER_TEST_CORPUS · STANDARD_v1_UNMODIFIED
intended_use: |
  Tenth constitutional-level governance ruling on 2026-07-31.
  Preserves TWO MORE Router diagnostic failures — bringing the test corpus from four failures (addendum ruling) to SIX.
  Introduces new Intent values (Purchase · Enquire · Quote · Service) per Vocabulary Elasticity Principle.
  Proposes ESTIMATOR BRAIN as a candidate for the multi-brain architecture (or as a Knowledge Domain within Staircase Brain).
  Introduces CONFIDENCE dimension in Router output (composes with Standard v2 Knowledge Confidence candidate).
  Preserves Philip's template pricing response as seed content for a future Pricing Knowledge Base article.
rule_a_compliance: no fabrication · verbatim preservation of Philip's authored content
rule_b_compliance: authored by named expert (constitutional author role)
rule_c_compliance: every claim traceable to Philip O'Farrell 2026-07-31
rule_new_compliance: no data missed · every diagnostic and every proposed value preserved below
extends:
  - nex-governance-ruling-2026-07-31-addendum-two-routers-reference-gallery-article-metadata.md (four-failure test corpus becomes six-failure)
  - Vocabulary Elasticity Principle (values within router dimensions are empirical · new values expected)
  - nex-governance-ruling-2026-07-31-nine-evidence-first-principle-trust-as-defining-characteristic.md (Router failure = trust-eroding · Router success = trust-building)
gatekeeper_discipline: |
  Standard v1 remains UNMODIFIED.
  Test corpus additions are Evidence layer content · not architectural changes.
  Router vocabulary evolutions preserved per Vocabulary Elasticity Principle.
  Estimator Brain is a candidate · not built · awaits Reality signal.
  Pricing response template is seed content · not authoritative pricing.
---

# NEX Governance Ruling — 2026-07-31 (Tenth Ruling · Router Diagnostic Failures 5 & 6 · New Intents · Estimator Brain Candidate · Confidence Dimension)

## Philip's Constitutional Statement (preserved verbatim as authored)

---

## Router Diagnostic Failure #5 — "need staircase"

*This is actually a very useful diagnostic.*

*The user typed:* **"need staircase"**

*But Nex answered with a generic fact about manufacturing.*

*That tells me the Question Router isn't understanding the user's intent yet.*

*The words "need staircase" are extremely ambiguous. A human would immediately ask:*

- *"Do you need to buy one?"*
- *"Are you looking for designs?"*
- *"Do you need a quotation?"*
- *"Do you need installation?"*
- *"Do you need help choosing a staircase?"*

*Instead, Nex appears to have routed only on the keyword staircase and returned the default Staircase article.*

### What Should Happen Instead

*The router should detect:*

- **Intent:** Purchase / Inquiry
- **Subject:** Staircase
- **Confidence:** Low

*Rather than retrieving a random staircase fact, Nex should guide the conversation.*

*For example:*

> ***I can help you with a staircase. What would you like to do?***
>
> *• View staircase designs*
> *• Learn about staircase types*
> *• Get a quotation*
> *• Find the right staircase for your home*
> *• Ask a staircase question*

*or even*

> ***"Are you looking to buy a staircase, or would you like information about staircase types and designs?"***

*That feels much more natural.*

### This is Exactly Why the Router Matters

*Right now it looks like:*

```
need staircase
     │
     ▼
keyword = staircase
     │
     ▼
Default staircase article
```

*It should become:*

```
need staircase
     │
     ▼
Intent Detection
     │
     ▼
Purchase / Browse
     │
     ▼
Conversation Guidance
```

### I Think You've Discovered Another Intent

*Looking at your examples today, I see a new high-level intent emerging.*

| User says | Intent |
|---|---|
| What is a staircase? | Learn |
| Show me oak staircases | Browse |
| Need staircase | Buy / Enquire |
| How much? | Quote |
| Install staircase | Service |
| Compare oak vs ash | Compare |

*Those shouldn't all go to the same article.*

*This is another example of why you've been saying don't create thousands of question-and-answer pairs. The knowledge already exists. The missing piece is teaching the Router to recognize what the user is trying to achieve before it retrieves evidence. Once the Router can distinguish "learn", "browse", "buy", "compare", "quote", and "install", Nex's responses will feel far more relevant without needing duplicate content.*

---

## Router Diagnostic Failure #6 — "How much for straight flight stairs"

*This is actually an even better diagnostic than the previous one.*

*The user asked:* **"How much for straight flight stairs"**

*But Nex answered about:* **Sweeping curved staircases**

*That tells us the Router is failing before retrieval.*

### What Probably Happened

*The query contained:* how much · straight · flight · stairs

*The Router should have interpreted:*

| Dimension | Correct value |
|---|---|
| Intent | Pricing / Quote |
| Subject | Straight flight staircase |
| Brain | Staircase Brain |
| Domain | Pricing / Estimating |
| Information Type | Cost |

*Instead it appears to have done something like:*

```
Found "straight"
      ↓
Matched article containing "straight"
      ↓
Returned wrong document
```

*or*

```
Low confidence
      ↓
Fallback to unrelated staircase type
```

*Either way, it completely ignored the most important words:* how much · straight flight

### What Nex Should Have Replied

*If there is no pricing data yet:*

> ***Straight flight staircases are generally the most economical staircase type because they are the simplest to design, manufacture and install.***
>
> *The price depends on:*
>
> *• Material (softwood, oak, walnut, etc.)*
> *• Width*
> *• Number of steps*
> *• Balustrade style*
> *• Handrail design*
> *• Glass, timber or metal balustrades*
> *• Installation requirements*
>
> *If you tell me your approximate floor-to-floor height and preferred material, I can explain the options or prepare an estimate.*

*Notice:*

> *It answers the question... without inventing prices.*

### Or If You Have an Estimator Brain

*Even better:*

```
Intent
   ↓
Pricing
   ↓
Estimator Brain
   ↓
Ask for measurements
   ↓
Generate estimate
```

*No Staircase Type Profile should ever be returned.*

### This Confirms Something We've Seen Today

*Your current retrieval seems heavily keyword driven.*

```
Question → Keyword → Article
```

*Instead of:*

```
Question → Intent → Brain → Knowledge Domain → Information Type → Evidence
```

*That's exactly why you've spent so much time defining the five routing dimensions.*

### This is a Router Test Case

*I'd save this as a permanent Router validation example.*

**User query:** *"How much for straight flight stairs"*

**Expected routing:**

- Intent: Pricing / Quote
- Subject: Straight flight staircase
- Brain: Estimator Brain (or Staircase Brain if pricing isn't separated yet)
- Knowledge Domain: Estimating / Pricing
- Information Type: Cost

**Current behaviour:** Returned an unrelated sweeping staircase article.

**Result:** ❌ Router failure.

*This is a valuable diagnostic because it doesn't indicate missing knowledge—it indicates incorrect routing. Once the Router correctly identifies pricing intent before retrieval, the same knowledge base can produce a much more relevant response without requiring additional question-and-answer pairs.*

---

## Gatekeeper Governance Actions (this tenth ruling triggers)

### 1. ROUTER TEST CORPUS EXTENDED — four failures → six diagnostics

The addendum ruling preserved four Router failures. This tenth ruling adds two more. Full test corpus now:

| # | User asks | Nex returned | Should return | Root cause |
|---|---|---|---|---|
| 1 | What type of staircase? | Installation | Classification | Missing Information Type router |
| 2 | Straight flight oak staircase images | Installation | Reference Gallery | Missing Intent router (Browse Images) |
| 3 | What size newel post? | Definition | Dimensions | Missing Information Type router |
| 4 | What woods are available? | Timber knots | Timber species | Keyword match vs semantic routing |
| 5 | **need staircase** | Generic manufacturing fact | Purchase/Inquiry clarification | Missing Intent router + Low Confidence handling |
| 6 | **How much for straight flight stairs** | Sweeping curved staircase | Pricing/Quote for straight flight | Keyword-driven retrieval · not intent-driven |

Governance action: this six-failure test corpus becomes the mandatory Router validation set. When Router is built · it must pass ALL SIX. Composes with the outcome-based Router acceptance criterion from the third ruling.

### 2. NEW INTENT VALUES per Vocabulary Elasticity Principle

Philip's enumerated new intents (preserved verbatim):

| User query pattern | Intent value |
|---|---|
| "What is X?" | Learn |
| "Show me X" | Browse |
| "Need X" | **Buy / Enquire** |
| "How much?" | **Quote** |
| "Install X" | **Service** |
| "Compare X vs Y" | Compare |

Intent value evolution across the ten same-day rulings:
- Addendum: Learn · Identify · Compare · Browse Images · Buy · Install · Troubleshoot · Quote (8 values)
- Third ruling: Identify · Explain · Compare · Browse · Advise · Troubleshoot (6 values)
- This tenth ruling: Learn · Browse · **Buy / Enquire** · **Quote** · **Service** · Compare (6 values with new nuance)

Governance action per Vocabulary Elasticity Principle (Standard v1 §1.3): values are empirical · evolution expected. No reconciliation required — reality will decide which values become canonical over time.

### 3. ESTIMATOR BRAIN — candidate for multi-brain architecture

Philip's exact language:

> *"Brain: Estimator Brain (or Staircase Brain if pricing isn't separated yet)"*

Governance analysis: Estimator Brain is proposed as a candidate. Two options:

| Option | Structure | When to build |
|---|---|---|
| (a) Estimator as its own Brain | Trade Intelligence has an Estimator Brain alongside Staircase · Tool · Materials · Joinery · Interior · Construction · Roofing etc. | When pricing spans multiple trades and needs consistent estimating logic |
| (b) Estimator as a Domain within each Brain | Each brain has an Estimating/Pricing domain alongside Classification · Components · Materials · etc. | When pricing is tightly coupled to each trade's specifics |

Governance action per Author-Driven Rule + Reality-Over-Speculation: no build until authoring reveals a limitation. Reality signal that would unlock the build: pricing queries begin arriving in volume · current knowledge cannot route them correctly. Reality has not yet spoken this signal — the Router failure #6 is a routing problem · not a knowledge problem.

Preserved as a Standard v2 candidate consideration alongside the Knowledge Confidence Layer.

### 4. CONFIDENCE DIMENSION in Router output — composes with Standard v2 candidate

Philip's authored Router output for Failure #5:

- Intent: Purchase / Inquiry
- Subject: Staircase
- **Confidence: Low**

First authored explicit Router-output CONFIDENCE dimension. Composes with:

- The Unknown Rule (memory index · immutable) — *"WHEN UNSURE, DO NOT GUESS THE BRAIN. DEFAULT TO WISDOM."*
- Knowledge Confidence Layer (Standard v2 candidate from sixth ruling · Canonical / Reference / Observed / Emerging)
- Evidence First (proposed ninth-ruling principle) — *"Unknown is preferable to incorrect."*

Governance action: Router-Confidence is a distinct dimension from Knowledge-Confidence. Router-Confidence = "how confident is the Router in the classification?" · Knowledge-Confidence = "how mature is the evidence?" Both compose but are separate. Preserved as an emerging Router-output field.

**Low Confidence handling requirement** — when Router-Confidence is Low, Nex must GUIDE CONVERSATION rather than retrieve arbitrary evidence. Philip's authored example:

> *"I can help you with a staircase. What would you like to do? • View staircase designs • Learn about staircase types • Get a quotation • Find the right staircase for your home • Ask a staircase question"*

This is a CLARIFICATION PATTERN · not an evidence retrieval. Governance action: Low-Confidence routing produces clarification · never guessed evidence. Composes with the Unknown Rule.

### 5. PRICING RESPONSE TEMPLATE — seed content preserved

Philip's authored template response for "How much for straight flight stairs" — preserved verbatim as SEED CONTENT for a future Pricing Knowledge Base article:

> *"Straight flight staircases are generally the most economical staircase type because they are the simplest to design, manufacture and install.*
>
> *The price depends on:*
> *• Material (softwood, oak, walnut, etc.)*
> *• Width*
> *• Number of steps*
> *• Balustrade style*
> *• Handrail design*
> *• Glass, timber or metal balustrades*
> *• Installation requirements*
>
> *If you tell me your approximate floor-to-floor height and preferred material, I can explain the options or prepare an estimate."*

Governance analysis: this template demonstrates key principles:
- Answers the question WITHOUT inventing prices (Evidence First · Rule A)
- Enumerates the factors that determine cost (workshop-companion attribute: *what experienced professionals notice*)
- Invites further conversation with specific asks (Customer Empowerment · workshop-companion attribute: *when to choose one approach*)
- Preserves the manufacturer's authority to prepare the actual estimate (Single Point of Responsibility)

Governance action: this template MAY become the anchor for a future Pricing Knowledge Base article · authored under Standard v1 discipline · placed in the appropriate Knowledge Domain (currently a candidate: Pricing/Estimating as a new domain within Staircase Brain).

### 6. KEYWORD-DRIVEN RETRIEVAL formally confirmed as the current failure mode

Philip's exact language:

> *"Your current retrieval seems heavily keyword driven."*

Governance action: keyword-driven retrieval is now formally identified as the failure mode across all six Router diagnostic examples. The remedy is the five-dimension Question Router (Standard v1 §2.3). Composes with the eighth-ruling next-milestone definition — when Router successfully replaces keyword retrieval, the entire architecture is validated.

### 7. TENTH SAME-DAY IDENTITY / VALIDATION STATEMENT

Adding this ruling's contribution:

1. Workshop companion, not encyclopedia (1st)
2. Grow the Staircase Brain · teach Nex how to choose (addendum)
3. Content acquisition → knowledge orchestration (3rd)
4. Teaching Nex → teaching Nex how to think (4th)
5. Knowledge operating system (5th)
6. Milestone crossed (6th · RATIFIED)
7. Standard v1 is EXECUTABLE (7th)
8. Constitution is the center (8th)
9. Trust is potentially the defining characteristic · Evidence First names the theme (9th)
10. **Keyword-driven retrieval is the confirmed failure mode · six-failure test corpus locked · Purchase / Quote / Service intents introduced · Estimator Brain candidate proposed · Confidence dimension formalised in Router output** (this 10th ruling)

Ten statements · one direction · one project.

**All governance rulings preserved verbatim across ten same-day documents · Standard v1 protected · Router test corpus expanded to six diagnostics · new Intent values preserved per Vocabulary Elasticity Principle.**
