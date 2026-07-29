# Future Module Brief · NEX Payment & Account Intelligence

**Status:** Roadmap · not scheduled
**Source:** Philip O'Farrell · 2026-07-28
**Depends on:** Materials v1 (frozen) · Staircase Estimation (shipped) · basic CRM/Projects module with customer records · initial Staircase Reference Brain content
**Category:** Business operations · cash-flow protection · customer coordination

---

## The principle this module encodes

A staircase company is not just selling timber. It is managing material cost + workshop time + installation labour + cash flow. Bespoke staircases sit in production for weeks before final payment arrives — good payment terms protect the workshop.

This module gives NEX the operational instincts of an experienced workshop owner **when it comes to money**. Same *"operations manager"* voice as everywhere else on the platform (Principle 0001), same composition-not-lookup discipline (Principle 0003), but applied to payment terms, credit risk, and account health.

## Three sub-features

### 1 · Payment Plan Intelligence

Suggests appropriate payment terms when a quote is being generated, based on customer type + trade history + order size + customisation level.

```
Payment Plan Suggestion

New customer · high-customisation order:
  • Deposit required: 30–50%
  • Design approval before manufacture starts
  • Balance on completion

Established trade account · standard staircase:
  • 30-day terms available
  • Invoice on delivery

Large developer · multiple staircase framework contract:
  • Monthly account arrangement
  • Terms agreed in advance
```

Never applies terms silently. The owner reviews and approves the suggested plan before it becomes part of the quote — same six-step Standard NEX Workflow (Principle 0002).

### 2 · Account Health Monitor

Live view of every customer's payment behaviour, surfaced as an operations-manager summary rather than a spreadsheet of columns.

```
Account Health

ABC Builders
  Status:           Good
  Payment history:  12 invoices · 11 paid on time
  Recommendation:   Continue trade credit as normal.

XYZ Construction
  Status:           Warning
  Latest invoice:   45 days overdue
  Recommendation:   Do not release new staircase orders until
                    payment plan is agreed.
```

Health signals composed from real payment history (from the workshop's invoicing / accounting system) — not scored, not gamified. The owner sees the picture and decides.

### 3 · Payment Protection Assistant

Before a bespoke staircase enters manufacture, and again before installation, NEX runs a payment readiness check.

**Before manufacturing:**

```
Payment Protection · Pre-manufacture

Customer:       Private homeowner
Order value:    Significant
Risk:           Medium (first order)

Recommended:    Deposit received before materials purchased
Status:         ✓ Deposit received on [date]
                Proceed to manufacture.
```

**Before installation:**

```
Payment Protection · Pre-installation

Outstanding balance:  Unpaid
Recommendation:       Confirm payment arrangement before installation
                      is scheduled — do not send installers to site
                      with an open balance.
```

Never blocks the owner. Every recommendation is a proposal the owner can override — but the recommendation stays on the record so the risk is captured whichever way the decision goes.

## Overdue-payment reminder progression

NEX supports the reminder path Philip documented — courteous escalation, not aggressive collection:

- **Before due date** — professional reminder: *"Your invoice is due on [date]."*
- **Shortly overdue** — courteous escalation: *"Your account is now overdue. Please arrange payment."*
- **Longer overdue** — formal notice: *"Your account remains unpaid. Late payment charges may now apply."*
- **Sustained non-payment** — stronger action suggested to the owner: late fees · stop further work · credit-account suspension · require payment before new orders.

**Never automatic.** Every escalation is proposed to the owner, who can hold the reminder (long-term customer with a known issue) or advance it (unresponsive first-time defaulter). Principle 0003 in action: judgement, not a fixed pipeline.

## Documentation-for-disputes support

When a bespoke staircase order runs into trouble, the difference between recovery and loss is the evidence chain. NEX quietly assembles the packet a small-claims process would need:

- Signed quotation
- Approved drawings
- Customer measurements approval
- Material specification
- Installation sign-off
- Invoice records
- Emails / messages agreeing the work
- Payment terms explicitly stated

Because these documents are already generated during the normal workflow, NEX assembles them into a coherent "dispute packet" on request — the owner never has to hunt for them across email, WhatsApp, and their filing cabinet.

## Architecture note

Payment & Account Intelligence sits on:

- **CRM / Customer records** — payment history · trade account status · relationship notes
- **Estimation module** — order value + customisation level + timeline
- **Materials Memory** — materials committed to the order · what's already been purchased
- **Staircase Reference Brain** — the business operations principles (see `business-operations-principles.md`)
- **Invoicing / accounting integration** — actual payment events (Xero · QuickBooks · Sage etc. via existing integrations, not a new one)

No new payment processing. NEX does not take card details, does not send money, does not become a payments platform. It observes, surfaces, and recommends — the actual money movement stays in whatever accounting system the workshop already uses.

## Quality-gate stance (all 12 must pass)

- **Q1 (feels like ops manager):** Passes — every card is the language a senior workshop owner would use with their bookkeeper.
- **Q2 (NEX did the work first):** Payment suggestion is drafted before the owner sees the quote, health status is pre-composed before the owner opens the dashboard.
- **Q3 (owner reviews, doesn't fill forms):** Every recommendation is a proposal · owner approves or overrides · nothing silent.
- **Q7 (confidence > automation):** Never sends a reminder, never blocks an installation, never suspends an account without owner approval.
- **Q8 (uncertain → ask):** When customer history is thin, asks one specific question rather than assuming risk profile.
- **Q11 (workshop manager test):** Passes — captures the money-related instincts an experienced workshop owner already carries.
- **Q12 (traceability):** Every recommendation shows which prior payment events + reference-brain principles led to it. No unsourced credit-risk verdicts.

## Design constraints

- Never take payment through NEX. Not a payments platform.
- Never send an escalation reminder without owner approval (at least in v1 — a "quiet mode" for repeat-reminder cadence can come later once trust is built).
- Legal/regulatory language always cites current authoritative sources. Never hardcode interest rates or small-claims thresholds — they change (Rule A · no fabricated numbers).
- Documentation for disputes is *assembled*, not *created* — every document already exists from the normal workflow.
- Account Health signals are surfaced, not scored. No credit rating engine. The owner reads the picture and decides.
- Owner-first language throughout. Customers see courteous, professional communication.

## Cross-references

- `data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/business-operations-principles.md` — the four business operations principles this module consumes
- `docs/product-constitution/roadmap/nex-staircase-estimation.md` — Estimation feeds this module (order value · customisation level · timeline all inform payment terms)
- `docs/product-constitution/roadmap/nex-installation-readiness-check.md` — Payment Protection at pre-installation composes with the site-readiness check
- `docs/product-constitution/roadmap/nex-buying-intelligence.md` — cash-flow-aware buying decisions read account state
- `docs/product-constitution/principles/0003-answers-as-judgement-not-verdict.md` — the composition rule this module lives under
