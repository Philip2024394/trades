# Nex SiteBook V2 · Mobile-First On-Site Specification

**Production spec · 2026-07-23**
**Purpose:** rebuild SiteBook for on-site reality — one hand, gloves on, rain, minimal signal. The world's best mobile construction site management experience.

**Departure from V1:** V1 was desktop-first with mobile as an afterthought. V2 is mobile-first PWA · offline-capable · camera-first · voice-first.

**Related:** Phase 6 PI (SiteBook substrate, shipped) · Phase 13 CV (Vision AI) · Phase 29 Digital Twin blueprint · Business Builder V2 · Chat V2.

---

## Section 1 · Design Philosophy

SiteBook V2 must be:

1. **Mobile-first** — designed for a phone in a work glove
2. **Offline-first** — works with zero connectivity, syncs when signal returns
3. **Camera-first** — camera IS the primary input · every entry starts with an image or voice
4. **Voice-first** — typing is optional, voice is default
5. **AI-assisted** — Vision + Trade Brains do the classification work
6. **Fast** — one-hand entry in <30 seconds
7. **Reliable** — never loses data, never crashes
8. **Construction focused** — knows trades, knows regs, knows the mud
9. **Designed for real building sites** — sun glare, rain drops on screen, gloves
10. **Never feels like office software** — no timesheet vibe, no HR forms

The persona: a tradesperson pulls out their phone at the end of a job. Two thumb taps. Done. The record exists in Nex.

---

## Section 2 · The First 30 Seconds

Merchant arrives on-site. Opens SiteBook. What they see:

### 2.1 Site Header (top 1/4 screen)

```
Waters Bathroom
12 Elm Street, Cardiff
─────────────────
🌦 15°C · Rain expected 3pm
👥 On site: Mike (electrician)
📦 Delivery expected: 10am · 3 pallets

STATUS: On track · Day 4 of 12
```

### 2.2 Big action buttons (middle 1/2)

Four huge tap targets (72px minimum):

```
📸 Take Photo        🎙 Voice Note

📦 Log Delivery      ⚠ Report Issue
```

Each button is a complete workflow — one tap starts the flow, one confirm ends it.

### 2.3 Today's timeline (bottom 1/4)

Chronological list of today's events:

- 09:00 Site opened · Mike checked in
- 09:15 First fix electrical started
- (empty · next event will slot here)

Merchant scans this in 3 seconds and knows the site status. Total time to understand: <15 seconds. Total time to make an entry: <30 seconds.

---

## Section 3 · Daily Site Diary Redesign

V1 asked for structured entries. V2 lets AI do the structure. Merchant captures raw · AI organises.

### 3.1 What V1 required (removed)

- Fill date field (removed · always today by default)
- Fill time field (removed · always now)
- Fill weather field (removed · auto-pulled from weather API)
- Fill labour list (removed · auto-populated from check-ins)
- Fill visitor list (removed · asked only when merchant taps "add visitor")

V2 removes 5 required fields.

### 3.2 What V2 auto-fills

| Field | Source |
| ----- | ------ |
| Date + time | Device clock |
| Weather | Weather API (region + time) |
| Labour on-site | Check-in log |
| Materials expected | Procurement + delivery schedule |
| Visitors expected | Calendar integration |
| Progress vs plan | Twin timeline delta |

Merchant confirms or edits · doesn't enter.

### 3.3 Voice diary — the primary path

Merchant taps 🎙 Voice Note · speaks · reviews transcript · saves.

Example flow:

> **Merchant speaks:** "Today's concrete pour finished at 2:15. Bit of a delay because the truck was late, half an hour. Quality looks good. Customer came by and approved the finish. Weather was fine, no rain during the pour."
>
> **Nex processes:** creates structured entries:
> · Milestone: concrete pour · complete · 14:15
> · Issue: supplier late by 30 min · resolved
> · Approval: customer signed off on finish · timestamped
> · Weather note: dry during pour
>
> **Merchant reviews structured entries · taps Save.**

One voice note → 4 structured records.

### 3.4 Photo diary

Merchant taps 📸 · camera opens · takes photo · Vision AI processes:

- Detects room / area
- Identifies work stage (first fix, second fix, etc.)
- Flags any visible issues
- Suggests entry (progress · defect · delivery · milestone)

Merchant confirms categorisation with one tap · save.

### 3.5 What V2 doesn't ask for at all

- Detailed narrative (voice or photo captures it)
- Precise time (auto)
- Precise location (device GPS, if enabled)
- Report formatting (generated on demand)

Merchant captures. Nex writes the report if requested.

---

## Section 4 · Camera-First Experience

Camera is the default. Photo triggers everything.

### 4.1 One-tap capture

- Home screen 📸 button opens camera immediately (no intermediate screens)
- Multi-shot mode default (take several)
- Auto-focus + auto-flash based on conditions
- HEIC preferred for iPhone (smaller files)
- Auto-tag with time + GPS + project

### 4.2 Vision AI analysis

Every photo processed:

- **Trade detection** — what trade is visible (plumbing pipework, tiling, electrical, etc.)
- **Location detection** — which room / area based on features
- **Work stage detection** — first fix, second fix, snagging, complete
- **Issue detection** — visible defects, missing PPE, hazards
- **Suggestion generation** — "This looks like completed second fix — add as progress?"
- **Confidence level** — visible on the entry

Vision runs asynchronously · UI never blocks · results populate as they arrive.

### 4.3 What Vision catches automatically

- ✓ Progress photos → routed to Twin timeline
- ✓ Defects → snag opened with severity
- ✓ Completed work → milestone update
- ✓ Safety issues → H&S entry + notification
- ✓ Material deliveries → procurement update
- ✓ Damage → incident log
- ✓ Measurements (approximate) → Estimator context
- ✓ Drawings → Doc AI OCR

### 4.4 Merchant review before commit

Vision suggests · merchant approves. Nothing writes to permanent record without confirmation (per constitutional rule medium-confidence Vision requires approval).

### 4.5 Photo enrichment

- Auto-annotation (arrow to defect, ruler for measurement)
- Voice caption during upload
- Auto-share to homeowner via Twin (if merchant enabled)

---

## Section 5 · Voice SiteBook

Voice is a first-class input. Every diary field can be dictated.

### 5.1 Voice patterns supported

- **Diary note**: "Today's concrete finished at 2:15..."
- **Structured entry**: "Log delivery, three pallets of bricks, delivered by Wolseley, on time"
- **Snag**: "Snag: crack in the plaster in the master bedroom, minor, plasterer to revisit"
- **Milestone**: "First fix electrical complete"
- **Question**: "What's the next scheduled inspection?"

### 5.2 Processing

- Web Speech API (browser-native, merchant-side only, no server-side voice)
- Transcript shown live
- Nex parses into structured records
- Merchant reviews + confirms
- Original transcript retained alongside structured data

### 5.3 Voice UX on-site

- Push-to-talk (hold button) — reliable in noisy environments
- Or tap-to-toggle for hands-free
- Visual audio-level indicator
- Auto-stop after 3 seconds of silence
- Manual stop always available
- Retry-if-noisy: "I couldn't hear that clearly — try again?"

### 5.4 What voice never does

- Bypass merchant review — transcript always shown
- Send to customer without merchant seeing text
- Voice-to-voice with customer (constitutional rule)
- Server-side voice storage (deleted after transcription)

---

## Section 6 · AI Project Assistant

Nex proactively helps · never intrusive.

### 6.1 Proactive triggers on SiteBook

- **Missing daily entry** — end of day gentle prompt: "Quick voice note about today?"
- **Weather-appropriate suggestions** — "Rain expected 3pm — cover open trench?"
- **Delivery reminders** — "Wolseley pallet expected 10am — flag when arrived"
- **Snag follow-up** — "That crack you flagged 5 days ago — is it fixed?"
- **Inspection nudges** — "Building Control tomorrow at 9 — anything to prep?"
- **Variation alerts** — "Customer changed spec on Elm St — need updated quote?"

### 6.2 Frequency rules

- One proactive nudge per session unless emergency
- Merchant can silence categories
- Never nag on same thing twice within 24h
- Vacation mode silences everything except emergencies

### 6.3 Assist without intrusion

- Nudges appear as subtle cards at bottom of home screen
- Dismissable with swipe
- Never interrupts current workflow
- Never full-screen modal

### 6.4 Learning from acceptance

- Merchant dismisses category X repeatedly → Nex learns · reduces frequency
- Merchant acts on category Y frequently → Nex proactively surfaces sooner

---

## Section 7 · Digital Twin Integration

Every SiteBook entry updates the Twin. Not a separate step.

### 7.1 What flows to Twin

- Every photo → Twin timeline event with Vision findings
- Every voice diary → structured events per parse
- Every delivery → Twin procurement update
- Every snag → Twin quality event
- Every milestone → Twin phase progression
- Every variation → Twin scope change (with approval workflow)
- Every inspection → Twin certification event

### 7.2 Sync architecture

- SiteBook writes to `hammerex_nex_twin_events` (per Phase 29 event log)
- Twin state reduces from events (per Phase 29 event-sourced pattern)
- Merchant + homeowner see Twin timeline updated in near real-time (Supabase Realtime)

### 7.3 Twin surfaces in SiteBook

- Merchant taps "Show Twin" → Twin timeline for this project
- Merchant taps any Twin event → jumps to detail
- No context switching between SiteBook + Twin — same substrate

### 7.4 Homeowner visibility

- Homeowner sees Twin timeline curated for their view (merchant-controlled visibility per event)
- Every SiteBook photo can be flagged private-to-merchant or visible-to-homeowner
- Default: photos visible to homeowner unless merchant marks otherwise

---

## Section 8 · Construction Memory

Every SiteBook record enriches Memory. Merchants query later.

### 8.1 Queryable via Chat V2

- "When was the wall in the front room completed?"
- "Show every photo from the staircase installation"
- "When did the plumber finish first fix?"
- "Who approved the variation on the kitchen scope?"
- "What was the weather when we poured the slab?"

Chat V2 queries Memory + Twin timeline · returns structured answer.

### 8.2 Memory writes

Every SiteBook event:

- Writes to Memory (per Phase 26 schema)
- Tagged with project + trade + region
- Contributes to cross-project pattern lending (K-anonymised)
- Feeds Trade Brain regional calibration

### 8.3 Personal Memory value

- Merchant queries their own history freely
- Cross-tenant Memory contributions gated by K-anonymity
- Merchant sees their own history unlimited · peer benchmarks tier-gated

---

## Section 9 · Site Safety

H&S integrated · not bolted on.

### 9.1 Supported records

- Safety observations (spot a hazard, photo + tap)
- Near misses (voice or text)
- Incidents (structured form — merits typed accuracy)
- Toolbox talks (schedule + attendance)
- Risk assessments (Trade Brain drafts, merchant approves)
- SWMS references (uploaded documents)
- PPE reminders (Vision detects missing PPE from photos)
- Site inductions (checklist per visitor)
- Inspection checklists (per Trade Brain)

### 9.2 Vision-detected safety issues

Vision AI processes every photo for:

- PPE presence (helmet, hi-vis, safety boots)
- Edge protection (fall risk)
- Working at height (harness, safe access)
- Housekeeping (trip hazards)
- Signage (compliant, present)

Detected issues surface as safety cards on home screen · merchant reviews.

### 9.3 Missing safety records

At end of week, Nex flags missing:

- No toolbox talk this week
- No inspection since last Wednesday
- No risk assessment for new work stage
- No PPE check documented today

Merchant sees list · addresses.

### 9.4 Incident escalation

Serious safety issue detected → immediate merchant notification (regardless of vacation mode) · optional escalation to H&S officer if configured.

---

## Section 10 · Project Timeline

Chronological, replayable project record.

### 10.1 Timeline surfaces

- Every SiteBook event
- Every Twin event
- Every scheduled task
- Every completed task
- Every photo
- Every voice note
- Every delivery
- Every inspection
- Every approval
- Weather overlay
- Labour hours overlay

### 10.2 Replay mode

Merchant + homeowner can scrub through project history:

- Day-by-day playback
- Photo-first view
- Voice notes playable
- Weather + labour context per day

### 10.3 Timeline filters

- Filter by trade
- Filter by event kind
- Filter by author
- Filter by date range
- Search by keyword

### 10.4 Handover pack derivative

Project complete → Timeline becomes handover pack (per Phase 29 blueprint). Automatically compiled.

---

## Section 11 · Mobile UX

### 11.1 Thumb-friendly

- Bottom nav (thumb reachable)
- Primary actions bottom third of screen
- Never require reaching top corners
- 56px+ touch targets for primary CTAs
- 48px minimum for anything tappable

### 11.2 Minimal typing

- Voice everywhere
- Autocomplete + suggestions
- Pick lists over free text
- Camera over description

### 11.3 Offline sync

- Every entry writes to local IndexedDB immediately
- Background sync when signal returns
- Sync status visible per entry
- Never lose data · retries indefinitely
- Merge conflict resolution (last-write-wins with audit log)

### 11.4 Fast photo uploads

- Presigned URL flow (per ES-03 §5.18)
- Direct-to-storage from device
- HEIC preferred (smaller than JPEG)
- Client-side compression before upload
- Progress indicator visible
- Background upload continues if merchant navigates away

### 11.5 Quick search

- Search bar always accessible
- Recent searches saved
- Search across projects, photos, notes, deliveries

### 11.6 Dark mode

- Auto-enabled based on device setting
- High contrast for outdoor sun glare
- OLED-friendly true black
- Manual toggle available

### 11.7 Battery efficient

- No polling (Realtime channels only)
- Vision AI runs server-side (device saves battery)
- Location only when merchant opens SiteBook (not background)
- Aggressive local caching

### 11.8 Glove-friendly

- Large touch targets (72px+ primary)
- No pinch-zoom required for common actions
- No small text-in-buttons
- Swipe gestures avoided (unreliable with gloves)

---

## Section 12 · Implementation

### 12.1 Database

Extend `hammerex_nex_sitebook_*` (existing) with:

```sql
hammerex_nex_sitebook_entries_v2 (
  id UUID PRIMARY KEY,
  merchant_slug TEXT NOT NULL,
  project_id UUID NOT NULL,
  kind TEXT CHECK (kind IN ('photo', 'voice_note', 'delivery', 'snag', 'milestone', 'inspection', 'safety', 'visitor', 'weather', 'diary')),
  content JSONB,          -- kind-specific fields
  vision_analysis JSONB,  -- Vision AI output
  transcript TEXT,        -- voice transcript if applicable
  media_asset_ids UUID[],
  device_context JSONB,   -- device, location, offline_captured
  sync_state TEXT CHECK (sync_state IN ('synced', 'pending', 'conflict')),
  captured_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  created_by UUID
);

hammerex_nex_sitebook_offline_queue (
  id UUID PRIMARY KEY,
  device_id TEXT,
  merchant_slug TEXT,
  entry_payload JSONB,
  captured_at TIMESTAMPTZ,
  sync_attempts INTEGER DEFAULT 0,
  last_error TEXT
);
```

### 12.2 APIs

```
POST /api/nex/sitebook/v2/entries/photo
POST /api/nex/sitebook/v2/entries/voice
POST /api/nex/sitebook/v2/entries/structured
POST /api/nex/sitebook/v2/entries/batch  -- offline sync bulk upload
GET  /api/nex/sitebook/v2/timeline/<project_id>
GET  /api/nex/sitebook/v2/entries/search
```

### 12.3 Offline architecture

- IndexedDB stores local entries
- Service Worker handles background sync
- Conflict resolution on server (event log is append-only, no conflicts by design)
- Merchant sees sync status per entry

### 12.4 Sync engine

- Every entry has UUID assigned client-side
- Idempotent server writes (UUID uniqueness)
- Retry with exponential backoff
- Dead-letter after 24h retry · merchant notified

### 12.5 Frontend components

`src/apps/sitebook-v2/`:

- `SiteHome.tsx` — landing site status
- `PhotoCapture.tsx` — camera flow
- `VoiceCapture.tsx` — voice diary
- `DeliveryLog.tsx` — structured delivery entry
- `SnagLog.tsx` — issue reporting
- `SafetyLog.tsx`
- `Timeline.tsx` — chronological project view
- `OfflineQueue.tsx` — sync status
- `SearchBar.tsx`

### 12.6 Backend

- `sitebook-v2/` module
- Delegates Vision AI to Phase 13 CV
- Writes Twin events per Phase 29
- Writes Memory rows per Phase 26
- Emits events per ES-02 catalog

### 12.7 AI integrations

- Vision AI (Phase 13) — photo analysis
- Web Speech API — voice transcription (client-side only)
- Trade Brains — safety checklist templates, defect classification
- Memory — cross-project pattern for snags

### 12.8 Photo processing

- Client-side compression (max 2048px, WebP where supported)
- Presigned upload direct to Storage
- Server processing async (Vision, variants, tagging)
- Original preserved for evidence integrity

### 12.9 Voice processing

- Web Speech API on device (browser-native)
- No server-side voice transmission
- Transcript sent as text
- Retention: transcript stored, no audio

### 12.10 Notifications

- Push notification when Vision detects safety issue
- Push when delivery arrives (from tracking)
- Push when inspection nears
- Web push via PWA

### 12.11 Testing

- Vitest unit tests for offline queue + sync engine
- Playwright E2E on mobile viewport
- Real-device testing on iOS Safari + Android Chrome
- Offline testing (airplane mode)
- Load testing at 1000 concurrent photo uploads
- Advisory panel field testing (real construction sites)

### 12.12 Performance targets

- Home screen render: <1s on mid-range phone
- Camera launch: <500ms
- Photo capture to visible: <2s
- Voice transcript arrival: <2s from stop-speaking
- Offline entry save: <100ms
- Sync when reconnected: <5s per entry

### 12.13 Accessibility

- WCAG 2.2 AA
- Screen reader complete
- High-contrast dark mode
- Voice input as accessibility affordance
- Large touch targets

### 12.14 Security

- Photos + voice at rest encrypted
- Merchant-scoped RLS
- Signed URLs 5-min expiry
- Device authentication via Supabase Auth
- PWA install requires HTTPS

### 12.15 Definition of Done

- All Section 12 delivered
- Advisory panel field testing signs off (5+ merchants on real sites)
- Offline scenarios verified (airplane mode + reconnect)
- Load test passes
- 90% of common on-site captures work first attempt

### 12.16 Acceptance criteria

- Photo capture → visible in Timeline <5s
- Voice note → structured entry <10s
- Offline entry preserved across app restart
- Sync completes within 5s of reconnect

### 12.17 Engineering estimate

- Offline architecture + sync engine: 3 weeks
- Camera capture + Vision routing: 2 weeks
- Voice capture + transcript processing: 2 weeks
- Structured entries + timeline: 2 weeks
- PWA + mobile UX polish: 2 weeks
- Safety module: 1 week
- Testing + advisory panel field trials: 3 weeks

**Total: ~15 engineer-weeks · Sprint 4 delivery target with 3-4 engineers parallelised.**

---

## Section 13 · Success Metrics

| Metric | V1 baseline | V2 target |
|--------|-------------|-----------|
| Daily Active Users (of active merchants) | 30% | 65% |
| Site diary completion (% of active project-days) | 20% | 60% |
| Photos uploaded per project | 12 | 40 |
| Voice usage | 5% of entries | 40% |
| Offline reliability | N/A | 99% entries preserved through offline |
| Average entry time | 3 min | 30s |
| Variation capture rate | 40% | 85% |
| Issue resolution time | 6 days | 2 days |
| Satisfaction | 3.2/5 | 4.5/5 |
| Project documentation completeness | 45% | 90% |

---

## Final CTO Review

- Cut structured incident form (voice + photo sufficient for V0 · structured only if legal req)
- Cut visitor sign-in (deferred to V2+ where enterprise contracts require)
- Cut labour timesheet integration (separate concern · not SiteBook's job)
- Simplify home screen to 4 buttons (down from 6)
- Approve for Sprint 4 delivery subject to Vision AI accuracy validated ≥90% on construction imagery

**End of Nex SiteBook V2 Spec.**
