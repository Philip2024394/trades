# Merchant Advisory Panel Charter · V1

**Governance document · 2026-07-23**
**Purpose:** define who the Merchant Advisory Panel is, what it decides, how it decides, and where its boundary sits against Nex product ownership. The Panel is a required signoff gate for every V1 Trade Brain per ADR-0017 §6 and Staircase Brain Spec §10.

**Not a focus group.** The Panel has real veto over publishing Author content to production. Its members are compensated and its output is binding within the scope defined below.

**Charter status:** V1 · pending CEO + Product Lead approval before first Panel is convened.

---

## 1 · Purpose

The Merchant Advisory Panel exists to:

1. **Validate every V1 Trade Brain** — before a Brain moves from `advisory_panel` to `published` status, the Panel must approve. This is a gate condition on the substrate feature flag.
2. **Review Learning Loop signals** — quarterly, the Panel reviews aggregated field-outcome signals from `hammerex_nex_brain_learning_signals` alongside the responsible Author.
3. **Flag emerging real-world concerns** — regulation changes, price shocks, defect patterns, tooling gaps — that the Nex team may not detect from telemetry.
4. **Sanity-check merchant-facing UX** for any surface that quotes Brain content (Estimator UI, Chat, Vision analysis).

The Panel does NOT own product roadmap, pricing, or Nex commercial decisions. Those remain with Product Lead + CEO.

## 2 · Membership

**Size:** 5-9 members. Below 5 is too thin for quorum; above 9 makes review meetings unwieldy.

**Composition mix (target):**

- At least one merchant per trade with a V1 Brain (Electrician · Plumber · Roofer · Carpenter at V1 launch; Staircase specialist as authoring proceeds)
- At least two merchants from Business or Works tiers (higher-utility merchants surface deeper feedback)
- At least one merchant on the Starter or Professional tier (represents mid-market reality)
- At least two regions represented (avoid London-only bias — target South · Midlands · North · Devolved nation coverage over time)
- At least one merchant from a rural or low-density region (represents "not enough peers yet" conditions per Validation Report C-7)

**Non-members explicitly excluded:**

- Trade Brain Authors (Authors present at Panel meetings for their Brain, but do not vote)
- Nex employees + contractors (attend as observers or presenters; no vote)
- Trade body officials (invited as guests where relevant; no vote)
- Any merchant with an active commercial dispute with Nex

**Term:** 12 months, renewable once (max 24 months per member). Prevents entrenchment while giving enough time to build institutional judgement.

**Rotation:** at end of Term 1, at least 2 seats rotate. Prevents dead-weight and keeps fresh eyes on the surface.

## 3 · Compensation

Per Nex commitments in the Author Contract §10 and Recruitment Package precedent:

- **Attendance honorarium:** `«£100-£200»` per meeting attended (2 meetings per V1 Brain launch + 4 quarterly reviews per year = ~6-8 meetings/year).
- **Preparation stipend:** `«£100»` per Brain-review meeting to cover reading time (Panel members review the Brain content in advance).
- **Emergency review fee:** `«£150»` per urgent out-of-cycle review (rare · reserved for regulation shocks or safety flags).

Compensation is invoiced quarterly. Panel members are not employees; standard IR35 / independent-contractor posture applies. 🛑 Legal Counsel to confirm exact payment structure per jurisdiction.

## 4 · Cadence

**V1 Brain launch cycle** (per Brain):

- **Meeting 1 · Halfway review** — at ~Week 8 of Author V1 authoring, Panel reviews Craft + Regulations + Materials modules submitted so far. Feedback captured; Author has 2 weeks to incorporate.
- **Meeting 2 · Signoff review** — at ~Week 14, Panel reviews the full 6-module Brain V1. Vote per §5 below.

**Standing quarterly cycle** (across all published Brains):

- **Q1-Q4 · Learning Loop review** — Panel reviews Learning Loop signals for each Brain + Author-proposed changes. Q3 also reviews any regulation changes flagged since the last cycle.

**Extraordinary meetings:**

- Called by Product Lead + at least 2 Panel members with 5 working days' notice
- Reserved for safety issues, regulation shocks, or field-detected fabrication risk (per ADR-0020)

## 5 · Decision-making

**Quorum:** 60% of seated members present (round up). Decisions taken without quorum are advisory only.

**Brain publish decision — the primary vote:**

Options: `approve_publish` · `approve_with_amendments` · `defer_pending_rework` · `reject`.

- `approve_publish` — Brain moves to `published`. Runtime substrate can serve this Brain via `/api/brain/*` when the feature flag is on. Requires **simple majority of quorum**.
- `approve_with_amendments` — Author has `«2 weeks»` to incorporate listed amendments; Product Lead confirms. No new Panel meeting needed unless Panel explicitly requests.
- `defer_pending_rework` — Brain returns to `author_review` status. Requires re-submission for a Meeting 2 style review after rework. **No merchant-facing exposure** until re-approved.
- `reject` — Fundamental issue: content quality, Author fit, regulation misalignment. Escalates to CTO + Product Lead. May trigger Author contract renegotiation or termination per Contract §9. Requires **2/3 majority of quorum**.

**Learning Loop review decisions:**

Panel does not directly amend Brain content. Panel produces a written recommendation to the Author; Author's response is captured in `hammerex_nex_brain_learning_signals.author_notes`. Escalation of unresolved disagreement follows §6.

## 6 · Escalation + tie-breaking

**Author-Panel disagreement:**

- Author's authority is paramount on content correctness per ADR-0017 §4 (Author owns the truth).
- Panel's authority is paramount on real-world utility + merchant-facing appropriateness.
- Where these conflict, escalation is: Author + Panel Chair → Product Lead → CTO. CTO decision is final within the Nex product line.

**Nex-Panel disagreement:**

- If Product decides to publish a Brain the Panel rejected (rare), that override is logged in `docs/DECISIONS/` as an ADR Amendment and Panel members are informed with reasons.

**Panel Chair role:**

- Elected annually from among Panel members (Panel-internal decision).
- Chairs meetings, sets agenda alongside Product Lead, breaks tied votes.

## 7 · Confidentiality + conflicts

Panel members receive pre-release Brain content, Author identities, and aggregated Learning Loop signals. Members sign a lightweight NDA at induction covering:

- Non-disclosure of pre-release Brain content until published
- Non-disclosure of specific merchant identifiers in Learning Loop signals (only aggregated data shared)
- Duration: 2 years from end of Term

**Conflicts of interest:**

- Panel members who compete directly with a Brain's Author or another Panel member must recuse from votes affecting that Brain.
- Panel members who receive material commercial benefit from a specific manufacturer / supplier / trade body must disclose this at induction and recuse from votes touching that party.

## 8 · Induction

Every new Panel member completes:

1. **1-hour Nex platform orientation** — high-level tour of Chat, SiteBook, Estimator, Trade Centre; product principles including ADR-0020 (Zero Fabrication).
2. **Brain contract briefing** — ADR-0017 §1-§8 walkthrough. Panel members must understand what a Brain IS before judging one.
3. **Learning Loop briefing** — how K-anonymised signals are computed per ADR-0016; what the Panel can and cannot infer from them.
4. **NDA signature + expense-payment setup**.

Induction is paid at the standard attendance honorarium.

## 9 · Publication of Panel outputs

Panel decisions are recorded in a Nex-internal register with:

- Meeting date + attendees
- Motion voted on
- Vote result
- Written rationale (~150 words) captured by Panel Chair

For publish decisions, the outcome + one-line rationale is published on the Brain's public attribution page ("V1 approved by Merchant Advisory Panel `«DATE»`") to earn merchant trust — this line is a factual statement of governance, per ADR-0020 evidence-or-silence.

## 10 · Dissolution + replacement

**Dissolution grounds:**

- Nex ceases operating Trade Brains as a product (unlikely at V1 launch, possible at strategic pivot)
- Panel loses quorum for 2 consecutive scheduled meetings and cannot be reconstituted
- CEO + CTO + Product Lead unanimous decision that Panel structure is no longer fit for purpose

**Replacement:**

- Dissolution triggers a 30-day window to constitute a successor Panel per §2 composition rules
- No Brain moves from `advisory_panel` → `published` during the dissolution-to-successor window
- Existing published Brains continue to serve; Learning Loop reviews pause until successor Panel seated

---

## Approval

**Charter status:** V1 · awaiting approval.

| Signatory | Role | Signoff |
|-----------|------|---------|
| CEO | Final approval of governance model | ☐ |
| CTO | Confirms Panel gate is enforceable in substrate | ☐ |
| Product Lead | Confirms Panel workflow is operable | ☐ |
| Legal Counsel | Confirms NDA + payment structure enforceable | ☐ |

Upon full signoff:

1. This charter moves to Status: Ratified in `docs/DECISIONS/INDEX.md` (or accepted as a governance doc referenced from ADR-0017 §6).
2. Panel recruitment begins per §2 composition rules.
3. First Panel convenes to induct and elect a Chair.
4. First Brain (Staircase or Electrician depending on Author onboarding) is scheduled for its first Halfway Review.

---

**End of Merchant Advisory Panel Charter V1.**
