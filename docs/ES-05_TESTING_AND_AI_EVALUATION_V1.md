# ES-05 · Nex Testing & AI Evaluation Framework v1.0

**Testing infrastructure spec · 2026-07-23**
**Purpose:** the definitive testing framework gating Trade Brain V1 authoring, autonomous agent deployment, and Vision AI production use. Supersedes ES-05 outline.

**Related:** ES-01 §9-10 (testing philosophy) · ADR-0017 (Trade Brain Contract) · ADR-0019 (Workforce Trust Ladder) · ADR-0020 (Honesty Framework) · ES-04 (Security tests) · Trade Brain Author Recruitment Package.

**Dependencies:** QA Lead + first Trade Brain Author input.

---

## Section 1 · The Test Pyramid

Layered from fast/many to slow/few:

```
        ┌─────────────────────────┐
        │  Manual Advisory Panel  │  quarterly
        ├─────────────────────────┤
        │  UAT + Panel Field      │  per V0/V1 slice
        ├─────────────────────────┤
        │  Chaos + Load           │  weekly staging
        ├─────────────────────────┤
        │  E2E (Playwright)       │  per PR + nightly
        ├─────────────────────────┤
        │  AI Evaluation          │  per model change
        ├─────────────────────────┤
        │  Construction Accuracy  │  monthly per Brain
        ├─────────────────────────┤
        │  Integration (Postgres) │  per PR
        ├─────────────────────────┤
        │  Unit (Vitest)          │  per PR
        └─────────────────────────┘
```

Every layer has: automation · owner · SLA · escalation path.

---

## Section 2 · Vitest Standards

### 2.1 Coverage floors

| Module type | Minimum coverage |
|-------------|------------------|
| Substrate (memory · brains · twin-live · workforce) | **90%** |
| Domain engines (bi · pi · est · cx · fi · sc · pm · cv · net · orch) | **85%** |
| UI components | **80%** |
| Adapters + integrations | **80%** |

CI blocks merge if coverage drops below floor.

### 2.2 Test naming convention

Describe merchant-observable behaviour, not implementation:

```typescript
// ❌ Don't
it('calls buildEstimate with correct args', ...)

// ✅ Do
it('generates a bathroom quote within £10 of expected regional average', ...)
```

### 2.3 Test placement

- Co-located `*.test.ts` alongside source
- Shared test utilities in `<module>/__test-utils__/`
- Never in a separate `/tests` directory

### 2.4 Mocking policy

**Allowed to mock:**
- External APIs (Anthropic · OpenAI · Stripe · Companies House)
- Time (`vi.useFakeTimers`)
- Random (`vi.spyOn(Math, 'random')`)

**Never mock:**
- Internal module barrel exports (creates false confidence)
- Database (use Testcontainers per §3)
- File system (use fixtures)

### 2.5 PR requirements

Every PR includes:
- New unit tests for new logic
- Regression test if bug fixed
- Coverage delta reported in PR check
- No skipped tests without explanation

---

## Section 3 · Integration Test Infrastructure

### 3.1 Testcontainers Postgres

Real Postgres 16 instance per test suite via Testcontainers. No mocked DB.

### 3.2 Seed patterns

Standard seed builders in `src/lib/test-utils/seeds/`:

- `seedMerchant()` → returns merchant slug + Owner user
- `seedProject()` → returns project ID with sensible defaults
- `seedTradeBrain()` → loads test Brain packs
- `seedMemoryRow()` → writes controllable memory rows

### 3.3 Test isolation

Every test starts with fresh database snapshot. No cross-test state.

### 3.4 RLS policy verification

Every new tenant table's RLS policy tested with:
- Owner can read own tenant
- Manager cannot read outside module scope
- Cross-tenant read attempts blocked (returns empty · not error to prevent enumeration)
- SQL injection attempts blocked

### 3.5 Every API endpoint tested

For every route in `src/app/api/nex/**`, integration test covers:
- Success case
- Auth failure (401)
- Authorisation failure (403)
- Validation failure (400)
- Rate limit response (429)
- Idempotency behaviour (if applicable)

---

## Section 4 · AI Evaluation Framework

Uniquely important. Nex's product IS AI outputs.

### 4.1 Scenario-based evaluation

Every AI-touching module has a scenario suite:

```typescript
type EvalScenario = {
  id: string;
  input: unknown;
  expected: {
    outputContains?: string[];
    outputExcludes?: string[];
    confidence?: 'low' | 'medium' | 'high';
    evidenceRequired?: boolean;
    latencyMs?: number;
  };
  category: 'golden' | 'edge' | 'adversarial';
};
```

Scenarios stored per module at `src/lib/nex/<module>/__evals__/scenarios.json`.

### 4.2 Golden path scenarios

Canonical merchant queries with expected outputs:
- 100+ per Trade Brain
- 50+ per major workflow (Estimator · Business Builder · Chat)
- Updated when merchant advisory panel reports common asks

### 4.3 Adversarial scenarios

Attempts to break, jailbreak, or mislead:
- 500+ initial adversarial prompt bank (per ES-04 §7.4)
- Categories: system-prompt extraction · PII exfil · cross-tenant · injection · confidence miscalibration
- Grows continuously

### 4.4 Confidence calibration tests

For every AI output tagged with confidence, verify:
- High-confidence outputs correct >95% of time
- Medium-confidence outputs correct >75% of time
- Low-confidence outputs correct >50% of time
- Confidence never over-reports

Calibration reviewed monthly.

### 4.5 Regression prompt bank

Fixed prompts rerun on every model version change (Anthropic model updates, prompt template updates). Detects semantic drift.

### 4.6 Semantic drift detection

Weekly sampling of production LLM outputs vs baseline responses. Alert on drift >20% semantic distance.

### 4.7 Cost per query monitoring

Every LLM call logged with:
- Provider
- Model
- Input tokens
- Output tokens
- Cost (from provider price)
- Merchant

Aggregated for budget enforcement (per ES-04 §11.5) + cost anomaly detection.

---

## Section 5 · Trade Brain Accuracy Framework

Trade Brains are the moat. Their accuracy = platform accuracy.

### 5.1 Author-authored scenario suite

Every Brain V1 ships with:
- 100+ realistic construction questions authored by the Trade Brain Author
- Expected answers per question · with allowable variation
- Categorised by sub-specialisation · region · complexity

Scenarios stored at `src/lib/nex/brains/<slug>/__evals__/scenarios.json`. PR review by Author before merge.

### 5.2 Author quarterly review

Every Brain reviewed quarterly by its Author. Paid honorarium per review. Author:
- Samples 20+ production responses
- Rates accuracy (correct · partial · wrong)
- Reports drift or gaps
- Approves or requests updates
- Signs off next quarter's expected accuracy

### 5.3 Correction rate targets

- **Target: <5% correction rate** per Brain per merchant per week
- **Alert threshold: >8%** in a rolling 30-day window
- **Escalation: Author engaged if >12%** over 30 days

Correction rate visible in Author dashboard.

### 5.4 Regional variance evaluation

Same question asked with different region contexts. Verify Brain answers reflect regional variance where applicable (regulations, materials, pricing).

### 5.5 Regulation currency check

Automated cron pulls latest Approved Documents / TGDs / NCC revisions. Alerts when Brain content references superseded revision. Author notified for update.

### 5.6 Merchant correction workflow

Per ADR-0017 § 5:
- Merchant marks Brain output as wrong via inline correction UI
- Correction appended to `hammerex_nex_brain_corrections`
- Author reviews weekly
- Author-accepted → Brain version bump
- Author-rejected → correction preserved with rationale

---

## Section 6 · Vision AI Accuracy Framework

### 6.1 Ground-truth annotation dataset

Seeded 100+ construction images across trades (Phase 0 deliverable). Grows to 500+ by Phase 1 end. Categories:

- Progression photos (first fix · second fix · complete)
- Defect photos (cracks · water damage · fixing issues)
- Safety photos (PPE compliance · edge protection · housekeeping)
- Delivery photos (materials arrival)
- Measurement photos (rooms · features · fixtures)

Each image has expert-annotated ground truth: trade · location · stage · findings · confidence expectations.

### 6.2 Accuracy metrics per finding type

| Finding | V0 target |
|---------|-----------|
| Trade classification | >90% |
| Room detection | >85% |
| Work stage detection | >80% |
| Defect detection (major) | >90% recall · >75% precision |
| Defect detection (minor) | >75% recall · >70% precision |
| PPE presence | >95% |
| Dimension estimation | ±20% typical accuracy |

Below target = model change or dataset expansion.

### 6.3 Regional accuracy validation

Same image types produce consistent findings across UK regions. If Cardiff plumbing photos scored differently than Manchester, investigate model bias.

### 6.4 False positive cap

For auto-append (high-confidence) findings: **<5% false positive rate.**
For approval-queue (medium-confidence) findings: <15% false positive rate acceptable.

### 6.5 Adversarial imagery

- Heavily edited photos
- Unusual angles
- Low-light
- Motion blur
- Photos of screens (not real scenes)
- AI-generated imagery (should be detected + rejected per ADR-0020)

---

## Section 7 · Estimator Accuracy Framework

### 7.1 Historical benchmarking

Estimator outputs compared to actual project outcomes:

- Estimated total vs actual total
- Estimated duration vs actual duration
- Estimated materials cost vs invoiced materials cost
- Estimated labour hours vs timesheet hours

Deltas stored in Memory for future calibration (per Phase 28 §6.4).

### 7.2 Merchant-specific calibration tracking

- After 5+ completed projects, merchant's own delta becomes calibration factor
- Merchant sees improvement over time ("Estimator accuracy this quarter: ±8% vs ±14% last quarter")
- Merchant can view calibration components

### 7.3 Cross-region validation

Same scope estimated across regions produces reasonable variance. Alert if variance exceeds expected regional bands.

### 7.4 Edge case coverage

Tracked separately (edge cases inherently have thin data):
- Heritage restoration
- Off-grid installation
- Unusual scopes
- Emergency callouts
- Insurance reinstatement

---

## Section 8 · Performance Testing

### 8.1 k6 load testing

Infrastructure at `test/load/`. Reusable scenarios per API endpoint category.

### 8.2 SLA targets

Per ES-06 §23:

| Surface | p95 |
|---------|-----|
| Chat first token | <400ms |
| Chat full response | <5s |
| Estimator generation | <3 min |
| Twin timeline reconstruction | <500ms |
| Public tradesites | <200ms |
| API standard reads | <200ms |

### 8.3 Load testing frequency

- **Before every major release**: 10× current density
- **Weekly staging**: standard load
- **Monthly**: sustained 8-hour endurance test

### 8.4 Performance regression detection

Every PR triggers subset performance tests. Regression >20% blocks merge.

---

## Section 9 · Chaos Testing

Per ES-06 §22.

### 9.1 Monthly staging scenarios

- Anthropic API 100% outage (verify fallback ladder)
- OpenAI Vision unavailable
- Supabase read replica failure
- Twin event storm (10× normal volume)
- Network partition (merchant losing connectivity mid-workflow)
- Realtime channel failure

### 9.2 Documented playbooks

Per scenario:
- Simulation procedure
- Expected system behaviour
- Merchant-facing UX in degraded mode
- Recovery verification

### 9.3 Success criteria

- Zero data loss in any scenario
- Merchant-facing UX degrades gracefully with clear messaging
- Recovery within RTO
- Automated rollback if degradation is worse than baseline

---

## Section 10 · Security Testing

Per ES-04 §5.6.

### 10.1 Automated

- **SAST via Semgrep** — every PR
- **Dependency scanning** — Renovate + Snyk continuous
- **RLS policy verification** — every new tenant table

### 10.2 Manual

- **DAST via OWASP ZAP** — quarterly
- **Penetration test** — annually (external firm)
- **Adversarial AI evaluation** — quarterly (500+ red-team prompts)
- **External security consultant** — Y2+ (per ES-10 §12.3)

---

## Section 11 · Accessibility Testing

### 11.1 Automated

- **axe-core** — every PR merchant-facing changes
- WCAG 2.2 AA compliance blocked at merge if failures

### 11.2 Manual

- **Keyboard navigation** — quarterly review of all merchant surfaces
- **Screen reader** — quarterly review (VoiceOver + NVDA + JAWS)
- **Colour contrast** — automated + spot-check
- **Voice input** — verified as accessibility affordance

---

## Section 12 · Regression Testing

### 12.1 Every bug fix generates a regression test

No exceptions. Bug fix PR without regression test blocked at review.

### 12.2 Regression suite runs

- Full regression on every merge to main
- Subset regression on every PR
- Zero tolerance policy: any regression failure blocks merge

### 12.3 Regression bank grows continuously

Never trimmed unless the underlying feature is retired.

---

## Section 13 · User Acceptance Testing

### 13.1 Merchant advisory panel

- 5+ pilot merchants for V0 features
- 15-20 by end of Y1
- Paid honorarium (per ES-10 §12.3 recommendation)
- Advisory panel field sessions bi-weekly

### 13.2 UAT capture template

Every V0/V1 slice reviewed by advisory panel with these 5 questions:

1. What was the best moment?
2. What was the worst moment?
3. What almost made you quit?
4. What surprised you?
5. Would you recommend this to another merchant like you?

### 13.3 NPS capture

- Pre-V0 baseline
- Post-V0 measurement per feature
- Advisory panel target: NPS ≥40

### 13.4 Blockers block release

Advisory panel identifies release blocker → fix or explicit accept-with-note.

---

## Section 14 · CI/CD Integration

### 14.1 Every PR pipeline

1. Install (cached)
2. Lint (fail on error)
3. TypeScript compile check
4. Vitest full suite (parallelised)
5. Integration tests
6. Playwright preview deploy
7. axe-core accessibility
8. Coverage report
9. Semgrep SAST
10. Deploy preview URL for reviewers

Target CI runtime: <8 minutes per PR (currently ~5min per Playbook §4.3).

### 14.2 Every merge to main

- Deploy to staging
- Automated smoke tests
- Staged rollout to production per ES-06 §7.2

### 14.3 Test parallelisation

- Vitest workers per file group
- Integration tests split across CI runners
- Playwright suites parallel

---

## Section 15 · Test Debt Management

### 15.1 Skipped tests

Reviewed monthly. Any test skipped >30 days requires:
- Clear rationale
- Removal plan OR
- Renewed skip approval

### 15.2 Flaky tests

Fixed within 2 weeks or removed. Flakiness tracked per test.

### 15.3 Coverage drops

PRs with coverage drop require explanation. Cumulative drop over quarter reviewed by CTO.

---

## Section 16 · Sign-off

Required before ES-05 acceptance:

- [ ] CTO
- [ ] QA Lead
- [ ] Product Lead
- [ ] First V0 Trade Brain Author (Electrician)

---

## Section 17 · Immediate Deliverables from ES-05

For Phase 0 Week 3-4:

1. **Vitest coverage floor enforcement** in CI
2. **Testcontainers integration test infrastructure** at `test/integration/`
3. **AI evaluation scenario template** at `src/lib/nex/<module>/__evals__/`
4. **Adversarial prompt bank** (500+ initial · at `docs/security/adversarial-prompts.md`)
5. **Vision AI ground-truth dataset** (100+ annotated images seed)
6. **UAT capture template** at `docs/uat/panel-session-template.md`
7. **k6 load test infrastructure** at `test/load/`
8. **Chaos scenario documentation** at `docs/chaos-scenarios.md`

---

## Dependencies

- **Blocks:** Trade Brain V0 authoring (Author needs scenario template) · Workforce V0 (needs AI evaluation) · Business Builder V2 (needs UAT template)
- **Blocked by:** First Trade Brain Author input on scenario format · QA Lead availability for framework refinement
- **Related:** ADR-0017 · ADR-0019 · ADR-0020 · ES-04

## Risks

- **Ground-truth dataset labelling cost** — mitigation: seed 100 · grow via merchant advisory panel contributions
- **AI evaluation cost at scale** — mitigation: sample-based rather than full-eval per release
- **Regression suite runtime bloat** — mitigation: monthly review · retire obsolete tests · parallelise aggressively
- **Advisory panel bandwidth** — mitigation: 15-20 by Y1 end · paid honorarium
- **Trade Brain Author review capacity** — mitigation: retainer includes quarterly review · offloaded from real-time correction workload

---

**End of ES-05 · Testing & AI Evaluation Framework v1.0.**
