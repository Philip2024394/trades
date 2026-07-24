# Trade Brain Author Tooling · Specification v1.0

**Editing tool spec · 2026-07-23**
**Purpose:** Trade Brain Authors are contracted master tradespeople, not developers. They need a purpose-built tool to author JSON packs against the ADR-0017 schema without touching git, IDEs, or engineering workflows.

**Related:** ADR-0017 (Trade Brain Contract) · Trade Brain Author Recruitment Package · ES-05 (Scenario suites are part of Brain authoring).

**Objective:** an Author can author a full Brain V1 (6 modules) using this tool without engineering assistance.

---

## Section 1 · User Profile

Trade Brain Authors:

- 15+ years hands-on trade experience
- Digital literacy: comfortable with modern web apps (email · Word · basic spreadsheet)
- **Not developers** — must never see JSON, TypeScript, or git
- **Time-constrained** — often authoring in evenings/weekends around trade work
- **Named public authors** — professional reputation depends on output quality

Design implication: authoring UX must match a well-crafted content editor (Notion · Airtable) rather than a developer tool.

---

## Section 2 · Core Capabilities

### 2.1 Structured content editor

- Form-based editing of every Brain module
- No raw JSON exposure (system generates JSON behind the scenes)
- Schema validation live (author sees what's required)
- Field-level help text explaining what belongs where

### 2.2 Live pack preview

- "Merchant preview" mode: Author sees what a merchant would see when consulting the Brain
- Preview per merchant persona (Cardiff plumber · London electrician · etc.)
- Real regional context loaded

### 2.3 Correction inbox

- Author sees merchant corrections queued for review
- Weekly digest email (default) or realtime for high-severity
- One-click accept · reject · defer
- Reject requires rationale (for merchant + audit)

### 2.4 Regulation currency tracking

- Author dashboard shows regulations currently cited
- Alerts when regulation body publishes an update relevant to Brain content
- One-click to review Brain sections potentially affected

### 2.5 Version control (invisible to Author)

- Every save creates a version
- Author sees "Version 1.3 · last edited Wednesday" not git SHAs
- Rollback available via UI
- Diff view shows what changed since last version
- Publishing a new version triggers advisory panel review workflow

### 2.6 Access control

- Each Author sees only their own Brain(s)
- Nex admin can view all Brains (audit + support)
- Merchants read Brain content · never edit

---

## Section 3 · Editor Surfaces per Module

Six V1 modules per ADR-0017. Each has purpose-built UI.

### 3.1 Craft module editor

**Purpose:** techniques, sequences, terminology.

**Editor UI:**
- Rich-text sections with headings
- Named entities highlighted (materials · tools · standards)
- Cross-references to other modules validated
- Evidence citation required per section (source URL or expert claim)

**Author output feels like:** writing a trade textbook chapter.

### 3.2 Regulations module editor

**Purpose:** region-scoped official cites.

**Editor UI:**
- Per-country fanout (starts with UK · IE + AU as V2)
- Structured citation entry (regulation body · document ID · section · summary · effective date)
- Auto-link to public regulator source
- Sunset date per citation (regulations expire)

**Author output feels like:** filling a professional citation database.

### 3.3 Materials module editor

**Purpose:** species · grades · pack sizes · defect risk per SKU.

**Editor UI:**
- Table view with columns for common attributes
- Category tree (e.g. Electrician: cables · consumer units · fittings · lighting · etc.)
- Alternative materials linked
- Regional supplier preferences noted

**Author output feels like:** managing a structured trade product catalog.

### 3.4 Workflow module editor

**Purpose:** standard sequences for common jobs.

**Editor UI:**
- Job type as top-level entity (e.g. "Bathroom refit · first fix")
- Ordered sequence of steps
- Per-step: description · duration · resources · prerequisites · outputs
- Decision points supported (if/then branching)
- Checkpoints marked (verifiable stages)

**Author output feels like:** authoring a construction methodology guide.

### 3.5 Defects module editor

**Purpose:** common faults · causes · fixes.

**Editor UI:**
- Defect catalog entries
- Per-defect: symptoms · likely causes · diagnostic steps · remediation
- Photo attachment supported (Author can upload reference images)
- Severity flag (safety-critical · quality-critical · cosmetic)

**Author output feels like:** a structured trade troubleshooting manual.

### 3.6 Pricing model editor

**Purpose:** unit rates · regional multipliers.

**Editor UI:**
- Base rate per unit (labour hours · materials cost · installation cost)
- Regional multiplier table (London · SE England · rest of UK · etc.)
- Complexity factors (tight access +15% · listed building +25%)
- Currency: GBP default · other currencies for future regional Brains

**Author output feels like:** authoring a professional estimating rate card.

---

## Section 4 · Scenario Suite Editor

Per ES-05 §5, every Brain V1 ships with 100+ author-authored scenarios.

### 4.1 Scenario editor UI

- List view of scenarios grouped by category (golden path · edge case · adversarial)
- Per scenario:
  - Question text
  - Expected answer text (Author authoritative)
  - Allowable variation (facts that must appear · phrasing that can vary)
  - Regional context
  - Complexity level
  - Trade sub-specialisation
- Author authors scenarios during Brain authoring (not after)
- Advisory panel reviews scenarios before V0 signoff

### 4.2 Scenario validation

- Every scenario tested during authoring — Author sees Brain output vs expected
- Divergences highlighted
- Author refines Brain content OR scenario expectations
- Iteration is visible

---

## Section 5 · Technical Architecture

### 5.1 Stack

- Next.js app hosted at `authors.thenetworkers.app`
- Supabase Auth for Author identity
- Author-scoped RLS on Brain content tables (Authors see only their Brains)
- Real-time collaboration via Supabase Realtime (multi-author on same Brain in future)
- Auto-save on every field change (debounced 2s)

### 5.2 Data model

Brain content stored in structured tables not raw JSON files:

```sql
hammerex_nex_brain_content (
  id UUID PRIMARY KEY,
  brain_slug TEXT NOT NULL,
  module TEXT NOT NULL,           -- 'craft' | 'regulations' | 'materials' | ...
  section_id TEXT NOT NULL,
  content JSONB NOT NULL,
  evidence JSONB,
  authored_by UUID REFERENCES auth.users(id),
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

Runtime loader reads from tables · caches into JSON pack format for consumption.

### 5.3 JSON pack export

- Weekly cron generates JSON packs from tables
- Packs written to `src/lib/nex/brains/<slug>/` in git via automated PR
- Engineer review before PR merge
- Version-tagged in git

This gives Authors a table-based UX with git as durable versioned truth.

### 5.4 Preview environment

- Author preview uses staging Nex environment
- Author's in-progress Brain loaded via feature flag
- Real Chat V2 · Estimator · etc. surfaces available

### 5.5 Publish flow

1. Author completes module in editor
2. Author clicks "Preview as merchant"
3. Author validates scenarios (green checks)
4. Author clicks "Submit for review"
5. Advisory panel reviews (3-5 members)
6. Advisory panel signs off OR requests changes
7. Nex admin promotes version to production
8. Merchant sees new Brain version within 24 hours

---

## Section 6 · Correction Inbox

### 6.1 UI

- Inbox view of pending corrections
- Filterable by module · severity · merchant tier · region
- Per correction: original Brain content · merchant's correction · merchant's reason · related conversation

### 6.2 Author actions

- **Accept** — Brain content updated · new version proposed · goes through publish flow
- **Reject** — correction filed with Author rationale · merchant sees rationale
- **Defer** — Author needs more info · asks Nex admin to reach out to merchant
- **Bulk resolve** — for common cases (e.g. regional slang not yet in vocabulary)

### 6.3 Weekly cadence

- Author receives digest email every Monday
- Target: <5 pending corrections at any time
- Alert if >15 pending after 2 weeks (Author bandwidth issue · Nex engages)

### 6.4 Correction accuracy tracking

- Author accept rate tracked (accepted / total received)
- Low accept rate (<20%) may indicate Brain quality issue OR overzealous corrections
- Reviewed quarterly with Author

---

## Section 7 · Regulation Currency Dashboard

### 7.1 What's tracked

- Every regulation cited by the Brain
- Publication date + effective date + last-reviewed date
- Regulator body monitored via feed (where available) or manual check schedule

### 7.2 Alerts

- Regulation body publishes update → Author notified within 48 hours
- Author sees which Brain sections may be affected
- Author reviews · updates · triggers new version

### 7.3 Author quarterly regulation review

- Author confirms all Brain regulations still current
- Documented review timestamp
- Retainer payment gate

---

## Section 8 · Access Control + Attribution

### 8.1 Author account setup

- Nex admin creates account with role `trade_brain_author`
- Author assigned to specific Brain(s)
- Author cannot access other Authors' Brains
- Author cannot see merchant PII (correction context masks it)

### 8.2 Public attribution

Every Brain surface shows:

> **Electrician Brain** · authored by [Author Name] · [credentials] · last reviewed [date]

Author name links to a public bio page (Author-provided content).

### 8.3 Author retirement

Per Trade Brain Author Recruitment Package §8:
- Author gives 6-month notice
- Successor Author identified · onboarded
- Original Author's attribution preserved on their sections
- Historical versions credit original Author

---

## Section 9 · Development Estimate

Per ES-01 modular monolith:

- Editor surface (React app under authors subdomain): 4 weeks
- Structured content database schema + migrations: 1 week
- Preview environment integration: 2 weeks
- Correction inbox: 2 weeks
- Regulation currency tracking: 2 weeks
- Scenario suite editor: 2 weeks
- Publish flow + PR automation: 2 weeks
- Testing + Author user testing: 2 weeks

**Total: ~17 engineer-weeks · 3 engineers parallelised over Phase 0 Week 3-8**

Priority delivery order:
1. Week 3-4: MVP editor for Craft + Regulations modules (Electrician Author begins authoring in parallel with build)
2. Week 5-6: Materials + Workflow + Defects modules
3. Week 7-8: Pricing model + Correction inbox + Preview environment
4. Week 9+: Scenario suite + Regulation currency + Publish flow

**Blocking:** editor MVP must be ready when first Author begins authoring (target Week 5-6).

---

## Section 10 · Author Onboarding

Once tool is ready:

### Day 1

- Nex Product Lead + first Author screen share
- Walk through tool features
- Author creates first module section
- Address blockers

### Day 2-3

- Author works independently
- Nex engineer on-call for issues
- Feedback captured

### Week 1 Retrospective

- What worked
- What blocked
- Tool iteration prioritised

---

## Section 11 · Success Criteria

For Author tooling V1:

- [ ] Author can complete a full module in <8 hours of authoring
- [ ] Author never sees JSON or code
- [ ] Author never touches git
- [ ] Preview environment matches production behaviour
- [ ] Correction inbox weekly digest arrives on Monday morning
- [ ] Regulation currency alerts within 48 hours of publication
- [ ] Advisory panel review workflow < 5 business days per Brain version

---

## Dependencies

- **Blocks:** Trade Brain V0 authoring at scale · Author productivity · Brain V1 delivery timeline
- **Blocked by:** Author input on V0 features (Week 3 workshop) · ADR-0017 accepted
- **Related:** ADR-0017 (Trade Brain Contract) · Trade Brain Author Recruitment Package

## Risks

- **Editor complexity** — mitigation: start with 2 modules (Craft + Regulations) · expand based on Author feedback
- **Preview environment drift from production** — mitigation: preview uses production Brain runtime · not simulation
- **Regulation feed availability** — mitigation: manual monitoring for regulator bodies without RSS · quarterly Author check
- **Author onboarding friction** — mitigation: pair Author with engineer for first day · 1:1 support Week 1

---

**End of Trade Brain Author Tooling Specification v1.0.**
