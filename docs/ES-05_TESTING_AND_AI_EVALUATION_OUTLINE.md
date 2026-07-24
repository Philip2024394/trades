# ES-05 · Testing & AI Evaluation Framework · Outline

**Draft outline · 2026-07-23**
**Purpose:** engineering blueprint for the testing infrastructure that gates Trade Brain V1 authoring, autonomous agent deployment, and Vision AI production use. Full document to be produced Week 2 of Phase 0 Preparation.

**Relationship to prior docs:** ES-01 §10 covered testing at strategic level. ES-05 goes to concrete test infrastructure. Every Trade Brain author's work will be evaluated against ES-05's construction accuracy framework.

---

## Sections planned

### Section 1 · Test Pyramid
- Unit (Vitest, 80% coverage minimum, 90% substrate)
- Integration (real Postgres via Testcontainers)
- E2E (Playwright, mobile + desktop)
- AI Evaluation (structured scenarios)
- Construction Accuracy (human-in-loop)
- Performance (k6 load testing)
- Chaos (dependency failures)

### Section 2 · Vitest Standards
- Co-located `*.test.ts` alongside source
- No PR merges without new unit tests
- Coverage tracked in CI
- Test names describe merchant-observable behaviour
- Mocking policy (mock external APIs · never mock internal modules)

### Section 3 · Integration Test Infrastructure
- Testcontainers Postgres for every integration suite
- Seed data patterns
- Test isolation (each test starts fresh)
- RLS policy verification tests
- Every API endpoint has integration test

### Section 4 · AI Evaluation Framework
- **Scenario-based evaluation** — 100+ scenarios per Trade Brain module
- **Golden path tests** — expected outputs for canonical inputs
- **Adversarial tests** — jailbreak attempts, prompt injections
- **Confidence calibration tests** — verifying reported confidence matches actual accuracy
- **Regression prompt bank** — fixed prompts rerun on every model change
- **Semantic drift detection** — weekly sampling against baseline
- **Cost per query tests** — verifying budget adherence

### Section 5 · Trade Brain Accuracy Framework
- **Human-authored scenario suite per Brain** — 100+ realistic construction questions per trade
- **Author validates outputs quarterly** — paid honorarium for review
- **Correction rate tracked** — target <5% correction rate per Brain per merchant
- **Regional variance evaluation** — Brain answers same question correctly per region
- **Regulation currency check** — Brain reflects latest regulation revisions within 30 days

### Section 6 · Vision AI Accuracy Framework
- **Ground-truth annotation dataset** — 500+ construction images across trades
- **Accuracy per finding type tracked** — defect detection · dimension estimation · trade classification
- **Regional accuracy validation** — same image types produce consistent findings across regions
- **False positive rate cap** — <5% for auto-append findings · higher for approval-queue findings
- **Adversarial imagery testing** — heavily edited photos · unusual angles · low-light

### Section 7 · Estimator Accuracy Framework
- **Historical benchmarking** — estimator outputs compared to actual project outcomes
- **Delta tracking per merchant** — accuracy improves over time via memory calibration
- **Cross-region validation** — same scope produces reasonable variance across regions
- **Edge case coverage** — heritage buildings · off-grid · unusual scopes tracked separately

### Section 8 · Performance Testing
- **k6 load-test infrastructure** — reusable scenarios per API endpoint category
- **Chat SLA** — p95 <5s · p99 <10s
- **Estimator generation** — p95 <3 min
- **Twin timeline reconstruction** — p95 <500ms
- **Load test at 10× current density** — before every major release
- **Sustained load testing** — 8h endurance tests weekly in staging

### Section 9 · Chaos Testing
- **Anthropic API outage simulation** — monthly, verify fallback ladder
- **OpenAI Vision outage simulation** — monthly, verify degradation
- **Supabase failure simulation** — staging only, monthly
- **Twin event log storm** — event volumes 10× normal
- **Network partition** — simulate merchant losing connectivity
- **Realtime channel failure** — verify graceful UI degradation

### Section 10 · Security Testing
- **SAST via Semgrep** — every PR
- **Dependency scanning** — Renovate + Snyk
- **DAST via OWASP ZAP** — quarterly
- **Penetration test** — annually
- **Adversarial AI evaluation** — quarterly with red team
- **RLS policy verification** — automated tests block PR

### Section 11 · Accessibility Testing
- **axe-core automated** — every PR
- **Manual keyboard navigation** — quarterly review
- **Screen reader compatibility** — quarterly (VoiceOver + NVDA + JAWS)
- **WCAG 2.2 AA compliance** — every merchant-facing surface

### Section 12 · Regression Testing
- **Every bug fix generates a regression test** — no exceptions
- **Full regression suite runs on every deploy**
- **Zero-tolerance policy** — failing regression blocks merge
- **Regression bank grows continuously**

### Section 13 · User Acceptance Testing
- **Merchant advisory panel** — 5+ pilot merchants per V0 slice
- **NPS capture** — pre + post rollout per feature
- **Structured qualitative feedback** — 5 open-ended questions per session
- **Blockers block release** — until fixed or explicit accept-with-note

### Section 14 · CI/CD Integration
- Every PR: lint · typecheck · Vitest · integration · Playwright preview · axe
- Every merge to main: deploy staging + smoke tests
- Every production deploy: staged rollout with automated rollback triggers
- Test runtime target: <5 min per PR

### Section 15 · Test Debt Management
- Skipped tests reviewed monthly
- Flaky tests fixed within 2 weeks or removed
- Coverage drops require explanation in PR

### Section 16 · Sign-off Requirements
- CTO
- QA Lead
- Product Lead
- Trade Brain Author (for construction accuracy sections)

---

## Immediate deliverables that ES-05 will produce

1. Vitest coverage floor enforcement per module
2. AI evaluation scenario templates per Trade Brain module
3. Vision AI ground-truth annotation dataset seed (100+ images)
4. Adversarial prompt bank (initial 500+ prompts)
5. Chaos test scenarios per external dependency
6. Merchant advisory panel qualitative capture template
7. Performance SLA test suites (k6)

---

**Full ES-05 document to be written Week 2 of Phase 0 Preparation with QA Lead + first V0 Trade Brain Author input.**
