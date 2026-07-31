---
author: Philip O'Farrell
role: Founder · constitutional author for NEX architecture
captured_at: 2026-07-31
type: nex_governance_ruling
subtype: constitutional_level · addendum_to_prior_ruling · two_routers · reference_gallery · article_metadata_requirement
status: CONSTITUTIONAL_LEVEL_RULING · ADDENDUM · EXTENDS_PRIOR_QUESTION_ROUTER_RULING
intended_use: |
  Second constitutional-level governance ruling on 2026-07-31.
  ADDENDUM to nex-governance-ruling-2026-07-31-four-layer-taxonomy-multi-brain-question-router.md.
  Extends the Question Router into TWO ROUTERS (Intent + Information Type).
  Introduces REFERENCE GALLERY as a missing artefact/index class.
  Introduces ARTICLE METADATA requirement (structured descriptors per article).
  Diagnoses four retrieval failures as symptoms of one root cause: keyword-matching vs intent-aware retrieval.
rule_a_compliance: no fabrication · verbatim preservation of Philip's authored content
rule_b_compliance: authored by named expert (constitutional author role)
rule_c_compliance: every claim traceable to Philip O'Farrell 2026-07-31
rule_new_compliance: no data missed · every architectural ruling preserved below
extends: |
  nex-governance-ruling-2026-07-31-four-layer-taxonomy-multi-brain-question-router.md
  (First ruling established Question Router as next priority · this addendum shows it's actually TWO routers · plus Reference Gallery · plus article metadata requirement.)
resolves_new_tensions:
  - Four retrieval failures diagnosed (same root cause)
  - Reference Gallery vs Knowledge Base distinction clarified
  - Article metadata requirement introduced
  - Two-router pattern (Intent + Information Type) established
  - Keyword search vs semantic routing tension resolved
---

# NEX Governance Ruling — 2026-07-31 (Addendum · Two Routers · Reference Gallery · Article Metadata)

## Failure #2 — "Straight flight oak staircase have you got images?"

*This is the same underlying issue, but it's even clearer.*

*The user asked:*

> **"Straight flight oak staircase have you got images?"**

*Nex extracted:*

> `staircases + staircase + straight + flight + image`

*But then still returned the Installation article.*

*That tells me the search is almost certainly behaving like a keyword match rather than an intent-aware retrieval system.*

### What Nex should have understood

*The request contains four separate concepts:*

| Phrase | Meaning |
|---|---|
| Straight flight | Staircase layout |
| Oak | Material |
| Images | User wants visual examples |
| Have you got | Browse request |

*The primary intent is **Browse Reference Images**, not "tell me about staircases."*

### The search should prioritise

*Instead of:*

```
staircase
↓
First staircase article
```

*It should think more like:*

```
Intent:
Browse images

Filters:
Layout = Straight Flight
Material = Oak

Result:
Reference image library
```

### The ideal response

*If your library contains matching references, Nex should answer something like:*

> ***Yes. Here are examples of straight flight oak staircases.***
>
> *I found several reference designs showing:*
>
> - Traditional cut string oak staircases
> - Contemporary closed string oak staircases
> - Straight flight staircases with square oak balusters
> - Straight flight staircases with painted strings and oak treads
>
> *Would you like to compare:*
>
> - Cut string vs closed string
> - Traditional vs contemporary
> - Oak with carpet runner vs fully exposed oak

*Notice that no installation knowledge is needed.*

## I think you're missing one major content type

*From everything you've described over the last few days, you now have:*

- Knowledge Base
- Vision Analysis
- DNA Narratives
- Reference Images
- Workshop Principles
- Staircase Specs

*But I don't think Nex has a dedicated **Reference Gallery** index.*

*Something like:*

```
Reference Library

Layout
 ├── Straight Flight
 ├── Quarter Turn
 ├── Half Turn
 └── Spiral

Construction
 ├── Cut String
 ├── Closed String
 └── Mono String

Material
 ├── Oak
 ├── Walnut
 ├── Ash
 └── Painted

Style
 ├── Traditional
 ├── Contemporary
 └── Industrial
```

*Then "show me straight flight oak staircases" becomes a gallery query instead of a knowledge search.*

## I think your next routing rule should be

*Before retrieval, classify the request.*

*For example:*

```
Does the user want:

□ Learn
□ Identify
□ Compare
□ Browse Images
□ Buy
□ Install
□ Troubleshoot
□ Quote
```

*Your example is clearly:*

```
☑ Browse Images
```

*So Nex shouldn't even search the installation articles.*

## This is actually encouraging

*These failures are happening because **your knowledge base is growing faster than your retrieval strategy**.*

*That's a good problem to have.*

*If you only had 20 articles, brute-force keyword search might seem acceptable. But as you're building hundreds of references, DNA narratives, workshop principles, component guides, and image libraries, Nex needs to answer two questions before it retrieves anything:*

1. **What does the user want to do?** *(identify, browse, compare, learn, install, etc.)*
2. **Which knowledge domain should answer that?** *(reference gallery, classification, installation, materials, tools, etc.)*

*Once those two steps are in place, the rich content you've been creating becomes much easier for Nex to use effectively, and it won't keep falling back to unrelated staircase articles.*

---

## Failure #3 — "What size newel post?"

*This one is much better than the previous examples because Nex found the correct component.*

*However, it still missed the intent.*

*The user asked:* **"What size newel post?"**

*Nex answered:* *"A newel post is the principal structural post..."*

*It answered **What is a newel post?**, not **What size is a newel post?***

### What Nex understood

*It detected:*

> **Entity:** Newel Post

*which is correct.*

### What Nex failed to detect

*It ignored the user's intent:*

> **Intent:** Dimension / Size

*So it returned the definition instead of the specification.*

### What the answer should look like

*A professional answer would be:*

> **Common newel post sizes vary depending on the staircase design and manufacturer.**
>
> *Typical sizes include:*
>
> - **90 × 90 mm** – the most common size for residential timber staircases.
> - **110 × 110 mm** – often used on premium or larger staircases.
> - **120 × 120 mm and above** – used for feature staircases or heavy architectural designs.
>
> *Matching handrails, base rails and balustrades are usually proportioned to suit the chosen newel size.*

*Then optionally:*

> *Would you like to know:*
>
> - Standard newel sizes
> - Feature newel posts
> - Box newels
> - How newel size affects staircase appearance

## I think you're discovering a second router

*Earlier we discussed Knowledge Domains.*

*Now you're finding Information Types.*

*For example:*

| User asks | Information Type |
|---|---|
| What is a newel? | Definition |
| What size is a newel? | Dimensions |
| What does a newel do? | Function |
| Where does a newel go? | Position |
| What wood is used? | Material |
| How is it fitted? | Installation |
| Show me one | Images |
| What's the difference? | Comparison |

*Notice they all refer to the same component, but each requires a different answer.*

## This is how an expert thinks

*When someone says:* **"What size newel post?"**

*A staircase manufacturer doesn't start explaining what a newel is.*

*They immediately think:* **"They're asking about dimensions."**

*That means Nex needs to separate two things:*

> **Object:** Newel Post
>
> and
>
> **Question Type:** Dimensions

*Only then should it retrieve knowledge.*

## I think this is the pattern emerging

*Every query is really:*

```
Intent
   +
Subject
   +
Optional Filters
```

*Example:*

> **"What size newel post?"** becomes
>
> - **Intent** → Dimensions
> - **Subject** → Newel Post
> - **Filter** → Standard Residential

*Whereas*

> **"What is a newel post?"** becomes
>
> - **Intent** → Definition
> - **Subject** → Newel Post

*Same subject. Completely different retrieval.*

*I actually think these tests are extremely valuable because you're exposing the kinds of questions real users will ask. They're showing that your knowledge itself is becoming strong—Nex is finding the right subject more often—but the retrieval layer still needs to identify what aspect of that subject the user wants. Once that intent routing is added, the same knowledge base you've been building will produce much more natural, expert-level answers without requiring you to write separate responses for every possible question.*

---

## Failure #4 — "What woods is available?"

*This is probably the clearest example yet that keyword matching is now holding Nex back.*

*The user asked:* **"What woods is available?"**

*Nex matched:* `available + wood` and returned: *"Live knot (sound knot)..."* because it found the word wood.

*It completely ignored the meaning of the question.*

### What a human staircase expert hears

*When a customer asks:* **"What woods are available?"**

*They immediately think:*

- **Intent:** Materials
- **Subject:** Timber species
- **Expected answer:**
  - Oak · Ash · Walnut · Beech · Sapele · Pine · Hemlock · Maple · Iroko · Accoya · Painted softwood · Engineered oak

*No staircase manufacturer would think: "The customer must be asking about knots."*

### This proves you need semantic routing

*Right now it appears Nex is doing something like:*

```
wood
↓
Find article containing "wood"
↓
Return first result
```

*Instead it needs:*

```
"What woods are available?"
↓
Intent = Material Options
↓
Entity = Timber
↓
Return Material Library
```

## I think your future knowledge map is becoming obvious

```
STAIRCASE BRAIN

Classification

Components

Materials
    ├── Timber Species
    ├── Steel
    ├── Glass
    ├── Finishes
    └── Paint Systems

Construction

Installation

Workshop

Design Languages

Reference Gallery

Knowledge Base
```

*Then:*

> **What woods are available?** never even searches Knot articles.

## Another thing I'm noticing

*Your articles are becoming too valuable to search by keywords.*

*For example, you now have:*

- Oak · Walnut · Ash
- Live knots · Dead knots · Grain · Moisture
- Joinery · Components · Design languages

*Every one contains the word:* **wood**.

*Eventually you'll have hundreds of articles containing "wood."*

*Keyword search simply won't scale.*

## You're reaching the point where every article needs metadata

*Instead of only storing text, every article should carry structured descriptors.*

**For example:**

> **Title:** Available Staircase Timbers
> **Domain:** Materials
> **Category:** Timber Species
> **Intent:** Reference · Selection · Comparison
> **Topics:** Oak · Ash · Walnut · Sapele · Pine
> **Audience:** Customer · Designer · Manufacturer

*Whereas the knot article might be:*

> **Domain:** Materials
> **Category:** Timber Defects
> **Intent:** Identification · Workshop
> **Topics:** Live Knot · Dead Knot · Grain

*Notice both belong to Materials, but they answer completely different questions.*

## These four examples tell the same story

| User asks | Nex returns | Should return |
|---|---|---|
| What type of staircase? | Installation | Classification |
| Straight flight oak staircase images | Installation | Reference Gallery |
| What size newel post? | Definition | Dimensions |
| What woods are available? | Timber knots | Timber species |

*The common pattern is that Nex correctly spots one keyword, but not the user's goal.*

## I actually think this is good news

*None of these failures suggest your knowledge is weak.*

*They suggest your knowledge is now richer than your search strategy.*

*That's a much better problem to have.*

*A year ago, the answer might have been "write more content." Today, I think the priority has shifted. Every new article should continue to be rich and well-structured, but the bigger return on investment is improving intent classification and metadata-driven retrieval so Nex can consistently choose the right knowledge domain before it generates a response.*

*In other words:*

> **Keep growing the Staircase Brain.**
> **Start teaching Nex how to choose from that brain.**

*That's the step that will unlock the value of all the work you've already done.*

---

## Gatekeeper Governance Actions (this addendum triggers)

### 1. TWO ROUTERS pattern established

Yesterday's ruling introduced the Question Router as next priority. This addendum reveals it's actually **TWO routers** that must both fire BEFORE retrieval:

**Router 1 — Intent classification (WHAT the user wants to do):**

```
□ Learn
□ Identify
□ Compare
□ Browse Images
□ Buy
□ Install
□ Troubleshoot
□ Quote
```

**Router 2 — Information Type (WHICH ASPECT of the subject):**

| Question shape | Information Type |
|---|---|
| What is X? | Definition |
| What size is X? | Dimensions |
| What does X do? | Function |
| Where does X go? | Position |
| What wood is X? | Material |
| How is X fitted? | Installation |
| Show me X | Images |
| What's the difference? | Comparison |

**Combined query decomposition:**

```
Every query = Intent + Subject + Optional Filters
```

### 2. REFERENCE GALLERY established as missing artefact/index class

Prior artefact-class enumeration was missing a dedicated Reference Gallery index. Philip's proposed structure:

```
Reference Library
├── Layout (Straight Flight · Quarter Turn · Half Turn · Spiral)
├── Construction (Cut String · Closed String · Mono String)
├── Material (Oak · Walnut · Ash · Painted)
└── Style (Traditional · Contemporary · Industrial)
```

Governance action: this is the browse-navigation index that queries like *"straight flight oak staircase images"* should hit — distinct from Knowledge Base search. Composes with the existing 796-image `nex-staircase-image-gallery-2026-07-31.html` + the 63-entry `admin-image-index-2026-07-31.html` — those are flat listings; Reference Library adds the multi-axis taxonomy.

Not yet implemented as directory structure or tag taxonomy · awaits Philip's explicit build instruction per Reality-Over-Speculation.

### 3. ARTICLE METADATA requirement introduced

Every article should carry structured descriptors:

- **Title**
- **Domain** (Materials · Classification · Installation · etc. — from Knowledge Domains)
- **Category** (Timber Species · Timber Defects · etc. — sub-taxonomy within domain)
- **Intent** (Reference · Selection · Comparison · Identification · Workshop · etc. — multiple values)
- **Topics** (Oak · Live Knot · etc. — multiple values)
- **Audience** (Customer · Designer · Manufacturer — multiple values)

Governance action: composes with the existing manifest structure (subject_domain · tags · a_plus) and with the Rule NEW inclusion-criteria discipline. Every future authored artefact should include these five metadata fields in frontmatter. Existing artefacts should be enriched during future audits, not silently rewritten.

### 4. Constitutional summary sentence locked

> ***"Keep growing the Staircase Brain. Start teaching Nex how to choose from that brain."***

Composes with yesterday's *"Nex is no longer becoming an encyclopedia. It's becoming a workshop companion."*

### 5. Failure pattern documented for future testing

Four failures preserved as a test-corpus for the Question Router build:

| User asks | Nex returned | Should return | Root cause |
|---|---|---|---|
| What type of staircase? | Installation | Classification | Missing Information Type router |
| Straight flight oak staircase images | Installation | Reference Gallery | Missing Intent router (Browse Images) + missing Reference Gallery index |
| What size newel post? | Definition | Dimensions | Missing Information Type router |
| What woods are available? | Timber knots | Timber species | Keyword match vs semantic routing |

Governance action: these four queries become a mandatory router-validation test corpus. Composes with the memory-index router corpus (`scripts/nex-router-corpus-test.mts`).

### 6. Knowledge Map extended

Yesterday's Knowledge Domains within Staircase Brain (9 domains) is now extended:

```
STAIRCASE BRAIN
├── Classification
├── Components
├── Materials
│   ├── Timber Species
│   ├── Steel
│   ├── Glass
│   ├── Finishes
│   └── Paint Systems
├── Construction
├── Installation
├── Workshop
├── Design Languages
├── Reference Gallery
└── Knowledge Base
```

Note: Materials now has explicit sub-domains (five). Reference Gallery is added as its own domain. Knowledge Base is preserved as a domain (educational content · distinct from Reference Gallery which is browse/visual).

### 7. Governance priority order confirmed

Per this addendum:

1. **PRIORITY 1**: Implement the Two Routers (Intent + Information Type) BEFORE retrieval
2. **PRIORITY 2**: Add structured metadata to every article
3. **PRIORITY 3**: Build Reference Gallery multi-axis index
4. **PRIORITY 4**: Continue authoring rich content (do NOT solve routing failures by writing more articles)

Composes with the memory-index Content Priorities and the Trust Metric north star.

**All governance rulings preserved verbatim · Philip's explicit build instructions awaited per the Author-Driven Rule.**
