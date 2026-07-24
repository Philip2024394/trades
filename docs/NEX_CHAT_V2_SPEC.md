# Nex Chat V2 · Primary Interface Specification

**Production spec · 2026-07-23**
**Purpose:** replace traditional navigation with intelligent conversation. Chat becomes the operating interface for construction businesses. Ready for Sprint 4 delivery per Implementation Plan.

**Departure from V1:** V1 Chat was a dedicated tab among many. V2 Chat is the merchant's home screen and primary way to interact with every module. Dashboards remain, but Chat is the default.

**Related:** Phase 1-4 Nex Brain foundations (shipped) · Phase 24 Multi-Agent Mesh (shipped) · Phase 32 Autonomous Workforce blueprint · Business Builder V2 (Nex consultant pattern).

---

## Section 1 · Design Philosophy — 11 Principles

Chat V2 defers to these before every design decision.

1. **Calm** — never alarmist tone, never urgent-urgent-urgent
2. **Professional** — construction operations director voice, not chatbot cheerfulness
3. **Construction-first** — trade vocabulary, real regulations, real supplier names
4. **Context aware** — knows current project, customer, time of day, weather, merchant preferences
5. **Honest** — evidence-or-silence enforced · "I don't know" is a valid answer
6. **Fast** — first token <400ms · full response <5s p95
7. **Action-orientated** — every reply includes a next step, not just information
8. **Never overwhelming** — one clear message at a time · max 3 actionable options
9. **Always explain WHY** — every recommendation has drill-down to signals + reasoning
10. **Always remember** — conversations persist · Chat picks up where it left off
11. **Never generic** — no "I'm sorry, as an AI language model..." · no marketing chatter

The persona: an experienced Construction Operations Director who has been with the merchant's business for years, knows every project, remembers every customer, and speaks like a trusted colleague. Never a chatbot.

---

## Section 2 · Home Screen · The Morning Briefing

Chat V2 IS the home screen. When the merchant opens Nex, they see Chat with today's briefing.

### 2.1 Anatomy of the morning briefing

```
Good morning Steve.

Today (Thursday 12 Sep):

You have 2 quotes waiting your approval
· Waters bathroom renovation (£4,200 estimated)
· Jones extension electrical first-fix (£1,850)

One overdue invoice — Marge Petersen (£850, 12 days over)
· I've drafted a friendly chase message

Weather forecast: heavy rain tomorrow · your extension crew
should switch to internal work

Site starts:
· 8:00 · Mike (electrician) at Waters
· 9:30 · Sam (plumber) at Jones

Would you like me to prepare today's work?
```

Below: three optional action buttons — **[Review quotes]** · **[Send chase]** · **[Adjust schedule]** — and a chat input field.

### 2.2 What's shown depends on merchant + day

- Weekend merchants see leisure-appropriate briefings
- New merchants see setup nudges
- Experienced merchants see business-metric-forward briefings
- Rainy days lead with weather impacts
- Payday weeks lead with cash flow

### 2.3 What's NEVER shown

- Marketing messages ("Have you tried our new Estimator?")
- Trivial notifications ("3 new merchants joined this week")
- Nagging about incomplete missions
- Ad-injected content of any kind

### 2.4 Home screen states

- **Fresh merchant** — welcoming, guides toward first missions
- **Regular merchant** — briefing pattern above
- **Vacation mode** — "Enjoying your break — I'll hold everything · check back when ready"
- **Emergency stop active** — clear status, resume button

---

## Section 3 · Conversational Operating System

Every module accessible through conversation. No hunting through menus.

### 3.1 Command types Chat handles natively

| Merchant says | Chat does |
|---------------|-----------|
| "Create a quote for Steve at 12 Elm St" | Opens Estimator context · pulls Steve's history · asks scope questions |
| "Schedule the electrician tomorrow" | Opens Scheduler · proposes Mike based on skill match · confirms |
| "Analyse this photo" (with attachment) | Vision AI processes · reports findings · suggests actions |
| "Check cash flow" | Finance module summary · action if concerning |
| "Estimate a staircase 3m wide oak" | Trade Brain (carpentry) prices · offers 3 alternatives |
| "Order 20 bags of mortar" | Marketplace search · supplier comparison · draft PO |
| "Send today's report to Steve" | Composes report · Preview · Approve · Send |
| "What's happening on Waters bathroom?" | Twin timeline · latest photos · outstanding tasks |
| "How did I price the last kitchen?" | Memory recall · shows prior quotes with drill-down |
| "Book the building control inspector" | Contacts council · drafts request · Merchant approves |

### 3.2 Context maintained through the conversation

Merchant doesn't need to repeat context. Chat holds:

- Current project (last one mentioned)
- Current customer (last one mentioned)
- Current trade sub-context (if merchant is a multi-trade)
- Current employee referenced
- Recent decisions (last 30 min in-session)

Merchant can pivot ("Actually, forget Waters — let's look at the Jones extension") and Chat gracefully switches.

### 3.3 Multi-step workflows

Chat handles multi-step tasks:

> **Merchant:** Create a quote for a rear extension
> **Chat:** Sure — who's the customer?
> **Merchant:** Sarah Jones
> **Chat:** Found her. She lives in Cardiff CF10. What's the extension scope? You can dictate or upload plans.
> **Merchant:** [uploads plans]
> **Chat:** Got them. 4m × 5m single-storey, glazed rear. Let me price this with the Estimator. Give me 30 seconds.
> [Estimator generates]
> **Chat:** Here's the draft — £68,400 target price, 12 weeks. Three tiers if you want them. Review or edit?

### 3.4 Voice input everywhere

Every chat input supports Web Speech API (browser-native, merchant-side only per constitutional rule). Mic button next to text field. Dictate → review transcript → send.

---

## Section 4 · AI Actions on Every Reply

Every Chat response ends with buttons that reduce clicks.

### 4.1 Action button patterns

**When Chat shows a quote:**
[Approve] [Edit] [Send] [Convert to Invoice] [Schedule Work] [Purchase Materials] [Save Template]

**When Chat shows a customer message draft:**
[Send as-is] [Edit] [Regenerate] [Save as template]

**When Chat shows a supplier comparison:**
[Order from cheapest] [Order from fastest] [Order from preferred] [See full comparison]

**When Chat surfaces a delay risk:**
[Adjust schedule] [Message customer] [Add buffer] [Dismiss]

### 4.2 Action design principles

- Never more than 4 primary actions per message
- Actions ordered by likelihood merchant will pick them
- Destructive actions require confirmation
- Approvals of external comms always show Preview before Send
- Actions inherit merchant's approval preferences (per weekly digest vs realtime)

### 4.3 One-tap workflows

Compound actions execute a chain:

- "Order from preferred" → drafts PO → applies merchant's default terms → sends to supplier · one click
- "Send as-is" → composes email · applies merchant signature · sends · one click
- "Approve + send" for quotes → marks quote approved · sends interactive proposal to customer · one click

---

## Section 5 · Context Memory

Chat automatically understands merchant's world without them repeating it.

### 5.1 What's automatically loaded per conversation

- **Current project** — most-recently active project (from last 24h SiteBook + Estimator activity)
- **Current customer** — most-recently referenced customer
- **Merchant profile** — trade, tier, sub-specialisations, region
- **Recent decisions** — last 10 approvals/rejections (informs preference model)
- **Financial context** — current cash horizon, VAT window
- **Weather context** — today + tomorrow forecast for merchant region
- **Team context** — who's on site today (from scheduling)
- **Trade Brain context** — merchant's trade Brain always loaded

### 5.2 Context switching

Merchant pivots easily:

- "Actually forget that, let's look at..." → clear signal, context shifts
- "@Waters" or "on the Waters project" → explicit context switch
- After 30 min idle, context softens (but recoverable)

### 5.3 Context transparency

Merchant can ask "what do you know about this?" and Chat shows the context bundle currently loaded — a debug/trust surface.

### 5.4 Cross-conversation memory

Every conversation logs to Memory. Merchant can ask months later:

- "When did I quote the Jones extension?"
- "What did Sarah want in the last conversation?"

Memory retrieves. Per Phase 26 conventions.

---

## Section 6 · Multi-Agent Collaboration

Behind Chat, the Phase 24 mesh + Phase 32 Workforce agents coordinate. Merchant never sees agent names.

### 6.1 Coordination invisible

When merchant asks "quote this bathroom refit":

- Estimator agent computes
- Bookkeeper agent checks affordability against merchant cash horizon
- Bathroom Trade Brain validates scope
- Site Manager agent schedules
- Marketing agent (silently) prepares customer-facing copy

Merchant sees ONE reply from Nex. Behind it, 5 agents contributed.

### 6.2 When agent identity matters

Some contexts benefit from surfacing the agent:

- "Your Bookkeeper thinks..." (merchant relates to the Bookkeeper as a colleague)
- "I checked with your Estimator on this..." (attribution builds trust)

Chat surfaces agent identity only when merchant benefit is clear.

### 6.3 Conflict resolution

Two agents disagree. Chat surfaces:

> Two of your team see this differently:
>
> **Your Estimator says:** "Add a 15% contingency — this scope has hidden risks"
> **Your Bookkeeper says:** "The 15% will push over Sarah's stated budget — offer at 10%"
>
> [Follow Estimator] [Follow Bookkeeper] [Ask for a compromise]

Per Phase 24 confidence engine.

### 6.4 Emergency stop from Chat

Merchant types "pause all agents" or "emergency stop" or "hold everything" · Chat confirms · executes.

---

## Section 7 · Visual Chat

Drag and drop anything. Nex recognises and routes intelligently.

### 7.1 Supported drops

- **Images** (JPG/PNG/HEIC) — Vision AI analyses · routes to Estimator/Twin/SiteBook based on content
- **PDFs** — Doc AI OCR · classification (invoice/spec/drawing) · routing
- **Drawings** (CAD or PDF plans) — Drawing analysis · extracts dimensions + spec
- **Videos** — frame-sampled Vision analysis
- **Voice recordings** (from other tools) — transcription · classification
- **Documents** (Word/etc) — OCR · classification
- **Spreadsheets** — parsing for pricing / customer lists
- **Multiple items** at once — batched processing with progress

### 7.2 Recognition + routing

Nex identifies content type + suggests routing:

> [Photo uploaded]
> I see a bathroom in mid-second-fix. That's the Jones project — should I add this to the SiteBook and flag anything? The extract fan looks like it's missing the trim ring.
>
> [Add to SiteBook] [Add to Twin only] [Ignore]

### 7.3 Rich media in responses

Chat can show:

- Cards (quote summary · customer info · project overview)
- Timelines (project progression · payment history)
- Comparisons (supplier pricing · alternative materials)
- Visualisations (cash horizon chart · margin trend)
- Interactive proposals (customer-facing quote preview)

Every rich response has text alternative for screen readers.

---

## Section 8 · Voice Experience

Builder on-site talking while walking. Voice is a first-class citizen.

### 8.1 Voice principles

- Web Speech API (browser-native, no server-side voice)
- Merchant reviews transcript before submission (per constitutional rule)
- Natural — merchant can speak conversationally
- Fast — under 3 seconds from stop-speaking to Nex response
- Interruptible — merchant can start speaking mid-response to interrupt

### 8.2 Voice use cases

- **"Nex, create today's SiteBook entry"** → Chat starts SiteBook capture flow
- **"Nex, estimate this staircase, 3m wide oak, 14 steps"** → Estimator generates
- **"Nex, send today's report"** → composes · previews · awaits confirmation
- **"Nex, remind me to call Sarah tomorrow"** → schedules reminder

### 8.3 Voice UX pattern

1. Merchant taps mic (or wake word if enabled)
2. Recording indicator visible
3. Merchant speaks
4. Transcript appears live as they speak
5. Merchant stops (auto-detect silence or manual tap)
6. Transcript can be edited before submit
7. Merchant taps Submit or auto-submit after 3s of no edit

### 8.4 What voice is NOT for (constitutional constraint)

- Customer purchasing path (never · merchant memory rule)
- Sending customer-facing communications without visual review
- Financial approvals above merchant threshold

Voice is merchant-side scope capture + platform commands only.

---

## Section 9 · Proactive AI

Nex initiates conversation when it matters. Never annoying.

### 9.1 Proactive triggers (examples)

- **Weather may delay tomorrow's concrete pour** → morning of, alongside briefing
- **Invoice overdue** → 3 days after due date, once, in briefing
- **Material prices changed** → weekly rollup, not per-item
- **Labour running over budget** → when 20% over, once, actionable
- **Inspection booked tomorrow** → evening before
- **Permit expires next week** → 7 days before, once

### 9.2 Frequency + intensity rules

- **One proactive alert per morning briefing** unless emergency
- **Emergencies interrupt** — safety, cash horizon <7d, critical inspection missed
- **Non-emergencies queue** — bundled into next briefing
- **Merchant can mute categories** — "stop telling me about weather" respected
- **Vacation mode silences all** except emergencies

### 9.3 Never-nag rule

If merchant dismisses a proactive alert, Nex does not re-raise it for 7 days minimum unless materially new information arrives. Same signal never gets raised twice without new evidence.

### 9.4 Notification hygiene

- Push notification only for merchant-declared priority events
- Email digest for lower-priority items
- Never SMS unless critical + merchant opted in
- Working hours respected

---

## Section 10 · Chat UX

### 10.1 Message bubble design

- Nex messages: left-aligned, subtle background tint
- Merchant messages: right-aligned, brand-tinted background
- Rich content (cards, tables) inline, not modal
- Timestamps subtle (grouped by hour)
- Read receipts absent (not needed)

### 10.2 Quick actions

- Action buttons directly below Nex's message
- Sticky action bar for long conversations (last message actions accessible without scroll)

### 10.3 Timeline

- Infinite scroll upward through history
- Search bar at top
- Filter by date, project, customer

### 10.4 Expandable responses

- Long responses collapsed with "Show more"
- Evidence/sources link to drill-down
- Rich data (charts, tables) toggleable

### 10.5 Progress indicators

- "Nex is thinking..." for LLM generation
- Multi-step progress for compound actions ("Analysing photo... Checking regulations... Calculating estimate...")
- Real work happening = visible progress

### 10.6 Typing indicator

- Three dots when Nex is responding
- Progress percentage when compound work is running (>3s)

### 10.7 Confidence indicators

- Green dot high · yellow medium · amber low
- Confidence never invisible on numerical outputs

### 10.8 Source references

- Every fact traces to source · click for detail
- Trade Brain citation shown for regulation quotes
- Memory row references shown for benchmarks

### 10.9 Theme

- Light + dark modes (dark auto-selected on mobile in low-light)
- Merchant brand accent colour applied
- No decorative construction imagery in main chat (professional restraint)

### 10.10 Animations

- Subtle · never distracting
- Message bubble slide-in
- Card expansion smooth
- No confetti or celebration overkill

### 10.11 Accessibility

- WCAG 2.2 AA
- Screen reader complete
- Keyboard navigation for every action
- 12px text floor · 44px tap targets · 4.5:1 contrast
- Voice input as accessibility affordance

### 10.12 Mobile-first layouts

- Single column
- Full-width bubbles
- Thumb-reachable send + mic buttons at bottom
- Persistent context bar shrinks on scroll
- Camera + gallery pickers native

---

## Section 11 · Command System

Merchants never remember commands. Nex understands natural language.

### 11.1 What Chat handles

- **Questions** ("How much have I made this month?")
- **Instructions** ("Send an invoice to Sarah for £2,400")
- **Follow-ups** ("Actually, make that £2,600")
- **Corrections** ("The extension is 4m not 5m")
- **Interruptions** ("Wait, first check the cash situation")
- **Multi-step workflows** ("Book an inspection then message Sarah")
- **Context switches** ("Forget that, let's look at Jones")

### 11.2 Intent recognition

Uses Phase 24 mesh planner + Trade Brain vocabulary. Ambiguity handled gracefully:

> **Merchant:** Send Sarah a message
> **Chat:** Which Sarah? You have Sarah Jones (extension project) and Sarah Waters (bathroom).

### 11.3 Correction handling

Merchant can correct any prior message inline. Nex retracts and rebuilds:

> **Merchant:** "Actually the extension is 4m not 5m"
> **Chat:** Updated. New estimate: £54,720 target (down from £68,400). Everything else the same?

### 11.4 Undo

Every Chat action has an undo affordance visible for 30 seconds. "Undo send" catches a mis-sent customer email if within window (before Postmark actually delivers).

---

## Section 12 · AI Transparency

Trust always precedes automation.

### 12.1 Explain WHY on demand

Every Chat output has an implicit "why?" affordance. Ask "why?" or tap the "?" icon:

> **Nex:** Send this quote at £68,400
> **Merchant:** Why £68,400?
> **Nex:** Based on:
> · Materials £24,000 (from Trade Centre live prices)
> · Labour 240h × £45/h = £10,800 (your regional average)
> · Subcontractor £8,000 (from your typical rate)
> · Overhead + profit 30% (matches your Estimator setting)
> · No adjustments for site complexity (I couldn't detect any from photos)
>
> [See full breakdown] [Adjust assumptions]

### 12.2 Confidence per output

Every recommendation carries confidence: high / medium / low. Low confidence prompts "want me to research more before you decide?"

### 12.3 Source of information

Every fact traces:
- Regulation cite → Government source URL
- Regional benchmark → K-anonymity gate + contributor count
- Estimator number → underlying calculation
- Recommendation → signal chain

### 12.4 Assumptions surfaced

Chat states what it assumed when generating:

> "I assumed this is a cavity wall extension based on the photos — please confirm before we quote."

### 12.5 Approval required for high-risk

- Sending customer communications
- Financial transactions
- Legal document generation
- External data commitments (booking inspections)

All show explicit "review before send" state.

### 12.6 Human verification recommended

For:

- Structural calculations (recommend engineer sign-off)
- Fire safety spec (recommend competent person)
- Gas work (recommend Gas Safe engineer)
- Anything Chat's confidence is low + high stakes

Chat says so.

---

## Section 13 · Implementation

### 13.1 Database

New tables:

```sql
hammerex_nex_chat_sessions_v2 (
  id UUID PRIMARY KEY,
  merchant_slug TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  title TEXT,
  status TEXT CHECK (status IN ('active', 'archived')),
  last_message_at TIMESTAMPTZ,
  context_snapshot JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

hammerex_nex_chat_messages_v2 (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES hammerex_nex_chat_sessions_v2(id),
  role TEXT CHECK (role IN ('user', 'nex')),
  content JSONB,     -- text + rich content
  actions JSONB,     -- action buttons
  confidence TEXT,
  evidence_refs JSONB,
  input_kind TEXT,   -- text, voice, upload
  observed_at TIMESTAMPTZ
);

hammerex_nex_chat_action_events (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID,
  message_id BIGINT,
  action_kind TEXT,
  outcome TEXT,
  taken_at TIMESTAMPTZ
);
```

### 13.2 APIs

```
POST /api/nex/chat/v2/session/new
POST /api/nex/chat/v2/session/<id>/message
GET  /api/nex/chat/v2/session/<id>/messages
POST /api/nex/chat/v2/action
GET  /api/nex/chat/v2/history/search
```

Streaming responses via SSE per ES-03 §3.5.

### 13.3 Frontend architecture

`src/apps/chat-v2/` components:

- `ChatHome.tsx` — the merchant landing surface
- `MessageBubble.tsx` (Nex + Merchant variants)
- `ActionBar.tsx` — quick actions per message
- `VoiceInput.tsx` — Web Speech wrapper
- `DropZone.tsx` — file drag+drop
- `RichContent/` — cards, tables, charts, previews
- `ContextBar.tsx` — persistent current-context surface
- `ConfidenceBadge.tsx` — visual confidence
- `EvidencePopover.tsx` — source drill-down

### 13.4 Backend architecture

- `chat-v2/` module orchestrates
- Delegates to Phase 24 mesh for reasoning
- Delegates to Phase 26 Memory for context loading
- Delegates to Phase 27 Brains for domain answers
- Delegates to Phase 28 Estimator, Phase 29 Twin, Phase 30 Market Intel as needed
- SSE stream for progressive response
- Events per ES-02 event catalog (`chat.message_sent`, `chat.action_executed`, `chat.session_completed`)

### 13.5 Conversation engine

- LLM: Claude Opus 4.7 primary · Haiku for high-volume classification
- Prompt templates versioned in `src/lib/nex/ai/prompts/chat-v2/`
- Context assembly: Memory + Brain + Twin + BOS + Market → structured prompt
- Response streaming with tool-use pattern for actions

### 13.6 Prompt framework

Every prompt has:
- System instruction (Nex persona + safety)
- Context bundle (merchant, project, memory recent)
- User message
- Available tools (per intent)
- Response format guidance
- Confidence expectations

### 13.7 Testing

- Vitest unit tests for context assembly + action handlers
- Playwright E2E for chat flows
- Load test at 1000 concurrent sessions
- AI evaluation suite: 500 scenarios covering common commands · confidence calibration · voice + drop-zone flows
- Advisory panel signs off

### 13.8 Performance targets

- First token latency: <400ms p95
- Full standard response: <5s p95
- Compound multi-agent response: <15s p95
- Search history: <500ms p95
- Voice transcription accuracy (browser dependent): >90%

### 13.9 Accessibility

WCAG 2.2 AA · voice input · screen reader complete · keyboard navigation.

### 13.10 Definition of Done

- All Section 13.1-13.9 delivered
- Advisory panel signs off ≥8/10
- Load test passes at 1000 concurrent
- 90% of common construction commands handled without escalation
- V1 Chat retained via feature flag for rollback

### 13.11 Acceptance criteria

- Merchant opens Nex → briefing visible in <1s
- Merchant asks "quote a bathroom" → estimator opens in <5s
- Merchant sends photo → Vision analysis + routing in <10s
- Voice command → transcript in <3s

### 13.12 Engineering estimate

- Chat V2 core (message engine + streaming + rich content): 4 weeks
- Home screen + morning briefing composer: 2 weeks
- Voice + drop-zone + rich media: 2 weeks
- Multi-agent integration + action routing: 3 weeks
- Testing + advisory panel: 2 weeks

**Total: ~13 engineer-weeks · Sprint 4 delivery target with 3 engineers parallelised.**

---

## Section 14 · The Future of Construction Software

Five-year projection: Chat becomes THE interface.

- **Menus become vestigial** — power users may still navigate; average merchants use Chat for 80%+ of tasks
- **Dashboards become answers to questions** — "How's my cash?" replaces staring at a widget
- **Reports become conversations** — merchant asks for analysis, drills in via follow-up
- **Onboarding becomes conversation** — Business Builder V2 established this pattern

The bold recommendation: **Nex ships with Chat as the default home for all new merchants**. Dashboards accessible but discovery through conversation. This is how the industry moves forward.

---

## Final CTO Review

- Cut auto-suggestions when merchant idle (nagging)
- Cut wake-word activation (privacy + rarely useful)
- Cut voice-to-voice mode (transcript review is safety)
- Simplify action bar to max 3 buttons (down from 4)
- Approve for Sprint 4 delivery subject to Phase 24 mesh being at production maturity

**End of Nex Chat V2 Spec.**
