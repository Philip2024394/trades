# Trade Operating System · Volume 3 (Extended)
## Additional Knowledge Areas (18-32)

**Audience:** Chief Architects, AI Platform Engineers, ML Engineers
**Source:** ChatGPT design-brief architecture series, Chief Architect review pass.

> "You've covered about 85-90% of what most AI design platforms ever think about. The remaining 10-15% is what separates a good platform from something that could genuinely compete with Adobe Express, Canva, VistaPrint, Wix, or Shopify over the next 5-10 years."

Fifteen additional knowledge modules that make the Trade OS defensible against commoditising AI image generation.

---

## 18. Design Language System (DLS)

Not prompts. Not Brand DNA. The **actual visual language** the AI uses. Every design derives from this.

- Layout Grammar
- Grid Systems · Margins · Spacing · White Space · Section Ratios · Image Ratios · Negative Space
- Hierarchy Rules · Card Rules · Banner Rules
- Typography Rules · Colour Rules · Shadow Rules · Border Rules · Radius Rules
- Animation Rules · Photography Rules

**Think of it as CSS for AI.**

---

## 19. Trade Intelligence Database

Every trade has its own design knowledge.

Example — **Plumber**:
- Preferred colours: Blue · White · Dark Grey
- Photography: Copper pipe · Boiler · Kitchen · Bathroom
- Van Layout: Large rear phone · Trust icons · Emergency call
- Premium Score: 92

Now imagine this for **200+ trades**. One of the biggest competitive advantages.

---

## 20. Vehicle Intelligence Database

Don't prompt vehicle dimensions every time. **Encode them.**

Example — **Ford Transit Custom 2025**:
- Printable area
- Wheel arches
- Door seams
- Fuel cap
- Rear handles
- Light positions
- Safe logo zones
- Photography zones
- Premium layouts

For every van: Transit · Vivaro · Trafic · Berlingo · Partner · Crafter · Sprinter · Transporter · Ducato · Movano · NV400 · Master · Combo · Kangoo.

**The AI doesn't guess — it knows.**

---

## 21. Print Intelligence

Very few AI platforms understand printing. The Print Intelligence Layer knows:

Bleed · Crop · Safe Area · CMYK · Pantone · Vinyl Limits · Embroidery Limits · Minimum Font Sizes · QR Code Sizes · Foil Rules · Lamination · Print DPI · File Formats · Sign Writer Requirements.

---

## 22. Layout Grammar Engine ⭐

Probably the most important missing module.

Instead of prompts saying *"Make it look premium"*, the engine outputs **rules**:

1. Hero image always occupies 60%
2. Logo never smaller than 9%
3. Phone always lower third
4. Negative space minimum 18%
5. Never overlap wheel arches
6. Rear phone number centred
7. Maximum three information groups

**AI follows rules. Not opinions.**

---

## 23. Merchant Psychology Engine

Merchant type → automatically changes Colours · Fonts · Photography · Spacing · Tone · Messaging · Icons · Layout.

Types: Cheap · Premium · Luxury · Emergency · Family · Commercial · Industrial · Corporate · Eco · Modern.

---

## 24. Conversion Intelligence

Not *"Does it look nice?"* but *"Will it sell?"*

Score: Trust · Professional · Premium · Phone Visibility · Call To Action · Readability · Brand Recall · Driving Legibility · Distance Recognition · Customer Confidence · Emotional Response.

---

## 25. AI Cost Optimiser

Automatically decides:
- Need GPT-5?
- Need GPT Image?
- Need Claude?
- Need deterministic code?
- Need cached asset?

**Merchants shouldn't pay for unnecessary AI calls.**

---

## 26. Brand Evolution Engine

Every 6 months, Trade OS proactively says:

> Your branding is now 4 years old. Modern design trends have changed. Would you like Version 7?
> [View Comparison]

Automates what agencies do manually.

---

## 27. Competitive Intelligence

Merchant enters "Joe's Plumbing". AI analyses top 50 plumbing brands. Reports vs theirs:
- Trust Score
- Modern Score
- Luxury Score
- Visibility Score
- Recommendation Score

---

## 28. Prompt Analytics

Every prompt ever generated logged: Prompt · AI Cost · Generation Time · Merchant Rating · Accepted · Rejected · Edited · Regenerated · Final Score.

Over time you'll discover:
- Prompt 18 → Vehicle score 97
- Prompt 21 → Vehicle score 84

**Prompt 18 becomes the standard.**

---

## 29. AI Model Router

One abstraction layer.

```
Design Request
       ↓
Router
       ↓
GPT Image · Ideogram · Flux · Recraft · Photoshop API
       ↓
Return Best
```

**Swap adapters when better models launch — not the platform.**

---

## 30. Creative Director Knowledge Base ⭐

Teach the AI how **Pentagram · Landor · Wolff Olins · Collins · leading vehicle wrap studios** critique work.

Rubric: Hierarchy · Spacing · Colour Balance · Visual Rhythm · Brand Personality · Contrast · Trust · Typography · Composition · Craftsmanship · Printability · Commercial Effectiveness.

Every generation judged against this.

---

## 31. Design Pattern Library

Reusable, proven patterns. Never let AI invent layouts from scratch.

Examples:
- Premium split-panel van wrap
- Full photographic hero wrap
- Minimal logo-first wrap
- Luxury black-and-gold wrap
- High-visibility emergency service wrap
- Geometric diagonal wrap
- Construction contractor wrap
- Fleet branding system
- One-page tradesman website
- Quote document layout
- Business card layouts
- Polo embroidery positions

Each pattern has: rules · strengths · ideal use cases.

---

## 32. Knowledge Graph

Connect everything.

```
Merchant
    │
    ├── Brand DNA
    ├── Vehicles
    ├── Assets
    ├── Campaigns
    ├── Customer Reviews
    ├── Website
    └── Marketing Performance
```

**Future AI agents reason across the business — not just generate images.**

---

## Final Architectural Rule

> **Build a Creative Operating System, not an AI image generator.**
>
> The competitive advantage is not better prompts, better images, or better AI models — those will all become commodities.
>
> **The moat is the intelligence layer between the merchant and the AI.**
>
> That layer knows:
> - who the merchant is
> - what trade they're in
> - what has worked before
> - what assets already exist
> - what should change
> - what should stay consistent
> - which AI model is best
> - how to judge the result
> - how to evolve the brand over years
>
> **This is very difficult to copy because it becomes proprietary knowledge rather than dependence on any single AI model.**

This rule is elevated to the master `PRINCIPLES.md` doc as Principle 12.

---

## Networkers-specific implementation notes

- **Modules 18-32 are Phase 3+ features.** Foundation (V1) + Merchant Experience (V2) ship first. These extend the moat once the platform is producing daily output.
- **Design Language System (18)** = the DIL modules already scaffolded in `src/lib/design/knowledge/`. Expand: `layout-grammar.ts`, `photography.ts`, `hierarchy.ts`, `shadow.ts`, `radius.ts`, `motion.ts`.
- **Trade Intelligence (19)** = extend `src/lib/design/knowledge/trades.ts` from the current 15 trades to 200+. Table-driven, admin-editable via an internal tool.
- **Vehicle Intelligence (20)** = extend `src/lib/design/knowledge/vehicles.ts` with per-van printable areas + safe zones + panel dimensions. Source: manufacturer body-builder guides (Ford, Mercedes, VW all publish these).
- **Print Intelligence (21)** = new file `src/lib/design/knowledge/print.ts` — bleed/crop/CMYK/DPI rules. Enforced in the Design Critic.
- **Layout Grammar Engine (22)** = new module `src/lib/design/engines/layout-grammar.ts`. Outputs machine-checkable rules the Prompt Compiler injects into every generation.
- **Merchant Psychology (23)** = extend BrandRecord.positioning with a Psychology field. Compiler reads → adjusts prompt tone + palette + typography.
- **Conversion Intelligence (24)** = new scoring axis added to Design Critic (V3 Q12). Separate from aesthetic score.
- **AI Cost Optimiser (25)** = decision function in the AI Orchestrator: "given task X + budget Y, pick cheapest model that hits quality threshold Z."
- **Brand Evolution (26)** = Mate's proactive engine (already shipped) gets a "brand-drift" detector that fires every 180 days.
- **Competitive Intelligence (27)** = new App `src/apps/competitor-audit/` — Phase 4+. Requires ethical scraping guardrails.
- **Prompt Analytics (28)** = every generation's `sds_json` + `prompt_text` + `quality_score` already logs to `hammerex_van_generations` from today's foundation migration. Extend to a cross-app analytics view.
- **AI Model Router (29)** = new module `src/lib/design/router/model-router.ts`. All OpenAI + Anthropic + Recraft + future models routed through it. **Zero direct API calls** in application code.
- **Creative Director Knowledge Base (30)** = the critic prompt template lives in `src/lib/design/knowledge/creative-directors.ts`. Encodes Pentagram/Landor/Wolff Olins/Collins critique patterns.
- **Design Pattern Library (31)** = new folder `src/lib/design/patterns/*` — one file per pattern. Each pattern is a bounded prompt fragment + rules + fit criteria.
- **Knowledge Graph (32)** = long-term goal. For now the DB schema is graph-shaped (BrandRecord → Assets → Events → Campaigns via foreign keys). True graph traversal comes with pgvector-based semantic linking once we have the volume.
