# Trade Brain Author Contract Template · V0

**Draft template · 2026-07-23**
**Purpose:** the concrete contract Trade Brain Authors sign before beginning V1 authoring. Every clause below is drawn from the Author Recruitment Package + ADR-0017 (including §8 Field Learning Loop). This is a TEMPLATE — every deployment of this template MUST pass through qualified UK employment/IP legal counsel before signature. Placeholders in the form `«PLACEHOLDER»` must be filled in per Author.

**Do not use this template without Legal Counsel review.** Clauses flagged with 🛑 are known to require legal wording refinement. Nex product team drafts the technical + attribution language; Legal owns the enforceability.

---

## Parties

- **Nex** — the operating entity (`«NEX LEGAL ENTITY NAME»`, `«REGISTERED ADDRESS»`), the platform commissioning the Trade Brain.
- **Author** — the master tradesperson (`«AUTHOR LEGAL NAME»`, `«AUTHOR ADDRESS»`, `«AUTHOR TRADE»`, `«PRIMARY CERTIFICATION + NUMBER»`), the author of the Brain content.

Effective date: `«EFFECTIVE DATE»`. Governing law: 🛑 `«ENGLAND AND WALES / other UK jurisdiction — Legal to confirm»`.

---

## 1 · Scope of work

Author agrees to author the V1 content of the `«BRAIN NAME»` Trade Brain against the schema locked by ADR-0017 (Trade Brain Contract). V1 content comprises the six required modules:

1. Craft
2. Regulations
3. Materials
4. Workflow
5. Defects
6. Pricing Model

Every module is authored through the Trade Brain Author Tooling (per `TRADE_BRAIN_AUTHOR_TOOLING_SPEC.md`). Author does not write JSON directly; the tooling exports the JSON packs to `src/lib/nex/brains/«brain_slug»/`.

Scope excludes the 4 V2 modules (tools · business tone · sub-specialisations · regional variants). V2 authoring is optional and covered by a separate schedule if commissioned.

## 2 · Deliverables + timeline

**V1 delivery target:** six modules complete + advisory panel signoff within `«N»` weeks of contract signature (default 15 weeks per Staircase Brain Spec §13).

Milestones:

| Milestone | Content | Nex payment |
|-----------|---------|-------------|
| M1 Kick-off | Onboarding + tool training complete | 10% of V1 honorarium |
| M2 Craft + Regulations modules submitted | Author scenarios pass structural test | 20% |
| M3 Materials + Workflow modules submitted | Author scenarios pass structural test | 20% |
| M4 Defects + Pricing Model submitted | Full 100-scenario suite runs · Author's expected answers filled in | 20% |
| M5 Advisory panel signoff | Merchant advisory panel approves V1 | 20% |
| M6 Publish | Brain moves to `status = published` | 10% |

Deliverable acceptance: each module is accepted when Nex + advisory panel confirm it meets the ADR-0017 §3 fact/rule/playbook schema requirements. Rejection routes to a revision cycle, capped at two revisions per module before further scope is renegotiated.

## 3 · Compensation

Per Author Recruitment Package §5:

- **V1 authoring honorarium:** `«£8,000 - £15,000»` total for the six V1 modules, paid per milestones in §2 above.
- **Quarterly maintenance retainer:** `«£500 - £1,000»` per quarter, paid in advance, covering (a) correction review per §5 below, (b) regulation-currency flagging, (c) field-learning-loop quarterly review per ADR-0017 §8, and (d) reasonable response to Nex questions on Brain content.
- **Sample-authoring fee (pre-contract):** `«£300»` for the pre-hire authoring task, paid regardless of whether this contract is subsequently signed. This clause records the paid task if it occurred.
- **V2 module honoraria:** commissioned separately if Nex proceeds with V2 authoring. This contract does not commit either party to V2.

Payment method: `«BANK TRANSFER — 30-day terms from milestone acceptance»` 🛑. VAT: 🛑 `«Author is / is not VAT-registered — invoice accordingly»`.

Explicitly not offered at V1 (per Recruitment Package §5): royalty per merchant subscription, equity, full-time employment. Royalty may be revisited at Y3+ if Nex commercial terms support it.

## 4 · Intellectual property

**IP model: work-for-hire.**

Author confirms every V1 module submitted is original work authored by them (or lawfully licensed to them), that they have full authority to assign it to Nex, and that no third-party IP is embedded without written permission and citation.

On acceptance and payment of each milestone, all Nex-facing rights (copyright, database rights, and any related IP) in the delivered module vest in Nex. Nex owns the pack. Author retains:

- **Attribution right** — Author's name, credentials, and last-reviewed date are displayed on every merchant-facing surface that quotes the Brain (per ADR-0017 §4).
- **Reference right** — Author may cite this authorship in their CV, marketing, portfolio, and public bio. Author may state they are "Author of the Nex `«BRAIN NAME»`."
- **Prior knowledge right** — nothing in this contract prevents Author from using their own general trade expertise elsewhere. This contract binds the SPECIFIC Brain content produced, not Author's underlying trade knowledge.

🛑 Legal Counsel to draft the assignment mechanic in enforceable form (assignment on acceptance vs. licence-back model).

## 5 · Corrections + Field Learning Loop review (ADR-0017 §5 + §8)

Merchant-submitted corrections flow to Author for weekly review. Author decides `accept`, `reject`, or `defer` with a written reason. Author-accepted corrections cause a Brain version bump (V0.1 → V0.2 etc.).

Per ADR-0017 §8 Field Learning Loop:

- Author receives a quarterly review pack of aggregated field-outcome signals (K-anonymised per ADR-0016) for their Brain.
- Author retains the right to reject learning-loop-proposed changes with a written reason.
- Author retains the right to propose their own changes based on the field data.
- Learning-loop-driven amendments are attributed as "field-informed update reviewed by `«AUTHOR NAME»`" — Author's original attribution on unchanged content is preserved.

Quarterly review time is covered by the retainer in §3. Extraordinary review requests (e.g. urgent regulation change) are paid at `«HOURLY RATE»` 🛑 with prior written agreement.

## 6 · Confidentiality

Author will not disclose:

- Nex platform designs, source code, financial figures, merchant data, or pre-release Brain content, EXCEPT as permitted for their own attribution and reference rights in §4.
- Correction chain content that identifies specific merchants beyond aggregated K-anonymised patterns.

Author's own general trade expertise, publicly published Nex materials, and Author's own attribution are explicitly excluded from confidentiality restrictions.

Confidentiality survives termination for `«3»` years 🛑.

## 7 · Warranties + limitations

Author warrants that:

- Every fact submitted is, to the best of Author's professional knowledge, technically accurate and regulation-current at time of submission.
- Every regulatory citation is verified against a named source.
- No submitted content constitutes regulated professional advice (e.g. Building Control determinations, structural sign-offs) — Brain content is guidance-grade and merchants + homeowners are directed to competent professionals for regulated determinations, per ADR-0017 §4 boundaries.

Author does NOT warrant fitness of the Brain for any specific merchant use case. The advisory panel and Nex own that assessment.

Liability cap: 🛑 `«Total cap on Author liability = 100% of honoraria received under this contract, excluding wilful misconduct»` — Legal to confirm.

## 8 · Merchant advisory panel + published attribution

Author consents to their name, trade, and headline certification being published on every merchant-facing Brain surface per ADR-0017 §4. This is a hard requirement of the Author role and cannot be waived.

Author consents to their name being visible to the Merchant Advisory Panel and the wider Nex team.

Author may withhold contact details (email, phone) from public display. Nex will surface only the professional attribution string.

## 9 · Term + termination

Term: `«2 years»` initial, then rolling `«12-month»` renewals unless terminated with `«90 days»` written notice.

Grounds for immediate termination:

- Author breach of confidentiality per §6
- Author submits fabricated content contrary to §7
- Author's certification is revoked or suspended
- Nex ceases operation of the Brain product line

On termination:

- Author's completed and paid-for content REMAINS Nex property (work-for-hire vested)
- Author's attribution on published content REMAINS (per ADR-0017 §4 — attribution survives termination)
- Retainer prorated to date of termination
- Uncompleted milestones fall away — no penalty on Author for early termination, no further payment from Nex

Successor authoring: on termination, Nex may commission a successor Author. Original Author's attribution is preserved on all content authored under this contract; successor's attribution overlays only on modules they subsequently amend.

## 10 · Nex commitments to Author

Nex commits to:

- Provide the Author Tooling (per `TRADE_BRAIN_AUTHOR_TOOLING_SPEC.md`) at no cost to Author.
- Provide onboarding + training per Recruitment Package §7.
- Make the Advisory Panel available for module review at agreed milestones.
- Preserve Author attribution across every version of the Brain.
- Pay milestones within 30 days of acceptance.
- Not amend Brain content without Author consent, EXCEPT (a) minor typographic corrections and (b) urgent safety corrections flagged by Nex where Author is unavailable — Author is notified within 48 hours in that case.

## 11 · Dispute resolution

🛑 `«Escalation → CTO / Product Lead → mediation → arbitration»` — Legal to select forum + rules.

## 12 · Independent status

Author is engaged as an independent contractor and is not an employee, worker, or agent of Nex. Author is responsible for their own tax, NIC, insurance (public liability + professional indemnity where trade requires), and pension arrangements.

🛑 Legal Counsel to confirm IR35 posture is clear in Nex's jurisdiction.

---

## Signatures

**For Nex**

Name: `«NEX SIGNATORY NAME»`
Title: `«NEX SIGNATORY TITLE»`
Signature: _______________________
Date: `«DATE»`

**Author**

Name: `«AUTHOR LEGAL NAME»`
Certification: `«PRIMARY CERTIFICATION + NUMBER»`
Signature: _______________________
Date: `«DATE»`

---

## Legal Counsel Review Checklist

Every deployment of this template MUST have Legal Counsel confirm:

- [ ] §1-§2 scope + deliverables — enforceability of milestone acceptance
- [ ] §3 compensation — VAT, tax, invoice terms consistent with jurisdiction
- [ ] §4 IP — work-for-hire assignment enforceable; attribution right survives termination
- [ ] §5 Learning Loop — quarterly review obligation phrased as consideration for retainer
- [ ] §6 confidentiality — scope + duration reasonable + enforceable
- [ ] §7 warranties — Author warranty scope not overreach; liability cap enforceable
- [ ] §8 attribution — Data-Protection consent covers public display of Author name
- [ ] §9 termination — notice period + post-termination rights are mutual
- [ ] §11 dispute — appropriate forum for £8k-£15k contract value
- [ ] §12 independent status — IR35 or equivalent posture confirmed

**Until Legal has ticked every box above, do not use this template with a live Author.**

---

**End of Trade Brain Author Contract Template V0.**
