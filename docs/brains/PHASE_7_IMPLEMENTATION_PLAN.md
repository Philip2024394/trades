# PHASE 7 IMPLEMENTATION PLAN — Merchant AI Assistant

**Status:** DRAFT — awaiting Philip's approval before any code is written.
**Version:** 1.0
**Author:** Claude, 2026-07-27

---

## Executive summary

Phase 7 asks for a **conversational AI layer** that lets merchants manage their product presence by talking to NEX. Investigation of the existing repo reveals that a **full Products app already exists** — a sophisticated 3-tier canonical/variants/offers model with event system, RLS, entitlement gating, and 10 migrations already shipped.

**The correct implementation is not to build a new products system.** It is to build a **conversational tool-use layer** on top of the existing Products app, integrated with the existing Anthropic wrapper (`src/lib/llm/anthropic.ts`) which already supports tool use and prompt caching.

This plan reflects that. Ship the AI layer + integrations. Do not rebuild what exists.

---

## Section 1 — Existing architecture summary

### 1.1 Products app (`src/apps/products/`)

Already shipped (App #006):

- **`src/apps/products/manifest.ts`** — full app manifest with plans, events, trade allowlist including `staircase-manufacturer`
- **`src/lib/products/`** — 4 files: `canonical.ts` · `offers.ts` · `read.ts` · `types.ts`
- **Three-tier data model** (per `supabase/migrations/20260715000000_products.sql`):
  - `os_products_canonical` — manufacturer-owned truth, brand-signed
  - `os_products_variants` — variant tree (colour × size × finish)
  - `app_products_merchant_offers` — merchant × canonical with local price/stock/delivery
  - `app_products_merchant_collections` — merchant curation
  - `app_products_supplier_ranges` — supplier-published selection
  - `app_products_supplier_feeds` — ingest pipeline
- **Lifecycle states already defined:** `draft | active | legacy | withdrawn`
- **Stock states:** `in_stock | low | out | preorder | discontinued`
- **Events published:** `product.published`, `product.updated`, `product.withdrawn`, `product.price_changed`, `product.stock_low`
- **10 supporting migrations:** product details tabs · FAQ · categories · calculators · warranty years · free delivery · surface flags · Hammerex fidelity
- **Constitution:** `os_*` tables read-any, write via Products routes only (RLS + entitlement). `app_products_*` tables Products-owned.

### 1.2 Anthropic LLM wrapper (`src/lib/llm/anthropic.ts`)

Already supports everything Phase 7 needs:

- **Direct fetch, no SDK dependency** (thin wrapper — one dependency less)
- **Model default:** `claude-opus-4-7`
- **Content blocks:** `text` · `thinking` · `tool_use` · `tool_result` · `image` (multimodal ready)
- **Tool definitions:** `AnthropicToolDef` type — ready for tool-use pattern
- **Prompt caching:** `cachedSystem` field — critical for repeated calls (10% of input token cost on cache hit)
- **Graceful fallback:** returns null when `ANTHROPIC_API_KEY` missing — enables template fallback

Also present:
- `src/lib/llm/composeForChannel.ts` — content composition
- `src/lib/llm/multimodal.ts` — image handling
- `src/lib/llm/voiceTraining.ts` — merchant voice training
- `src/lib/ai-visualiser/promptBuilder.ts` — prompt builder pattern

### 1.3 Existing NEX chat endpoints (`src/app/api/nex/`)

Ten existing endpoints:
- `chat/` · `staircase-chat/` · `staircase-configure/` · `brain-chat/` · `converse/` · `correction/` · `feedback/` · `history/` · `reload-brain/` · `signals/` · `centre-search/`

Chat surface + history persistence pattern already established.

### 1.4 Merchant identity + auth

- **`hammerex_trade_off_listings`** — the merchant/business table (referenced by `publisher_business_id` in products)
- **`src/lib/tradeSession.ts`** and related — merchant session infrastructure
- **`src/apps/merchant/`** — merchant app surface
- **Trade allowlist per app** — a merchant's trade type determines which apps they can install

### 1.5 Event system

- **Manifest declares `eventsConsumed` and `eventsPublished`**
- **Platform runtime routes events between apps**
- Products app already publishes `product.published` etc. — downstream apps consume

### 1.6 The NEX Brain layer (separate from platform)

Everything I've been building — `data/`, `docs/brains/`, `knowledge/` — is a **content and reasoning layer**. It is currently not wired to `src/apps/products/`. Phase 7 is where these two worlds meet.

---

## Section 2 — Gap analysis

What Phase 7 needs that does NOT exist:

| Capability | Status | Where it lives |
|---|---|---|
| Conversational merchant AI endpoint | ❌ Missing | Would be new `/api/nex/merchant-assistant/route.ts` |
| Tool-use bindings from AI → Products app helpers | ❌ Missing | New `src/lib/nex/merchant-tools/` |
| Merchant AI chat UI | ❌ Missing | New `src/app/nex-app/merchant-assistant/page.tsx` |
| Approval intermediate state (`pending_approval`) | 🟡 Partial | Products has `draft`, could extend or map |
| AI banner generation | ❌ Missing | New library + storage |
| Banner version history | ❌ Missing | New table or column |
| Auto marketing refresh cron | ❌ Missing | New cron + toggle field |
| Merchant identity in AI prompt system | 🟡 Partial | Session exists, needs prompt-builder |
| Trust guardrails in AI product creation | ❌ Missing | New guardrail library |
| Customer product search via NEX chat | 🟡 Partial | Chat exists, needs product search binding |

What EXISTS and Phase 7 should reuse:

| Capability | Where |
|---|---|
| Product create/update/read/publish | `src/lib/products/canonical.ts`, `offers.ts`, `read.ts` |
| Product data model (canonical + variants + offers) | Existing migrations |
| Anthropic tool use + prompt caching | `src/lib/llm/anthropic.ts` |
| Event bus (publish product events) | Platform runtime |
| Merchant identity + session | `src/lib/tradeSession.ts` |
| Merchant permission model (trade allowlist, entitlements) | App manifest system |
| Trust architecture rules | `docs/brains/nex-business-listing-and-trust-architecture.md` |
| Answer confidence model | `docs/brains/nex-answer-engine-confidence-model.md` |
| Design + quote + supplier engines | `data/staircase-*.json` |

---

## Section 3 — Implementation approach

**Guiding principles:**

1. **Do not rebuild the Products app.** Wrap it.
2. **Do not invent a new AI infrastructure.** Use the existing Anthropic wrapper.
3. **Fit the platform's manifest-first architecture.** The Merchant AI Assistant should be a first-class NEX capability, not an unmanaged bolt-on.
4. **Trust guardrails are code, not prompts.** Prompt-injected "don't make false claims" is not enough. Validation runs on every generated field before it reaches storage.
5. **Nothing publishes without merchant approval.** Every AI-generated change is a draft until the merchant explicitly says publish.
6. **Reuse existing content composition + voice training.** Merchant already has a voice-training layer that Phase 7 should honour.

**Architecture pattern:**

```
Merchant chat UI (React)
       ↓
POST /api/nex/merchant-assistant
       ↓
Session → identify merchant
       ↓
Load merchant context (business, existing products, voice, tier)
       ↓
Anthropic call with tool definitions:
   - create_product_draft
   - update_product_field
   - generate_banner
   - list_products
   - publish_product
   - archive_product
   - preview_change
       ↓
Tool-use loop:
   1. AI proposes tool call
   2. Server validates against guardrails
   3. Server executes via existing src/lib/products/ helpers
   4. Server returns tool_result to AI
   5. AI produces final response
       ↓
Response streamed / returned to chat UI
       ↓
Draft record created in existing product tables
       ↓
Merchant reviews → approve → publish (calls existing publish helper)
```

---

## Section 4 — Files to create

### 4.1 Library — merchant assistant core

```
src/lib/nex/merchant-assistant/
├── index.ts                    Public API barrel
├── contextLoader.ts            Load merchant business + existing products + voice for prompt
├── promptBuilder.ts            System prompt + cachedSystem construction
├── tools.ts                    AnthropicToolDef[] for the 7 merchant tools
├── toolExecutors.ts            Server-side executor per tool - validates + calls Products lib
├── guardrails.ts               Content validation (no false claims, no fake certifications)
├── bannerGenerator.ts          AI banner generation + storage
├── autoMarketing.ts            Refresh engine + toggle logic
└── types.ts                    Shared types
```

### 4.2 API endpoints

```
src/app/api/nex/merchant-assistant/
├── route.ts                    POST — main chat endpoint with tool-use loop
├── history/route.ts            GET/POST — conversation history persistence
└── approve/route.ts            POST — approve a draft, transition to active

src/app/api/nex/merchant-assistant/banner/
└── route.ts                    POST — regenerate banner variant

src/app/api/nex/merchant-assistant/preview/
└── route.ts                    GET — preview a draft product as customer would see it
```

### 4.3 UI

```
src/app/nex-app/merchant-assistant/
├── page.tsx                    Merchant-facing chat page (session-gated)
├── layout.tsx                  Layout with merchant identity banner
└── nex-merchant-assistant.css  Scoped styles

src/components/nex-app/merchant-assistant/
├── MerchantAssistantChat.tsx   Chat UI (message list + input)
├── ProductDraftCard.tsx        Card preview for a drafted product
├── BannerPreview.tsx           Live banner preview
├── ApprovalActions.tsx         Publish / Edit / Discard buttons
├── ProductListPanel.tsx        Sidebar with existing products
└── ToolActivityIndicator.tsx   Shows which tool is being executed
```

### 4.4 Cron for auto-marketing refresh

```
src/app/api/cron/nex-merchant-marketing-refresh/
└── route.ts                    Daily cron - regenerate banners for merchants with auto-marketing ON
```

### 4.5 Documentation

```
docs/brains/nex-merchant-assistant-architecture.md    Full architecture doc
docs/features/nex-merchant-assistant.md               One-line entry in features index
docs/DECISIONS/0022-nex-merchant-assistant-tool-use-pattern.md   ADR
```

---

## Section 5 — Files to modify

- **`src/apps/products/manifest.ts`** — add `eventsConsumed: ["nex.merchant_assistant.draft_created"]` if we want draft tracking events. Otherwise no change needed.
- **`src/lib/products/canonical.ts`** — verify there's a `createDraft` helper that only sets `lifecycleStatus: draft`. If not, add one. Do NOT change the existing `publish` helper.
- **`src/lib/products/types.ts`** — add optional `nex_draft_source` field (values: `merchant_ai_assistant` | `manual`) so we can filter AI-generated drafts. This is a metadata addition, not a behaviour change.
- **`docs/BLUEPRINT.md`** — will regenerate via `node scripts/scan-blueprint.mjs` after build.
- **`docs/features/index.md`** — add merchant-assistant entry.

**Explicitly not modified:**
- Existing chat endpoints (`/api/nex/chat`, `/api/nex/staircase-chat`) — they serve different audiences and stay independent.
- Products app internal logic — we call through the existing helpers, never bypass them.
- Merchant session infrastructure — we consume it, never fork it.

---

## Section 6 — Database changes

### 6.1 New migration (single migration for atomicity)

```
supabase/migrations/20260728000000_nex_merchant_assistant.sql
```

**Contents:**

```sql
-- 1. Conversation history for the merchant assistant
CREATE TABLE app_nex_merchant_assistant_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active'
);

CREATE TABLE app_nex_merchant_assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES app_nex_merchant_assistant_threads(id) ON DELETE CASCADE,
  role text NOT NULL,                    -- 'user' | 'assistant' | 'system'
  content jsonb NOT NULL,                -- Anthropic content-block shape
  tool_calls jsonb,                      -- array of tool_use blocks
  tool_results jsonb,                    -- array of tool_result blocks
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ... on merchant_id, thread_id, created_at

-- 2. Banner versions history
CREATE TABLE app_nex_merchant_assistant_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES app_products_merchant_offers(id) ON DELETE CASCADE,
  headline text NOT NULL,
  body text,
  cta text,
  visual_style text,                     -- 'premium' | 'utility' | 'seasonal' etc.
  version int NOT NULL,                  -- monotonic per offer
  is_active boolean NOT NULL DEFAULT false,
  generated_by text NOT NULL,            -- 'nex_ai' | 'merchant_manual'
  generated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  UNIQUE (offer_id, version)
);

-- 3. Auto-marketing toggle per merchant
ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS nex_auto_marketing_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nex_auto_marketing_frequency_days int NOT NULL DEFAULT 14;

-- 4. AI draft source flag on products (metadata only)
ALTER TABLE os_products_canonical
  ADD COLUMN IF NOT EXISTS nex_draft_source text;    -- 'merchant_ai_assistant' | null

ALTER TABLE app_products_merchant_offers
  ADD COLUMN IF NOT EXISTS nex_draft_source text;

-- 5. RLS policies
--    - Threads/messages: merchant sees only their own
--    - Banners: merchant sees only their own
--    - Auto-marketing fields: merchant edits only their own
```

**No changes to existing product tables' behaviour.** All existing rows unaffected.

---

## Section 7 — API changes

### 7.1 New endpoints

- **`POST /api/nex/merchant-assistant`** — main chat endpoint
  - Body: `{ thread_id?, message }`
  - Response: streamed assistant response with tool call events
  - Auth: requires valid merchant session
  - Rate limit: 60 req / 5 min per merchant

- **`GET /api/nex/merchant-assistant/history?thread_id=X`** — thread messages
- **`POST /api/nex/merchant-assistant/approve`** — approve a draft
  - Body: `{ draft_id }`
  - Executes existing Products publish helper
  - Fires `product.published` event
- **`POST /api/nex/merchant-assistant/banner`** — regenerate banner
  - Body: `{ offer_id, style?, refresh_reason? }`
  - Returns new banner draft (not activated)
- **`GET /api/nex/merchant-assistant/preview?draft_id=X`** — customer-view preview

### 7.2 Cron endpoint

- **`GET /api/cron/nex-merchant-marketing-refresh`** — daily, iterates merchants with auto-marketing enabled

### 7.3 No changes to existing endpoints

`/api/nex/chat`, `/api/nex/staircase-chat`, `/api/nex/staircase-configure` all unchanged.

---

## Section 8 — UI changes

### 8.1 New pages

- **`/nex-app/merchant-assistant`** — main merchant chat page
  - Header: merchant identity banner ("Welcome back, [Business]")
  - Left panel: existing products (sortable, filterable)
  - Centre: chat message stream
  - Right panel: current draft preview (if any)
  - Actions bar: Publish / Edit / Discard when draft in view

### 8.2 New components

Listed in Section 4.3. All isolated to `src/components/nex-app/merchant-assistant/`.

### 8.3 Integration with existing NEX shell

- Existing `src/components/nex-app/shell/NexSectionsNav` gets a new entry for "Merchant Assistant" (visible only to authenticated merchants).
- No changes to existing customer-facing chat surfaces.

---

## Section 9 — Security considerations

### 9.1 Merchant permission rules

- Every tool executor **re-checks merchant ownership** on every call. AI cannot be tricked into operating on another merchant's data even if the prompt is manipulated.
- Session validated at endpoint entry — no tool call runs without a valid merchant session.
- **Trade allowlist enforced** — merchants outside `staircase-manufacturer` and related trades can install the assistant but tools are filtered to their trade scope.

### 9.2 Trust guardrails (code, not prompt)

Every generated field passes through a validator before storage:

- **No false certifications** — regex + word-list blocking (e.g. "BSI-approved", "ISO-certified", "TrustMark verified") unless the merchant record already holds that credential in `hammerex_trade_off_listings.credentials`.
- **No comparison claims** ("better than X", "cheaper than Y") without evidence — flagged and stripped.
- **No fake awards / years** — "established 1980" blocked if `hammerex_trade_off_listings.trading_since` says otherwise.
- **No health/safety claims** ("100% safe", "child-proof") — blocked outright; user must remove.
- **No pricing that undercuts merchant's actual price** — if AI generates a promotional price, it must be equal or higher than the base offer price; percentage-off is the only legal reduction and must be marked with `promotion` block.
- **Every guardrail rejection is shown to the merchant** as a clear message ("I could not include the phrase 'BSI-approved' — this claim needs verification. Would you like me to write it without that claim?").

### 9.3 Draft-only default

- **No AI tool call ever writes to `lifecycleStatus: active`.** All creates land in `draft`. Only the explicit `/approve` endpoint (or the `publish_product` tool used after explicit merchant confirmation) transitions to active.
- **Bulk operations require confirmation per item.** AI cannot say "publish all 50 drafts" and have it happen — the tool executor requires explicit `confirm: true` per draft.

### 9.4 Rate limits + audit

- Rate limit: 60 requests per 5 minutes per merchant.
- Every AI tool call logged to `os_activity_events` with `merchant_id`, `tool_name`, `arguments`, `result`, `timestamp`.
- Audit log queryable — supports future dispute resolution and abuse investigation.

### 9.5 Prompt injection defence

- **Structural separation:** merchant chat input is never concatenated into the system prompt. It is always in the user message.
- **Tool schemas are static.** AI cannot invent new tools or bypass validators by describing them.
- **Every tool executor is a real function with type-checked args.** LLM output validated against Zod schema before execution.

---

## Section 10 — Publishing workflow

```
[Merchant chat]
      ↓
"Add this product"
      ↓
[AI proposes create_product_draft]
      ↓
[Validator runs guardrails]
      ↓
[Executor calls src/lib/products/canonical.ts::createDraft]
      ↓
Draft record with lifecycleStatus: draft, nex_draft_source: merchant_ai_assistant
      ↓
[UI shows draft preview]
      ↓
Merchant sees: Publish · Edit · Discard
      ↓
On Publish → POST /api/nex/merchant-assistant/approve
      ↓
[Server re-validates merchant ownership]
      ↓
[Calls existing publish helper]
      ↓
lifecycleStatus: active
      ↓
Fires product.published event → downstream apps update
```

For update flows: same pattern. AI proposes `update_product_field`; validator runs; executor writes to a draft revision; merchant approves; existing update path runs.

---

## Section 11 — The 7 merchant tools

Full `AnthropicToolDef` list, defined in `src/lib/nex/merchant-assistant/tools.ts`:

1. **`list_products`** — return merchant's existing products with filters
2. **`create_product_draft`** — create a new product in draft state
3. **`update_product_field`** — modify a single field on an existing product or draft
4. **`generate_banner`** — produce a banner (headline + body + CTA) for an offer
5. **`preview_change`** — return a customer-facing preview of a draft
6. **`publish_product`** — transition a draft to active (requires explicit merchant confirmation in message)
7. **`archive_product`** — withdraw an active product (requires confirmation)

Each tool has:
- Zod schema for arguments
- Server-side executor that re-checks merchant ownership
- Guardrail pass over any generated text
- Returns structured result (never freeform)

---

## Section 12 — Auto-marketing refresh design

**Purpose:** for merchants who opt in, NEX periodically refreshes banner copy to keep listings feeling current.

**Design:**
- Per-merchant toggle: `nex_auto_marketing_enabled` (boolean)
- Per-merchant frequency: `nex_auto_marketing_frequency_days` (default 14)
- Daily cron `/api/cron/nex-merchant-marketing-refresh`:
  - Loads merchants with `nex_auto_marketing_enabled = true` AND `last_refresh < now - frequency_days`
  - For each merchant's top-N products, generates a new banner version
  - Banner saved to `app_nex_merchant_assistant_banners` as `is_active: false` — merchant reviews and activates
  - Notification fired to merchant: "3 new banner variants ready for review"
- Merchant can opt out any time; drafts remain, no publish happens without their action

**No auto-publish.** Refresh generates drafts only.

---

## Section 13 — Integration with existing NEX intelligence engines

Phase 7 is where the knowledge/reasoning layer I've been building meets the transactional product layer.

- **Design recommendation engine** — when a customer designs a modern-oak-glass stair, the supplier matching engine can now return actual products (via merchant offers) that match the spec, not just company names.
- **Quote engine** — merchant assistant can ingest quote engine cost bands when a merchant asks "what should I price this at?" (advisory only, merchant decides).
- **Supplier matching engine** — already routes to merchants by category; now also routes to specific products within each merchant.
- **Country packs** — merchant assistant reads merchant's country from session, applies country-specific terminology (spindle vs baluster) when generating descriptions.
- **Answer confidence model** — when AI is unsure about a product detail (e.g. "does this timber species match the customer's floor?"), it says so at Level 5 confidence rather than guessing.
- **Trust architecture** — merchant assistant is a Verified-tier or Partner-tier feature. Listed-only merchants can view but not use the assistant to publish.

---

## Section 14 — Testing strategy

### 14.1 Unit tests (Vitest)

- Tool executors: happy path + ownership check + guardrail rejection per tool
- Guardrails: table of forbidden phrases → expected rejection
- Prompt builder: given merchant context, produces expected system prompt structure
- Banner generator: valid Anthropic response → parsed correctly

### 14.2 Integration tests

- End-to-end: merchant session → chat message → tool call → draft created → approve → published event fired
- RLS: merchant A cannot list, edit or publish merchant B's products
- Rate limit: 60 requests succeed, 61st fails
- Anthropic key missing: template fallback returns valid draft

### 14.3 Manual QA checklist

- Create product from photo
- Update price
- Generate 3 banner variants
- Publish one
- Archive one
- Auto-marketing toggle on/off
- Attempt to inject "publish all my drafts" — expect refusal
- Attempt to inject "add fake ISO certification" — expect guardrail block
- Attempt cross-merchant access — expect 403

### 14.4 Load test

- 100 concurrent merchant chat sessions
- Anthropic prompt cache hit rate > 60% after warm-up

---

## Section 15 — Risks & tradeoffs

| Risk | Mitigation |
|---|---|
| AI hallucinates false certifications | Code-level guardrails (Section 9.2) — validation not prompt |
| Merchant unhappy with AI-generated copy | All drafts, all approvable, all editable, all discardable |
| Prompt injection tries to grant elevated permissions | Static tool schemas, server-side ownership re-check on every executor |
| Anthropic API cost at scale | Prompt caching (5-min TTL), rate limits per merchant, cached merchant context |
| Migration breaks existing product data | Migration is additive only (new tables + optional columns). No data transforms. |
| Merchants confused by draft vs published states | Clear UI badges (Draft — Not Public / Live) + preview + explicit publish button |
| Auto-marketing spams merchants with refresh notifications | Frequency default 14 days, per-merchant tunable, off by default |
| AI-generated banners look generic | Reuse `voiceTraining.ts` to inject merchant voice into every generation |

---

## Section 16 — Build sequence (estimated)

Broken into ship-ready increments. Each increment can be reviewed / rolled back independently.

**Increment 1 — Foundation (2-3 days)**
- Migration `20260728000000_nex_merchant_assistant.sql`
- `src/lib/nex/merchant-assistant/` skeleton files with types + tool definitions
- `src/lib/nex/merchant-assistant/guardrails.ts` with initial word-list
- Unit tests for guardrails

**Increment 2 — Read-only tools + chat endpoint (2-3 days)**
- `list_products` tool executor
- `preview_change` tool executor
- `POST /api/nex/merchant-assistant/route.ts` with tool-use loop
- Basic chat UI (message stream + input) — read-only conversation, no writes yet
- Session gating tests

**Increment 3 — Write tools + approval workflow (3-4 days)**
- `create_product_draft`, `update_product_field`, `publish_product`, `archive_product` executors
- Ownership re-check on every executor
- `POST /api/nex/merchant-assistant/approve` endpoint
- Draft preview card in UI
- Integration tests for publish flow

**Increment 4 — Banner generation (2 days)**
- `generate_banner` tool executor
- Banner versions table integrated
- Banner preview component in UI
- Regenerate + activate flow

**Increment 5 — Auto-marketing cron (1-2 days)**
- Cron endpoint
- Per-merchant toggle UI
- Notification fires on new drafts ready
- Integration test

**Increment 6 — NEX intelligence engine integration (2-3 days)**
- Supplier matching engine reads product offers (not just merchants)
- Answer confidence model wired into merchant assistant responses
- Country pack terminology applied per merchant region
- Trust tier gating (Verified+ only)

**Increment 7 — Polish + docs (1-2 days)**
- Architecture doc `docs/brains/nex-merchant-assistant-architecture.md`
- ADR `docs/DECISIONS/0022-nex-merchant-assistant-tool-use-pattern.md`
- Blueprint regenerate
- Features index update

**Total:** ~13-19 working days. Ship-ready increments allow review after each.

---

## Section 17 — What I need Philip to confirm before building

Please confirm each — building starts only after these are settled:

1. **Confirm the wrap-existing-Products-app approach** vs building a separate NEX-native product model. I strongly recommend wrap-existing.

2. **Confirm the ownership re-check pattern** — every tool executor re-validates merchant identity even though the endpoint already gated on session. Adds ~50ms per call for defence-in-depth.

3. **Confirm draft-only default** — AI never writes to `active` directly. Only merchant approval endpoint or the `publish_product` tool after confirmation transitions to active.

4. **Confirm the guardrail word-list starting point** — I'll draft the initial list (fake certifications, false comparisons, health/safety absolutes) but the merchant assistant may need domain-specific additions for staircases (e.g. "safety-certified stair" as a bare claim). Would you like to review the word-list before shipping?

5. **Confirm trust tier gating** — Merchant Assistant available to `verified` and `partner` tier merchants only, or open to `claimed` tier too? My recommendation: `verified+` for write actions, `claimed+` for read-only (list_products, preview_change).

6. **Confirm auto-marketing default state** — I recommend **off by default**. Merchant opts in per Philip's "nothing publishes automatically" rule.

7. **Confirm the migration timing** — I'll write the migration as additive (new tables + optional columns) so it can ship before any code that uses it. Confirm this is safe with the existing 238 migrations pipeline.

8. **Confirm the endpoint path** — `/api/nex/merchant-assistant` (aligned with existing `/api/nex/*` pattern) vs `/api/nex/merchant/assistant` (deeper nesting). I recommend the first.

9. **Confirm the build sequence** — 7 increments as sketched, or would you prefer smaller / larger increments?

10. **Confirm blueprint regeneration timing** — After each increment (7 regenerations) or once at the end. I recommend once at the end to keep the doc noise down.

---

## What happens after approval

- I ship Increment 1 (foundation migration + skeleton + guardrails) first.
- I stop after Increment 1 and confirm the direction before Increment 2.
- Any deviation from this plan requires a plan update — no silent scope creep.
- Every increment ends with a commit + push + status report.

---

## What I will NOT do until approved

- Write any code
- Modify any database migration
- Touch any file in `src/apps/products/`
- Add any API endpoint
- Publish or ship anything

**Awaiting your approval on the 10 confirmation points in Section 17.**
