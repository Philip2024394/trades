# ADR-0316d · NEX UI Reference Standard · Visual Design Constitution · 🔒 DOCTRINE LOCKED · Phase D.1 (design only)

**Status:** 🔒 DOCTRINE LOCKED · founder-authored 2026-09-11 · design only · zero code · zero substrate mutation · Phase D.3 implementation itself remains BLOCKED · this ADR does NOT authorise Phase D.3
**Founder:** Philip · authored verbatim 2026-09-11 · providing five canonical reference screens + 18 visual DNA rules + engagement principles
**Consumes:** ADR-0316b Code-Autonomy Readiness + Section-Build Lifecycle · ADR-0316c Section-Build Revision Model · CLAUDE.md UI theme rules · locked-doctrines DOC-033 (UI theme · CLAUDE.md rules) · Work Map v1.1

**Doctrine version:** `nex_ui_reference_standard.v1.0.0` · **Applies to:** every future NEX1/NEX2/NEX3/Master AI UI build · every section revision · every founder-facing surface

---

## Section 1 · Founder verbatim authorisation

**Founder-authored constitutional statement:**

> *"NEX UI Reference Standard — Founder Approved. These supplied NEX screens are canonical visual references for NEX1 UI development. NEX1 must preserve the underlying NEX visual identity across all new sections while being allowed to innovate within that identity."*

**Founder-authored engagement principle:**

> *"NEX1 must NOT simply copy these screens. Instead: Preserve the NEX visual DNA, component language and design philosophy while creating new, world-class interfaces appropriate to each capability."*

**Founder-authored purpose:**

> *"That gives NEX something much better than a fixed template. It creates a living NEX design system. For example, a new Image Intelligence section could look completely different from Account Creation, but you should immediately be able to look at it and say: 'That's NEX.'"*

**Founder-authored scaling principle:**

> *"World-standard UI + recognisable NEX identity + continuous innovation without visual drift."*

**Founder scope note (this ADR does NOT authorise D.3):**

> *"Do not let the excitement around D.3 cause implementation to start automatically. You now have: Doctrine: 🟢 locked · Implementation: 🔴 waiting for explicit founder authorization. That separation is exactly what you've been building into NEX."*

---

## Section 2 · Purpose

Establish the **NEX UI Reference Standard** as permanent constitutional doctrine · so every future NEX1/NEX2/NEX3 UI build starts with an approved visual target · not a blank canvas · and every founder review has a canonical reference to compare against.

**This ADR authors NO code.** It records:
- The 5 canonical reference screens (founder-approved)
- The 18 locked visual DNA rules (founder-authored verbatim)
- The "innovate within · never copy" engagement principle
- The colour reserved-use rules
- The CAP-XXX card structure enriched with NEX UI Standard section
- How the reference library grows (founder-authored additions only)

This complements but does NOT replace: CLAUDE.md UI rules · locked-doctrine DOC-033 · Phase D.3.b theme linter target.

---

## Section 3 · Canonical NEX Reference Assets (founder-approved v1.0.0)

The following five screens are the initial canonical NEX UI reference library. Each screen is a founder-approved artefact that establishes the NEX visual language. NEX1 must consult these when authoring UI · preserve the visual DNA they carry · never copy them literally.

| Ref ID | Source URL | Role in reference library |
|---|---|---|
| **NEX-UI-REF-001** | `https://ik.imagekit.io/ctlxgvqcm/ChatGPT%20Image%20Sep%2010,%202026,%2012_33_39%20AM.png?updatedAt=1788975239898` | Canonical NEX visual reference · v1.0 seed |
| **NEX-UI-REF-002** | `https://ik.imagekit.io/ctlxgvqcm/ChatGPT%20Image%20Sep%207,%202026,%2012_08_30%20PM.png?updatedAt=1788757735440` | Canonical NEX visual reference · v1.0 seed |
| **NEX-UI-REF-003** | `https://ik.imagekit.io/ctlxgvqcm/ChatGPT%20Image%20Sep%207,%202026,%2011_51_36%20AM.png?updatedAt=1788756713286` | Canonical NEX visual reference · v1.0 seed |
| **NEX-UI-REF-004** | `https://ik.imagekit.io/ctlxgvqcm/ChatGPT%20Image%20Sep%207,%202026,%2010_11_13%20AM.png?updatedAt=1788750693717` | Canonical NEX visual reference · v1.0 seed |
| **NEX-UI-REF-005** | `https://ik.imagekit.io/ctlxgvqcm/ChatGPT%20Image%20Sep%2010,%202026,%2003_42_27%20AM.png?updatedAt=1788986566195` | Canonical NEX visual reference · v1.0 seed |

### 3.1 · Reference-asset discipline (locked)

- Every reference asset carries an immutable ID (NEX-UI-REF-###)
- URLs are stored in this ADR + in `data/nex-ui-reference-library.json` (authored under D.3.b · not by this ADR)
- Reference assets are **read-only for Master AI · read-only for NEX1** — additions require founder-authored ADR amendment
- Reference assets are **never modified in place** · new versions get new IDs
- Reference assets are **never deleted** · deprecated assets remain in the library with a deprecation timestamp
- Reference assets are hosted at ImageKit CDN (per ADR-0024 image manifest discipline · with founder-attributed provenance)

### 3.2 · Reference categories (for future extension)

The library will grow to cover:

- Landing / hero references (established)
- Card / component references (candidate additions)
- Navigation references (candidate)
- Mobile-first references (candidate)
- Animation / motion references (candidate)
- Typography specimens (candidate)
- Icon language references (candidate)
- Colour swatches (candidate)
- Anti-references (examples of UI the founder specifically does NOT want) (candidate)

Additions to the library happen ONLY via founder-authored ADR amendment naming the new reference ID · URL · role.

---

## Section 4 · NEX Visual DNA · 18 locked rules (founder-authored · verbatim)

**These 18 rules are the constitutional foundation of NEX visual identity. They apply to every future NEX1/NEX2/NEX3 UI build. Any UI that violates any rule is rejected by the theme linter (Phase D.3.b).**

| # | Rule | Category |
|---:|---|---|
| **1** | Deep near-black / midnight navy foundation | Base colour |
| **2** | Electric cyan/blue as the primary technology accent | Accent colour |
| **3** | NEX orange as the strategic action/accent colour | Accent colour |
| **4** | White/light-grey high-contrast typography | Typography |
| **5** | Thin luminous cyan borders and subtle glow | Border / glow |
| **6** | Dark translucent panels / glass-like surfaces | Surface treatment |
| **7** | Rounded but controlled component geometry | Geometry |
| **8** | Fine-line technical/orbital/interface elements | Line quality |
| **9** | Futuristic AI/technology imagery | Imagery direction |
| **10** | Large, clean visual focal points | Composition |
| **11** | Strong negative space | Composition |
| **12** | Premium rather than flashy | Overall tone |
| **13** | Sophisticated rather than "gaming UI" | Overall tone |
| **14** | Orange reserved for important actions and NEX identity | Colour discipline |
| **15** | Cyan used for information, interaction and technology states | Colour discipline |
| **16** | Consistent icon language | Icon system |
| **17** | Mobile-first precision with responsive desktop expansion | Responsive |
| **18** | Accessibility and readability must never be sacrificed for visual effects | Accessibility |

### 4.1 · Locked interpretation

- **Rule 12 + 13 together** — NEX is premium + sophisticated · never flashy · never gaming-style. This distinguishes NEX from consumer AI aesthetics.
- **Rule 14 + 15 together** — orange = action + NEX identity (never for information) · cyan = tech + information + interaction (never for CTAs). A blue CTA is a violation. A yellow CTA is a violation. An orange information badge is a violation.
- **Rule 17** — mobile-first is the default authoring pattern · desktop is the expansion · never the reverse.
- **Rule 18** — non-negotiable · WCAG AA contrast minimum · visual effects that reduce readability are rejected without discussion.

### 4.2 · Precise reserved-colour rules (locked · consumed by D.3.b theme linter)

Combining rules 2 · 3 · 14 · 15 with existing CLAUDE.md rules:

| Colour role | Reserved for | Forbidden use |
|---|---|---|
| **NEX orange** | Primary CTAs · NEX identity marks · founder-critical actions | Information badges · secondary text · status indicators |
| **Electric cyan/blue** | Interactive states · information · technology indicators · borders · glow | CTAs · button fills · action confirmation |
| **White / light grey** | High-contrast typography · icon strokes on dark surfaces | Backgrounds (dark surfaces are the base) |
| **Dark near-black / midnight navy** | Base surface · glass-panel backdrop | Text on light backgrounds (there are none · except reversed contexts) |
| **Existing dark green (`#166534`)** | Non-NEX-identity dark-green CTAs where CLAUDE.md rules apply (e.g. Yard · Trade Centre) | Must not conflict with NEX orange in NEX-identity surfaces |
| **In-stock indicator green (`#10B981`)** | Reserved semantic · never a CTA · never repurposed | Any non-in-stock use |
| **Yellow** | Reserved for packages-page accents + CTAs per CLAUDE.md | Any other page's CTA |

This table supersedes any earlier CTA-colour guidance where NEX-identity surfaces are concerned. Non-NEX-identity surfaces (Trade Centre · SiteBook · Yard · consumer product pages) continue to use CLAUDE.md `#166534` dark-green + `#10B981` reserved semantic.

---

## Section 5 · Engagement principle (locked)

**Founder-locked verbatim:**

> *"NEX1 must NOT simply copy these screens. Instead: Preserve the NEX visual DNA, component language and design philosophy while creating new, world-class interfaces appropriate to each capability."*

### 5.1 · What NEX1 MAY do (within the visual DNA)

- Reuse the visual language across new sections (base colours · glass surfaces · cyan glow · orange CTAs · fine-line elements)
- Adapt composition per capability (image intelligence section may look different from account creation)
- Innovate on interaction patterns (new gestures · new micro-animations) provided they preserve the DNA rules
- Introduce new component variants where existing ones don't fit the capability
- Improve accessibility · responsiveness · performance without changing visual language

### 5.2 · What NEX1 MUST NOT do

- Copy any reference screen literally (pixel-level cloning is REJECTED)
- Introduce visual systems outside NEX DNA (bright pastel palettes · flat-design-only · skeuomorphism · brutalism · glassmorphism-heavy · neon-cyberpunk · retro-terminal · gaming-heavy)
- Add colour roles beyond the reserved-use table (§4.2)
- Break the mobile-first responsive pattern
- Use an icon library other than the approved set (Lucide is the current locked default until founder-authored amendment)
- Sacrifice accessibility for visual effects (any violation of Rule 18 is REJECT with `sec.accessibility_violation`)
- Introduce animations that fail WCAG motion sensitivity criteria (`prefers-reduced-motion` must be honoured)

### 5.3 · The recognition test (locked)

Every completed NEX1 UI build must pass the founder's implicit recognition test:

> *"When you look at the finished section · you should immediately be able to say: 'That's NEX.'"*

If the section could pass as a competitor's product · it has failed the recognition test regardless of whether it violates any explicit rule. Founder judgement on the recognition test is final and non-appealable.

---

## Section 6 · CAP-XXX card enrichment (locked)

The section-build card anatomy from ADR-0316c §6 is extended with a **NEX UI STANDARD** section that appears before the BUILD state:

```
┌─────────────────────────────────────────────┐
│ CAP-XXX · SECTION NAME                      │
│                                             │
│ ── NEX UI STANDARD ─────────────────────── │
│                                             │
│ Reference screens: NEX-UI-REF-001 to 005    │
│ Design tokens: v1.0.0                       │
│ Component library: shared (Lucide icons)    │
│ Colour discipline: orange=action cyan=info  │
│ Recognition test: must feel "That's NEX"    │
│                                             │
│ [ 📚 VIEW REFERENCE LIBRARY ]               │
│ [ 🎨 VIEW DESIGN TOKENS ]                   │
│ [ 📖 VIEW UI CONSTITUTION (this ADR) ]      │
│                                             │
│ ── NEX1 BUILD ──────────────────────────── │
│ (rest of card per ADR-0316b/c)             │
└─────────────────────────────────────────────┘
```

### 6.1 · Locked card requirements

- Every CAP card displays the NEX UI Standard section BEFORE the build section
- Every card links to the current Reference Library revision (initially v1.0.0 with the 5 seed assets)
- Every card links to the Design Tokens (authored under D.3.b · not yet extant)
- Every card links to this UI Constitution ADR
- The NEX UI Standard section is visible in all lifecycle states (BUILDING · TESTING · AWAITING_PREVIEW · IN_REVIEW · APPROVED · ACTIVE · REVERTED)

### 6.2 · When founder types a change request

Founder change requests can reference the NEX UI Standard directly:

- *"Move the button to preserve NEX orange discipline"*
- *"The panel background should be more like NEX-UI-REF-002"*
- *"Reduce the cyan glow · Rule 5 says subtle not heavy"*

NEX1 receives the change request + the referenced material + rebuilds. The revision cycle from ADR-0316c continues to apply.

---

## Section 7 · How the reference library grows (locked)

**Founder-authored principle:**

> *"When you later give me the website URLs, image-kit links and additional screenshots, we can extend this into a proper NEX Visual Reference Library rather than relying on a prompt alone."*

### 7.1 · Locked growth rules

- **Founder-authored only** — Master AI never adds a reference. NEX1 never adds a reference. Only founder ADR amendment.
- **Each addition is atomic** — one ADR amendment · one new reference ID · one URL · one role description
- **Versioning** — the reference library carries a version (v1.0.0 with 5 seed assets · v1.1.0 when the next founder-authored addition ADR lands · etc.)
- **Deprecation not deletion** — old references remain in the library with `deprecated_at` timestamp · never removed (historical audit)
- **Categorisation** — every new reference declares its category (hero · card · navigation · mobile · animation · typography · icon · anti-reference · etc.)
- **Provenance** — every reference declares its source (founder-supplied · founder-approved-external · founder-approved-generated)

### 7.2 · Reference library storage

- **Canonical text source**: this ADR (§3 above) + future amendment ADRs · always append never edit
- **Structured source**: `data/nex-ui-reference-library.json` · authored under D.3.b · mirrors the ADR content in machine-readable form for the theme linter and card UI to consume
- **Never Work Map** — the reference library is separate substrate · not conflated with capability registry

### 7.3 · Anti-references (candidate future category)

The founder may later provide reference material of what NEX must **NOT** look like. These entries carry `role: anti-reference` and Security Agent flags any UI approaching them as `sec.ui_theme_violation` + reference to the anti-reference ID.

---

## Section 8 · Integration with Phase D.3.b (theme linter) locked

Phase D.3.b (theme linter · from ADR-0316b §10 sub-phase plan) consumes this ADR + `data/nex-ui-reference-library.json` (when authored) + `docs/nex-design-tokens.json` (also authored in D.3.b) to enforce:

- All 18 visual DNA rules
- Reserved-colour discipline (§4.2)
- Icon library restriction
- Mobile-first responsive pattern
- Motion sensitivity accessibility
- Recognition test (visual-similarity assist · not authoritative · surfaces to founder for final judgement)

### 8.1 · Linter rejection codes (locked)

Each rule violation gets a specific `sec.` code per the four-way Guardian namespace discipline:

- `sec.ui_dna_violation` — general DNA drift
- `sec.orange_misused` — NEX orange used outside CTAs / NEX identity
- `sec.cyan_misused` — cyan used for CTAs or non-tech / non-information roles
- `sec.icon_library_violation` — non-Lucide icon detected (until amendment)
- `sec.mobile_first_violation` — desktop-only responsive pattern detected
- `sec.motion_sensitivity_violation` — animation without `prefers-reduced-motion` respect
- `sec.gaming_aesthetic_detected` — neon-cyberpunk / retro-terminal / heavy-glassmorphism drift
- `sec.recognition_test_flagged` — computed similarity indicates the section could pass as non-NEX (surfaced to founder · non-blocking · advisory)
- `sec.accessibility_violation` — WCAG AA contrast or keyboard-nav or aria-label failure

Rejection codes appended to the existing `sec.*` namespace in `docs/nex-locked-doctrines.json` under the D.3.b sub-phase.

---

## Section 9 · Enforcement implications (doctrine · not implemented by this ADR)

- **Every Phase D.3.b theme linter implementation** must consume this ADR + the reference library + design tokens as authoritative
- **Every NEX1 UI proposal** must pass the theme linter before Security Agent ACCEPT
- **Every card in the Work Map** displays the NEX UI Standard section per §6.1
- **Every founder change request** may reference NEX-UI-REF-### IDs directly
- **Every new reference addition** requires founder-authored ADR amendment
- **Every animation** honours `prefers-reduced-motion` per Rule 18
- **Every completed build preview** carries a visual-comparison overlay (founder can toggle between the NEX-UI-REF-### and the current build for direct comparison)

---

## Section 10 · What this ADR did NOT do

- ❌ No code authored
- ❌ No design token registry created (Phase D.3.b)
- ❌ No `data/nex-ui-reference-library.json` created (Phase D.3.b)
- ❌ No theme linter code (Phase D.3.b)
- ❌ No CAP-XXX card UI modified
- ❌ No visual-comparison overlay built
- ❌ No new reference assets beyond the 5 provided (founder authors additions)
- ❌ No modification to CLAUDE.md UI rules (this ADR complements + strengthens them)
- ❌ No modification to `docs/nex-locked-doctrines.json` (D.3.b adds the new `sec.` codes)
- ❌ No Work Map JSON modification
- ❌ No Stage 1a foundation modified
- ❌ No Stage 1b resumption
- ❌ No nex.evidence collision resolution
- ❌ **No Phase D.3 implementation authorised · locked separation preserved per founder direction**
- ❌ No Phase D.3.b authorised (theme linter is the sub-phase that consumes this ADR · still BLOCKED)
- ❌ No autonomous operation authorised
- ❌ No copying of reference screens ever authorised
- ❌ No absolute-safety claim introduced

---

## Section 11 · Decision provenance footer

| Field | Value |
|---|---|
| **Decision** | NEX UI Reference Standard / Visual Design Constitution locked as permanent doctrine. 5 canonical NEX reference screens registered as NEX-UI-REF-001 through 005. 18 visual DNA rules locked verbatim from founder. "Innovate within DNA · never copy" engagement principle locked. Reserved-colour discipline locked (orange = action · cyan = tech/info · white = typography · dark navy = base). CAP-XXX card enriched with NEX UI STANDARD section preceding the build. Reference library grows only via founder-authored ADR amendment. Recognition test locked: "You should immediately be able to say 'That's NEX'." Consumed by Phase D.3.b theme linter (still BLOCKED). This ADR does NOT authorise Phase D.3 or D.3.b implementation. |
| **Decided by** | Philip |
| **Decision date** | 2026-09-11 |
| **ADR** | 0316d · this file · consumed by Phase D.3.b theme linter · every future NEX1/2/3 UI build · every founder change request |
| **Effective from** | `nex_ui_reference_standard.v1.0.0` |
| **Supersedes** | none · complements + strengthens CLAUDE.md UI rules · complements DOC-033 |
| **Reason** | Founder verbatim: prevent UI drift as hundreds of sections are built · give NEX1 a visual target instead of a blank canvas · make the Work Map become the actual Founder ↔ NEX1 development control centre with visual DNA preserved across every build · world-standard UI + recognisable NEX identity + continuous innovation without visual drift. |

---

## Section 12 · Cross-references

**Consumed by (future ADRs):**
- Phase D.3.b theme linter implementation
- Phase D.4.a founder review queue (card UI must render NEX UI STANDARD section)
- Every future NEX1 UI proposal
- Every future founder-authored reference-library amendment (candidate: ADR-0316d.1 · 0316d.2 · etc.)

**Consumes:**
- ADR-0316b Code-Autonomy Readiness + Section-Build Lifecycle
- ADR-0316c Section-Build Revision + On-Card Change Requests + Preview vs Live Distinction
- CLAUDE.md UI theme rules (complemented · not replaced)
- Locked-doctrines DOC-033 (UI theme rules · augmented by this ADR)
- ADR-0024 image manifest (governs how reference assets are stored)
- Work Map v1.1

**Referenced by future candidate slots:**
- ADR-0316d.1 · first reference-library amendment (when founder provides next batch of URLs)
- ADR-0316e · design tokens registry (D.3.b implementation)
- ADR-0316f · icon language extension (if founder authorises non-Lucide icons)

---

## Section 13 · Master AI STOPS · Phase D.3 remains BLOCKED

**Master AI does NOT autonomously proceed to Phase D.3 · D.3.a · D.3.b · D.4 · D.4.a · D.5 · D.6 · D.7 · D.8 · D.9 · D.10 · D.11.** Founder-locked separation of doctrine from implementation.

**Master AI does NOT autonomously resume Stage 1b implementation.** The nex.evidence collision remains parallel unresolved (task #161).

**Current position after ADR-0316d:**

- Phase A · Stage 1a · 🟢 COMPLETE
- Phase B · Guardian reconciliation (3-way) · 🟢 LOCKED
- Phase C · Acquisition Fabric · 🟢 LOCKED
- Stage 1b Wiring + Founder Decisions · 🟢 LOCKED · apply halted at nex.evidence collision
- Work Map v1.1 · 🟢 ACTIVE
- Phase D.1 · HQ Consolidation Target · 🟢 LOCKED (ADR-0316)
- Phase D.1 · Security Agent Design (4-way) · 🟢 LOCKED (ADR-0316a)
- Phase D.2 · registries authored · 🟢 SHIPPED
- Phase D.1 · Code-Autonomy + Lifecycle · 🟢 LOCKED (ADR-0316b)
- Phase D.1 · Revision + On-Card + Preview · 🟢 LOCKED (ADR-0316c)
- **Phase D.1 · NEX UI Reference Standard / Visual Design Constitution · 🟢 LOCKED (this ADR · ADR-0316d)**
- Phase D.3 · D.3.a · D.3.b · D.4 · D.4.a · D.5 · D.6 · D.7 · D.8 · D.9 · D.10 · D.11 · 🔴 BLOCKED pending own founder authorisation

**Substrate posture:** unchanged · everything frozen · Gate 3 remains OPEN · Stage 1a foundation preserved · Lab-Guardian ledger preserved · specialist tables preserved · nex.evidence collision preserved.

**Founder decision points now open:**

1. Approve ADR-0316d as locked doctrine (this ADR complete)
2. Direct nex.evidence collision resolution (separate track · task #161)
3. Authorise Phase D.3 (Security Agent implementation)
4. Or authorise Phase D.3.b (theme linter) directly to give NEX1 the UI enforcement machinery first
5. Or provide additional reference URLs / image-kit links / screenshots to extend the reference library to v1.1.0

Master AI does not choose the order. Founder authorises explicitly.

---

**End of ADR-0316d · NEX UI Reference Standard · Visual Design Constitution · doctrine locked · every sub-phase implementation remains BLOCKED pending founder authorisation.**
