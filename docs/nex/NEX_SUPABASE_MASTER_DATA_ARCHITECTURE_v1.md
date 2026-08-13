# NEX SUPABASE MASTER DATA ARCHITECTURE v1

**Status:** Blueprint · L2 Architecture · not a constitution
**Owner:** Philip
**Author:** Claude Code (Nex AI Engineer) · 2026-08-02
**Purpose:** the single map that every future Supabase migration references
**Scope:** the new dedicated Nex Supabase project only (`ijvqdvsvwtwxzcqmoqit`) — never the trades / hammerex / streetlocal / citydrivers projects

---

## What this document is (and isn't)

**Is:** the master information architecture for Nex's long-term memory. Names the seven data worlds, the tables inside each, who owns them, what's already built, and what is intentionally deferred.

**Isn't:**
- Another constitution (Philip 2026-08-02: *"Not another constitution. Not another capability."*)
- A build directive
- Complete SQL for every table
- A promise that everything below will be built — most of it is intentionally later-phase

---

## Governance rules for the whole database

1. **One capability = one world.** Every table belongs to exactly one of the seven worlds below. If a proposed table doesn't fit, either the world list is wrong or the table is wrong.
2. **Never cross the worlds.** Reads/writes stay inside a world's owner capability except through documented cross-world FKs.
3. **Every new capability spec MUST include a "Storage" section referencing this blueprint** and identifying which world its tables land in.
4. **Every new migration MUST use the `nex_{world}_{thing}` prefix** — with one grandfathered exception (see Legacy Naming below).
5. **Never-one-copy rule** applies to every world: Supabase (live) + Git (version history) + regular exports (daily/weekly). Detail: `reference_nex_supabase_and_image_architecture_2026_08_02.md`.
6. **Data-scope rule:** only Nex app data lives here — never trades/hammerex/streetlocal/citydrivers data.
7. **RLS defaults per world** (see per-world sections) — v1 relies on server-side session_id filtering; v2.5 adds auth-backed policies.

---

## Naming convention (Philip 2026-08-02 refinement · full-word namespaces)

Prefix: `nex_{capability}_{thing}` — full-word capability namespace, not 2-char shorthand. Every table announces its owning capability in the name.

### Approved capability namespaces (Philip verbatim)

```
nex_users_*        → Identity users (auth)
nex_profiles_*     → Identity profiles + relationships
nex_chat_*         → Chat / conversation memory
nex_projects_*     → Projects (v1 shipped)
nex_tasks_*        → Active Tasks Engine
nex_spaces_*       → Nex Spaces
nex_trade_*        → Trade Brain (authored knowledge)
nex_merchant_*     → Merchant Directory + Trade Centre
nex_images_*       → Central Image Library
nex_memory_*       → Conversation memory / summaries
nex_ai_*           → AI usage · costs · prompts
nex_learning_*     → Learning Queue (Answer Promotion Pipeline)
nex_kb_*           → General Knowledge Base
```

**Rule:** every new table falls into exactly one of these prefixes. If a proposed table doesn't fit, either the namespace list needs a new entry (rare · needs Readiness Gate) or the table is wrong.

**Why prefixes not Postgres schemas:** matches repo convention (hammerex_* · xrated_* · studio_*), simpler RLS + PostgREST auto-exposure, single migration folder, no schema-switch header dance.

### Rename done · 2026-08-02

The Project Object v1 tables shipped mid-session using an early 2-char world convention. Now renamed to match the approved full-word capability namespaces:

| Old name | New name (v1.1) |
|---|---|
| `nex_projects` | `nex_projects` (kept — main entity table for the capability) |
| `nex_project_messages` | `nex_projects_messages` ✅ renamed |

Migration file `supabase/migrations/20260802220000_nex_projects_v1.sql` updated in place — if Philip has not yet applied it, the fresh apply creates the correctly-named schema. If applied, one small ALTER TABLE covers the rename:

```sql
ALTER TABLE public.nex_project_messages RENAME TO nex_projects_messages;
```

All existing indexes/triggers/FKs already reference the table via its symbol, so the rename is transparent to them.

---

## The capability namespaces (mapping to storage)

```
Nex Supabase (ijvqdvsvwtwxzcqmoqit)
  ├── nex_users_*      · Identity — auth users
  ├── nex_profiles_*   · Identity — Living Profiles + relationships
  ├── nex_merchant_*   · Merchant Directory
  ├── nex_trade_*      · Trade Brain (authored knowledge · staircase-first)
  ├── nex_kb_*         · General Knowledge Base
  ├── nex_learning_*   · Learning Queue (Answer Promotion Pipeline)
  ├── nex_chat_*       · Chat conversation memory
  ├── nex_memory_*     · Conversation summaries + long-term memory
  ├── nex_projects_*   · Projects ✅ v1 shipped
  ├── nex_tasks_*      · Active Tasks Engine
  ├── nex_spaces_*     · Nex Spaces
  ├── nex_images_*     · Central Image Library (shared by all capabilities)
  └── nex_ai_*         · AI usage · costs · prompt library
```

Each namespace is a data world. Cross-namespace reads happen only through documented foreign keys. Every migration lands in exactly one namespace.

---

## Per-capability sheet template (Philip 2026-08-02 · Master Data Blueprint extension)

Every capability going forward has its own SHEET in this blueprint. Each sheet answers seven questions in one place, so anyone can find everything about a capability without hunting through the codebase:

```
CAPABILITY SHEET

1. UI screens          · every route/component the user sees
2. Database tables     · every nex_{capability}_* table
3. API endpoints       · every /api/nex/{capability}/* route
4. Image bucket        · which Supabase Storage buckets it reads/writes
5. AI Brain used       · which Brain(s) provide reasoning
6. Permissions         · RLS posture + role matrix
7. Ownership           · owning capability + boundaries
```

### Worked example · Trade Centre + Nex Chat merged capability (Production · v1)

**1. UI screens**
- `/nex-app/centre` · marketplace feed with Continue chip · filters · Ask Nex bar
- Merchant profile bottom sheet (from `MerchantProfileSheet.tsx`)
- Nex Chat modal (Project-backed · Start Project / Continue Project CTA)
- `/nex-app/projects` · Continue page (list)
- `/nex-app/projects/[id]` · Project detail (thread · Purpose · Project Manager · Members)

**2. Database tables**
- `nex_projects` ✅ built
- `nex_projects_messages` ✅ built (renamed)
- `nex_projects_events` deferred (state timeline)
- `nex_merchant_merchants` deferred (currently reads hammerex tables)
- `nex_merchant_photos` deferred → `nex_images_images`
- `nex_merchant_reviews` deferred

**3. API endpoints**
- `POST /api/nex/projects` ✅ create
- `GET /api/nex/projects` ✅ list
- `GET /api/nex/projects/[id]` ✅
- `PATCH /api/nex/projects/[id]` ✅ status · purpose · conversation_id · append_message
- `DELETE /api/nex/projects/[id]` ✅
- `POST /api/nex/merchant-chat` ✅ intake-agent replies
- `GET /api/nex/centre/feed` ✅ marketplace feed (interim: hammerex tables)
- `POST /api/nex/centre-search` ✅ Ask Nex bar

**4. Image bucket**
- Reads from `nex-images` bucket · `merchant/{merchant_id}/**` paths
- Interim: also reads ImageKit-hosted trade-tag pool for seeded merchants

**5. AI Brain used**
- **Intake Agent** (composeIntakeReply · authored templates · Rule A safe · no LLM synthesis) for merchant-chat responses
- **Trade Brain (Staircase)** for design questions inside chat
- **Introduction Brain** (future · composes with Discovery when unfrozen)

**6. Permissions (RLS posture)**
- `nex_projects` · owner-only via session_id (v1) → user_id (v2.5)
- `nex_projects_messages` · owner-only via project ownership
- Merchant tables (`nex_merchant_*`) · public read for published merchants
- Interim hammerex tables · existing RLS unchanged

**7. Ownership**
- Owner: Trade Centre + Nex Chat merged capability (Production · target 9.5/10)
- Owns: feed · profile sheet · Nex Chat surface within merchant context · Project object · message thread · quotation flow (future) · agreement flow (future)
- Does NOT own: Living Profiles at large (Identity capability) · calendars (Automation) · websites (Studio) · image storage (Images capability provides the bucket)

---

## World sheets (deferred capabilities · placeholder rows)

Each of these gets a full 7-field sheet at the moment its build begins. Today they're one-liners so the blueprint stays useful without exploding into design docs Philip hasn't asked for.

| Capability | Namespace | Status | Notes |
|---|---|---|---|
| Identity | `nex_users_*` · `nex_profiles_*` | Spec | Builds when auth lands · absorbs Connections redesign |
| Trade Brain | `nex_trade_*` | Partial (TS source) | Supabase runtime when scale demands |
| Learning Queue | `nex_learning_*` | Spec | Answer Promotion Pipeline |
| Chat memory | `nex_chat_*` · `nex_memory_*` | Spec | Cross-session conversation memory |
| Active Tasks | `nex_tasks_*` | Spec (deferred by freeze) | Universal commitment engine |
| Spaces | `nex_spaces_*` | Absorbed into Projects | No separate tables planned |
| Discovery | `nex_profiles_*` + candidate `nex_activity_*` | Spec (outside freeze) | See `project_nex_discovery_capability_2026_08_02.md` |
| Website Builder | `nex_studio_*` | Spec (frozen) | See `project_nex_website_builder_2026_08_02.md` |
| Images (as capability) | `nex_images_*` | Spec (freeze-compatible slice possible) | Full sheet below |
| AI usage | `nex_ai_*` | Spec | Cost + prompt library · deferred per build-first-measure-second |

Each row gets a full sheet when its build cycle starts. Blueprint stays useful today; grows only when build demands it.

---

## Storage bucket convention (Philip 2026-08-02)

Every capability's originals live in Supabase Storage, in a capability-scoped bucket. ImageKit remains the DELIVERY CDN, not the master.

```
Supabase Storage (source of truth)
  ├── nex-images/staircase        · Trade Brain reference images
  ├── nex-images/merchants        · Merchant Directory uploads
  ├── nex-images/users            · User uploads (profile · project photos)
  ├── nex-images/discovery        · Discovery activity + interest imagery
  ├── nex-images/websites         · Website Builder assets
  ├── nex-images/social           · Social posts + campaigns
  ├── nex-images/ai-generated     · AI-generated images (must be marked)
  ├── nex-projects/attachments    · Project files (per-project prefixed)
  └── (other capability-scoped buckets added as capabilities land)
```

**Rules:**
- Path structure inside each bucket: `{owner_type}/{owner_id}/{category}/{filename}.{ext}`
- Every stored file has a corresponding `nex_images_images` row (never orphan uploads)
- Public read for `approval_status = approved` · owner + admin write · variant generation via service role
- CDN URL is a computed column: ImageKit-optimized derivation of the storage path

---

## World 1 · Knowledge (`nex_trade_*` / `nex_kb_*` / `nex_learning_*`)

**Owner capability:** Knowledge Router (Conversation Brain sub-component)
**Composes with:** Brain Separation Architecture · Four-Level Cost Model · Answer Promotion Pipeline · Author-Driven Rule (ADR-0041) · repo ADR-0028/0033
**Today's storage:** TypeScript files in the trades repo (source of truth for authoring). This world's Supabase tables are the future runtime store.

| Table | Purpose | Deferred? |
|---|---|---|
| `nex_kb_brains` | One row per Brain (staircase, plumbing, electrical, ...). id · name · status · version_current | Deferred |
| `nex_kb_components` | Components within a Brain (stringers, treads, base rail, ...) | Deferred |
| `nex_kb_answers` | The authored Q&A rows. brain_id · component_id · question · answer · evidence_ids · author · version · status (draft/approved) · tags | Deferred |
| `nex_kb_evidence` | Sources / citations attached to answers (URL · PDF · ADR · manufacturer doc) | Deferred |
| `nex_kb_versions` | Full history of every authored answer edit | Deferred |
| `nex_kb_review_queue` | **The Learning Queue.** Unanswered questions land here after Level 3 answered them. Philip promotes → becomes Level 1 authored knowledge. | Deferred |
| **`nex_kb_intents`** | **The intent library** (Philip 2026-08-02). canonical intent code + example phrasings + brain hint + capability hint. Powers the Intent Engine. | Deferred (spec below) |
| `nex_kb_embeddings` | Vector embeddings for retrieval — question text → nearest answer(s) | Deferred |

### `nex_kb_intents` — spec (Philip called out)

Every user utterance maps to a **canonical intent code**. English is unlimited; intentions are not.

```
id                uuid
code              text  UNIQUE     -- e.g. "GET_STAIRCASE_QUOTE", "REMINDER_CREATE"
capability        text            -- which capability owns the fulfilment
brain_hint        text  NULL       -- which brain should answer (staircase, general, ...)
example_phrasings jsonb           -- ["I need stairs", "want stairs", "can you build stairs?"]
required_slots    jsonb           -- ["location", "budget"], populated by Second Law clarify
default_reply     text  NULL       -- optional Level 1 canned response when no data needed
status            text            -- "draft" | "approved"
created_at        timestamptz
updated_at        timestamptz
```

**Why this is powerful:** *"I need stairs" · "I want stairs" · "Can you build me stairs?" · "Need staircase"* all resolve to `GET_STAIRCASE_QUOTE` and route to the same capability with no additional English variations authored. Same for *"My insurance is due" · "Car insurance next month" · "Renew insurance"* → `REMINDER_CREATE`.

**Composes with:** Intent Engine principle in `project_nex_four_level_cost_model_2026_08_02.md`.

### RLS posture (Knowledge)

- Public SELECT on approved answers/intents (published knowledge is public)
- Authenticated author WRITE on drafts
- Admin approval on status transitions
- Review queue: authenticated admins only

---

## World 2 · Identity (`nex_id_`)

**Owner capability:** Living Profiles + Identity capability (spec · deferred per freeze)
**Composes with:** Profile & Identity System v1.0

| Table | Purpose | Deferred? |
|---|---|---|
| `nex_id_users` | Auth user identity. id · email · phone · nex_handle · verified_at | Deferred (session_id today) |
| `nex_id_profiles` | Living Profile row per user. adaptive_type (personal/trade/business) · display_name · avatar · location · bio · social · website | Deferred |
| `nex_id_handles` | Reservations + redirects for `@handle`. handle · user_id · reserved_at · retired_at | Deferred |
| `nex_id_relationships` | Accepted connections. requester_id · recipient_id · established_at · relationship_type | Deferred |
| `nex_id_connection_requests` | Pending inbound/outbound with reason + business context | Deferred |
| `nex_id_user_types` | Coarse type preference (homeowner/tradesperson/business/creator/parent/student). Even a primitive first-visit choice would populate this and enable personalization. | **Phase 2 recommended** — cheapest lever for the audit's "personalized home" recommendation |

### RLS posture (Identity)

- User reads own profile · public reads published Living Profile
- Owner writes own
- Handles table read-only public

---

## World 3 · Trade Centre (`nex_tc_`)

**Owner capability:** Trade Centre + Nex Chat merged capability (Production)
**Interim:** merchant data currently reads from the trades-repo hammerex tables via `/api/nex/centre/feed`. This world's Nex-owned merchant data lands when Living Profiles arrives (World 2).

| Table | Purpose | Deferred? |
|---|---|---|
| `nex_tc_merchants` | Nex-native merchant profile. id · nex_handle → nex_id_handles · name · trade · location · years · tier · verification_level | Deferred (hammerex today) |
| `nex_tc_services` | Services offered per merchant | Deferred |
| `nex_tc_photos` | Merchant photo pointers → `nex_im_images.id` | Deferred |
| `nex_tc_ratings` | Aggregate rating (sum · count · derived avg) | Deferred |
| `nex_tc_reviews` | Individual reviews. reviewer_id · rating · body · moderation_status | Deferred |
| `nex_tc_verification_events` | Audit trail for verification lifecycle | Deferred |
| `nex_tc_hours` | Opening hours by day | Deferred |

### RLS posture (Trade Centre)

- Public SELECT on published merchants + approved reviews
- Owner writes own merchant + own reviews
- Verification writes: admin only

---

## World 4 · Projects (`nex_pj_`) ✅ v1 SHIPPED 2026-08-02

**Owner capability:** Trade Centre + Nex Chat merged capability (Production)
**Composes with:** First Law (visibility) · Fifth Law (completion) · Project Object primitive

| Table | Purpose | v1 status |
|---|---|---|
| `nex_pj_projects` (currently `nex_projects` — see Legacy Naming) | The Project object. id · session_id · owner_user_id (nullable) · merchant_id · merchant_name · merchant_avatar_url · title · **purpose** · status · intent · conversation_id · members (jsonb) · timestamps | ✅ built |
| `nex_pj_project_messages` (currently `nex_project_messages`) | Message thread. id · project_id · role · text · created_at | ✅ built |
| `nex_pj_events` | Timeline events (state changes · quote received · survey booked · reminders sent) | Deferred |
| `nex_pj_tasks` | Sub-tasks within a project | **Explicitly parked** per Philip 2026-08-02 freeze extension ("Resist adding tasks, files, calendars, invoices, and everything else until people have actually used the workflow.") |
| `nex_pj_files` | Attached files (measurements, quotes, photos) → likely joins to `nex_im_images` for image attachments | Parked |
| `nex_pj_reminders` | Project-specific reminders (composes with `nex_au_reminders`) | Parked |

### RLS posture (Projects)

- **v1 (today)** — RLS OFF · server-side session_id filtering via `/api/nex/projects/*` routes
- **v2.5** — RLS ON · policy: `owner_user_id = auth.uid()` OR `session_id in claimed_sessions` (one-time migration attaches session_ids to newly-authed users)

### Ownership boundary

- Owns: project shape · message thread · status transitions · members list
- Does NOT own: merchant data (World 3) · image files (World 8) · reminders (World 6) · analytics (World 7)

---

## World 5 · Studio (`nex_st_`) — DEFERRED CAPABILITY

**Owner:** Website Builder + Creator Studio capabilities (deferred per Product Freeze until Trade Centre + Nex Chat = 9.5/10)
**Composes with:** Website Builder Outcome-First spec · Nex Power cost bands

| Table | Purpose |
|---|---|
| `nex_st_websites` | Website project. owner_user_id · title · theme (jsonb) · published_url · version_current · created_at |
| `nex_st_pages` | Pages within a website. website_id · slug · title · content (jsonb) · seo (jsonb) |
| `nex_st_website_versions` | Version snapshot per material edit. website_id · version_num · content_snapshot · created_at |
| `nex_st_social_posts` | Scheduled + published social posts. platform · body · media_ids → nex_im_images · scheduled_at · published_at |
| `nex_st_campaigns` | Marketing campaigns grouping posts + emails |
| `nex_st_videos` | Video asset metadata (points to Storage) |

All Studio tables **deferred**. Not building until freeze lifts.

### RLS posture (Studio)

- Owner reads own · published websites public read
- Owner writes own

---

## World 6 · Automation (`nex_au_`) — DEFERRED CAPABILITY

**Owner:** Active Tasks Engine capability (deferred)
**Composes with:** Active Tasks Engine spec · First Law · Fifth Law

| Table | Purpose |
|---|---|
| `nex_au_active_tasks` | Universal commitment engine. id · owner_user_id · title · description · status (Draft→Awaiting Confirmation→Approved→Scheduled→Running→Completed→Archived) · due_at · progress · owner · edit_history |
| `nex_au_schedules` | Cron-like schedules driving repeating tasks |
| `nex_au_notifications` | Pending outbound (push · email · in-app) |
| `nex_au_notification_devices` | Push subscription endpoints per user |
| `nex_au_reminders` | Reminder-specific rows (built on top of active tasks) |

All Automation tables **deferred**.

### RLS posture (Automation)

- Owner reads/writes own only
- Service-role writes for cron-driven side effects

---

## World 7 · Analytics (`nex_an_`) — DEFERRED per build-first-measure-second

**Owner:** Capability Intelligence capability (deferred per Philip 2026-08-02: *"Build user value first, then measure it."*)
**Composes with:** Constitution Health Report · Promise Dashboard · Capability Intelligence spec · Principle 3 (Event Log)

| Table | Purpose |
|---|---|
| `nex_an_events` | The universal event log. actor_user_id · session_id · capability · event_type · payload (jsonb) · created_at |
| `nex_an_capability_metrics` | Per-capability metric emissions. capability · metric · period · value (numeric) · dims (jsonb) |
| `nex_an_ai_usage` | Per-request AI cost. request_id · capability · level (1-4) · model · input_tokens · output_tokens · cost_pence · duration_ms |
| `nex_an_promise_scores` | Monthly Promise Dashboard rollups. period · promise (1-5) · score_pct · reason_text |

All Analytics tables **deferred until real value proven**.

### RLS posture (Analytics)

- Admin SELECT only · service-role INSERT only
- Never anonymized public dashboards without owner sign-off

---

## World 8 · Images (`nex_im_`) — Philip called out explicitly

**Owner:** Nex Image Library capability (deferred as full capability · schema plans landed early)
**Composes with:** repo ADR-0027/0028/0029/0030/0033/0034 (image DNA · master AI prompt · geometry · learning · family tree · confidence bands)
**Data-scope rule:** every image referenced anywhere in Nex lives here — Trade Centre · Website Builder · Marketing · Trade Brain · User uploads · AI generated. **One library, all consumers.**

### `nex_im_images` — the central table

```
id                    uuid PK
owner_user_id         uuid NULL           -- FK → nex_id_users when auth
owner_type            text                -- "user" | "merchant" | "system" | "ai_generated" | "library"
capability            text                -- "trade_centre" | "website" | "marketing" | "learning" | "user_upload"

-- Content classification (Philip verbatim schema)
category              text                -- "hero" | "banner" | "portrait" | "product" | ...
trade                 text NULL           -- "staircase" | "plumbing" | "electrical" | ...
room                  text NULL           -- "kitchen" | "hallway" | "bathroom" | ...
material              text NULL           -- "oak" | "ash" | "walnut" | "glass" | "steel" | ...
colour                text NULL

-- Source
source                text                -- "upload" | "ai_generated" | "library_seed" | "scan" | "camera"
original_filename     text
storage_bucket        text                -- "nex-images"
storage_path          text                -- e.g. "merchants/abc123/hero-01.jpg"
cdn_url               text NULL           -- ImageKit-optimized delivery URL
width                 int
height                int
file_size_bytes       int

-- SEO / accessibility
alt_text              text
caption               text NULL
description           text NULL
seo_keywords          text[]

-- Governance
approval_status       text                -- "pending" | "approved" | "rejected"
copyright_owner       text NULL
license               text NULL

-- ADR-0027 through ADR-0034 image intelligence stack
image_type            text                -- "hero_image" | "facebook_banner" | "instagram_banner" | ...
image_purpose         jsonb               -- {primary, secondary, tertiary}
can_become            text[]              -- which variants this image is allowed to spawn
dna_confidence        numeric NULL        -- 0.00-1.00
master_ai_prompt      text NULL
master_description    text NULL
locked_attributes     jsonb NULL

-- Analytics · basic counters
view_count            int DEFAULT 0
click_count           int DEFAULT 0
share_count           int DEFAULT 0
last_viewed_at        timestamptz NULL
avg_view_time_ms      int NULL         -- rolling average time users linger
favourite_count       int DEFAULT 0    -- how many users saved it

-- Analytics · AI-usage counters (Philip 2026-08-02 · every image learns)
used_in_websites      int DEFAULT 0    -- how many Studio websites embed it
used_in_social_posts  int DEFAULT 0    -- how many social posts embed it
generated_leads       int DEFAULT 0    -- attributable leads via nex_projects created after view

-- Analytics · learned scores (updated by nightly job)
hero_score            numeric NULL     -- 0-100 · fitness as a hero image
ctr                   numeric NULL     -- computed: click_count / view_count
popularity_score      numeric NULL     -- composite of views + shares + favourites + lead gen

-- Analytics · surfacing signal
last_recomputed_at    timestamptz NULL

created_at            timestamptz DEFAULT now()
updated_at            timestamptz DEFAULT now()
```

### Companion tables

| Table | Purpose |
|---|---|
| `nex_im_variants` | Derived variants (family tree children). parent_id · child_id · variant_type ("facebook_banner", "transparent_asset", "hero_1200x800") |
| `nex_im_relationships` | Explicit family-tree edges (parent · sibling · child) beyond variants |
| `nex_im_usage` | Where each image is used. image_id · consumer_capability · consumer_ref (merchant_id/website_id/post_id) · surfaced_at · impressions |
| `nex_im_review_queue` | AI-flagged uploads pending admin review (per ADR-0033 quality gate) |

### Storage bucket

- Bucket: `nex-images`
- Structure: `{owner_type}/{owner_id}/{category}/{filename}.{ext}` — e.g. `merchants/abc123/hero/kitchen-01.jpg`
- Public read for approved rows (matches CDN cache expectations)
- Owner + admin write

### RLS posture (Images)

- Public SELECT on rows where `approval_status = 'approved'`
- Owner writes own
- Variant generation: service-role
- View + click counters: service-role updates from event log

---

## Cross-world relationships (major joins)

```
nex_pj_projects.owner_user_id  →  nex_id_users.id
nex_pj_projects.merchant_id    →  nex_tc_merchants.id  (or hammerex_* today)
nex_pj_projects.conversation_id → (server memory · not FK)

nex_tc_merchants.nex_handle    →  nex_id_handles.handle
nex_tc_photos.image_id         →  nex_im_images.id
nex_tc_reviews.reviewer_id     →  nex_id_users.id

nex_id_profiles.user_id        →  nex_id_users.id
nex_id_relationships.*_id      →  nex_id_users.id (both sides)

nex_kb_answers.brain_id        →  nex_kb_brains.id
nex_kb_answers.evidence_ids[]  →  nex_kb_evidence.id
nex_kb_answers.intent_code     →  nex_kb_intents.code (soft ref)

nex_st_websites.owner_user_id  →  nex_id_users.id
nex_st_social_posts.media_ids[]→  nex_im_images.id

nex_au_active_tasks.owner_user_id → nex_id_users.id
nex_au_notification_devices.user_id → nex_id_users.id

nex_an_events.actor_user_id    →  nex_id_users.id  (nullable · anon events allowed)
nex_an_events.capability       →  capability registry (string enum)

nex_im_variants.parent_id      →  nex_im_images.id
nex_im_usage.image_id          →  nex_im_images.id
```

---

## Ownership table (which capability owns which world)

| World | Owner capability | Capability stage | Storage stage |
|---|---|---|---|
| Knowledge | Knowledge Router | Partial (Trade Brain in TS today) | Deferred |
| Identity | Living Profiles | Spec | Deferred (session_id today) |
| Trade Centre | Trade Centre + Nex Chat merged | Production | Deferred (hammerex today) |
| **Projects** | **Trade Centre + Nex Chat merged** | **Production** | ✅ **v1 shipped** |
| Studio | Website Builder + Creator Studio | Spec | Deferred (freeze) |
| Automation | Active Tasks Engine | Spec | Deferred |
| Analytics | Capability Intelligence | Spec | Deferred (build-first-measure-second) |
| Images | Nex Image Library | Spec | Deferred (freeze-compatible slice possible when merchant onboarding needs it) |

---

## v1 Build Set — what's actually in Supabase today

**Only these:**

- `nex_projects` (Projects capability)
- `nex_projects_messages` (Projects capability · renamed 2026-08-02 from `nex_project_messages`)

Both created by migration `supabase/migrations/20260802220000_nex_projects_v1.sql` — awaiting Philip's manual apply via SQL Editor.

**Everything else in this blueprint is documented, not built.** Blueprint sheets are backlog — each fills when the capability's build cycle starts.

---

## Phased build plan

### Phase 1 — DONE (2026-08-02)
- World 4 · Projects · `nex_projects` + `nex_project_messages`

### Phase 2 — freeze-allowlist candidates
When one of these becomes a proven need (three-question gate + freeze test):
- `nex_id_user_types` — the cheapest lever for the audit's "personalized home" recommendation
- `nex_im_images` + Storage bucket — when merchant onboarding needs upload
- `nex_pj_events` — when merchant reply pipe lands and we need a state timeline
- Rename of legacy Project tables to `nex_pj_projects` (Option A) — if freeze allows a small consistency migration

### Phase 3 — after Trade Centre + Nex Chat reaches 9.5/10 (freeze lifts)
- World 1 · Knowledge (starting with `nex_kb_intents` since Intent Engine unlocks the Four-Level Cost Model in production)
- World 2 · Identity full stack (when auth arrives)
- World 3 · Trade Centre native tables (migrate off hammerex)
- Nex Image Library full capability

### Phase 4 — the AI-OS layer
- World 5 · Studio (Website Builder)
- World 6 · Automation (Active Tasks Engine)
- World 7 · Analytics (Event Log + Capability Intelligence + Promise Dashboard)

### Not planned (until proven need · Author-Driven Rule)
- Multi-region replication
- Read replicas
- Federated queries with the hammerex Supabase
- Real-time subscriptions on every table

---

## RLS summary matrix

| World | Public read | Owner read | Owner write | Admin write | Service-role write |
|---|---|---|---|---|---|
| Knowledge | ✅ (approved) | — | ✅ (draft) | ✅ (promote) | — |
| Identity | ✅ (published profile) | ✅ | ✅ | ✅ (verification) | — |
| Trade Centre | ✅ (published) | ✅ | ✅ | ✅ (verification) | — |
| Projects | ❌ | ✅ (session/user) | ✅ | ❌ | ✅ (system) |
| Studio | ✅ (published sites) | ✅ | ✅ | ❌ | — |
| Automation | ❌ | ✅ | ✅ | ❌ | ✅ (cron) |
| Analytics | ❌ | ❌ | ❌ | ✅ (SELECT only) | ✅ |
| Images | ✅ (approved) | ✅ | ✅ | ✅ (approval) | ✅ (variants) |

---

## Never-one-copy: backups per world

Per the never-one-copy rule (`reference_nex_supabase_and_image_architecture_2026_08_02.md`):

- **Live production** — Supabase (this project)
- **Version history** — Git (this blueprint + migrations + authored TS files for Knowledge world during Phase 1-2)
- **Regular exports** — TBD job that dumps every world to JSON weekly (daily for Knowledge + Identity + Projects when those grow)

Backup job is future work — flagged here so it's not forgotten.

---

## Governance

- This blueprint is L2 Architecture · not L1 Constitutional · not L3 Implementation
- Major changes (world addition · world merge · world removal) require Readiness Gate
- Table additions within existing worlds require only a capability spec that references this blueprint
- Superseded by future `NEX_SUPABASE_MASTER_DATA_ARCHITECTURE_v2.md` when it lands · v1 stays in Git for history

---

## Related memory / repo docs

- `constitution_nex_brain_separation_architecture_2026_08_02.md` (L1 rule this blueprint operationalises for storage)
- `reference_nex_supabase_and_image_architecture_2026_08_02.md` (5-knowledge-worlds framing · never-one-copy rule · runtime vs authoritative source strategy)
- `project_nex_four_level_cost_model_2026_08_02.md` (Intent Engine · Answer Promotion Pipeline — this blueprint's Knowledge world)
- `project_nex_capability_intelligence_2026_08_02.md` (Analytics world)
- `project_nex_active_tasks_engine_2026_08_02.md` (Automation world)
- `project_nex_spaces_2026_08_02.md` (absorbed into Projects world)
- `project_nex_website_builder_2026_08_02.md` (Studio world)
- `project_nex_ai_merchant_image_intelligence_2026_08_02.md` (Trade Centre + Images cross-world)
- Repo `docs/DECISIONS/0027-nex-golden-rules-constitution.md` through `0034` (image intelligence stack that Images world persists)
- Repo `docs/DECISIONS/0041-...` (Author-Driven Rule that governs when each world is built)

---

*End of NEX_SUPABASE_MASTER_DATA_ARCHITECTURE_v1.*
