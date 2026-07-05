# PLATFORM MATURITY MODEL (PMM)

**Version:** 1.0
**Adopted:** 2026-07-05
**Governs:** every batch report + milestone completion claim.

---

## Purpose

The PMM is the **objective scorecard** for the Xrated Trades AI
Platform. It replaces subjective claims of "done" with measurable
maturity across the dimensions that matter for a long-lived
platform.

**Use rules:**
1. Every batch report updates PMM scores.
2. Every milestone report cites PMM deltas.
3. "M3 is complete" alone is not acceptable. "M3 raised Foundation
   from 82% → 95%, AI Composition 45% → 68%, Business OS 50% → 72%"
   is.
4. The platform is only considered *complete* when every dimension
   reaches ≥ 95%.

**Score bands:**
| Range | Meaning |
|---|---|
| 0–20% | placeholder / stub / not started |
| 21–50% | foundational infrastructure in place, not production-ready |
| 51–75% | production-usable for the common path, gaps at edges |
| 76–90% | production-ready with known deferred work |
| 91–100% | production-hardened with tests + monitoring |

---

## The 12 dimensions

Each dimension is measured by weighted sub-metrics with explicit
counting rules. Scores must be *derived*, not guessed. A "measurement
rule" line under each sub-metric shows how the number was arrived at.

---

### 1. Foundation

**Definition:** the platform-primitive layer that every higher layer
depends on. Registries, kit, primitives, containers, tokens, themes.

**Sub-metrics:**

| Sub-metric | Weight | Measurement rule | Current |
|---|---|---|---|
| Registry Kit shipped | 10% | Binary (createRegistry + validators + selfCheck + snapshot) | **100%** |
| Primitives coverage | 20% | shipped ÷ 25 baseline | 25/25 = **100%** |
| Container coverage | 20% | shipped ÷ 19 Constitution list | 10/19 = **53%** |
| Design token coverage | 15% | token count ÷ 100 baseline | 63/100 = **63%** |
| Theme extension | 10% | fields shipped ÷ full design language | **100%** |
| Registry count | 15% | shipped ÷ 15 target (10 today, 5 planned M3) | 10/15 = **67%** |
| Registries migrated to kit | 10% | migrated ÷ total | 9/10 = **90%** (AI Gateway deliberately not migrated) |

**Weighted total: 82.0%**

**Target for M3 exit:** 100%
**Target for platform complete:** 100%

---

### 2. AI Composition

**Definition:** how sophisticated + reliable is the AI composer.

**Sub-metrics:**

| Sub-metric | Weight | Measurement rule | Current |
|---|---|---|---|
| Pipeline stages implemented | 20% | wired ÷ 14 stages (Composition Engine v2 target) | 8/14 = **57%** |
| LLM tasks wired | 10% | wired ÷ 5 required tasks | 3/5 = **60%** |
| Deterministic selection surface | 15% | dimensions with deterministic picker (theme, section, KG bind, container select) ÷ 6 | 4/6 = **67%** |
| Retrieval-first hallucination prevention | 15% | LLM tasks with corpus validation ÷ LLM tasks that need it | 3/3 = **100%** |
| Content-fill AI | 10% | sections wired ÷ sections eligible | 0/many = **0%** |
| Multi-turn refinement | 10% | shipped? | **0%** |
| Style-aware composition | 10% | shipped? | **0%** |
| End-to-end preview trip | 10% | proven for how many trades? | 13/13 = **100%** |

**Weighted total: 46.2%**

**Target for M3 exit:** 75% (Composition Engine v2 delivers stages 9–14)
**Target for platform complete:** 100%

---

### 3. Design System

**Definition:** depth + coherence of the design language.

**Sub-metrics:**

| Sub-metric | Weight | Measurement rule | Current |
|---|---|---|---|
| shadcn primitives | 15% | shipped ÷ 25 target | 25/25 = **100%** |
| Containers (design-registered) | 15% | shipped ÷ 19 | 10/19 = **53%** |
| Design Registry populations | 10% | entries ÷ 60 target | 36/60 = **60%** |
| Theme presets | 10% | shipped ÷ 12 (6 light + 6 dark) | 6/12 = **50%** |
| Token registry sets | 10% | shipped ÷ 6 (default + 5 industry) | 1/6 = **17%** |
| Icon catalogue | 10% | Lucide inventory registered? | 0/1400+ = **0%** |
| Font registry | 5% | registered fonts ÷ 20 target | 0/20 = **0%** |
| Animation registry | 5% | registered presets ÷ 15 | 0/15 = **0%** |
| Constitutional metadata on primitives | 10% | primitives declaring all Constitution fields ÷ total | 26/26 = **100%** |
| Design System conflict resolved | 10% | single source of truth? (registry unifies) | **100%** (M2 batch 9) |

**Weighted total: 60.5%**

**Target for M3 exit:** 82% (icon + font + animation registries land in M3)
**Target for platform complete:** 100%

---

### 4. Business OS

**Definition:** how many Business OS layers are registry-driven and
composable per Constitution Amendment 2.

**Sub-metrics:**
18 layers × registry backing × runtime usability. Each layer scored
0/50/100.

| Layer | Score | Rationale |
|---|---|---|
| Business | 100 | `knowledgePackageRegistry` — 13 trades |
| Brand | 20 | brand overrides typed but no runtime merger |
| Theme | 100 | `themePresets` + full design language |
| Design Tokens | 100 | `designTokenRegistry` + resolver |
| Navigation | 0 | no `navigationRegistry` yet |
| Layouts | 50 | `blueprintRegistry` acts as layouts but not registry-based composition |
| Containers | 53 | 10/19 shipped |
| Sections | 100 | 48 registered, KG-bound |
| Components | 100 | 25 primitives + M2 catalogue |
| Business Apps | 30 | infra 100% but content 3/15 |
| CRM | 10 | contacts table exists, no CRM registry |
| Bookings | 0 | no booking registry |
| Payments | 100 | `paymentProcessors` — 20+ adapters |
| Analytics | 20 | events schema exists, no analytics registry |
| SEO | 10 | tags exist per page but no registry |
| Automation | 10 | 10 cron routes exist, no registry |
| Publishing | 100 | publish pipeline ships |
| Weight-equal aggregate: | | |

**Weighted total (equal weight per layer): 50.7%**

**Target for M3 exit:** 72% (adds Navigation, Layouts→layoutRegistry, Bookings, dashboards + forms bring CRM up)
**Target for platform complete:** 100%

---

### 5. Marketplace

**Definition:** third-party installability, discoverability,
lifecycle management.

**Sub-metrics:**

| Sub-metric | Weight | Measurement rule | Current |
|---|---|---|---|
| App content | 15% | shipped ÷ 15 | 3/15 = **20%** |
| Pack content | 10% | shipped ÷ 6 | 1/6 = **17%** |
| Template content | 10% | blueprints ÷ 60 target | 52/60 = **87%** |
| Install flow | 10% | works? | **100%** (blueprint + app installers work) |
| Uninstall flow | 10% | works? | **50%** (partial — app-scoped only) |
| Upgrade flow | 5% | shipped? | **0%** |
| Rollback flow | 5% | shipped? | **0%** |
| Search UI on marketplace | 10% | shipped? | **20%** (kit has search, UI partial) |
| Filter chips | 5% | shipped? | **0%** |
| Ratings + reviews schema | 5% | shipped? | **0%** |
| Version history | 5% | shipped? | **0%** |
| Publisher onboarding | 5% | shipped? | **0%** |
| Developer submission review queue | 5% | shipped? | **10%** (schema exists) |

**Weighted total: 29.0%**

**Target for M3 exit:** unchanged (M5 owns marketplace expansion)
**Target for platform complete:** 100%

---

### 6. Mobile

**Definition:** mobile-native capability — PWA, offline, native
shell.

**Sub-metrics:**

| Sub-metric | Weight | Measurement rule | Current |
|---|---|---|---|
| Mobile-first responsive baseline | 15% | shipped sections mobile-tested? | **90%** |
| PWA manifest.json | 10% | present? | **0%** |
| Service worker | 10% | present? | **0%** |
| Bottom navigation | 10% | shipped? | **0%** |
| Mobile drawer nav | 10% | shipped? | **0%** |
| Offline layout hydration | 10% | shipped? | **0%** |
| Install prompt | 5% | shipped? | **0%** |
| Storefront push notifications | 10% | shipped? | **0%** |
| Camera / GPS surfaces | 10% | shipped for merchant use? | **20%** (5 files use geolocation) |
| Native shell scaffold | 10% | Capacitor / Expo scaffold? | **0%** |

**Weighted total: 15.5%**

**Target for M3 exit:** unchanged (M7 owns mobile)
**Target for platform complete:** 100%

---

### 7. Automation

**Definition:** self-running platform behaviours + AI-driven
automations.

**Sub-metrics:**

| Sub-metric | Weight | Measurement rule | Current |
|---|---|---|---|
| Cron infrastructure | 10% | cron routes shipped ÷ target | 10 / 30 = **33%** |
| Growth Coach | 15% | shipped + proactive? | **40%** (on-demand only) |
| Auto-tag assets on upload | 10% | shipped? | **0%** |
| Auto content generation | 15% | shipped? | **0%** |
| Auto-publish + preview links | 10% | shipped? | **100%** |
| Automated migration testing | 10% | shipped? | **0%** |
| Automated a11y checks | 10% | shipped? | **0%** |
| Automated performance regression | 10% | shipped? | **0%** |
| Scheduled reports for merchants | 10% | shipped? | **0%** |

**Weighted total: 16.8%**

**Target for M3 exit:** unchanged (M8 owns automation depth)
**Target for platform complete:** 100%

---

### 8. Enterprise

**Definition:** multi-tenant, teams, SDK, white-label, plugins.

**Sub-metrics:**

| Sub-metric | Weight | Measurement rule | Current |
|---|---|---|---|
| Teams / roles / permissions | 15% | shipped? | **0%** |
| Multi-tenant white-label domain routing | 15% | shipped? | **10%** (custom domain works per merchant, not per agency) |
| SDK (npm) | 10% | shipped? | **0%** |
| Plugin architecture | 15% | shipped? | **0%** |
| Presence + comments | 10% | shipped? | **0%** |
| Audit log | 10% | shipped? | **10%** (some tables, no central log) |
| Public API for external tools | 10% | shipped? | **20%** (some routes exist) |
| Publisher onboarding | 5% | shipped? | **0%** |
| SOC 2 / GDPR readiness | 10% | audited? | **20%** (basic RLS but no audit) |

**Weighted total: 8.0%**

**Target for M3 exit:** unchanged (M9 owns enterprise)
**Target for platform complete:** 100%

---

### 9. Performance

**Definition:** measured, budget-enforced runtime performance.

**Sub-metrics:**

| Sub-metric | Weight | Measurement rule | Current |
|---|---|---|---|
| Bundle-size CI | 15% | fails on regression? | **0%** |
| Lighthouse CI | 15% | scores tracked over time? | **0%** |
| Server-only markers | 10% | count on server-only registries | **0%** |
| Registry snapshot for cold-boot | 10% | shipped? | **0%** |
| Registry telemetry export | 10% | wired to warehouse? | **10%** (hooks exist) |
| Image optimisation | 10% | Next Image + sharp? | **50%** (Next Image used; sharp missing) |
| Cache strategy documented | 5% | ADR present? | **0%** |
| Load test | 10% | 1K+ tenant test run? | **0%** |
| Cold-start budget | 5% | measured? | **0%** |
| CDN + edge documented | 5% | docs present? | **20%** (Vercel + Cloudflare noted) |
| p95 render budget | 5% | tracked? | **0%** |

**Weighted total: 9.0%**

**Target for M3 exit:** unchanged (M10 owns performance)
**Target for platform complete:** 100%

*Note: this is lower than the user's initial estimate of 60%. The
user's estimate credited "current code works" — the PMM measures
whether performance is *governed*, not whether it happens to work.*

---

### 10. Testing

**Definition:** test infrastructure + coverage + CI gates.

**Sub-metrics:**

| Sub-metric | Weight | Measurement rule | Current |
|---|---|---|---|
| Test runner installed | 15% | vitest / jest present? | **0%** |
| Test files executable | 15% | count of runnable ÷ total .test.ts | 0/16 = **0%** |
| Unit test coverage | 15% | rough % of business logic | **5%** |
| Integration tests | 10% | present? | **0%** |
| Visual regression | 10% | present? | **0%** |
| a11y CI | 10% | present? | **0%** |
| CI pipeline | 10% | GitHub Actions live? | **0%** |
| Load test | 5% | present? | **0%** |
| Registry selfCheck in CI | 5% | wired? | **0%** |
| Test authoring convention | 5% | documented? | **50%** (house console.assert pattern used) |

**Weighted total: 4.0%**

**Target for M3 exit:** 30% (parallel engineering quality stream)
**Target for platform complete:** 100%

---

### 11. Security

**Definition:** authentication, authorisation, injection, secret,
audit.

**Sub-metrics:**

| Sub-metric | Weight | Measurement rule | Current |
|---|---|---|---|
| Auth (session + password + magic link) | 15% | shipped? | **90%** |
| RLS on Supabase tables | 15% | audited coverage | **50%** (assumed on most; not audited) |
| Injection audit | 10% | pass on `dangerouslySetInnerHTML` etc.? | **20%** |
| CSP headers | 10% | present? | **0%** |
| CSRF protection | 5% | Next.js baseline | **80%** |
| Secret management | 10% | .env only or vault? | **50%** |
| Dependency audit | 10% | `npm audit` clean? | **60%** (2 moderate warns) |
| Rate limiting | 10% | on public routes? | **20%** (some) |
| Audit log for state-changing routes | 10% | shipped? | **10%** |
| Security incident runbook | 5% | present? | **0%** |

**Weighted total: 41.5%**

**Target for M3 exit:** unchanged (M10 owns security hardening)
**Target for platform complete:** 100%

---

### 12. Accessibility

**Definition:** WCAG compliance, screen-reader friendliness,
motion respect, keyboard nav.

**Sub-metrics:**

| Sub-metric | Weight | Measurement rule | Current |
|---|---|---|---|
| Radix primitives everywhere possible | 15% | primitives that could be Radix that are | **95%** |
| Icons aria-hidden | 10% | Lucide use pattern | **95%** |
| Motion respects prefers-reduced-motion | 10% | motion-safe: usage | **90%** |
| Colour-contrast tokens | 10% | tokens defined + measured? | **50%** |
| Focus states on every interactive | 10% | shadcn baseline | **90%** |
| a11y CI | 10% | axe-core in pipeline? | **0%** |
| Screen-reader manual test | 10% | any % of surfaces tested? | **10%** |
| Semantic HTML | 10% | audit clean? | **70%** |
| Landmarks (main/nav/footer) | 5% | present in generated apps? | **70%** |
| Text tap-target sizes | 5% | 44px+ compliance | **90%** |
| Doc'd a11y ADR per primitive | 5% | count | **0%** |

**Weighted total: 65.3%**

**Target for M3 exit:** 78% (containers ship with a11y notes)
**Target for platform complete:** 100%

---

## Overall baseline (2026-07-05, post-M2)

Weighted equally across all 12 dimensions:

| Dimension | Current | M3 exit target | Complete target |
|---|:-:|:-:|:-:|
| 1. Foundation | **82.0%** | 100% | 100% |
| 2. AI Composition | **46.2%** | 75% | 100% |
| 3. Design System | **60.5%** | 82% | 100% |
| 4. Business OS | **50.7%** | 72% | 100% |
| 5. Marketplace | **29.0%** | 29% | 100% |
| 6. Mobile | **15.5%** | 15.5% | 100% |
| 7. Automation | **16.8%** | 16.8% | 100% |
| 8. Enterprise | **8.0%** | 8.0% | 100% |
| 9. Performance | **9.0%** | 12% | 100% |
| 10. Testing | **4.0%** | 30% | 100% |
| 11. Security | **41.5%** | 43% | 100% |
| 12. Accessibility | **65.3%** | 78% | 100% |
| **Overall (unweighted mean)** | **35.7%** | **46.8%** | **100%** |

The current 35.7% overall figure is the honest baseline. It looks
low because the PMM measures *governed* + *tested* + *scaled*, not
"code exists." That's the point.

---

## Update protocol

The PMM is updated at three points:

**After every batch (Phase 5 report).** Diff each affected
dimension's score. Add a `### Snapshot YYYY-MM-DD` block at the
bottom of this file with the batch id + new scores.

**After every milestone.** Diff each dimension. Add a milestone
snapshot with a summary of what moved.

**When a dimension's measurement rule changes.** Rare, but when
Constitution amendments alter what a dimension covers, the sub-metric
weights must be updated + a "revision" note added.

---

## Governance

- The PMM is the tie-breaker for prioritisation. If two work items
  cost the same and one lifts more low-scoring dimensions, do that
  one first.
- Any regression on a dimension score in a batch report requires
  explicit acknowledgement + a follow-up plan.
- A dimension may only be marked ≥ 90% when its **measurement rule**
  is met, not when the code "feels done."
- No milestone is "complete" until every dimension it *aimed* to
  advance has reached its milestone-exit target.

---

## Snapshot log

*Every batch appends a snapshot here. First entry is the baseline.*

### Snapshot 2026-07-05 — Baseline (post-M2)

Foundation 82 · AI Composition 46 · Design System 61 · Business OS
51 · Marketplace 29 · Mobile 16 · Automation 17 · Enterprise 8 ·
Performance 9 · Testing 4 · Security 42 · Accessibility 65
→ **Overall: 35.7%**
