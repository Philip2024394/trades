# Staircase Author Application Intake Spec

**Draft V1 · 2026-07-24**
**Purpose:** the exact fields to collect from each applicant so review is consistent and portfolio evaluation is comparable. Also specifies the inbox + form setup.

---

## Inbox setup (do this Week 1)

- **Email address:** `authors@thenetworkers.app` — create as a monitored inbox (Gmail forwarding OK for V1 · Front / Help Scout / similar for scale later)
- **Auto-reply:** confirming receipt + link to the intake form (below) if they haven't already used it
- **Rota:** CEO + one delegate check inbox weekly during recruitment window

## Intake form (Google Form or Airtable — recommend Airtable for structured review)

### Section A — Identity + credentials
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Full name | Short text | Yes | |
| Email | Email | Yes | |
| Phone (UK) | Short text | Yes | For interview scheduling |
| Nearest city / region | Short text | Yes | UK region — for regional variance signal |
| Years hands-on staircase experience | Number | Yes | Must be ≥15 to progress |
| Certifications held | Long text | Yes | Free text — will verify against public registers |
| Current occupation | Short text | Yes | e.g. "self-employed joiner", "college instructor", "stair-shop foreman" |
| LinkedIn profile URL | URL | Optional | |
| Personal / business website | URL | Optional | |

### Section B — Trade authority
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Trade body membership | Multi-select | Yes | BWF · IOC · FMB · Guild of Master Craftsmen · CITB · other · none |
| Highest formal qualification | Short text | Yes | e.g. "City & Guilds Level 3 Bench Joinery 6706-33 · Distinction · 2003" |
| Areas of stair work experience | Multi-select | Yes | Options: bespoke joinery · volume manufacturing · installation · site fitting · repair / renovation · heritage / traditional · commercial · loft conversions · spiral / helical · glass balustrades · winders |
| Regulations knowledge (self-rated 1-5) | Scale | Yes | Approved Doc K · BS 5395 · Doc M · Doc B fire routes |
| Have you trained apprentices? | Yes/No + brief | Yes | If yes: how many, over what period |

### Section C — Authored work portfolio
Ask for 5 examples. Each with:
| Field | Type | Required |
|-------|------|----------|
| Piece title | Short text | Yes |
| Where published (magazine · blog · training material · book · internal) | Short text | Yes |
| Year | Number | Yes |
| URL or file upload | URL or attachment | Yes |
| Length (approx word count) | Number | Yes |
| Brief description | Long text (≤200 words) | Yes |

### Section D — References
Three references — 2 professional (past employer, senior colleague, or client) + 1 trade body:
| Field | Type | Required |
|-------|------|----------|
| Reference name | Short text | Yes |
| Relationship | Short text | Yes |
| Organisation | Short text | Yes |
| Email | Email | Yes |
| Phone | Short text | Optional |

### Section E — Fit and commitment
| Field | Type | Required |
|-------|------|----------|
| Why this role (300 words max) | Long text | Yes |
| What's the most misunderstood thing about staircase work in your experience? (300 words) | Long text | Yes | This is the strongest signal in early filter — depth of insight shows through |
| Willing to have your name publicly attached to every Brain answer? | Yes/No + brief | Yes |
| Willing to commit to 2 years minimum (V1 authoring + 8 quarterly reviews)? | Yes/No + brief | Yes |
| Anticipated V1 fee expectation (£) | Number | Yes | Sets negotiation frame; anywhere £6k-£20k acceptable at this stage |
| Available start date | Date | Yes |
| Anything else you'd want us to know | Long text | Optional |

### Section F — Consent + declarations
- [ ] I confirm all information above is accurate and can be independently verified
- [ ] I understand this role is contracted work-for-hire, not employment
- [ ] I understand my name and credentials will be publicly displayed on the Nex platform if hired
- [ ] I have no undisclosed commercial interest that would bias content toward any particular manufacturer or supplier
- [ ] I consent to Nex checking my references and verifying my credentials against public registers

## Automated triage (add to intake tool)

Reject with polite acknowledgement email when:
- Years hands-on <15
- Any Section F consent unchecked
- Fewer than 5 portfolio examples
- Fewer than 3 valid references

Shortlist to interview stage when:
- All non-negotiables met
- 3+ trade body memberships OR 1 IOC/BWF/Guild + strong portfolio
- Section E "misunderstood thing" answer shows genuine depth (subjective — read manually)

## Review cadence

- **Weekly** review of new applications during active recruitment window
- Batch shortlisted applicants for interview to test 3-5 candidates per interview week
- All applicants get a response within 14 days (yes/no/still-reviewing) — reputation matters, this role's audience is small and tight-knit

## Applicant tracker fields (Airtable base or similar)

Beyond the form fields above, add:
- **Status:** New · Under review · Shortlisted · Interview scheduled · Sample task sent · Sample task received · Offer stage · Signed · Rejected · Withdrew
- **Reviewer:** who owns triage
- **Interview date/time**
- **Sample task topic assigned**
- **Sample task received date**
- **Decision + rationale** (private notes)

## Retention of unsuccessful applicants

Unsuccessful V1 applicants should be tagged for V2 authoring wave (Y2). Some strong candidates may not win the founding-Author slot but be excellent for Bricklayer / Plumber sub-specialisations later, or for the Merchant Advisory Panel.

## Compliance notes (UK)

- Personal data collected: apply GDPR minimisation — retain application data for 12 months only unless applicant consents to longer retention (add tick box in Section F)
- Right of access: any applicant can request their submission back — plan for it
- Do not collect data you don't need (no DOB · no NI number at application stage · no gender/ethnicity — those come after hire only if lawful basis exists)
