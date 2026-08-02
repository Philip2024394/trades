# Installer Mindset + Terminology Brain + 5 Specialist Brain Proposals · Philip 2026-08-02

## Philip's architecture directive (verbatim · MOST IMPORTANT PART OF THIS DUMP)

> *"At this point, I would avoid making Universal QA much larger unless the content truly belongs there. Most new knowledge is likely to fit better into a specialist brain (Site Conditions, Manufacturing Tolerances, Commercial, or Risk), keeping routing more precise and reducing the chance of future regressions like the workflow interception issue you already solved."*

**Locked as immutable rule.** Going forward, new authored knowledge is routed into a specialist brain by default. Universal-QA additions are the exception, not the rule.

## Five new specialist brain proposals (Philip verbatim)

### 1. Site Conditions Brain (RECOMMENDED)
> *"Sometimes the staircase is correct and the building is wrong. That is extremely common in practice."*
Examples: floors not level · walls out of plumb · stairwell too small · concrete opening out of square · steel beam in wrong position · finished floor thickness changed · plaster thicker than surveyed · door moved · window changed · ceiling lowered · services in the way · existing staircase removed incorrectly.

### 2. Manufacturing Tolerances Brain
> *"Teach Nex that perfection has practical limits."*
Examples: timber moves with humidity · concrete rarely perfectly square · walls seldom perfectly straight · floors rarely perfectly level · glass has manufacturing tolerances · steel fabrication has tolerances · paint thickness changes dimensions · carpet changes finished floor level.
> *"One of the biggest mistakes AI systems make is assuming buildings are mathematically perfect."*

### 3. Project Lifecycle / Ownership Brain
Chain: Customer → Sales → Estimator → Surveyor → CAD Designer → Workshop Manager → Machinist → Bench Joiner → Finishing Department → Quality Control → Dispatch → Installer → Customer Handover.
Purpose: allow Nex to answer *"Whose responsibility is this problem?"* instead of only explaining what the problem is.

### 4. Manufacturing Risk Brain
High risk: wrong rise · wrong finished floor level · incorrect stairwell opening · incorrect handedness · incorrect string width · wrong glass measurements.
Medium risk: timber colour variation · minor wall movement · delivery damage.
Low risk: packaging labels · cleaning · documentation.
Purpose: allow Nex to prioritise faults instead of treating every issue equally.

### 5. Commercial Brain
Topics: why deposits are taken · why design approval is required · why manufacturing cannot start without signed drawings · why customer changes after approval increase costs · why bespoke staircases are difficult to cancel once production starts · why glass is often ordered after approval · why installers need confirmed access dates.
Purpose: make Nex stronger when talking to customers rather than only tradespeople.

## Philip's mature architecture summary (verbatim)

```
Conversation Brain (planned)
    ↓
Workflow Brain
    ↓
Vision Brain
    ↓
Site Conditions Brain (recommended)
    ↓
Installation Brain
    ↓
Component Brain
    ↓
Materials Brain
    ↓
Family Brain
    ↓
Universal Knowledge
```

## Content authored in this dump

- **Solo installer content** (BRAIN 1001-1010) — can one person build a staircase, traditional makers, when a second person helps, glass handling, curved stairs, concrete overlays, safety before ego
- **Installer preferences** (BRAIN 1011-1020) — why many prefer working alone, one decision-maker, no universal sequence, experience reduces mistakes, apprentice model, planning saves time, most time is thinking not fixing, know when to ask for help, best installations look easy, small companies can produce exceptional work
- **Experienced installer mindset** (BRAIN 1021-1030) — test-fit in the mind, never fix yourself into a corner, building has final say, measure twice fix once, follow the load path, work to a reference, don't chase small errors, know when to stop, confidence vs complacency, invisible professionalism
- **Professional installer mindset** (BRAIN 1031-1040) — drawings are a guide not the building, installer is the last engineer, protect immediately, new houses move, not every creak is a defect, every staircase is bespoke, pattern recognition, experience cannot be read in a book, customers buy confidence, good installation is invisible

## Terminology Brain (rich content · destination options)

Key distinctions:
- **Stair** = singular (individual step, or architectural term for one flight/enclosure)
- **Stairs** = customer everyday word — usually means the complete staircase
- **Staircase** = the complete assembled system
- **Flight** = one uninterrupted run of steps between landings
- **Shell** = manufacturing section (multiple shells = one staircase)
- **Stairwell** = the space in the building (not the staircase)
- **Stair opening** = the structural hole through the floor
- **Stair core** = commercial protected structural area
- **Stair enclosure** = walls surrounding the staircase
- **Step vs Tread** — step = walking position (tread + rise), tread = the horizontal surface only
- **Rise vs Riser** — rise = vertical measurement, riser = the vertical board on closed-riser stairs

## How different people speak (verbatim table)

| Person | Typical Term |
|---|---|
| Customer | Stairs |
| Joiner | Staircase |
| Installer | Flight |
| Factory | Shell / Flight |
| Architect | Stair |
| Building Inspector | Staircase or protected stair |
| Quantity Surveyor | Stair package |
| Site Manager | Stair install |

## Nex language rule (verbatim from Philip)

> *"Nex should understand context before terminology. If someone says 'my stairs squeak', Nex understands the staircase has movement or noise — not multiple individual steps. If someone says 'flight two isn't level', Nex understands the second run of the staircase — not a separate staircase."*
>
> *"In everyday conversation, there is no need to correct people's terminology. If someone asks 'Can you quote for my oak stairs?', a good staircase professional understands they are asking about their staircase. Nex should mirror the customer's language while still understanding the technical distinction internally."*

## Deferred to future (per validate-first + stop-enlarging-universal)

Terminology Brain as a dedicated specialist brain file is DEFERRED. This cycle: only the essential customer-language interpretation anchors ship (~10 in universal) + the "Mirror customer language" immutable rule. Full Terminology Brain awaits authorization once specialist-brain routing pattern is chosen.
