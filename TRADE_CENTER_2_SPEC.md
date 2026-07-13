# Trade Center 2.0 — Production Specification

**Owner:** Philip O'Farrell
**Doc lead:** Lead Product Designer + Lead Staff Architect (Claude)
**Status:** Canonical — every future feature evaluated through this frame
**Version:** 1.0 · 2026-07-11
**Non-negotiable frame:** Construction Operating System. Not ecommerce. Benchmark against Figma, Linear, Slack, VS Code, Stripe Dashboard, Notion, Apple HIG. Never against Amazon, Etsy, Shopify, eBay.

---

## 0. Vision & Non-Goals

### 0.1 What we're building

Trade Center is the workspace a UK/global construction professional opens every morning to run their business. The marketplace is one module. The shell wraps 20+ modules and stays visually identical across every one. Users don't think "I'm on an ecommerce website." They think "I'm inside Trade Center."

### 0.2 What we are NOT building

- Not a better Amazon
- Not a Shopify theme with vertical branding
- Not a category page with fancy filters
- Not a rebrand of the existing merchant profile system
- Not a rebuild of Studio (Studio owns merchant storefronts; Trade Center owns the marketplace shell)

### 0.3 Success metrics (workflow, not conversion)

| Amazon measures | Trade Center measures |
|---|---|
| Conversion rate | Jobs completed per merchant per week |
| Average basket | Time-to-quote |
| Impulse purchases | Repeat visits per merchant per month |
| Cart abandonment | Supplier relationships opened per user |
| Sessions | Muscle-memory adoption (⌘K daily active) |
| GMV | Time saved per user per week (self-reported + measured) |

### 0.4 Design principles

1. **The user's work is the hero.** Products decorate their day, not the reverse.
2. **The shell never changes.** Every module lives inside the same primary rail, top bar, right panel.
3. **Every row carries state.** A row without state is a menu, not identity.
4. **Reduce thinking to muscle memory.** Every action has a keyboard shortcut discoverable in ⌘K.
5. **AI in the shell, not in a submenu.** Copilot is a first-class citizen of every task.
6. **Trades speak like trades.** No "add to cart" — "add to job list." No "checkout" — "book delivery."
7. **Mobile is a native app in browser clothing.** Not a stacked desktop.
8. **The shell is the brand.** Someone who removes the logo should still recognise it.

---

## 1. Information Architecture

### 1.1 Two-tier navigation

**Primary rail (always visible, identical for every user):**
Home · Marketplace · Messages · Orders · Saved · Quotes · Estimator · Community · Business

Nine slots. Every module lives here or in ⌘K. No 10th slot without deleting one first.

**Secondary rail (context-sensitive to primary):**
- Marketplace → Trade categories with state
- Messages → Threads grouped by merchant / supplier / customer
- Orders → Deliveries by status
- Saved → Lists by job / project
- Quotes → Draft / Sent / Won / Lost
- Community → Canteens I belong to
- Business → Analytics / Team / Billing / Settings

**Pinned block (bottom of secondary rail):**
- Pinned merchants (max 5)
- Recent items (last 5, auto-populated)

### 1.2 Module contract

Every module MUST implement:

```typescript
type ModuleManifest = {
  slug: string;                    // "marketplace"
  displayName: string;             // "Marketplace"
  icon: LucideIcon;                // Store
  primaryRailPosition: number;     // 2
  routes: RouteSpec[];             // pages this module owns
  sidebarState: () => Promise<SidebarState>;  // live state for secondary rail
  commandPaletteActions: CommandAction[];      // ⌘K actions
  eventEmissions: EventSchema[];   // events this module emits
  eventListeners: EventListener[]; // events this module handles
  keyboardShortcuts: Shortcut[];   // shortcuts scoped to this module
  emptyStates: EmptyStateSpec[];   // what to show when zero data
  aiTools: AITool[];               // tools the copilot can call
};
```

No module is registered without a manifest. No module bypasses the shell.

### 1.3 Cross-module communication

- **Sync:** public API (`/api/{module}/*`) — for immediate reads
- **Async:** event bus (Postgres LISTEN/NOTIFY + durable event log table) — for eventual consistency
- **UI:** shell fires `shell:navigate`, `shell:focus`, `shell:notify` events any module can listen for
- **No cross-module DB reads.** Ever. Module A does not query Module B's tables directly.

---

## 2. Full Page Hierarchy

```
/                                       Home dashboard — "Today's Work"
/marketplace                            Marketplace home — trade grid
/marketplace/[trade]                    Category workspace
/marketplace/[trade]/[productSlug]      Product detail
/merchants                              Merchant directory
/merchants/[slug]                       Merchant storefront (renders via Studio)
/merchants/[slug]/reviews               Reviews (uses hammerex_network_reviews)
/messages                               Messaging workspace
/messages/[threadId]                    Thread view
/orders                                 Delivery Kanban
/orders/[id]                            Order detail + tracking
/saved                                  Saved lists workspace
/saved/[listId]                         List detail
/quotes                                 Quote builder workspace
/quotes/[id]                            Quote edit
/quotes/[id]/preview                    PDF preview
/estimator                              Material estimator
/estimator/[projectId]                  Project estimate
/community                              Canteens (migrated from /trade-off/yard/canteens)
/community/[slug]                       Canteen page (existing)
/business                               Business dashboard home
/business/analytics                     Revenue / orders / customer flows
/business/invoices                      Invoices in / out
/business/team                          Team & permissions
/business/billing                       Plan, cards, invoices
/business/settings                      Company profile
/trades/[slug]                          Trade profile (public identity)
/knowledge                              Knowledge base
/knowledge/[articleSlug]                Article
/settings                               Personal preferences
/settings/notifications                 Channel preferences
/settings/shortcuts                     Keyboard cheat sheet
/admin                                  Admin console (role-gated)
/admin/moderation                       Review + canteen moderation
/admin/merchants                        Merchant verification queue
```

**URL rules:**
- Trade slugs are canonical and shared across marketplace + community + trade profiles
- Nested routes always breadcrumb via URL segments, never via client state
- Filters live in URL query params (matches Linear pattern) so links are shareable
- The shell reads `pathname` to compute primary/secondary rail state

---

## 3. Complete Component Tree

### 3.1 Shell composition

```tsx
<TradeCenterShell>
  <TopBar>
    <Logo />                          {/* Yellow dot + "Trade Center" */}
    <BreadcrumbTrail />               {/* Marketplace / Plastering / Trowels */}
    <UniversalSearch />               {/* triggers ⌘K palette */}
    <ShellActions>
      <NotificationsBell />           {/* count + slideover */}
      <AICopilotToggle />             {/* opens right panel */}
      <CompanySwitcher />             {/* multi-business users */}
      <UserMenu />
    </ShellActions>
  </TopBar>

  <MainLayout>
    <Sidebar>
      <PrimaryRail>
        {MODULES.map(m => <PrimaryNavItem module={m} />)}
      </PrimaryRail>
      <SecondaryRail>                 {/* context-sensitive per current module */}
        {activeModule.sidebarState().rows.map(r => <SecondaryNavItem row={r} />)}
      </SecondaryRail>
      <PinnedBlock>
        <PinnedMerchants />
        <RecentItems />
      </PinnedBlock>
    </Sidebar>

    <MainPane>
      <PageHeader />                  {/* title + actions */}
      <PageContent>{children}</PageContent>
    </MainPane>

    <RightPanel>                       {/* task-aware, collapsible */}
      {panelSlot === "ai" && <AICopilot />}
      {panelSlot === "compare" && <ProductCompare />}
      {panelSlot === "cart" && <Basket />}
      {panelSlot === "job-list" && <JobListDrawer />}
    </RightPanel>
  </MainLayout>

  <CommandPalette />                   {/* ⌘K global overlay */}
  <ToastRegion />
  <RealtimeSubscriptions />            {/* SSE / Supabase Realtime */}
</TradeCenterShell>
```

### 3.2 Primary rail item

```tsx
<PrimaryNavItem
  icon={Home}
  label="Home"
  href="/"
  badge={notifications.count}       // shown only when > 0
  shortcut="g h"                    // "g then h" like Linear
  active={pathname === "/"}
/>
```

### 3.3 Product card v2

```tsx
<ProductCard>
  <ProductImage />                  {/* object-contain, cream bg */}
  <MerchantChip>                    {/* logo + name — always visible */}
    <MerchantLogo />
    <MerchantName />
    <VerifiedTick />                {/* if verified */}
  </MerchantChip>
  <ProductName />                   {/* max 2 lines, then ellipsis */}
  <ProductSpec />                   {/* one-line, muted */}
  <TrustRow>
    <StarRating />                  {/* stars + count */}
    <YearsTrading />                {/* "10y trading" */}
  </TrustRow>
  <PriceBlock>
    <RetailPrice />
    <TradePrice />                  {/* if user is verified trade */}
    <BulkPricing />                 {/* if applicable */}
    <BusinessAccountBadge />        {/* if user has account with merchant */}
  </PriceBlock>
  <DeliveryRow>
    <DeliveryChip />                {/* "Free tomorrow" */}
    <StockChip />                   {/* "Low stock" — only when < 20% */}
    <DistanceChip />                {/* "3.2mi — collect today" */}
  </DeliveryRow>
  <CardActions>
    <AddToJobList />                {/* was "Add to Basket" */}
    <QuickCompare />                {/* + into right panel */}
    <SaveHeart />                   {/* bookmark, not heart */}
  </CardActions>
</ProductCard>
```

### 3.4 Command Palette

```tsx
<CommandPalette>
  <SearchInput placeholder="Search or run a command…" />
  <ResultsGrouped>
    <Group title="Actions">
      <CommandRow icon={FileText} label="Quote a job" shortcut="⌘Q" />
      <CommandRow icon={MessageSquare} label="Message supplier" shortcut="⌘M" />
      <CommandRow icon={Package} label="Track order" />
      <CommandRow icon={List} label="Open saved list" />
    </Group>
    <Group title="Products">{/* semantic search results */}</Group>
    <Group title="Merchants">{/* fuzzy merchant name match */}</Group>
    <Group title="Categories">{/* trade categories */}</Group>
    <Group title="Recent">{/* last 5 things */}</Group>
    <Group title="Ask AI">
      <AIQueryRow query={input} />
    </Group>
  </ResultsGrouped>
  <Footer>
    <KeyHint keys={["↑","↓"]}>navigate</KeyHint>
    <KeyHint keys={["↵"]}>select</KeyHint>
    <KeyHint keys={["esc"]}>close</KeyHint>
  </Footer>
</CommandPalette>
```

Global bindings: ⌘K (open), ⌘⇧K (search-only), ⌘/ (focus universal search).

---

## 4. Design System

### 4.1 Token layers

Three layers, ordered by generality:

**Layer 1 — Primitives** (unchanged from brand tokens):
- `BRAND_YELLOW #FFB300`, `BRAND_BLACK #0A0A0A`, `BRAND_AMBER #F59E0B`
- `BRAND_GREEN #10B981` (in-stock/live only), `BRAND_GREEN_DARK #166534` (CTAs)
- `BRAND_RED #DC2626`, `BRAND_BLUE #3B82F6`
- Off-white surface `#FBF6EC`

**Layer 2 — Semantic** (new):
```typescript
const semantic = {
  surface: { base, subtle, muted, emphasis, inverse },
  text:    { default, subtle, muted, inverse, danger, success },
  border:  { subtle, default, strong, focus, danger, success },
  action:  { primary, primaryHover, primaryActive, secondary, danger, success },
  status:  { success, warning, danger, info, neutral }
};
```

**Layer 3 — Component** (new):
Each component pulls from semantic, never from primitives. Example: `Button.primary.background = action.primary`. This lets us dark-mode + density-mode by swapping only Layer 2.

### 4.2 Type scale

Rhythmic, matches Linear:
- `xs` 11px / 15px lh
- `sm` 13px / 18px lh
- `base` 15px / 21px lh
- `md` 17px / 24px lh
- `lg` 22px / 28px lh
- `xl` 28px / 34px lh
- `2xl` 36px / 40px lh

Never below 13px for readable copy (WCAG + `feedback_typography_wcag.md`). Font stack: Inter → SF Pro → system-ui.

### 4.3 Spacing scale

`4 8 12 16 24 32 48 64 96` — rhythmic 4/8 base. Every component margin/padding uses these; no magic numbers.

### 4.4 Elevation

Hyper-flat, five levels:
- `0` — flat (default)
- `1` — hover cards `0 1px 2px rgba(0,0,0,0.05)`
- `2` — dropdowns `0 4px 12px rgba(0,0,0,0.08)`
- `3` — modals `0 12px 32px rgba(0,0,0,0.12)`
- `4` — command palette `0 24px 64px rgba(0,0,0,0.20)`

### 4.5 Motion

Three durations, two easings:
- `fast` 100ms — micro-interactions (chip toggle, hover)
- `base` 200ms — panel open/close, dropdown
- `slow` 300ms — page transitions, sheet open

Easing: `ease-out` for enter, `ease-in` for exit. Respects `prefers-reduced-motion`.

### 4.6 Density modes

`comfortable` (default) and `compact` — trades on tablets often prefer compact. Toggle in personal settings; persisted per-device via `localStorage`.

### 4.7 Dark mode

First-class. Not "invert everything." Curated dark tokens per Layer 2. Trades work at 6am on job sites; dark mode is not vanity.

### 4.8 Iconography

Lucide only (per `feedback_lucide_icons_only.md`). No emoji-as-icon. Icons inherit currentColor + stroke-width from theme. Consistent 14/16/18/22 sizes.

---

## 5. Backend Architecture

### 5.1 Domain-Driven Design

Every module = one Bounded Context = one Postgres schema. Table prefix `tc_{module}_{table}`.

```
tc_marketplace_*     Products, variants, images, specs
tc_merchants_*       Merchants, profiles, locations, hours, delivery zones, verification
tc_orders_*          Orders, order_items, order_events, shipments
tc_messages_*        Threads, messages, message_reads
tc_notifications_*   Notifications, preferences, channels
tc_saved_*           Saved lists, list items
tc_quotes_*          Quotes, quote items, quote events
tc_estimator_*       Estimates, components, projects
tc_analytics_*       Events, sessions (denormalized)
tc_reviews_*         Extends hammerex_network_reviews — keep compatibility
tc_delivery_*        Delivery zones, tracking events
tc_community_*       Extends hammerex_canteens (migrate references)
tc_business_*        Businesses, users, permissions
tc_ai_*              Conversations, messages, tool calls
tc_search_*          Search index, synonyms, analytics
tc_media_*           Unified media objects across all modules
tc_kb_*              Knowledge base articles, categories
tc_admin_*           Audit log, admin actions
tc_shell_*           Pinned items, recent items, cross-module state
```

### 5.2 Command / Query separation (CQRS-lite)

- **Write paths**: validated at API boundary (Zod), emit domain event to `tc_shell_events` log, return 202 Accepted for async operations.
- **Read paths**: pre-computed read models optimised for the exact page query. Never join across 5 tables at request-time.
- **Denormalization is a feature.** Search index, sidebar state, home dashboard all read from read models updated by event handlers.

### 5.3 Event bus

Two channels:
- **Real-time** (Postgres LISTEN/NOTIFY → SSE to browser): order status changes, new messages, notifications
- **Durable log** (`tc_shell_events` table): every domain event stored for audit + replay + read-model rebuild

Event schema:
```typescript
{ id, kind, actor_slug, aggregate_kind, aggregate_id, payload, occurred_at }
```

### 5.4 Service boundaries

Each module exports:
- `/api/{module}/*` — public REST + server actions
- `src/modules/{module}/domain/*` — pure domain logic, no I/O
- `src/modules/{module}/infrastructure/*` — DB, cache, event bus adapters
- `src/modules/{module}/read/*` — read-model builders + queries
- `src/modules/{module}/manifest.ts` — module contract implementation

Rule: `import` from another module's manifest is allowed. Import from its `domain/*` or `infrastructure/*` is FORBIDDEN. Enforced by ESLint boundary rule.

### 5.5 Extraction strategy

Every module compiles to its own bundle. When one grows past its wall, it can be extracted to a service without touching consumers — the manifest is the only surface anyone knows about. Supabase Postgres schemas mean we can `pg_dump --schema=tc_marketplace` and move it to a dedicated cluster on the same day the module is extracted.

---

## 6. Database Schema (core tables)

### 6.1 Marketplace

```sql
CREATE SCHEMA tc_marketplace;

CREATE TABLE tc_marketplace.products (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  merchant_slug     text NOT NULL,        -- references tc_merchants.merchants.slug
  trade_slug        text NOT NULL,        -- shared taxonomy
  category_slug     text NOT NULL,
  name              text NOT NULL,
  spec_line         text,                 -- one-line under name
  description       text,
  primary_image_url text,
  price_gbp         int NOT NULL,
  trade_price_gbp   int,                  -- shown to verified trades
  bulk_pricing      jsonb,                -- [{qty, priceGbp}, ...]
  currency          char(3) NOT NULL DEFAULT 'GBP',
  stock_qty         int,
  stock_state       text CHECK (stock_state IN ('in','low','out','preorder','discontinued')),
  delivery_promise  text,                 -- "Free tomorrow" / "Free next day"
  collect_available boolean DEFAULT false,
  spec_data         jsonb,                -- structured specs for filters + comparison
  search_tsv        tsvector,             -- full-text index
  search_embedding  vector(768),          -- pgvector semantic search
  status            text NOT NULL DEFAULT 'live'
                       CHECK (status IN ('draft','live','archived')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX products_search_tsv ON tc_marketplace.products USING GIN (search_tsv);
CREATE INDEX products_embedding  ON tc_marketplace.products USING ivfflat (search_embedding);
CREATE INDEX products_trade      ON tc_marketplace.products (trade_slug, status);
CREATE INDEX products_merchant   ON tc_marketplace.products (merchant_slug, status);
```

### 6.2 Merchants

```sql
CREATE SCHEMA tc_merchants;

CREATE TABLE tc_merchants.merchants (
  slug                 text PRIMARY KEY,       -- canonical business slug
  legal_name           text NOT NULL,
  display_name         text NOT NULL,
  logo_url             text,
  trade_slugs          text[] NOT NULL,        -- can span multiple trades
  primary_trade_slug   text NOT NULL,
  verified_ch          boolean DEFAULT false,  -- Companies House
  verified_insurance   boolean DEFAULT false,
  verified_trades_body boolean DEFAULT false,
  years_trading        int,
  response_time_hrs    numeric,                -- rolling median
  avg_star_rating      numeric,                -- from tc_reviews
  review_count         int,
  home_postcode        text,
  lat                  double precision,
  lng                  double precision,
  delivery_radius_mi   int,
  business_accounts    boolean DEFAULT false,
  bulk_pricing         boolean DEFAULT false,
  fast_response        boolean DEFAULT false,  -- responds within 1h business hours
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX merchants_trade ON tc_merchants.merchants USING GIN (trade_slugs);
CREATE INDEX merchants_geo   ON tc_merchants.merchants (lat, lng);
```

### 6.3 Orders

```sql
CREATE SCHEMA tc_orders;

CREATE TABLE tc_orders.orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_slug          text NOT NULL,          -- trade/customer
  merchant_slug       text NOT NULL,
  status              text NOT NULL CHECK (status IN
    ('placed','accepted','preparing','dispatched','out_for_delivery','delivered','cancelled','refunded')),
  subtotal_gbp        int NOT NULL,
  delivery_gbp        int NOT NULL DEFAULT 0,
  vat_gbp             int NOT NULL DEFAULT 0,
  total_gbp           int NOT NULL,
  delivery_address    jsonb,
  delivery_type       text CHECK (delivery_type IN ('delivery','collect')),
  requested_slot      tstzrange,              -- delivery window request
  confirmed_slot      tstzrange,
  stripe_session_id   text,                   -- via existing Checkout flow
  placed_at           timestamptz NOT NULL DEFAULT now(),
  delivered_at        timestamptz
);

CREATE TABLE tc_orders.order_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES tc_orders.orders(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL,          -- soft-reference (products may archive)
  product_snapshot    jsonb NOT NULL,         -- name/spec/image at purchase time
  qty                 int NOT NULL,
  price_gbp           int NOT NULL
);

CREATE TABLE tc_orders.order_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES tc_orders.orders(id) ON DELETE CASCADE,
  kind                text NOT NULL,
  actor_slug          text,
  note                text,
  meta                jsonb,
  occurred_at         timestamptz NOT NULL DEFAULT now()
);
```

### 6.4 Messages

```sql
CREATE SCHEMA tc_messages;

CREATE TABLE tc_messages.threads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL CHECK (kind IN ('buyer_merchant','trade_trade','support')),
  subject       text,                          -- optional
  participants  text[] NOT NULL,               -- slugs
  last_message_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tc_messages.messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     uuid NOT NULL REFERENCES tc_messages.threads(id) ON DELETE CASCADE,
  author_slug   text NOT NULL,
  body          text NOT NULL,
  attachments   jsonb DEFAULT '[]'::jsonb,
  sent_at       timestamptz NOT NULL DEFAULT now(),
  edited_at     timestamptz,
  status        text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','deleted'))
);

CREATE TABLE tc_messages.message_reads (
  thread_id     uuid REFERENCES tc_messages.threads(id) ON DELETE CASCADE,
  reader_slug   text,
  read_up_to    timestamptz NOT NULL,
  PRIMARY KEY (thread_id, reader_slug)
);
```

### 6.5 Saved lists / Quotes / Estimator

```sql
CREATE SCHEMA tc_saved;
CREATE TABLE tc_saved.lists (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_slug      text NOT NULL,
  name            text NOT NULL,
  job_reference   text,                       -- e.g. "Watson kitchen"
  shared_with     text[] DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tc_saved.list_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id         uuid NOT NULL REFERENCES tc_saved.lists(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL,
  qty             int NOT NULL DEFAULT 1,
  note            text,
  position        int NOT NULL,
  added_at        timestamptz NOT NULL DEFAULT now()
);

CREATE SCHEMA tc_quotes;
CREATE TABLE tc_quotes.quotes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_slug      text NOT NULL,               -- the trade issuing the quote
  customer_ref    text,                        -- customer email/phone/name
  job_reference   text,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft','sent','viewed','accepted','declined','expired','converted')),
  currency        char(3) NOT NULL DEFAULT 'GBP',
  subtotal_gbp    int NOT NULL DEFAULT 0,
  vat_gbp         int NOT NULL DEFAULT 0,
  labour_gbp      int NOT NULL DEFAULT 0,
  markup_pct      numeric NOT NULL DEFAULT 0,
  total_gbp       int NOT NULL DEFAULT 0,
  valid_until     date,
  pdf_url         text,
  sent_at         timestamptz,
  viewed_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE SCHEMA tc_estimator;
CREATE TABLE tc_estimator.projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_slug      text NOT NULL,
  name            text NOT NULL,
  trade_slug      text NOT NULL,
  dimensions      jsonb,                       -- structured room / area dims
  ai_prompt       text,                        -- what the user asked
  components      jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_gbp       int,
  status          text NOT NULL DEFAULT 'draft',
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

### 6.6 Shell state

```sql
CREATE SCHEMA tc_shell;

CREATE TABLE tc_shell.pinned (
  user_slug     text,
  kind          text CHECK (kind IN ('merchant','product','category','list')),
  target        text,
  position      int,
  pinned_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_slug, kind, target)
);

CREATE TABLE tc_shell.recent (
  user_slug     text,
  kind          text,
  target        text,
  seen_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_slug, kind, target)
);

CREATE TABLE tc_shell.events (            -- durable event bus log
  id            bigserial PRIMARY KEY,
  kind          text NOT NULL,
  actor_slug    text,
  aggregate     text,
  aggregate_id  text,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_kind_time ON tc_shell.events (kind, occurred_at DESC);
```

### 6.7 Row-Level Security

Every table starts with `ENABLE ROW LEVEL SECURITY`. Public reads open only where the domain says so (merchants, products, live reviews). All writes go through `supabaseAdmin` via server-side APIs — never the anon key. This preserves existing patterns from `hammerex_canteens` etc.

---

## 7. API Structure

### 7.1 Endpoint conventions

```
GET    /api/{module}/{resource}          — list
GET    /api/{module}/{resource}/[id]     — read
POST   /api/{module}/{resource}          — create
PATCH  /api/{module}/{resource}/[id]     — update
DELETE /api/{module}/{resource}/[id]     — delete
POST   /api/{module}/{resource}/[id]/[action]  — command
```

### 7.2 Response envelope

```typescript
type ApiResponse<T> =
  | { ok: true; data: T; meta?: { cursor?: string; total?: number } }
  | { ok: false; error: string; detail?: string; fields?: Record<string,string> };
```

Consistent across every endpoint. Client type-narrows on `ok`.

### 7.3 BFF endpoints for pages

Every route has a corresponding `GET /api/pages/{route}` that returns EVERYTHING that page needs in one round-trip. Home dashboard's page endpoint returns notifications count, orders in-flight, quotes waiting, deliveries this week, saved carts — all in one call. Cuts waterfalls dead.

### 7.4 Server actions vs REST

- **Server actions** for form-driven mutations (composer post, quote save)
- **REST + JSON** for everything else (fetches, cross-module clients)
- **SSE / WebSocket** for real-time (order status, messages, notifications)

### 7.5 Idempotency & rate limits

- Every write endpoint accepts `Idempotency-Key` header
- Global rate limit: 60 req/min per user, 600 per IP
- Command-level limits enforced per action (e.g. `send_message` capped at 30/min per thread)

### 7.6 ETags & caching

- `GET` responses carry ETag
- Client sends `If-None-Match` for cache validation
- Edge caches merchant profiles + product detail pages with 60s stale-while-revalidate

---

## 8. State Management

### 8.1 Layers

| Layer | Store | Owner |
|---|---|---|
| Server data | TanStack Query | React Query cache |
| Cross-shell state | Zustand | Sidebar collapsed, cmd palette open, RT panel slot |
| URL state | Next.js router | Filters, sort, active tab |
| Real-time channels | Supabase Realtime | Order status, messages, notifications |
| Optimistic UI | TanStack Query mutations | Immediate feedback + rollback |
| Persistent client | localStorage / IndexedDB | Preferences (LS), drafts (IDB) |

### 8.2 Rules

- **Server state is never mirrored in Zustand.** Query is the source of truth.
- **URL state is never mirrored in Zustand.** Router is the source of truth.
- **Optimistic updates always have a rollback path.** No exceptions.
- **Offline drafts live in IDB.** Quotes and estimator projects survive tab crash.
- **Realtime updates invalidate Query caches** — receiving `order.status_changed` triggers `queryClient.invalidateQueries(['orders', orderId])`.

---

## 9. Search Architecture

### 9.1 Three-layer stack

**Layer 1 — Keyword** (Postgres):
- `pg_trgm` for fuzzy match ("truwl" → "trowel")
- `tsvector` for BM25-style full-text
- Synonym table `tc_search.synonyms` — "sparks" ↔ "electrician"

**Layer 2 — Semantic** (pgvector):
- Embeddings on product name + description + specs
- `voyage-3-large` or comparable model, cached
- Query embedding at request time, hybrid rerank

**Layer 3 — Intent** (LLM router):
- Fast small model (Haiku) classifies query as `product | merchant | command | question | comparison`
- Router dispatches to appropriate handler:
  - `product` → hybrid search
  - `merchant` → fuzzy merchant lookup
  - `command` → command palette action match
  - `question` → hand to AI copilot
  - `comparison` → open compare drawer with named products

### 9.2 Query flow

```
Client input
  ↓ debounce 150ms
POST /api/search?q=...&kind=auto
  ↓
Intent router (25ms Haiku call, cached by query prefix)
  ↓
Dispatch:
  hybrid search (BM25 + vector rerank) → results grouped
  merchant fuzzy lookup                 → merchant rows
  command matcher                       → action rows
  AI question                           → SSE stream to copilot
  ↓
Response: { groups: [ {kind, rows}, ... ], intent }
```

### 9.3 Voice + image

- **Voice**: browser MediaRecorder → Whisper API → text query → same `/api/search` endpoint
- **Image**: upload → CLIP embedding → vector-only search on product embeddings

### 9.4 Analytics

Every query logged to `tc_search.queries` with intent, result count, first-click result, time-to-click. Retrained synonyms + boost rules weekly.

---

## 10. AI Architecture

### 10.1 Runtime

- **Reasoning**: Claude Opus 4.7 (per `feedback_model_opus_47.md`)
- **Latency-sensitive**: Claude Haiku 4.5 (command palette intent, quick answers)
- **Streaming**: SSE from `/api/ai/chat` → typed characters in copilot panel

### 10.2 Tool-use pattern

The copilot has tools registered by modules:

```typescript
type AITool = {
  name: string;                  // "search_products"
  description: string;
  parameters: JSONSchema;
  handler: (args, ctx) => Promise<ToolResult>;
};
```

Modules register their own tools at boot:
- Marketplace: `search_products`, `get_product`, `compare_products`
- Merchants: `find_merchant`, `get_merchant`
- Orders: `list_my_orders`, `get_order_status`, `track_delivery`
- Estimator: `estimate_materials`, `calculate_area`, `calculate_volume`
- Quotes: `create_quote_from_list`, `send_quote_to_customer`
- Saved: `add_to_list`, `create_list_from_products`
- Messages: `send_message_to_merchant`, `search_threads`

### 10.3 System prompt (kernel)

Reflects platform voice + safety:
- Speak like a trade to a trade. Not corporate. Not chirpy.
- Never invent product specs. If unsure, say so and cite source.
- Never quote a price you can't back with a live product row.
- Prefer local merchants (within 30 miles) when the user has geolocation.
- Refuse medical/legal advice. Refer to a professional.
- Every recommendation shows the merchant name + price + distance.

### 10.4 Session model

```sql
CREATE TABLE tc_ai.conversations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_slug    text NOT NULL,
  title        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tc_ai.messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES tc_ai.conversations(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('user','assistant','tool')),
  content          text,
  tool_calls       jsonb,
  tool_call_id     text,
  sent_at          timestamptz NOT NULL DEFAULT now()
);
```

Conversations resume across sessions. User can pin a conversation to a job.

### 10.5 Cost control

- Per-user monthly token cap (free: 5k reasoning tokens; Pro: 500k; Business: 5M)
- Router downgrades to Haiku when Opus quota is exceeded
- Every completion logged to `tc_ai.usage` for billing/observability

### 10.6 Where AI lives in the UI

1. **Right panel copilot** — persistent, cross-page
2. **Command palette** — ⌘K "Ask AI" is always the last group
3. **Inline card suggestions** — "Find cheaper alternative" chip on every product card
4. **Empty states** — every empty state suggests an AI action ("Ask AI to build your first quote")
5. **Estimator** — natural-language input → structured estimate
6. **Search** — questions dispatch to copilot inline

---

## 11. Performance Plan

### 11.1 Service Level Objectives

| Metric | Target | Measurement |
|---|---|---|
| TTFB p95 | < 400ms | Vercel edge logs |
| LCP p95 | < 1.8s on 4G | RUM |
| INP p95 | < 200ms | RUM |
| Command palette open | < 100ms | Client timer |
| Product card render (30 items) | < 100ms | Client timer |
| Search first result | < 300ms | Server timer |
| AI first token | < 800ms | Server SSE start |

### 11.2 Techniques

- **Server Components by default.** Client only for interactivity.
- **Route prefetch on hover** for every sidebar link.
- **BFF endpoints** collapse waterfalls (Section 7.3).
- **Edge middleware** does auth check + geo lookup in <5ms.
- **Image transform** via Supabase Image Transform, cached at edge.
- **Virtualized lists** (react-virtual) for any grid over 100 items.
- **Web Workers** for heavy client math (estimator).
- **Service Worker** for offline shell + last-viewed items.
- **Bundle strategy**: shell + core = always. Each module = code-split, prefetched on hover.
- **Progressive hydration**: shell hydrates first; main pane streams.
- **HTTP/3** + `Priority` hints on above-the-fold images.

### 11.3 Caching

- Merchant profiles: ISR 60s
- Product detail: ISR 60s
- Category grid: ISR 30s (revalidate on `product.updated` event)
- Home dashboard: no cache (per-user + realtime)
- Search results: no cache
- Static assets: 1 year immutable

---

## 12. Mobile Architecture

### 12.1 Not a stacked desktop

Mobile is designed first. Desktop is what you get when the viewport grows past `lg`. Key differences:

| Concern | Mobile | Desktop |
|---|---|---|
| Navigation | Bottom tab bar (5 items) | Left sidebar (9 items) |
| Command palette | Bottom sheet | Center modal |
| Right panel | Bottom sheet, drag-to-expand | Right column, resizable |
| Product grid | 2 col | 4 col |
| Filters | Full-screen sheet | Persistent sidebar |
| Search | Header search opens full-screen | Header inline |
| Actions | Bottom sticky bar | Header actions |

### 12.2 PWA

- Installable via manifest.json
- Add to Home Screen — becomes app-shell that lives outside browser chrome
- Service Worker caches shell + last 50 products + drafts
- Web-Push notifications (order status, messages)
- Voice search from mic button (Web Speech API + Whisper fallback)
- Image search from camera icon
- Native share sheet for saved lists

### 12.3 Offline behaviour

Fully functional:
- View last-seen products (image + name + price)
- Draft new quotes (persisted to IDB, synced on reconnect)
- Draft new estimates (same pattern)
- Read messages you've already loaded
- Compose messages (queued for send on reconnect)

Not functional offline:
- Live search (requires server)
- Checkout (requires Stripe)
- AI (requires server)

Sync banner shows pending queue when back online.

### 12.4 Touch targets

Minimum 44×44 (Apple HIG + `feedback_typography_wcag.md`). Density mode never shrinks below this on mobile.

---

## 13. Desktop Architecture

### 13.1 Keyboard-first

- Every action has a shortcut
- `?` opens cheat sheet (like Notion / Linear)
- ⌘K opens command palette
- ⌘\ collapses sidebar
- `g h` navigates to Home; `g m` to Marketplace; `g o` to Orders (Linear pattern)
- `j` / `k` move between rows in any list
- `enter` opens focused row
- `esc` closes any panel

### 13.2 Multi-tab awareness

Each open tab has its own URL state. Users open Marketplace in one tab, Quotes in another, work in both. No global-store leakage between tabs.

### 13.3 Split-pane comparison

Right panel expands to full-width when user compares 2+ products. Grid on left, comparison table on right, both scroll independently.

### 13.4 Print-optimized

Quotes and estimates have print CSS with brand header, structured layout, no shell chrome. Native "Save as PDF" produces professional artifacts.

### 13.5 Density controls

`comfortable` default, `compact` for power users (settings). Compact mode: 30% more rows per viewport, smaller padding, 13px base type. Feels like Linear compact.

---

## 14. Accessibility

### 14.1 Non-negotiable baseline

- **WCAG 2.2 AA** (upgrade from 2.1)
- All interactive elements 44×44 minimum
- Focus rings 2px visible, keyboard-navigable
- No mouse-only interactions
- Screen reader tested with NVDA + VoiceOver
- `prefers-reduced-motion` respected globally
- Colour contrast enforced at build-time (design-token linting)

### 14.2 Structure

- Semantic landmarks (`<nav>`, `<main>`, `<aside>`, `<footer>`)
- Skip-to-content link on every page
- Language attribute on every page
- Every image has meaningful `alt` OR `alt=""` if decorative

### 14.3 Live regions

- Toast notifications → `aria-live="polite"`
- Order status changes → `aria-live="polite"`
- Errors → `aria-live="assertive"`
- Command palette results → `aria-live="polite"` + `role="listbox"`

### 14.4 Screen reader mode

Command palette's screen-reader announcement: "Command palette. Search or run a command. Actions available. Products available. Merchants available. Categories available. Recent items. Ask AI." Users can Tab through groups.

### 14.5 Keyboard traps

Any modal, palette, or panel traps focus while open and returns focus on close (Radix or Dialog primitives handle this correctly if adopted).

---

## 15. Security

### 15.1 Auth

- **Sessions**: existing HMAC-signed `xrated_trade_session` cookie
- **2FA**: optional for personal; required for `business_admin` and `admin` roles
- **Session TTL**: 30 days rolling; forced re-auth for sensitive actions (billing, team changes)

### 15.2 Authorization

Role model:
```
user           — default; can browse, buy, message, save
trade          — verified tradesperson; sees trade prices, can post to canteens
merchant       — has products live; manages own storefront
business_admin — owns a Business account; can manage team + billing
admin          — platform admin; sees moderation console
```

Permission check pattern:
```typescript
if (!can(session, "orders.read", { merchantSlug })) return unauthorized();
```

Permissions are declarative, stored in `tc_business_permissions`.

### 15.3 CSRF

- SameSite=Strict cookies
- Double-submit token on state-changing endpoints
- Server actions get CSRF for free via Next.js

### 15.4 Data protection

- PII (phone, address) encrypted at rest via pgcrypto column encryption
- Secrets in `.env`, never in client bundle
- Service role key never leaves server
- PAT rotated annually (per Philip's call)
- Audit log for every admin action → `tc_admin.audit_log`

### 15.5 Rate limiting

- Global: 60 req/min per user, 600 per IP
- Auth endpoints: 10 attempts / 15 min per IP
- AI endpoints: monthly token cap per role tier
- Search: 300 queries / min per user

### 15.6 Content Security Policy

Strict CSP with allowlist for Supabase, Stripe, ImageKit, Vercel, Anthropic. No `unsafe-inline`. Nonces on runtime scripts.

### 15.7 Payments

Stripe Checkout Session (existing pattern per `feedback` memory). We never see card data. PCI scope = SAQ-A.

---

## 16. Workflows

### 16.1 Marketplace workflow (customer trade)

```
1. Trade opens / (home)
   → sees "Today's Work": 2 quotes waiting, 3 deliveries, 1 supplier replied
2. Clicks Plastering in sidebar
   → Category workspace; state chip on sidebar row shows "3 in basket"
3. Uses filters or search to find product
4. Clicks product card
   → Product detail in main pane; comparison drawer opens in right panel
   → Merchant chip prominently shown; distance calculated from user postcode
5. Adds to Job List (not "basket" — job-scoped)
6. Adds 3 more products; right panel shows running total
7. Opens Job List page → drags order into 2 groups by delivery date
8. Clicks "Book delivery" → checkout via Stripe Checkout Session
9. Lands back in Orders with tracking already visible
10. Order events stream in real-time as merchant updates status
```

### 16.2 Merchant workflow

```
1. Merchant signs up via /trade-off/join
2. Onboarding: verify Companies House + insurance + trade
3. Merchant lands in /business dashboard
   → sees revenue this month, orders in-flight, unread messages, review response queue
4. Uses Studio to design storefront (existing system)
5. Adds product via Studio → published to Trade Center marketplace
6. Order comes in → notification + right-panel Order preview
7. Merchant confirms + sets confirmed delivery slot
8. Merchant uploads dispatch confirmation → status flips to dispatched
9. Delivery driver marks delivered → order closes
10. Review lands 24h later → merchant has 72h to respond (existing flow)
11. Merchant sees monthly review score in /business/analytics
```

### 16.3 Customer (buyer) workflow

Same as trade workflow but:
- Trade prices hidden
- Bulk pricing hidden unless verified business account
- Estimator restricted to consumer-friendly categories (paint, tile, flooring)
- Access to Canteen posts but cannot post
- Full access to reviews, messaging, saved lists

### 16.4 Admin workflow

```
1. Admin logs in via /admin/login
2. Dashboard shows system health (KPIs, error rate, queue depths)
3. Moderation queue: pending reviews (72h window), disputed reviews, canteen reports
4. Reviews moderated one at a time (existing `/admin/network-reviews` flow)
5. Merchant verification queue: check Companies House + insurance docs
6. Every admin action logged to tc_admin.audit_log
7. Admin cannot see user PII without justified reason logged
```

---

## 17. Implementation Roadmap

### Phase 0 — Foundation (weeks 0–2)

- **Design system:** semantic tokens, elevation, motion, density modes, dark mode primitives
- **Shell components:** `TradeCenterShell`, `Sidebar`, `TopBar`, `RightPanel`, `CommandPalette` skeleton
- **Home dashboard:** "Today's Work" strip with real BFF endpoint
- **Module contract types + registry:** `ModuleManifest`, module loader
- **Event bus:** `tc_shell.events` table + Postgres NOTIFY channel + SSE endpoint
- **Migrate existing routes into shell** without changing behaviour (marketplace, messages, orders, saved from existing surfaces)
- **Command palette v0** — search + navigate only

**Exit criteria:** Empty shell renders. Home dashboard shows real user data. Sidebar navigates between existing pages inside the new shell.

### Phase 1 — Marketplace v2 (weeks 3–5)

- Product card v2 with merchant identity + trust signals + delivery
- Category workspace with state-aware sidebar chips
- Sub-category chip row (not slider — real chips)
- Filters below categories (Baymard-compliant)
- Merchant chip always visible
- Local supplier detection via edge geolocation
- Bulk pricing + trade discount rendering
- Product detail v2 with comparison drawer

**Exit criteria:** Buying a trowel from a specific merchant takes 3 clicks from home. Search finds it via keyword OR synonym. Merchant chip surfaces distance.

### Phase 2 — Modules Alive (weeks 6–8)

- Messages workspace (SSE-backed real-time)
- Orders workspace (Kanban with real-time status updates)
- Saved Lists workspace (drag-and-drop from grid)
- Quotes workspace v1 (PDF export)
- Estimator workspace v1 (basic material calc, one trade at a time)

**Exit criteria:** A trade can quote a job in Quotes, drop the products onto a Saved List, then message the merchant to negotiate — all inside the shell, without page reloads.

### Phase 3 — AI Layer (weeks 9–11)

- Command palette becomes universal (actions + products + merchants + AI)
- AI copilot in right panel — persistent across pages
- Semantic search (pgvector) live
- Product embeddings back-filled
- AI recommendations on product cards ("Find cheaper alternative")
- Natural language quote/estimate generation

**Exit criteria:** User types "estimate materials for a 4x5m kitchen refit" into ⌘K, gets a draft quote from the copilot inside 5 seconds.

### Phase 4 — Business Dashboard (weeks 12–14)

- Analytics module (revenue, orders, customer flows) — Chart.js or Tremor
- Team management, roles, permissions
- Business account tiers with Stripe subscription
- Multi-company switcher (top bar)
- Business-scoped billing (Stripe Connect)

**Exit criteria:** A 3-person plastering business can invite team members, assign roles, see monthly revenue, download VAT-ready invoices.

### Phase 5 — Mobile + Offline (weeks 15–16)

- Mobile-first redesign (not a stacked desktop)
- Bottom tab bar navigation
- Bottom-sheet command palette
- PWA installable + Service Worker
- Offline drafts (IDB for quotes/estimates)
- Push notifications
- Voice search (Whisper API)
- Image search (CLIP embeddings)

**Exit criteria:** A trade on a job site with 2 bars of signal can compose a quote, browse cached products, and send a message queue that syncs when reconnected.

### Phase 6 — Polish (weeks 17–18)

- Accessibility audit + fixes (NVDA / VoiceOver)
- Dark mode ship
- Density modes (comfortable / compact)
- Empty states designed for onboarding
- In-shell onboarding tour (spotlight tour like Linear)
- Cheat sheet at `?`
- Print styles for quotes/estimates

**Exit criteria:** WCAG 2.2 AA passes external audit. Dark mode feels native. A power-user can operate the platform with zero mouse.

### Phase 7 — Launch (weeks 19–20)

- Marketing site aligned with new visual language
- Public API for partners
- Documentation portal (Mintlify or similar)
- Merchant onboarding automation
- Analytics dashboard for platform team

**Total: ~20 weeks / 5 months** at a 3-person team pace. Compressible to **12 weeks** with a 5–6 person team, provided design + engineering are locked-in on the same spec (this doc).

---

## 18. Assumptions I'm Challenging

### 18.1 "Every trade wants an OS"

**False.** The 2-jobs-a-week sole trader wants to buy nails, not run a business inside a workspace. **Consequence:** ship a `simple` mode alongside `workspace` mode. Simple = product grid + basket. Workspace = full shell. Photoshop has Elements. Figma has FigJam. Trade Center should have both.

### 18.2 "Trade categories in the sidebar make the layout the brand"

**Partially false.** If each user's sidebar reads different labels (`Plastering` vs `Electrical`), users build different muscle memory. **Fix:** the *primary* rail is identical for every user (Home / Marketplace / Messages / Orders / Saved / Quotes / Estimator / Community / Business). Trades live in the *secondary* rail, which is context-sensitive. The recognisable "brand from layout" is the primary rail — the module set — not the trades.

### 18.3 "Every module deserves a sidebar entry"

**False.** Nine primary rail slots is a hard ceiling. Reviews, Notifications, Knowledge Base, Delivery Tracking, Media Library, Search — they live *inside* modules or in the command palette. If you can't defend a 10th slot by evicting an existing one, the 10th doesn't ship.

### 18.4 "Canteens should live under Community"

**Partially true.** Community IS a canteen navigation module — but canteens ALSO belong to merchant stores as their discussion tab. **Fix:** Canteens are a primitive that shows up in three places: standalone under Community, embedded in merchant storefronts (`/merchants/[slug]/canteen`), and as a hosted discussion inside a Quote's customer share view. One primitive, three surfaces.

### 18.5 "The command palette is search"

**False.** Search is search. The palette is *actions + search*. They must feel different. Actions have icons + shortcuts. Products have images + prices. If they blend, both become worse. Group visually.

### 18.6 "Products are the hero"

**Partial truth Philip already stated.** Products are the hero on the *category page*. On the *home dashboard* the user's work is the hero. On the *quote builder* the customer relationship is the hero. On the *estimator* the calculation is the hero. Different pages, different heroes — same shell.

### 18.7 "AI should be everywhere"

**Right in principle, dangerous in execution.** AI everywhere = AI nowhere. Users learn to ignore AI chips that never help. **Fix:** AI is in the shell always (⌘K + copilot toggle). AI inline is context-earned: appears on product cards only when it has a real recommendation, not as decoration.

### 18.8 "Rebuild from scratch"

**Wrong instinct.** The Yard, Canteens, Reviews, Merchant profiles, Studio, Stripe boost flow, membership auth, `hammerex_network_*` tables — these ALREADY WORK. Trade Center 2.0 is the **shell + module registry + missing modules** (Orders workspace, Quotes, Estimator, AI copilot, command palette, cross-module state). Not a demolition. It's the operating system layer that unifies what's already there.

---

## 19. Decisions & Directives (Philip, 2026-07-11)

Every decision below is canonical. Downstream architecture flows from these.

### 19.1 Trade verification — multi-layer trust score (not a single badge)

Trust is a primary moat. Every merchant carries a visible **Trust Score** derived from independently-verifiable layers:

1. **Verified Identity** — government ID confirmed
2. **Verified Business** — Companies House match + active status
3. **Verified Trade Skills** — trades-body membership (Gas Safe, NICEIC, FMB, CITB, etc.)
4. **Verified Address** — postcode confirmed (dropped pin + utility bill)
5. **Verified Insurance** — public liability + employer's liability, current
6. **Verified Qualifications** — CSCS card, trade certifications
7. **Verified Reviews** — minimum 5 reviews, minimum 4.0 average, no outstanding disputes
8. **Verified Years Trading** — Companies House incorporation date

Each layer is independently displayed on the merchant profile (a checkmark grid, not a single blob). Trust Score = weighted composite (0–100) surfaced everywhere the merchant appears (product cards, side lane, search results, comparison drawer).

**Schema addition:**

```sql
CREATE TABLE tc_merchants.verification (
  merchant_slug         text PRIMARY KEY REFERENCES tc_merchants.merchants(slug),
  identity_verified_at  timestamptz,
  business_verified_at  timestamptz,
  skills_verified_at    timestamptz,
  address_verified_at   timestamptz,
  insurance_verified_at timestamptz,
  quals_verified_at     timestamptz,
  reviews_verified_at   timestamptz,
  years_verified_at     timestamptz,
  trust_score           smallint,      -- 0–100, recalculated daily
  updated_at            timestamptz NOT NULL DEFAULT now()
);
```

Recalculation cron runs 03:00 UTC daily. Trust Score changes emit `merchant.trust_changed` on the event bus so cards + directory listings refresh their read models.

### 19.2 Platform tiering — three levels

| Tier | Price | What's included |
|---|---|---|
| **Free** | £0 | Marketplace access, basic profile, basic selling (up to 20 products), messaging, saved lists |
| **Professional** | £14.99/mo | Business dashboard, analytics, priority placement in search, advanced AI (Opus reasoning), store customisation via Studio, business tools, inventory management |
| **Enterprise** | £39.99/mo | Multi-user teams with roles + permissions, branch management, API access, advanced reporting, white-label capabilities (custom subdomain + brand tokens) |

Free tier deliberately generous on browsing + basic selling to widen top-of-funnel per the Simple Mode principle (§21). Paywalls unlock *workflow* — the OS — not access to the marketplace.

### 19.3 Local supplier — dynamic radius, user-chosen

Not a fixed threshold. Every user picks their preferred radius from:

`Same postcode · Same town · 10 mi · 25 mi · 50 mi · Nationwide`

Stored per-user in `tc_shell.preferences` and per-session in URL query for shareability. Default: `25 mi` for logged-in trades, `Nationwide` for anonymous browsers.

Merchants also declare per-product `delivery_radius_mi` on the product row so a Nationwide-listed merchant can still be filtered out by a `10 mi` local search.

### 19.4 International from day one

Every country shares the same architecture, the same design system, and the same codebase. Only *data* is country-specific.

**Domains:**
`tradecenter.co.uk` · `tradecenter.ie` · `tradecenter.com.au` · `tradecenter.us` · (+ others as they onboard)

**Per-country data:**
- Merchants (country-scoped)
- Products (country-scoped inventory + pricing in local currency)
- Tax logic (VAT / GST / sales tax)
- Shipping providers + zones
- Trades-body verification sources (Gas Safe UK, Master Plumbers AU, etc.)
- Currency + locale formatting

**Schema pattern:** `country_code` column on `tc_merchants.merchants`, `tc_marketplace.products`, `tc_orders.orders`. Every read query filters by country. Edge middleware detects country from domain and injects it into request context.

Impact on URL structure: `/marketplace/plastering` — country lives in domain, not path. Cross-country links are impossible by design; if a merchant expands to a second country, they get a second slug in that country's namespace.

### 19.5 AI as infrastructure — cost routing

AI is not a product; it's a shell primitive. Every request routes to the cheapest model that can produce the correct answer:

| Task class | Model | Rationale |
|---|---|---|
| Command palette intent classification | Haiku 4.5 | 25ms latency, negligible cost |
| Fuzzy search reranking | Haiku 4.5 | Volume, latency-critical |
| Product recommendations | Haiku 4.5 | Simple pattern match |
| Business advice / reasoning | Opus 4.7 | Depth required, low volume |
| Estimator natural-language → structured | Opus 4.7 | Correctness matters |
| Image generation | Only on explicit user request | Highest per-call cost |
| Voice transcription | Whisper (streaming) | Cheap and battle-tested |

**Router lives in `/api/ai/dispatch`.** Every internal call goes through it. Cost per user tracked in `tc_ai.usage`. Model choice never exposed in UI — user just gets an answer. Free tier gets Haiku unlimited, Professional gets Opus generous quota, Enterprise gets Opus unlimited + custom system prompts.

### 19.6 Studio boundary — permanent separation

Studio is the **creation engine**. Trade Center is the **operating system**.

**Studio owns:**
- Trade websites
- Business landing pages
- Merchant storefront pages
- Portfolios
- Marketing pages
- Any surface that gets *designed*

**Trade Center owns:**
- Everything that runs the business *after* it's built
- Orders, messaging, quotes, estimates, analytics, reviews, delivery, saved lists, community

**Integration boundary:**
- Merchant storefronts render inside Trade Center via `/merchants/[slug]` but the *content* comes from Studio's published layouts (existing `studio_layouts` table pattern per `project_studio_module_21_foundation.md`).
- When a merchant edits their store, Trade Center's Business dashboard links out to Studio (not a Studio-in-modal — the two are separate apps sharing an auth session).

### 19.7 Simple Mode + Workspace Mode — two entry points

Not everyone wants an OS on day one. Two modes, one platform:

**Marketplace Mode** (default for anonymous + new users):
- Search
- Browse
- Buy
- Leave
- No sidebar-heavy shell — a lighter chrome that matches consumer expectations
- No forced onboarding

**Workspace Mode** (opt-in, default once a user creates a Saved List, sends a Quote, or joins a Canteen):
- Full shell
- Sidebar with live state
- Command palette
- All modules
- AI copilot in the shell

Users graduate from Simple → Workspace naturally. There is no toggle — the shell decides based on user activity signals. If a user hasn't used any workspace primitive in 30 days, the shell drops back to Simple.

This is decided at the shell level, not per-page. See §21 for the shell selector logic.

### 19.8 Marketplace philosophy — canonical

> We are not replacing Amazon.
> We are solving problems Amazon was never designed to solve.

Amazon optimises transactions. Trade Center optimises professional work. **This distinction is load-bearing.** Every feature must be evaluated against it via the Trade Center Design Principles constitution (`TRADE_CENTER_DESIGN_PRINCIPLES.md`).

### 19.9 Canteens migration path (spec-team call, not user-facing)

Redirect `/trade-off/yard/canteens/*` → `/community/*` with a permanent 301 + `Cache-Control: public, max-age=31536000`. Existing bookmarks route correctly forever. Internal links get grep-swept during Phase 0 shell migration.

---

## 20. Month 1 sequence (Philip's directive, 2026-07-11 — architecture-lock revision)

Philip revised the sequence again on 2026-07-11 after the master architecture doc landed: **Week 0 for Architecture Lock added before any implementation.** This is now canonical.

### Week 0 — Architecture Lock (no code yet)

- Approve `TRADE_CENTER_2_SPEC.md` (this doc)
- Approve `TRADE_CENTER_DESIGN_PRINCIPLES.md` (constitution)
- Approve `TRADE_CENTER_PLATFORM_ARCHITECTURE.md` (master architecture)
- Scaffold `src/platform/contracts/ModuleContract.ts` and supporting types
- Scaffold `src/platform/registry/` (module discovery + boot loader)
- Scaffold `src/platform/eventBus/` (Postgres NOTIFY + durable log)
- Ship `tc_shell.*` migrations (events, registry, pinned, recent, preferences, feature_flags)
- Ship `tc_users.*` migration (identity + roles)
- Deploy ESLint boundary rules — cross-module imports rejected at build
- Empty modules for every launch module, each with a valid manifest
- Boot integration test passes: platform starts, registry loads, palette opens

**Exit criteria:** platform boots empty. Every manifest validates. Every architectural rule enforced by CI. No feature code yet. **One architectural mistake now costs months later** — this is why the week exists.

### Week 1 — Build the Shell (no feature work)

- Persistent sidebar (primary + secondary rail scaffolding)
- Persistent top navigation
- Command palette skeleton (⌘K opens, actions register via `ModuleManifest`)
- Workspace architecture (module registry, shell context, route interception)
- Right panel scaffolding (slots for AI, compare, cart, job-list)
- Design system tokens shipped (semantic layer + dark mode primitives)

**Exit criteria:** Empty shell renders. ⌘K opens. Every existing route runs *inside* the new shell without breaking. Zero new features.

### Week 2 — Build the Workspace Layer

Transform the shell from decoration into workspace:

- Today's Work strip on Home (quotes waiting, deliveries arriving, savings this month, supplier replies, back-in-stock)
- Notifications system (real-time bell + slideover)
- Recent activity feed
- Pinned merchants block (bottom of secondary rail)
- Saved lists workspace
- Live sidebar state (every rail row carries counts, badges, pinned status)

**Exit criteria:** A logged-in user opens Home and sees their *work*, not the *market's*. This is the single change that flips the platform from "shop with sidebar" to "workspace."

### Week 3 — Marketplace Integration

Marketplace becomes the FIRST module wired to the shell — proves the module contract works end-to-end. Product cards are a subset of this ship.

- Marketplace manifest fully implemented against `ModuleContract`
- Product cards v2 (merchant identity, trust layers, delivery, distance, trade discount, business pricing, comparison quick-add)
- Category workspace with state-aware sidebar chips (sidebar row shows "3 in basket · 1 back in stock")
- Search provider registered → global search returns products alongside merchants + categories + actions
- Command palette actions registered (`marketplace.reorder`, `marketplace.compare`, `marketplace.find_local`, etc.)
- Home dashboard widget contributed by Marketplace (recent viewed / low-stock alerts on saved items)
- Redirect layer: existing `/trade-off/yard/canteens/*` routes → `/community/*` (permanent 301 per §19.9)

**Exit criteria:** No product card can be understood without seeing the merchant behind it. Marketplace proves any future module can plug in via the same contract. Moat is visible on every product surface.

### Week 4 — AI Layer

Introduce the AI assistant into the shell:

- Copilot in right panel — persistent across every page
- Copilot in ⌘K — "Ask AI" as a permanent last group
- Inline product recommendations ("Find cheaper alternative", "Compare with…", "Calculate quantity") — appear only when the AI has a real answer, never as decoration
- Cost router live per §19.5
- Tool-use pattern with the first modules registering their tools (Marketplace: `search_products`, `get_product`; Estimator: `estimate_materials`; Quotes: `create_quote_from_list`)

**Exit criteria:** A logged-in trade can ask the copilot to estimate materials for a job and receive a structured draft quote inside 5 seconds, without leaving the shell.

---

## 21. Simple Mode ↔ Workspace Mode (shell selector)

Two entry points into one platform. The shell decides which mode to render based on user activity signals — **there is no user-facing toggle.**

### 21.1 Mode assignment logic

```
if user is anonymous:
  → Marketplace Mode

if user has never created a saved list, quote, estimate, order, or canteen post:
  → Marketplace Mode

if user has performed any workspace action in the last 30 days:
  → Workspace Mode

if user has not performed any workspace action in 30 days:
  → Marketplace Mode (silent downgrade with a subtle "Return to workspace" chip in the header)
```

Session cache: mode locked for 24h after promotion to Workspace to prevent flicker. Live update: creating a Saved List while in Marketplace Mode promotes to Workspace immediately (with a subtle onboarding hint).

### 21.2 What's different in each mode

| Concern | Marketplace Mode | Workspace Mode |
|---|---|---|
| Shell chrome | Light — logo, search, cart, sign-in | Full — sidebar, command palette, top bar, right panel |
| Sidebar | Hidden | Persistent |
| Command palette | Off | ⌘K live |
| AI copilot | Hidden (inline recommendations only, in cards) | Right panel toggle + ⌘K |
| Home page | Category grid + "Today's Work" hidden | Home dashboard with Today's Work |
| Onboarding | None — start browsing | Guided tour of shell (spotlight, dismissable) |
| Modules visible | Marketplace, Merchants, Reviews | All 9 primary + Business dashboard |

### 21.3 The upgrade moment

When a user creates their first Saved List, sends their first Quote, joins their first Canteen, or places their first Order, a soft interstitial fires:

> "You've just unlocked the Trade Center workspace.
> Same platform. More tools. Muscle memory that saves you hours every week."
>
> [Show me around · Skip for now]

Non-blocking — takes them straight to the workspace either way. This is the ONLY forced onboarding moment; every other interaction is discoverable.

### 21.4 Downgrade is silent

If a user hasn't touched Saved / Quotes / Estimator / Community / Business / Messages / Orders in 30 days, the shell drops back to Marketplace Mode without an announcement. A subtle "Return to workspace" chip appears in the header for one week; if unused, disappears. No shame, no friction, no dark pattern.

---

## 22. What I'd change first if I were shipping tomorrow

The four-week sequence above IS the answer. Every item in the roadmap is scaffolding around those moves. Ship them; the OS thesis becomes real. Skip them; it remains a good-looking category page.

**Every one of these four weeks must pass the Trade Center Design Principles test (see `TRADE_CENTER_DESIGN_PRINCIPLES.md`).** No exceptions.

---

**End of specification.**

*Amendments to this doc require a written note in `docs/trade-center-2/changelog.md` and a link back from the affected section. This spec is the source of truth. Every future Trade Center feature is measured against it AND against the constitution.*
