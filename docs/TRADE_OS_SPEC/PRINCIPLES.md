# Trade OS · Engineering Principles

---

## 🎯 The Mission (put this at the top of your engineering handbook)

**By 2030 a merchant should not think *"I'm using AI".* They should think *"My business has a creative department."***

Trade OS becomes their:
- Brand Manager
- Creative Director
- Marketing Manager
- Vehicle Wrap Designer
- Graphic Designer
- Print Production Manager
- Website Designer
- Design Archivist
- Quality Controller

All working from the same Brand DNA.

## 📜 The Architectural Commandment

> **Every feature must increase the intelligence of the platform, not merely the number of things it can generate.**
>
> **AI models are interchangeable. The Intelligence Layer is not.**
>
> Our mission is to build the world's best Creative Operating System for trades — one that understands businesses, learns continuously, preserves brand consistency, and orchestrates the best AI tools to deliver professional outcomes. Every architectural decision should strengthen that Intelligence Layer. **That is the enduring competitive advantage.**

Every PR bounces if it fails this test: *"does this deepen the intelligence layer, or does it just wrap another model?"* If the honest answer is the latter, the PR bounces.

---

> ### 🔒 CONFIDENTIAL · Trade Secret · Do Not Distribute
>
> This document codifies the architectural rules that give Networkers Studio its structural moat. They are the reason the platform will outperform image-generation wrappers and general-purpose design tools.
>
> **Do not share with:**
> - External contractors without a signed NDA
> - Freelance designers or agencies
> - Competitors or industry peers
> - Public documentation, blog posts, conference talks, YouTube tutorials
> - Any AI training corpus
>
> **If this repository ever becomes public, remove or move this file first.** The value lives in these rules being ours.

---

## 🥇 THE MASTER RULE

### Save the recipe, not the image.

Every asset the platform ever produces (van wrap, logo, business card, workwear, invoice, letterhead, social banner, app screen, site board, email signature) is an **ephemeral render** of a **durable recipe**.

The **RECIPE** is:
- Brand DNA snapshot (V1 Part 2)
- SDS (Structured Design Specification)
- Prompt Compiler version
- Memory snapshot (V3 Q11 forthcoming)
- Design Intelligence Layer version
- AI model + parameters used

The recipe is stored forever. The render is a **cache**. Renders can be deleted, expired, re-rendered at higher quality when better models ship, or regenerated from the recipe on demand for pennies.

### Why this is the moat

- **Storage becomes negligible.** ~5-20KB per brand recipe vs ~50-200MB per brand's PNGs. Across 10,000 merchants: ~200MB of recipes vs 500GB-2TB of images. ~99% cost reduction.
- **Model upgrades = free quality upgrades** for every past design a merchant has ever produced. When GPT Image 2 launches, every past van/logo/card re-renders at the new quality. Competitors who saved PNGs are stuck at 2026 quality forever.
- **Merchants can regenerate infinitely.** The cost is generation time (pennies), not "another copy of a saved thing".
- **The system gets better for each merchant over time** as the Memory Engine learns preferences. The Brand Brain compounds in value with every interaction.
- **Merchants who leave and come back years later** get their brand back exactly as it was — plus every asset re-rendered at the current model's quality.

### What this changes in code

- Every generation table stores the **RECIPE** (SDS + prompt + snapshot IDs). Image URLs are treated as **cache**, never source of truth.
- Regenerate button on every asset in Brand Vault — trivially cheap because we re-cook the recipe.
- Brand DNA change triggers "18 assets can be updated" preview flow — implemented via recipe regeneration, not stored-image edit.
- One Click Rebrand feature (reposition budget → premium) — re-runs every recipe with the new Brand DNA. No image migration needed.
- Storage retention policies for images can be aggressive (30-day cache expiry) without touching recipes.

---

## The Other Principles

Each earned its place. New principles must too.

### 1. Brand DNA is the only editable source of truth
Every image, document, van, business card, invoice, workwear item, and app screen is a derived artifact. No Studio owns data; every Studio subscribes to Brand DNA via the event bus and publishes new assets back into the Brand Vault.

### 2. AI owns nothing
AI creates suggestions. **Database owns truth.** Every AI output must be persistable, versionable, replayable. If an AI's output isn't captured as structured data, it's disposable.

### 3. Everything is event-driven
No Studio ever calls another Studio directly. `Brand.ColourChanged` → Event Bus → every subscriber reacts independently. Loose coupling is non-negotiable. Direct App-to-App imports fail code review.

### 4. Prompts are compiled, never handwritten
Every prompt sent to any AI model comes from the Prompt Compiler. Deterministic. Versioned. Testable. **Zero string concatenation** of prompts in application code. When the compiler version changes, we can replay every past generation deterministically.

### 5. Assets are immutable
Never overwrite. Always create a new version. Rollback is version-switching, not deletion. Every asset carries the recipe version it was rendered from.

### 6. Every generation carries a reasoning trace
The Decision Engine captures **why** each design choice was made. When a merchant asks "why gold?", Mate cites the exact rule + input + confidence score that produced the answer. Explainable is not optional.

### 7. Merchant memory is private
Brand Memory, preferences, rejections, and edits are per-merchant and never leak cross-merchant. Aggregated cross-merchant learning is anonymised and only used to improve the DIL rules themselves, never to expose one merchant's preferences to another.

### 8. No asset ships without QA
The Design Critic scores every generation. Anything below 92 auto-regenerates. Nothing user-facing bypasses this gate. If a Studio can bypass QA, it's a bug not a feature.

### 9. Anti-lockin, always
Merchant owns everything. Full ZIP export at any time (SVG + PDF + PNG + CMYK + Pantone + Brand Guide + Fonts + Licences + README). No hostage assets. The anti-Checkatrade positioning (never take commission, never sell leads) applies to design output too — never make it hard for a merchant to walk away with their brand.

### 10. Cache aggressively, cache correctly
Cache prompts by compiler version + input hash. Cache Brand DNA reads by version. Cache renders by recipe hash. Never regenerate what hasn't changed. Every cache miss is a signal to check whether we're compiling correctly.

### 11. Every image is a photo of the recipe
Corollary to the Master Rule. Treat generated images the same way you'd treat a photograph of a physical thing: proof of existence, cached representation, replaceable. The thing itself is the recipe. If your code loses an image URL and can't regenerate from stored recipe → the code is broken.

### 12. Build a Creative Operating System, not an AI image generator
The competitive advantage is not better prompts, better images, or better AI models — those will all become commodities.

**The moat is the intelligence layer between the merchant and the AI.** That layer knows:

- Who the merchant is
- What trade they're in
- What has worked before
- What assets already exist
- What should change
- What should stay consistent
- Which AI model is best for the task
- How to judge the result
- How to evolve the brand over years

Very difficult to copy because it becomes proprietary knowledge, not dependence on any single AI model. This is the closing principle from the Chief Architect review (V3 additional knowledge areas 18-32) — it applies at the architectural level to every future feature decision. Every proposed feature must answer: *"does this deepen the intelligence layer, or does it just wrap another model?"* Prefer the former.

---

## Rules for adding new principles

- A new principle earns its place by **preventing an actual bug** or **unlocking an architectural property**.
- Not by being clever. Not by being trendy.
- Adding a 15th principle should be **harder** than adding the 10th.
- Trend the principle count toward stability, not growth.

---

## Reading order for new engineers

1. **This document** — Master Rule + 11 Principles
2. `docs/TRADE_OS_SPEC/V1_PART_1_CORE_ARCHITECTURE.md`
3. `docs/TRADE_OS_SPEC/V1_PART_2_BRAND_DNA_SCHEMA.md`
4. `docs/TRADE_OS_SPEC/V1_PART_3_APP_MANIFEST.md`
5. `docs/TRADE_OS_SPEC/V1_PART_4_EVENT_BUS.md`

If this document contradicts specific implementation in any file, **this document wins**. The implementation must be corrected.

---

## Enforcement

These rules should be enforceable at every stage:

- **Lint rules** — no direct App-to-App imports, no string concatenation of prompts, no images stored without corresponding recipe row
- **Code review checklist** — every PR touching a generator answers "does this respect the Master Rule?"
- **Runtime validators** — every generation persists the recipe alongside the render; violation logs to admin alert
- **Test suite** — regeneration from stored recipe must produce equivalent output (allowing for image-gen stochasticity)

Rules that only live in documentation get broken. Rules that live in code stay honoured.
