# Principle 0002 · The Standard NEX Workflow

**Status:** Active
**Established:** 2026-07-28 · Philip O'Farrell
**Applies to:** Every NEX application module

---

## The Principle

Every owner-facing workflow in NEX follows the same six-step interaction model. This is not a Materials pattern — it is the **standard interaction model for the entire NEX platform**.

## The Six Steps

```
1. Owner describes what happened or what they need.
                    ↓
2. NEX understands the business context.
                    ↓
3. NEX prepares the work.
                    ↓
4. Owner reviews the proposed changes.
                    ↓
5. Owner approves.
                    ↓
6. Business records update automatically.
```

## Every step explained

### 1. Owner describes what happened or what they need

The owner opens NEX and says, in their own words, what has happened or what they need — using whatever input is fastest for the moment.

- **Voice** — *"I've had twenty oak boards delivered."*
- **Photo** — snap a delivery note or receipt
- **Upload** — drop an invoice or spreadsheet
- **Text** — type a sentence
- **Later:** natural continuation — *"Another twenty."*, *"Same supplier."*, *"Use the last one."*

Voice, photo, upload and text are first-class equals. Never treat one as second-class. Never require the owner to know which mode is "correct" for the task.

### 2. NEX understands the business context

Before asking any question, NEX resolves everything it already knows or can infer:

- Materials Memory — has the owner worked with this material before?
- Recent activity — is this a continuation of an in-progress workflow?
- Active projects — is there an obvious customer / project this belongs to?
- Suppliers — is there a preferred supplier already recorded?
- Stock — what physically exists that could satisfy this request?
- Time context — end of a delivery day, mid-machining, month-end?

Only after all of that does NEX consider what it still needs to ask.

### 3. NEX prepares the work

NEX drafts the entire piece of work as if it were going to execute:

- Records that would be created (packs, boards, allocations, orders, invoices)
- Calculations that would run (volume, weight, cost, shortfall)
- Materials Memory changes (new item · use existing · update · one-off)
- Stock changes (deltas · not just totals)
- Downstream effects (project reservations · purchase-order requirements)

Nothing has changed yet. NEX has silently done the paperwork. The owner has done nothing.

### 4. Owner reviews the proposed changes

NEX presents its work as **three sections** — the shape locked into Principle 0001:

- **✓ This is what I understood** — a plain-language summary of what the owner said + a verbatim quote of the original request
- **✓ This is what I'm going to do** — a checklist of actions NEX is about to execute
- **✓ What will change** — the concrete deltas (+N records · +X m³ · +£value)

Edit affordances default to collapsed. Owner opts *into* editing. If any required piece is genuinely missing, that section opens automatically and NEX explains why.

### 5. Owner approves

One button. Unambiguous. **Confirm.** No hidden branching, no wizards, no multi-step commit. If NEX is uncertain, it asked at step 2 or step 4 — not here.

### 6. Business records update automatically

Every write is done through the existing service layer. Every write is audited with the original request captured verbatim. The workflow ends on a **success beat** — no silent redirect — showing the owner exactly what happened, with clear next-step buttons (open the record · start another · done).

## Where this pattern applies

Every existing and future NEX application module inherits this pattern:

- **Materials** — pilot module. Add Stock with NEX proved the pattern.
- **Hardwood Calculator** — next module. Must follow this pattern from day one.
- **Staircase Calculator** — inherits when Reference Brain authoring lands.
- **Projects** — creating a project, adding milestones, closing a build.
- **Purchasing** — *"I need three oak string blanks"* → NEX checks stock, drafts a PO, owner approves.
- **CRM** — *"Just spoke to Sarah about the Smith staircase"* → NEX logs the note against the customer + project.
- **Manufacturing** — *"Started machining pack 145"* → NEX updates board statuses, offers a cut plan.
- **Estimating** — *"Quote for a 14-riser oak staircase"* → NEX pulls from the Staircase Reference Brain, drafts a quote, owner reviews.
- **Scheduling** — *"Book the Latham delivery for Thursday"* → NEX adds it, checks capacity, warns of conflicts.
- **Deliveries** — inbound + outbound flows both fit the pattern.
- **Invoicing** — *"Send the deposit invoice for Smith"* → NEX drafts, owner reviews, sends.

**No exceptions.** If a domain seems to require a different pattern, first re-examine — usually the difference is superficial. If the difference is genuine (e.g. real-time collaboration surfaces), document the deviation with the same rigor as an ADR.

## What this pattern rules out

- **Free-form CRUD screens** where the owner fills in the primary form and clicks Save.
- **Multi-step wizards** that force the owner to work through pages in a fixed order.
- **Silent auto-actions** that mutate business state without an approval beat.
- **Confirmation dialogs that only summarise the action verbally** ("Are you sure?") without showing what will change.
- **Bulk-import screens** with column mapping. If the owner would naturally hand a spreadsheet to an operations manager, NEX should read the spreadsheet and prepare the work, not ask the owner to map columns.

## Why this pattern is a competitive advantage

Every other trade software vendor exposes their database through screens. Feature-by-feature it's easier. Ten years later the owner is filling in forms all day.

NEX inverts the relationship. **The owner describes the world. NEX handles the paperwork. The owner supervises.** That's the difference between a tool and an employee.

If we hold the pattern across every module — Materials, Calculator, Projects, Purchasing, CRM, Manufacturing, Estimating, Scheduling — the platform feels **immediately familiar** to any new user. Learn one module, know them all. That consistency is worth more than any one clever feature.

## Design brief for every new module

When starting a new module:

1. Write down the owner-facing sentences the owner would say to describe the work. That's the input.
2. Enumerate what NEX already knows (from Memory, stock, projects, activity, prior decisions). That's the context.
3. Sketch the confirmation screen using the three-section shape *"I understood · I'm going to · What will change"*.
4. Only after the input, context and confirmation are designed, decide what backend + API + schema is required to support them.

**Design the workflow first. Fit the code to the workflow. Not the other way around.**

## Where this shows up first

The Materials Add-Stock vertical slice was the proof-of-concept:

- Input surface: voice · camera · upload · text as equals (`MaterialsAskBar` · `EntryHero` · `VoiceButton`)
- Context resolution: intent parser + Materials Memory match (`nex_intent.ts` · `memory.ts`)
- Work preparation: draft + memory action selection (client state in `AddStockWorkflow`)
- Review: three-part confirmation (`InterpretationCard` · `ActionsCard` · `StockChangesCard`)
- Approval: single Confirm button
- Success + next steps: `DoneView` with green success + [Open Pack] [Done] [Record another]

Every future module inherits these six moments. The specific UI vocabulary may change per domain, but the shape is fixed.

## Related principles

- Principle 0001 · NEX quietly runs the paperwork — this pattern is what "quietly runs" means in practice
- Future 0003+ principles will cover recurring interaction primitives that arise across modules (confirmation shape, activity history, memory match phrasing, offline behavior)

## Cross-references

- `feedback_nex_design_principle_tech_disappears.md` — Claude auto-memory · same pattern · session-persistent
- `src/components/nex-app/materials/add-stock/` — the reference implementation of this pattern
- Materials Library (upcoming) — an additional layer between the shared NEX catalogue and each company's Materials Memory
