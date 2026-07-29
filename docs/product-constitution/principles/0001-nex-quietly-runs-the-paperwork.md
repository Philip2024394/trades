# Principle 0001 · NEX quietly runs the paperwork while the owner runs the workshop

**Status:** Active
**Established:** 2026-07-28 · Philip O'Farrell
**Applies to:** Every NEX module (Materials · Calculator · Projects · Purchasing · CRM · Manufacturing · Estimating · Scheduling · Deliveries · Invoicing · Future)

---

## The Principle

> **NEX quietly runs the paperwork while the owner runs the workshop.**

## Why this exists

Every other trade software makes the owner do the work — fill in forms, click through wizards, interpret screens, learn menus, remember procedures, sit at a desk. Ten years in, the software feels like a burden.

NEX inverts that. The owner tells NEX what has happened, in their own words, using whatever input is fastest for the moment (voice, photo, upload, text). NEX interprets it, uses everything it already knows about the business, prepares the work, and hands it back for approval. The owner reviews and confirms. NEX quietly writes the paperwork.

The owner should feel like they hired an experienced operations manager — someone who knows staircase manufacturing, remembers how the business works, and quietly gets things done while asking for approval only when needed.

If the owner ever thinks *"where do I click?"* or *"what field do I fill in?"*, the illusion breaks and NEX becomes another CRUD app.

## What "feels like an operations manager" means

An experienced operations manager:

- **Speaks the owner's language.** Says *"I've recorded the delivery"* not *"Transaction saved."*
- **Uses context they already have.** Doesn't ask *"which project?"* if the answer is obvious.
- **Presents completed work.** Says *"Here's what I've done — approve?"* not *"Please fill in the following fields."*
- **Asks precisely when uncertain.** Not *"please provide all required information."*
- **Recognises what they've seen before.** *"That's the oak we usually buy from Latham — same as last time?"*
- **Never silently makes mistakes.** Shows their work before any change becomes permanent.
- **Doesn't need to be complimented on being smart.** They just quietly get it right.

## The Ten Quality-Gate Questions

Every workflow, screen, prompt and interaction across the platform must pass all ten before shipping.

### 1. Does this feel like working with an experienced operations manager rather than software?

**Pass:** *"I've recorded a delivery of 20 European Oak PAR boards. Open the pack?"*
**Fail:** *"Transaction complete. Click OK to continue."*

### 2. Has NEX completed as much of the work as possible before asking the owner anything?

**Pass:** NEX has already parsed the delivery, matched the material to what it recognises, calculated the volume, drafted the pack, and only asks the owner to confirm.
**Fail:** A blank form with 12 required fields and a Save button.

### 3. Does the owner review and approve rather than complete forms?

**Pass:** The confirmation screen reads as *"This is what I understood · This is what I'm going to do · This is what will change."*
**Fail:** The confirmation screen requires the owner to fill in fields before the primary button becomes active.

### 4. Is the technology invisible?

**Pass:** Copy says *"I've seen this before"*, *"I'll remember it for next time"*, *"I don't recognise this yet"*.
**Fail:** Copy says *"Materials Memory found match"*, *"Insert record?"*, *"Database updated"*.

### 5. Does the workflow reduce effort compared to traditional software?

**Pass:** The owner speaks one sentence and confirms one screen.
**Fail:** The owner navigates three menus, fills in five fields, and clicks two Save buttons.

### 6. Does the owner always understand what will happen before anything changes?

**Pass:** *"I'll create a pack of 20 boards, update stock by 0.182 m³, and record a purchase value of £370. Confirm?"*
**Fail:** A generic *"Save"* button next to a form the owner didn't write.

### 7. Is confidence more important than automation?

**Pass:** When uncertain, NEX asks a single specific question. When the match is exact, NEX uses it and shows why.
**Fail:** NEX silently picks the most likely option and hopes for the best.

### 8. If NEX is uncertain, does it ask rather than guess?

**Pass:** *"This looks like European Oak PAR (67% similar) — same material? If not, I'll treat this as new."*
**Fail:** NEX silently assumes it's a duplicate and merges records.

### 9. Can this workflow eventually support voice, photographs, screenshots and documents as naturally as typing?

**Pass:** The input surface treats voice, camera, upload and text as first-class equals. Same downstream flow regardless of input mode.
**Fail:** Voice / photo are added as buttons in a submenu, or only text works properly.

### 10. After using this workflow, would a staircase manufacturer describe it as "easy" rather than "clever"?

**Pass:** *"I just tell it what turned up and it does the rest."*
**Fail:** *"You have to know where the buttons are but it's really powerful once you learn it."*

### 11. Would an experienced staircase workshop manager naturally work like this?

**The strongest filter.** Not *"would a software developer build it this way"*. Not *"would an inventory application behave this way"*. But: **would an experienced workshop manager, standing on the shop floor, with sawdust on their hands and a phone in their pocket, naturally work like this?**

**Pass:** The screen fits how a real workshop manager thinks and moves. They can use it one-handed, in a rush, without training, without hesitation.
**Fail:** The screen fits how a software product manager thinks. It looks tidy in Figma but the workshop manager wouldn't pick up the phone during a delivery to use it.

Apply this test after the other ten. If the previous ten passed but this one fails, the design is still wrong. Redesign.

### 12. Can a staircase workshop manager understand where every material came from?

**The traceability test.** If a worker on the shop floor asks *"where did this oak come from?"*, the chain of provenance must be visible and one tap away — no digging through settings, no calling head office, no waiting for a report.

The chain we're building toward:

```
Oak Stair Tread                    (physical part)
     ↓
European Oak PAR                   (Stock entry · pack ref · board ref)
     ↓
library_slug: hardwood/            (Materials Memory provenance)
european-oak-par
     ↓
Memory imported: 28/07/2026        (when this material became "known" to the business)
     ↓
Supplier ABC · 42 lengths          (which supplier · what quantity · what price)
```

**Pass:** Every material record links back to the delivery it came in on · the supplier it came from · the price paid · the Memory entry that recognised it · the Library entry (if imported) it descends from · and the moment the owner first added it. Every step is a tap or a hover away in the UI.

**Fail:** Any link in the chain is hidden, missing, deferred to a "reports" screen, or requires the owner to piece together the story from separate places. Silent gaps in provenance are silent failures — a workshop manager needs to answer *"where did this come from?"* in seconds, not minutes.

**Why this test locks in before Materials v1 freezes.** Without provenance, NEX is *a database of products*. With provenance, NEX becomes *a trade knowledge engine*. The distinction is the entire competitive advantage. Every screen that shows a material must surface the provenance path, or link one tap into it.

## Practical guidance — the copy tests

Prefer human words:

| Instead of | Use |
|---|---|
| Add Stock | What have you received today? |
| Save · Submit · Insert | Confirm · Done · Approve |
| Record created successfully | I've created the pack |
| Error: field required | I need one more thing — what species? |
| Materials Memory | (invisible in UI — say *"I recognise this"* / *"I'll remember"*) |
| Please review the entries | Here's what I understood |
| Transaction complete | Delivery recorded |
| Are you sure you want to continue? | (avoid — if the action is safe, don't ask; if it's destructive, show what will change) |

## Practical guidance — the interaction tests

- **Confirmation screens** read as *"I understood · I'm going to · What will change"*, not *"Please review · Please save"*.
- **Edit affordances** default to collapsed. Owner opts *into* editing.
- **Silent auto-fill** is fine when confident; ambiguity requires explicit approval.
- **Never** silently create duplicate records.
- **Never** silently mutate stock, purchases, allocations, or any owner-visible state.
- **Never** expose internal error codes. Say what the owner needs to hear and what to do next.
- **Silence** beats fabrication. *"Unknown"* beats *"best guess"*.
- **Every mutation** ends on a beat where NEX shows what just happened — success is worth the moment, not a silent redirect.

## The trap this principle prevents

Every trade-software vendor slowly turns into an ERP because feature-by-feature it's easier to expose the underlying database than to hide it. Each feature is a small compromise. Ten years later the owner is filling in forms all day and the software feels like a burden.

NEX must not follow that path. Every screen, every prompt, every empty state is a test of this principle. If we let it slip module by module, we lose the differentiation and become another CRUD app in a category owned by Sage, Xero, and Salesforce.

## The Standard NEX Workflow Pattern

Every module follows the same six-step pipeline:

1. **Owner says what happened** — voice · photo · upload · text · however is fastest
2. **NEX understands the business context** — active project, recent customer, stock, suppliers, previous decisions
3. **NEX prepares the work** — drafts the records, calculates the numbers, matches against known materials
4. **Owner reviews** — three-part confirmation (*"I understood · I'm going to · What will change"*)
5. **Owner approves** — one button, unambiguous
6. **Business updates automatically** — records written, stock adjusted, audit trail captured, success shown

This pattern works for adding stock, checking availability, reserving materials, purchasing, quoting, invoicing, scheduling, and every future workflow. When designing a new module, start from this pattern and specialise only where the domain genuinely requires it.

## Where this shows up first

The Add-Stock-with-NEX vertical slice (Materials · 2026-07-28) was the pilot for this principle:

- Voice · camera · upload · text as first-class equals
- Three-part confirmation (*"I understood · I'm going to · What will change"*)
- Post-confirmation success screen with no auto-redirect
- Memory match phrased as *"I've seen this before"* not *"Database match found"*
- Recent activity feed reads *"Recorded a delivery · You said: 'Add 20 oak boards'"* — the owner's own words play back
- Every user-facing string audited to remove internal jargon ("Memory", "record", "database", "transaction")

Every future module inherits this pattern. Every future contributor is expected to hold their work to the same test.

## Cross-references

- `feedback_nex_design_principle_tech_disappears.md` (Claude auto-memory · same principle · session-persistent)
- `docs/DECISIONS/` (ADRs · architecture · complementary but distinct)
- `CLAUDE.md` (agent instructions · must never contradict the Constitution)
