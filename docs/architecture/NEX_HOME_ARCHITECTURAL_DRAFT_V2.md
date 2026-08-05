# NEX Home · Architectural Draft v2

**Status:** Architectural Draft v2 · FROZEN 2026-08-05.
**Nature:** Product constitution for NEX Home — not a screen specification.
**Author:** Claude (Master AI Engineer for NEX), reviewed and refined by Philip O'Farrell 2026-08-05.

> **This document defines the philosophy of how users enter and re-enter NEX. It is not a UI specification. UI decisions become one expression of this architecture — not the architecture itself.**

---

## 0 · Framing

**NEX Home is not a page. NEX Home is the persistent operating context from which every capability is entered and to which every capability returns.**

Brains · conversations · projects · artifacts are transient workspaces. Home is always there. This distinction governs navigation, animation, and state management for the lifetime of NEX.

The document that follows describes OS objects · their relationships · their behaviours · their lifecycles. Where UI language remains, treat it as one candidate expression among many, not as the architecture itself.

---

## 1 · Purpose

**The purpose of NEX Home is to establish trust before asking for work.**

Trust comes before conversation.
Conversation comes before work.
Work creates artifacts.

NEX Home is where trust is earned — through demonstrated memory, visible continuity, honoured commitments, and interactions that consistently leave the user further forward.

**The two audience-shaped jobs of Home:**
- For a **first-time visitor:** demonstrate through the act itself that NEX is not another chat. Memory forms. Progress persists. The ecosystem is alive.
- For a **returning user:** re-establish continuity in the first moment of re-entry. *"Here is exactly where you left off."*

**Not Home's job:** answering domain-specific work (Brain surface) · running conversation depth (Conversation surface) · showing artifact depth (Project / Artifact surface). Home **establishes**; other surfaces **execute**.

---

## 2 · The parent principle · Continuity

Every persistent object in NEX Home exists to preserve a specific axis of **continuity**.

| Object | Axis of continuity |
|---|---|
| Living Memory | Continuity of *what NEX knows about the user* across time |
| Current Context | Continuity of *what the user is working on* across sessions |
| Interrupted Session (J7) | Continuity of *state at the exact moment of interruption* |
| Artifacts | Continuity of *outcomes* — the durable result of past work |
| Learning | Continuity of *NEX's growing intelligence* about the user and the domain |
| Living Profile | Continuity of *identity* across every capability |
| Active Tasks (First Law) | Continuity of *commitments* until completed · cancelled · archived |
| Trade Centre relationships | Continuity of *human relationships* NEX has helped establish |

**Continuity is the honest answer to *"why NEX vs any other AI?"*** ChatGPT is stateless-first. NEX is continuous-first. Every visible NEX object is proof of that difference.

---

## 3 · User entry states (seven journeys)

An entry state is not a "page load" — it is the OS's understanding of *what continuity the user is arriving with*. NEX Home reads seven distinct continuity states and shapes the persistent context accordingly.

| # | Entry state | Signal | Continuity the OS must establish | Success condition |
|---|---|---|---|---|
| **J1** | First-time anonymous | no session · no memory | Continuity does not yet exist · Home invites the first fact via Living Demonstration | User shares first fact · Living Memory writes · user *realises* memory has formed |
| **J2** | First-time authenticated | new session · empty memory · declared identity | Continuity begins today · Home offers proactive first-question suggestions grounded in intent classifier | First message sent · first memory written · first artifact seeded |
| **J3** | Returning · no active work | session · memory · no tasks | Continuity across time is expressed via Living Memory + learning-since-last-visit | User re-engages a remembered thread or begins new work |
| **J4** | Returning · active work | session · ≥1 active task | Continuity of active work dominates the Home surface | User continues active work · fastest resume path taken |
| **J5** | Invited via deep-link | `?invite=…` · `?ref=…` · `?from=merchant/[slug]` | Invite context sits above Home's own continuity band without dislodging it | Invite intent completed without losing Home orientation |
| **J6** | Merchant / trade professional | user_type = trade | Routed to the **separate merchant OS** (studio surface) · Home does not attempt to unify operational and exploratory workflows | Merchant reaches operational surface in ≤2 gestures |
| **J7** | **Interrupted Session** | previous session ended in a non-graceful state | Continuity of state at the exact moment of interruption is restored · *"Here's exactly where you left off"* is the only above-fold action | User resumes in one gesture · zero re-context cost |

**J7 detection signals** *(architectural anticipation · full infrastructure not required for v1 ship):*
- Session ended without an explicit sign-out or "done" action.
- An Active Task existed with progress > 0 and no completion signal.
- The Conversation had an in-flight message never confirmed.
- A draft artifact existed and was unpersisted at session end.

**Why J7 is a defining OS behaviour:** every mature operating system honours interruption gracefully. iOS resumes a phone call · macOS preserves unsaved documents · Linear returns you to the exact issue you were writing about. NEX must do this too — it composes with the First Law (Commitment): an interruption is not a decision to abandon.

---

## 4 · Home's persistent OS objects

Home is composed of persistent OS objects. Their names describe their **nature** (not their UI form). Each object has a data source · a purpose · a lifecycle · a continuity contribution · a rule for empty state.

### 4.1 Living Memory
- **Nature:** the persistent, growing understanding NEX has of the user.
- **Continuity contribution:** across time — memory survives every session.
- **Data source:** `nex_memory_*` + `nex_kb_*` data worlds.
- **Lifecycle:** written when a message contains a fact worth remembering · inspectable at any time · editable · forgettable by user request.
- **Content rule:** the most recent · most relevant · or most surprising memory takes surface priority.
- **Empty state:** Living Demonstration pattern — user shares first fact · memory forms in real time · user realises. Never marketing copy.
- **Interaction affordances:** inspect · edit-in-place · forget · privacy controls.

### 4.2 Current Context
- **Nature:** what the user is working on right now, expressed as a live handle.
- **Continuity contribution:** across sessions — bridges session-end to session-start.
- **Data source:** `nex_au_active_tasks` + `nex_projects_*` + Interrupted Session detector.
- **Lifecycle:** exists whenever there is active work · absorbs J7 handling · resolves to empty when no work is active.
- **Content rule (J4):** 0-3 highest-priority active tasks · each carrying its live progress state.
- **Content rule (J7):** the exact restoration surface — *"Here's where you left off"* — Continue is the only primary action.
- **Empty state:** slim invitation — *"Ready to start something? Tell NEX or pick a specialist."*
- **Interaction affordances:** resume · open task detail · complete · cancel.

### 4.3 Brain selector *(name deferred · Philip 2026-08-05)*
- **Nature:** the surface through which the user selects which NEX specialist to engage.
- **Continuity contribution:** across capability domains — the user's next domain intent.
- **Data source:** `nex_kb_brains` config + user activity signals.
- **Lifecycle:** personalised order based on recent activity · declared interests · current project domain.
- **Content rule:** most relevant specialists surfaced first + affordance for the complete set.
- **Empty state (first-time users):** the flagship specialists visible + affordance to the rest — variety demonstrated.
- **Interaction affordances:** select specialist → enter Brain surface as transient workspace over Home.
- **Naming:** deferred. Compass / Network / Ring / Switchboard all describe topology. The right name emerges from the user mental model of *"which specialist am I choosing to work with?"* — exploration continues before commit.

### 4.4 Ecosystem live-state
- **Nature:** live state from NEX capabilities the user is not directly working in right now.
- **Continuity contribution:** across capabilities — the user knows NEX is alive across the whole ecosystem, not just the surface they're on.
- **Data source:** live queries into Trade Centre · Discovery · Learning · Community · Merchant activity.
- **Lifecycle:** rotates through relevant signals · never accumulates.
- **Content rule:** 2-3 signals expressing *live state* (not entry-point links).
- **Empty state:** collapses gracefully — never placeholder marketing.
- **Interaction affordances:** tap → enter the relevant transient capability workspace.

### 4.5 Recent Artifacts
- **Nature:** the durable outcomes of past NEX work.
- **Continuity contribution:** across outcomes — projects · designs · estimates · commitments persist and remain accessible.
- **Data source:** `nex_projects_*` + `nex_au_active_tasks` + `nex_im_images` + estimator subsystem.
- **Lifecycle:** created by conversations / brains · owned by the user · never disappear unless the user explicitly archives.
- **Content rule:** 2-3 most recent or most relevant artifacts.
- **Empty state:** *"When you and NEX build something together, it lives here."* (Judgment · post-prototype copy pass may improve.)
- **Interaction affordances:** open artifact as transient workspace over Home.

### 4.6 NEX Heartbeat *(new · Philip 2026-08-05 · spec pending)*
- **Nature:** a persistent living signal that NEX is working with the user even when the user is not interacting with it.
- **Continuity contribution:** across time · across capabilities · across sessions — the *pulse* of the persistent operating context.
- **Reference frame:** Windows notifications · macOS Dock · iOS Dynamic Island · Apple Watch complications · Linear cycle indicator. NEX Heartbeat synthesises *ambient · shape-shifting · always-present · rich when tapped · silent when not.*
- **Design constraints:** persistent · non-interruptive · glanceable · interactive · silent by default · every signal it surfaces must strengthen a continuity axis · Identity-Test carrier.
- **Candidate signals:** memory being written · learning banked · background work in progress · commitments approaching · ecosystem activity · continuity restoration.
- **Status:** first-class platform object — full spec deferred to a dedicated document.

---

## 5 · Primary interaction · Conversation

Conversation is the primary way a user turns intent into action from Home. The Conversation surface is a transient workspace that mounts over Home when initiated.

- **Initiation:** user focuses the input · begins typing or speaking.
- **Commit:** first keystroke commits to a message.
- **Transition:** the transient Conversation workspace enters · Home continuity remains behind it, not replaced.
- **Resolution:** conversation resolves into artifacts · which flow into Recent Artifacts · which persist in Home's continuity band.
- **Return:** conversation ends · Home is already present · no "return to Home" action needed.

**Placeholder framing:** the input is not framed as *search*. It is framed as conversation. Exact wording deferred to design phase — copy reinforces demonstration and the demonstration has not yet been prototyped.

**Empty-state Living Demonstration** (canonical example): first-time user (J1) arrives · Living Memory is populated with inviting empty-state expressions that do not describe memory · user types a first message containing a fact · on `event.memory.written` a Living Memory expression appears without explanation · user realises what happened. That realisation is the introduction. No overlay · no tooltip · no caption.

---

## 6 · Secondary interaction · Specialist selection *(Brain surface)*

The Brain selector allows a user to declare capability intent directly — bypassing conversation when the intent is already clear.

- **Initiation:** user selects a specialist from the Brain selector.
- **Transition:** the Brain surface enters as a transient workspace over Home. Home continuity band remains ambient behind it.
- **Persistence:** Home never leaves. What appears to be a "back to Home" gesture is actually *closing the Brain workspace* — Home was always there.
- **Intent-routed variant:** user states intent in Conversation · Router classifies → domain → specialist · Brain enters with a labelled handoff (*"NEX is opening the Staircase brain to help with this"*) · handoff is visible not silent.
- **State preservation:** entering and exiting a Brain does not reset Home state · Home state is application-lifetime.

---

## 7 · Home's event vocabulary (choreography anchor)

Home's behaviour is described in **events**, not timestamps. Animation timing changes; state transitions do not.

```
event.route.requested          · route hit
event.first.paint              · Home skeleton established
event.state.loaded             · Living Memory · Current Context · Brain selector data resolved
event.memory.available         · specific recall content ready for surface
event.selector.ready           · Brain selector populated
event.user.idle                · N ms without interaction after state.loaded (threshold, not timestamp)
event.input.focused            · primary input receives focus
event.input.first-keystroke    · user commits to conversation
event.memory.written           · Living Memory subsystem persisted a new fact
event.workspace.entering       · a transient workspace mounts over Home
event.workspace.closing        · a transient workspace unmounts · Home returns to foreground
event.heartbeat.pulse          · Heartbeat surfaces a new signal
event.session.interrupted      · session ended non-gracefully · triggers J7 preparation on next entry
event.session.restored         · J7 restoration completed
```

**Behavioural specifications reference events**, not seconds. Where a threshold time genuinely matters (e.g., idle detection), the threshold is expressed as a property of the event, not as an absolute animation timing.

Example: *"On `event.memory.available`, Current Context reveals the specific recall content."* — implementation-independent · survives every framework choice.

---

## 8 · Transient workspaces · The relationship to Home

Every non-Home surface is a **transient workspace**. Transient workspaces have a common contract with Home:

- **Enter over, not replace.** Transient workspaces mount as overlays. Home never unmounts.
- **Preserve Home state.** Home state is application-lifetime. Transient workspaces do not modify it directly — they interact via well-defined channels (writing to memory · updating tasks · creating artifacts).
- **Return by closing.** Closing a transient workspace reveals Home unchanged. No re-render · no re-fetch · no re-orientation cost to the user.
- **Contribute to continuity on close.** A transient workspace that ends without contributing to at least one continuity axis has failed its job — the user has spent time and no continuity strengthened.
- **Composable.** Multiple transient workspaces can stack (a Brain over Home · a Conversation over the Brain · an Artifact preview over the Conversation) — Home remains the base.

**Categories of transient workspaces:**
- Brain surfaces (Layer 3)
- Conversation surface (Layer 4)
- Project / Artifact surfaces (Layer 5)
- Living Memory Drawer
- Ecosystem workspace entries (Trade Centre · Discovery · Community)

---

## 9 · Success criteria mapped to the 5-Question Audit Gate

Every criterion is testable · doctrine-anchored · reviewable at prototype stage.

| # | Test | Pass criteria |
|---|---|---|
| **1** | **North Star** *"Every conversation moves you forward"* | On a returning user's re-entry, at least one persistent Home object expresses progression since last visit (memory added · task completed · learning banked · project advanced · relationship strengthened). On a first-time user's entry, a Living Demonstration produces the first evidence of progression before the user has taken more than one action. |
| **2** | **Ecosystem** *"Connects multiple capabilities"* | Home expresses live state from ≥3 distinct capabilities. Live state means current data, not entry-point tiles. Verified at design and prototype review. |
| **3** | **Differentiation** *"Obviously different from other AIs"* | A first-time user, presented with Home for 3 seconds silent, can identify what NEX preserves that ChatGPT / Claude / Perplexity do not. Answer must reference something they observed on the surface. |
| **4** | **Keynote** *"Demoable without explanation"* | Home's entry choreography, played silently, tells the story of an OS with memory · continuity · specialists · a living pulse. No placeholder states · no apologetics. |
| **5** | **Identity** *"Recognisable de-branded"* | Strip cream palette · NEX wordmark · character illustration · brand text. The interaction pattern and persistent OS objects are still identifiable as NEX through Living Memory · Current Context · Brain selector · Heartbeat · continuity band. Validation: external designers shown a de-branded prototype identify it as *"not a known competitor's product."* |

**Emotional outcome test (§10):** open-word question to 5 first-time users · target register hit rate ≥ 3 of 5.

---

## 10 · Emotional outcome

**The emotional state Home optimises for, in the first minute of a session:**

> **"I'm already making progress."**

**Why:** the hero is the user. NEX should feel like **momentum**, not omniscience. Systems that appear to predict the user (*"the system knows where I'm going"*) risk a surveillance-adjacent register. Systems that give the user momentum (*"I'm already making progress"*) are unambiguously welcome.

**How the surface delivers momentum:**
- Living Memory proves the user's past effort persists.
- Current Context proves the user's active work continues.
- Brain selector proves the user has expert help ready.
- Ecosystem live-state proves the user is connected to a bigger system.
- Heartbeat proves the user's work continued even when they were away.
- Living Demonstration proves the user's first action produced a durable outcome.

**How to validate:** post-prototype, ask 5 first-time users the open question *"In one word, what did that feel like?"* Target register: momentum · progress · continuity · being met · being understood. Failure modes to detect: *fast · fine · clean · normal · slick* (competent but forgettable) · *surveilling · knowing · reading me · predictive* (unsettling).

---

## 11 · NEX Home Design Principles · TIMELESS

These five never change. Everything else in NEX Home can evolve. These cannot.

1. **Demonstrate before describing.**
2. **Progress before navigation.**
3. **Context before navigation.** *(broadened from "Memory before menus" — context includes memory · active work · commitments · interrupted sessions · shared work · time)*
4. **Conversation before configuration.**
5. **Every interaction leaves the user further forward than before.**

**Ordering discipline:** shape (1) > hierarchy (2) > affordances (3) > input (4) > outcome (5). If two ever conflict, the earlier wins.

Every future NEX Home revision passes these five before any other test — before the 9-Test Doctrine, before the 5-Question Audit Gate, before design review.

---

## 12 · Related NEX-wide doctrines

Home is one expression of doctrines that apply across NEX:

- **Living Demonstration** — universal doctrine. Never explain. Show. Applies to Conversation · Projects · Trade Centre · Discovery · Learning · every future capability.
- **The Persistent Operating Context** — Home is the OS itself, not a route. Transient workspaces overlay it.
- **Continuity as parent principle** — every persistent object solves an axis of continuity.
- **The Acid Test** — every architectural spec must survive removal of every UI element.
- **Naming reflects true nature** — no UI-form nouns leaking into user-language.
- **Choreography by events, not timestamps** — implementation-independent behaviour specs.

---

## 13 · Deferred decisions (do not block agreement of this document)

| # | Decision | Status |
|---|---|---|
| D1 | Brain selector name | Deferred · exploring names grounded in *"user chooses a specialist"* mental model, not topology |
| D2 | Hero copy | Deferred · copy reinforces demonstration · demonstration not yet prototyped |
| D3 | J7 detection infrastructure scope | Anticipate now · full infrastructure can ship in a later iteration · Home architecture accommodates it |
| D4 | NEX Heartbeat detailed spec | Deferred to a dedicated document · this document reserves it as a first-class platform object |
| D5 | Empty-state copy across objects | Deferred to design phase after Living Demonstration prototypes land |

---

## 14 · What this document is not

- Not a UI specification.
- Not an implementation plan.
- Not a screen mockup or component inventory.
- Not a marketing brief.

**What this document is:** the product constitution for NEX Home. Every future UI · every implementation · every design revision defers to this document. If a UI decision contradicts this document, this document wins.

---

**Version history:**
- v1 (2026-08-05 · earlier same day) — first-pass landing-page specification.
- v2 (2026-08-05 · this document) — architectural draft · frozen · product constitution for NEX Home.
