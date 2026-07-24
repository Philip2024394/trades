# Phase 29 — Nex Digital Construction Twin

**Blueprint · 2026-07-23**
**Status:** Design document. Not yet built. Composes Phase 6 (`pi/`), Phase 13 (`cv/`), Phase 16 (`cc/` construction cloud), Phase 23 (`twin/` scenario engine), Phase 24 (mesh + Phase 27 Brains), Phase 25 (`bos/`), Phase 26 (`memory/`), SiteBook.

---

## Executive Summary

Phase 23 shipped a scenario simulator called `twin/` — what-if math (fuel up 20%, hire another carpenter, buy a van). Useful, but bounded to hypotheticals. Phase 29 is a different animal: a **persistent, continuously-updated digital replica of every real project** on the platform, from the moment it's estimated through decades of maintenance and future renovations.

The Digital Construction Twin is not a 3D model viewer. Autodesk, Bentley, Buildots and OpenSpace already ship those. The Twin is the **single source of truth for a construction project's state, decisions, and outcomes over its lifetime**, layered from:

- Structured project state (Phase 6 PI + Phase 16 CC)
- Vision-derived observations (Phase 13 CV, continuously fed)
- Trade-Brain perspective (Phase 27 — each Brain sees the project through its own specialist lens)
- Merchant + homeowner narrative (SiteBook)
- Predictive intelligence (Phase 25 BOS + Phase 23 twin scenarios)
- Cross-tenant learning (Phase 26 memory, K-anonymised)

The strategic result is that after a project completes, its Twin does not archive. It stays living. Homeowners re-open the Twin 15 years later for a bathroom retrofit and Nex knows the pipework layout, cavity insulation depth, joist span, boiler serial. When any trade returns to that house, they inherit the Twin's memory of who did what, why. This turns Nex into the **permanent digital record of the built environment**, not just a project tool.

The moat is the same as prior phases, taken to its logical conclusion: composition depth × time. A competitor cannot conjure a decade of living Twins. Every day Nex runs, the Twins get denser.

---

## 1. Digital Twin Architecture

### 1.1 The layered stack

```
┌────────────────────────────────────────────────────────────────────┐
│  Presentation                                                      │
│  · Homeowner portal   (SiteBook)                                   │
│  · Merchant workspace (Studio + project view)                       │
│  · Trade Brain view   (per-Brain project perspective)               │
│  · Public-good view   (aggregated, K-anonymised)                    │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────┐
│  Twin Runtime (Phase 29 new)                                       │
│  · State reducer        · Timeline replay                          │
│  · Perspective engine   · Predictive engine                        │
│  · Vision reconciler    · Cross-project pattern lender             │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────┐
│  Event Bus (Phase 29 new)                                          │
│  Every state change is a typed event. Twin is derived, not stored. │
└─────────┬──────────┬──────────┬──────────┬──────────┬──────────────┘
          │          │          │          │          │
    ┌─────▼───┐  ┌───▼────┐  ┌──▼─────┐  ┌─▼──────┐  ┌▼──────────┐
    │Phase 6  │  │Phase 13│  │Phase 26│  │Phase 27│  │Phase 25    │
    │PI + CC  │  │CV      │  │Memory  │  │Brains  │  │BOS         │
    │project  │  │vision  │  │writes  │  │trade   │  │risk        │
    │state    │  │events  │  │+ reads │  │views   │  │scoring     │
    └─────────┘  └────────┘  └────────┘  └────────┘  └────────────┘
```

### 1.2 Event-sourced, never mutated

The Twin's state is **not stored in a mutable row**. Every event (photo added, cost recorded, invoice sent, delivery received, snag opened, weather observation, sensor reading) writes to an append-only event log. The Twin at any moment in time is a **reduction** of the log up to that moment.

This unlocks four capabilities competitors don't ship:

1. **Time travel** — replay the Twin at any prior date without a "history table" hack
2. **Correction transparency** — any change is a new event; nothing is silently rewritten
3. **Perspective folding** — the same log reduces differently for the Plumber Brain vs. Homeowner vs. Insurer
4. **Cross-project pattern lending** — patterns in one Twin's log translate cleanly to another Twin's context

### 1.3 The pipeline

```
Project created (est → memory writes id)
     │
     ▼
AI creates initial Twin  ← seeded from estimate + Trade Brain scope + region context
     │
     ▼
Estimates imported       ← Phase 28 output attached
     │
     ▼
Drawings + BIM linked    ← Phase 13 CV drawing mode + external BIM ingest
     │
     ▼
Trade Brains connected   ← Phase 27; each Brain declares interest, opens a perspective
     │
     ▼
Schedule connected       ← from Phase 24 mesh dependency graph
     │
     ▼
Labour tracking          ← time entries + SiteBook check-ins
     │
     ▼
Material tracking        ← Phase 17 MP deliveries + inventory pulls
     │
     ▼
Photo / video updates    ← SiteBook + Phase 13 CV reconciler
     │
     ▼
Drone / 360° capture     ← optional; see §12
     │
     ▼
Financial tracking       ← Phase 10 FI + costs recorded
     │
     ▼
Live risk monitoring     ← Phase 25 BOS running per-event
     │
     ▼
Predictive analysis      ← Phase 23 twin scenarios projected on live state
     │
     ▼
Handover                 ← digital handover pack generated
     │
     ▼
LIVING RECORD            ← Twin persists for life of the building
```

### 1.4 What Phase 29 does NOT do

- **Does not** re-implement BIM authoring. External BIM (Revit, IFC, ArchiCAD) ingests via IFC 4.3 files or Autodesk Forge / Bentley iModel APIs.
- **Does not** re-implement CAD viewers. Existing Autodesk Forge Viewer / Bentley iTwin.js embed for 3D display.
- **Does not** re-implement scheduling engine. Uses the Phase 24 mesh graph + Phase 25 scheduling agent.
- **Does not** replace SiteBook. SiteBook is the merchant + homeowner-facing surface; Twin is the substrate.

Composition, not reinvention.

---

## 2. Twin Components (the data model)

### 2.1 Twenty typed component layers

Each project Twin has these layers. Layers are optional — a Twin declares what it uses. Missing layers are honest omissions.

| Layer                | What lives here                                                | Owning engine                    |
| -------------------- | -------------------------------------------------------------- | -------------------------------- |
| Project overview     | Name, address, party names, dates, status                       | Phase 6 PI                       |
| Site location        | Lat/long, region, climate zone, soil hints                      | Phase 20 world                   |
| Building information | Age, type, listed status, floor area, storeys                    | Phase 16 CC                      |
| Structural           | Foundation, walls, beams, load-path notes                       | Structural Brain (Phase 27)      |
| Architectural        | Room schedule, elevations, finish schedule                       | Architect Brain                  |
| Mechanical           | HVAC, ductwork, plant                                            | HVAC Brain                       |
| Electrical           | Consumer unit, circuits, points, certification                    | Electrician Brain                |
| Plumbing             | Hot/cold, waste, boilers, pressure, isolators                    | Plumber Brain                    |
| Fire protection      | Alarms, compartmentation, emergency lighting, sprinklers          | Fire Safety Brain (Phase 27)     |
| Roof                 | Pitch, covering, insulation, flashings, gutters                   | Roofer Brain                     |
| Interior finishes    | Wall/floor/ceiling by room                                       | Multiple Brains                  |
| External works       | Driveways, patios, drainage, boundaries                          | Groundworker + Landscaper Brains |
| Utilities            | Gas + water + electricity + telecoms meter locations              | Utilities registry               |
| Landscaping          | Planting, hardscape, irrigation                                   | Landscaper Brain                 |
| Temporary works      | Scaffolding, propping, protective screens                        | Scaffolder Brain                 |
| Plant + equipment    | On-site plant (owned + hired), status, GPS                       | Fleet Agent (Phase 24)           |
| Health + safety      | RAMS, permits-to-work, incident log                               | H&S agent                        |
| Quality inspections  | Sign-offs by stage, Building Control notes                        | Building Control Brain           |
| Documents            | Every drawing, spec, RFI, variation, invoice                     | Document store                   |
| Progress captures    | Photos, videos, drone, LiDAR (see §12)                            | SiteBook + Phase 13 CV           |
| Daily site logs      | SiteBook diary entries                                            | SiteBook                         |
| Weather history      | Local observed weather per day (from weather API)                | Weather feed                     |
| Supplier deliveries  | Every delivery, on-time-yes/no, defect-yes/no                     | Phase 26 memory + Phase 17 MP    |
| Financial records    | Every cost + invoice + payment                                    | Phase 10 FI                      |
| Maintenance          | Post-handover events (service, callback, upgrade)                | Maintenance registry (new)       |

### 2.2 Every component carries evidence + confidence

Same envelope as the Phase 26 Memory Engine — subject / predicate / value / evidence_tables / confidence / observed_at / decays_at / correction_of. This means Twin state is queryable, correctable, and trustworthy.

### 2.3 Storage decision

- **Events** — `hammerex_nex_twin_events` (append-only)
- **Reduced state snapshots** — cached weekly for fast reads; rebuilt from events on demand
- **BIM binary blobs** — stored in Supabase Storage; only URIs enter the event log
- **Photos/videos** — same

Never store derived state as source of truth. The log is truth.

---

## 3. AI Project Understanding

### 3.1 The Vision Reconciler

Every photo uploaded runs through a **Vision Reconciler** that:

1. **Analyses** via Phase 13 CV (`analyzeConstructionImage`)
2. **Diffs** against the Twin's current state — "brickwork was at 40% last week; this photo shows 65%; +25% progression"
3. **Cross-checks** against expected sequence from the Trade Brains — is this progression consistent with the plan?
4. **Emits events** — `progress.brickwork.pct = 65`, `quality.brickwork.perp_lines_flag = ok`, etc.
5. **Flags anomalies** — "roof underlay laid before flashing reverses expected sequence; verify"

The Reconciler never silently updates the Twin. Every event it emits carries `source: "vision_reconciler"` and `confidence: <derived>`. Merchant or homeowner sees them for approval on medium-confidence and above; low-confidence are logged for review.

### 3.2 Cross-Brain perspective

The same photo triggers multiple Trade Brain interpretations. A photo of a bathroom mid-second-fix triggers:

- Plumber Brain notices trap orientation, isolator location, pressure test caveats
- Electrician Brain notices Zone 1 fitting, socket height, extract fan wiring
- Tiler Brain notices substrate state, water-proofing membrane presence, tile edge protection
- H&S Brain notices working-at-height signals, dust extraction, PPE

Each Brain emits its own events into the log tagged with its `agent_id`. Merchant sees a unified reply through the mesh voice unifier (Phase 24), but the log preserves per-Brain provenance.

### 3.3 Anomaly detection

Trade Brains encode expected states per stage. A dev-mode "should-be" checklist compares what Vision sees to what should be visible. Two classes of anomaly:

- **Missing** — expected object not present. "Bathroom second-fix scheduled complete; extract fan not visible in ceiling."
- **Unexpected** — object present but out of sequence. "Skirting installed before wall paint second coat; will need overpaint."

Anomalies raise events that the Predictive Engine (see §5) weighs against the schedule + budget.

---

## 4. Real-Time Construction Intelligence

### 4.1 The Live Project Intelligence Dashboard

Twelve tiles. Each tile is a projection over the event log; each tile is a live subscription that re-renders on relevant events.

| Tile                     | Data                                                          | Source                                      |
| ------------------------ | ------------------------------------------------------------- | ------------------------------------------- |
| Progress                 | Overall + per-stage percent                                   | Vision reconciler + trade Brain checklists  |
| Labour utilisation       | Booked hrs vs planned hrs today                                | Phase 24 workforce agent + SiteBook check-ins |
| Material usage           | Received / installed / remaining                              | Phase 17 MP + Vision                        |
| Equipment status         | On-site plant, GPS status, next service due                    | Fleet agent                                 |
| Site safety              | Open incidents, permits, PPE observations from Vision           | H&S agent + Vision                          |
| Weather impact           | Today's weather × trade weather-sensitivity                    | Weather feed + Brain rules                  |
| Budget performance       | Actual vs estimated per line                                   | Phase 10 FI                                 |
| Programme delays         | Critical-path variance                                        | Phase 24 mesh graph                         |
| Supplier delays          | Delivery ETA vs promised                                       | Phase 26 memory + Phase 17 MP               |
| Quality risks            | Open snag list + defect probability from Vision                 | Phase 27 defect libraries                   |
| Cash flow                | Twin-scoped 30/60/90 day inflow-vs-outflow                     | Phase 10 FI + Phase 25 BOS                  |
| Customer variations      | Requested variations pending approval                          | SiteBook + Phase 8 CX                       |

### 4.2 Event feed

Underneath the tiles, a chronological event feed shows every state change with its source. Merchants scroll it like a Slack channel of their project. Filter by trade, source, severity.

### 4.3 Push notifications

Events with `severity >= warning` raise a push to the merchant (browser + optional email/SMS). Never SMS on info-level; the notification budget is precious.

---

## 5. Predictive AI

### 5.1 The Prediction Engine

Reuses Phase 25 BOS `predictRisks()` scoring plus Phase 23 twin scenario math, running continuously on the Twin's live state. Ten prediction classes:

| Prediction                | How derived                                                              | Confidence source                            |
| ------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| Project delay             | Progress rate × remaining scope vs scheduled_end                          | Rate stability × sample size                 |
| Budget overrun            | Actual-to-estimate delta trend × remaining budget                          | Trend fit R²                                 |
| Material shortage         | Delivery ETA distribution × critical path                                 | Supplier on-time-pct memory                  |
| Labour shortage           | Booked vs planned hrs × trade availability rollup                          | Memory sample size                           |
| Cash flow issue           | Milestone timing × customer payment behaviour (Phase 8 CX)                | Customer payment sample size                 |
| Weather disruption        | Local weather forecast × trade weather-sensitivity rules                   | Forecast horizon × Brain rule confidence     |
| Safety risk               | Open permit gaps + Vision-flagged PPE misses + injury-cause memory patterns | Cross-tenant rollup                          |
| Equipment failure         | Plant service-interval overrun × age × usage rate                          | Manufacturer data + memory                   |
| Customer dispute          | Variation velocity + payment lag + review-tone drift (Phase 8 CX)          | Historical dispute correlations              |
| Warranty risk             | Component × known-defect memory + install-quality Vision score              | Cross-tenant memory                          |

### 5.2 Every prediction is a probability + expected impact + suggested action

The BOS engine already produces this shape (`RiskSignal`). The Twin surfaces it live per project. Predictions decay when the underlying signal changes; they don't stale silently.

### 5.3 Cross-project pattern lending

The most valuable prediction upgrade: when a new project's Twin resembles a completed project's Twin (same trade mix, similar scope, similar region), pattern-lend the completed project's outcome history to the new project's predictions.

Example: "This kitchen fit's Twin resembles 8 completed Twins from your region. Median actual vs estimated delta: +6.2 days, +£1,850. Applied as calibration."

This is a memory-recall × K-anonymised regional rollup composition. Nothing fabricated.

### 5.4 Getting smarter over time

Prediction accuracy is itself memorised. Each predicted-vs-actual pair emits a `prediction.accuracy.<class>` memory row. The engine's confidence in a prediction class scales with its historical accuracy for that merchant, region, and scope shape. Bad prediction classes get quietly demoted.

---

## 6. Construction Timeline (the permanent record)

### 6.1 The timeline surface

Merchants and homeowners see the Twin as a scrubbable timeline. Every event is a node. Filter by:

- Trade (see only what the electrician did)
- Kind (see only deliveries; see only variations)
- Severity (only warnings + critical)
- Layer (only structural events)
- Person (everything Sam Smith did)

### 6.2 Time-travel

Any prior date reconstructs the Twin exactly. "Show me the project on 14 March at end of day" gives the state after that day's events, no more. This is because the log is the source of truth (§1.2).

### 6.3 Handover pack

At project completion the Twin generates a **digital handover pack**:

- Every drawing revision (final versions)
- Every certificate (electrical, gas, F-gas, EPC)
- Every warranty (product + workmanship)
- Every photo (indexed by room/stage)
- Every material spec (as-installed)
- Every serial number Vision extracted (§8.7 of Phase 28 blueprint)
- Every regulation cite the Twin encountered

Handover is a downloadable PDF + a live URL. The live URL keeps updating for the building's life. A homeowner selling their home in 2036 hands the new owner the URL; the Twin is transferable.

### 6.4 Post-completion events

After handover, events still enter the log:

- Boiler service — records date, engineer, findings
- Callback — quality events with cost + resolution
- Renovation — new sub-project spun up as a child Twin sharing the building
- Sale — ownership event with new party

The Twin ages with the building.

---

## 7. Multi-Trade Collaboration

Every Phase 27 Trade Brain gets a **project perspective**. Same log, different reduction.

- **Builder perspective** — full sequence + risk map + budget vs actual
- **Plumber perspective** — plumbing layer events + quality checks + isolators visible
- **Electrician perspective** — electrical layer + certification status + points count
- **Roofer perspective** — roof layer + weather history + warranty triggers
- **Steel Fabricator perspective** — structural steel schedule + connection details + installation photos
- **Surveyor perspective** — measurement events + drawing revisions + sign-offs
- **Architect perspective** — design intent + variations + drawing revisions
- **Site Manager perspective** — full dashboard, all trades, blocking issues
- **Project Owner perspective** — homeowner view (see §8)

Perspectives are computed views over the log, not duplicated data. Adding a new perspective is a query addition, not a schema migration.

---

## 8. Customer Experience

### 8.1 The homeowner portal

The customer opens their project. They see, in order:

1. **Today** — one card: "Today the electricians are here. Sockets in kitchen going in."
2. **Progress** — visual timeline. Green ticks past; blue diamond today; grey future.
3. **Photos** — grouped by day; scrubbing gives a room-by-room progression view
4. **Upcoming work** — next 7 days by trade
5. **Payments** — milestone schedule, paid + due
6. **Changes** — pending variations, with approve/decline buttons
7. **Approvals** — decisions Nex needs before proceeding (finish choices, timing)
8. **Documents** — final drawings, certificates, warranties (grows as project progresses)
9. **Warranty** — post-handover; shows what's covered until when
10. **Maintenance advice** — Trade-Brain-authored per component
11. **Future upgrades** — suggested when memory shows patterns (e.g., "solar readiness noted; here's what the retrofit would cost")

### 8.2 Homeowner voice

Customer-facing copy is Nex-voiced through the Phase 24 mesh — Northern UK, direct, brief, no jargon. Trade Brains authoritative when depth is needed; Nex explains it plainly.

### 8.3 Constitutional guardrail

Per the platform rules: **no voice AI on the customer purchasing path**. The customer portal accepts touch + written input only. Voice on the merchant side (walk-and-talk) is fine — customer side is text.

### 8.4 Sitebook integration

The customer portal IS the SiteBook homeowner surface (per memory notes: "homeowner-owned project workbook, /sitebook + /homeowners routes"). Twin plugs into SiteBook, not competes.

---

## 9. Digital Twin + SiteBook

SiteBook already exists (per memory). Phase 29 makes SiteBook the **live journal writer for the Twin**.

Every SiteBook event enters the Twin log:

| SiteBook event         | Twin log event                              |
| ---------------------- | ------------------------------------------- |
| Daily log entry        | `diary.entry.text`                          |
| Progress photo         | `progress.photo` → Vision reconciler        |
| Issue raised           | `quality.snag.open`                          |
| Delivery received      | `material.delivery` (matched to Phase 17 MP) |
| Weather noted          | `weather.observation`                       |
| Inspection             | `inspection.stage.<name>.pass/fail`         |
| Sign-off               | `inspection.stage.<name>.signed_off`        |
| Equipment on/off site  | `plant.movement`                            |
| Safety observation     | `safety.observation` (severity graded)      |

SiteBook is the merchant + homeowner-friendly UI. Twin is what makes SiteBook intelligent underneath.

---

## 10. Integration Across Nex

| Nex module          | Twin uses it for                                                        |
| ------------------- | ----------------------------------------------------------------------- |
| Global Nex Brain    | Voice unification across perspectives (Phase 24)                        |
| Trade Expert Brains | Per-Brain perspective + anomaly detection + defect libraries            |
| Memory Engine       | Cross-project pattern lending; calibration factors                       |
| Knowledge Graph     | Component→component relationships; adjacency lookups                    |
| AI Estimator (28)   | Initial Twin scaffolding at project creation                            |
| Studio              | Merchant workspace UI                                                   |
| CRM (Phase 8 cx)    | Customer interaction history; variation approvals                        |
| Marketplace         | Delivery + supplier events                                              |
| Trade Centre        | Post-handover product warranty registry                                 |
| Finance             | Every cost + invoice → live budget performance                          |
| Inventory           | Merchant-stocked materials pre-allocated to Twin                        |
| Scheduling          | Dependency graph fed to Twin timeline                                    |
| Supplier network    | On-time-pct feedback loops                                              |
| Autonomous agents   | Nex drafts customer messages on variations; merchant approves           |
| Business Intelligence | Twin data feeds cross-project analytics                               |

Every event that enters the Twin is one event. Every module reads its view of the log.

---

## 11. Vision AI Innovations

Beyond Phase 28 Estimator's Vision list (substrate detection, age dating, owner-hint, progression, cross-photo consistency, standards flags, warranty serial extract, sequence-planning), Phase 29 adds live-project Vision unique to the Twin:

1. **Continuous progression scoring** — each new photo scores the room against a Brain's expected-state checklist; drift alerts merchants
2. **Trade-attribution from photo** — Vision infers *who was on site today* from tools + fixtures + PPE colours + van-in-background OCR. Cross-checks against SiteBook check-ins.
3. **Compliance-in-frame** — Vision detects PPE compliance, exposed edges without protection, unsecured ladders, missing signage — feeds H&S dashboard live
4. **Material-fit reconciliation** — Vision reads visible product labels + serials, matches against the estimate's material list, flags substitutions the merchant made silently
5. **Time-lapse Twin snap** — the daily best photo becomes a Twin "frame"; scrubbing produces a time-lapse of the whole project without manual video work
6. **Adjacent-project cross-check** — when many merchants in the region have Vision-fed Twins, Nex spots regional pattern drift ("your competitors are using tile spacer type X, you're using Y — outcomes differ")
7. **Historic-image reconstruction** — a homeowner uploads an old photo of the house from 2010; Vision maps components against the current Twin; retrofits become guided ("that heating pipe is still there — will need re-routing")
8. **Safety-close-call detection** — Vision + wearable sensors flag near-misses without a report needing to be filed
9. **Occupancy-aware scheduling** — during renovations where homeowner remains in the house, Vision estimates dust + noise + occupied-area constraints, informs sequence
10. **Cross-Twin defect propagation alerts** — a supplier's batch failure detected on one Twin auto-alerts every other Twin that used the same batch (with merchant consent)

---

## 12. Future Technologies (immediate value vs later)

Grouped by pragmatism:

### 12.1 Immediate value (V0-V1)

| Tech                | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| Phone photo         | Already the primary input; Vision reconciler feeds Twin      |
| 360° camera         | One-frame room capture; Vision extracts room state           |
| GPS plant tracking  | Cheap tracker per van/plant; live Twin equipment tile        |
| Weather feed        | Free API; feeds prediction engine                             |
| Digital permits     | Photos + geotag + timestamp; sufficient for most jobs         |

### 12.2 High value, next 24 months (V2)

| Tech                | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| Drone photogrammetry| Roof + external progress captures without scaffold access    |
| LiDAR (iPhone Pro)  | Room measurements accurate to ±10mm; drawing generation      |
| Smart tools         | Torque + rotation logs prove sign-off; deters over-tightening |
| Basic wearables     | Location + inactivity alerts for lone workers                |

### 12.3 Defer to V3+ (invest when merchant demand justifies it)

| Tech                | Reason to wait                                              |
| ------------------- | ----------------------------------------------------------- |
| AR glasses          | Ergonomically not yet worn all day; UX is unsolved          |
| VR walkthroughs     | Occasional value for design review; not core                |
| Smart helmets       | Cost per unit high; battery life problematic                |
| Full IoT sensor sets| High cost per project; low signal for small trades          |

### 12.4 Architecture principle

Every new tech is an **event source**, not a new subsystem. Adding a drone means adding a drone event schema + a Vision reconciler for drone imagery. The Twin doesn't care where the events come from.

---

## 13. Monetisation Strategy

### 13.1 Twin tiers (per project)

| Tier               | Included                                                            | Priced how                          |
| ------------------ | ------------------------------------------------------------------- | ----------------------------------- |
| Basic Twin         | Timeline + photos + estimate + delivery log                          | Free — every project                |
| Professional Twin  | + Vision reconciler + prediction engine + handover pack (PDF)         | Included in Merchant Professional £14.99/mo |
| Enterprise Twin    | + Multi-perspective views + drone/LiDAR ingest + variation workflow   | Included in Merchant Business £24.99/mo |
| Developer Twin     | Portfolio view across N projects; multi-site programme                 | £199/mo per developer               |
| Government / Infra | Regional Twin aggregate + public-good API + audit trail                | Per contract                        |

### 13.2 Post-handover subscriptions

The Twin doesn't end at handover. Long-tail recurring revenue:

- **Homeowner Twin subscription** — £3.99/mo. Maintenance reminders, warranty vault stays live, upgrade cost estimates on demand. Perpetual value for the length of home ownership.
- **Facilities Management Twin** — commercial buildings. £29/mo per building. Scheduled maintenance, contractor coordination.
- **Insurance Twin** — insurer subscribes for anonymised construction quality history for claim modelling. Bespoke pricing.
- **Building lifecycle services** — energy modelling, retrofit assessments, decarbonisation planning. Referral fees or in-house services on the Twin.

### 13.3 Digital handover packages

At project completion, offer the customer a paid handover upgrade:

- **Standard pack** — free (basic PDF)
- **Premium pack** — £19.99 one-off. Interactive live URL, warranty vault, maintenance calendar, transferable to new owner on sale.

### 13.4 Manufacturer + supplier partnerships

- Manufacturers pay to be inside product warranty vaults (branded surface, opt-in per merchant)
- Suppliers pay for delivery-event surfacing (branded delivery cards, opt-in)
- Component brands pay to appear in "future upgrades" suggestions (clear ad label)

### 13.5 Second-side revenue

- Insurance underwriters pay for anonymised claim-history-vs-build-quality correlation data
- Standards bodies pay for anonymised compliance-pattern data
- Local authorities pay for regional building-passport aggregate data

---

## 14. Competitive Analysis

### 14.1 vs. Autodesk Construction Cloud

**Their strength:** BIM authoring + integration with Revit workflow. Deep enterprise adoption.

**Their gap:** BIM-centric. The Twin exists as a design artefact + a construction workflow. It doesn't stay alive after handover in a homeowner-usable way. It doesn't learn cross-tenant. It doesn't predict.

**Nex advantage:** Nex's Twin is designed for the small merchant's project through to the homeowner's lifetime, not for a large GC's document control. And it learns.

### 14.2 vs. Bentley Systems

**Their strength:** infrastructure + civils (roads, rail, water). iTwin.js is well-engineered.

**Their gap:** infrastructure-first. Doesn't touch domestic construction. Doesn't have merchant workflow layer.

**Nex advantage:** Nex covers the small-project long tail Bentley never targeted.

### 14.3 vs. Procore / Oracle Aconex / Trimble

**Their strength:** document control, RFI workflow, submittals. Enterprise construction management.

**Their gap:** enterprise price point + form-driven workflow. No trade-brain intelligence. No consumer-side story.

**Nex advantage:** Nex reaches merchants and homeowners; enterprise CDEs don't.

### 14.4 vs. Buildots / OpenSpace / Matterport

**Their strength:** capture-first (video/360°). Progress detection at scale.

**Their gap:** the capture is the product. They don't own the estimator, the trade brains, the memory substrate, or the homeowner surface. They plug into other systems.

**Nex advantage:** Nex owns the whole stack. Capture is one input into a substrate that also owns everything downstream.

### 14.5 vs. ServiceTitan / Buildertrend

**Their strength:** service-industry workflow, dispatch, invoicing.

**Their gap:** no Twin. No BIM. No Vision-fed construction understanding. Their product isn't a Twin at all.

**Nex advantage:** Nex is the first platform that stitches merchant workflow + Vision-fed Twin + long-lived building record.

### 14.6 The moat (deepest here of any phase)

Four durable structural advantages:

1. **Composition depth × time.** Building Twins requires every prior Nex phase to be shipped and working. Competitors would need to build the memory, the estimator, the trade brains, the mesh, and the vision layer *before* their Twin can be interesting.
2. **Event-sourced from day one.** Retrofitting event sourcing into a mutable-row Twin is a rewrite for competitors. Nex bakes it in.
3. **Homeowner ownership.** Nex's Twin transfers with the building. Competitor Twins are contractor-scoped. Homeowners are locked into whoever owns the last Twin used on their house.
4. **Cross-project pattern lending.** Nex's memory substrate makes each new Twin smarter as prior Twins accumulate. Standalone Twins can't do this.

---

## 15. Long-Term Vision — the Global Construction Intelligence Network

Ten years in, if every Nex project becomes a durable Twin, the platform holds:

- Millions of building Twins across regions, ages, typologies
- Structured records of material choices → performance → warranty outcomes
- Regional maintenance-cost baselines, per building age × trade
- Labour productivity distributions per region × trade × season
- Supplier quality distributions per region × spec
- Regulation compliance patterns per country × era

This becomes a **research-grade dataset** with (K-anonymised) commercial value to:

- Insurers (claim modelling)
- Regulators (evidence-based Standards updates)
- Standards bodies (real-world compliance data)
- Governments (retrofit programmes, decarbonisation modelling)
- Materials manufacturers (product performance in-service)
- Academic institutions (construction research)

**Consent is the gate.** Every merchant + homeowner opts in with clear terms; data-portability + right-to-be-forgotten honoured. The commercial channel is a co-op model: contributing merchants get free or reduced-cost access to aggregate benchmark reports; commercial buyers pay full price.

Nex becomes not just an operating system but a **civic-scale infrastructure asset for the built environment**.

---

## 16. Technical Requirements

| Component               | Est. build load                                      | Notes                                            |
| ----------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| Event log schema + API  | 4 weeks                                              | Append-only, indexed by project + kind + observed_at |
| State reducer           | 4 weeks                                              | Per-layer reducers; cached weekly snapshots       |
| Vision reconciler       | 6 weeks                                              | Depends on Phase 13 CV extensions                 |
| Perspective engine      | 3 weeks                                              | Trade Brain views over the log                    |
| Predictive engine       | 4 weeks                                              | Reuses Phase 25 BOS + Phase 26 memory             |
| Timeline UI             | 8 weeks                                              | Merchant + homeowner surface                       |
| Handover pack generator | 3 weeks                                              | PDF + live URL                                    |
| BIM ingest              | 6 weeks                                              | IFC + Forge/iTwin.js integration                  |
| Drone/LiDAR ingest      | 4 weeks                                              | V2                                                |
| Post-completion surface | 4 weeks                                              | Warranty vault, maintenance calendar              |

### 16.1 Data model

Three new tables:

- `hammerex_nex_twin_events` — append-only event log (see §1.2)
- `hammerex_nex_twin_snapshots` — cached weekly state reductions
- `hammerex_nex_twin_perspectives` — cached per-Brain projections (optional; can be rebuilt)

BIM binary + photos + videos → Supabase Storage.

### 16.2 AI models

- Vision — same as Phase 13 CV (GPT-4-Vision / equivalent)
- Prediction — deterministic first (Phase 25 BOS math), ML only at V3+ once dataset justifies
- Language — Claude Opus 4.7 for merchant-facing voice; homeowner-facing is simplified copy from the same source

---

## 17. Development Roadmap

- **V0 · event log + timeline + Vision reconciler + basic handover PDF** — 12 weeks. Blocked only on Phase 27 having a few Brains at V1.
- **V1 · perspective engine + predictive dashboard + BIM ingest** — 10 weeks after V0.
- **V2 · homeowner portal + drone/LiDAR + post-completion warranty vault** — 12 weeks after V1.
- **V3 · cross-project pattern lending + insurance/FM revenue channels + civic dataset (opt-in)** — 12 weeks after V2.
- **V4 · ML-enhanced prediction, smart tools, wearables integrations** — rolling from V3.

Total path from now: approximately 12 weeks to V0 in production, once Phases 27/28 pass V1.

---

## 18. Risk Assessment

| Risk                                                                | Severity | Mitigation                                                                              |
| ------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| Vision misinterprets progression; Twin state drifts from reality     | High     | Merchant approval on medium-confidence events; append-only means never silent overwrite |
| BIM ingest quality varies wildly                                     | High     | IFC 4.3 only + validation on ingest; broken files rejected, not silently accepted        |
| Event log explosion (millions per project)                           | Medium   | Weekly snapshot cache + partitioning by project + observation_at range indexes           |
| Cross-project pattern lending amplifies bad patterns                 | High     | K-min gate + confidence decay + explicit "regional benchmark applied" label              |
| Homeowner portal exposes merchant costs unintentionally              | High     | Perspective engine enforces homeowner scope; costs never rendered without merchant flag  |
| Insurance data channel raises DPA/GDPR concern                       | High     | Opt-in + explicit consent + K-anonymity + region-only granularity                        |
| Competitor with deep pockets replicates faster                       | Medium   | Composition moat + time × merchant density; keep shipping                                |
| Manufacturer bias in "future upgrades" suggestions                   | Medium   | Clear ad labels + merchant opt-in per brand                                              |
| Twin becomes overwhelming UX for small-project merchants             | Medium   | Progressive disclosure; basic Twin is a timeline, deeper features unlock at Professional |

---

## 19. Final Strategic Recommendation

### 19.1 Is this Nex's greatest long-term moat?

Yes, by a distance. Phase 24 (mesh), Phase 26 (memory), Phase 27 (Brains), Phase 28 (estimator) are all shippable in months. Phase 29 (Twin) requires all of them to work, plus time × merchant density to accumulate value. That is the definition of a moat: pre-requisite dependencies × time no competitor can compress.

### 19.2 Sequencing constraint

Do not attempt Phase 29 V0 before Phase 27 V1 and Phase 28 V0 are stable. The Twin without Trade Brains is a photo scrapbook. The Twin without the Estimator is a rear-view mirror. Both are prerequisites for the Twin to be intelligent, not just organised.

### 19.3 Non-negotiables

1. Event-sourced from day one. Do not ship a mutable-row Twin.
2. Evidence chain on every state row.
3. Opt-in for cross-tenant contribution.
4. Homeowner-transferable ownership of the Twin.
5. No voice on the customer purchasing path.

### 19.4 Recommended immediate step

Ratify the event log schema as an ADR before writing code. Every future Twin behaviour derives from that schema; getting it wrong is an infrastructure migration later.

### 19.5 What makes this civilisation-scale

Twenty years from now, if Nex holds a critical mass of Twins for a country's housing stock, the network becomes indispensable infrastructure. Sale conveyancing loops through it. Insurance quotes reference it. Local authority retrofit programmes consult it. Nex crosses from a construction platform into a **built-environment operating system**.

That's why Phase 29 matters more than the phases that preceded it. It is the phase where Nex's ceiling stops being "SaaS for trades" and starts being "infrastructure for the built world."

---

**End of Phase 29 blueprint.**
