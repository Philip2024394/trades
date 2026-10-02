# Affiliate Journey Bridge · Spec · 2026-10-02

> ## 🔒 SEALED 2026-10-02
>
> Affiliate Journey Bridge architecture is **frozen** as of 2026-10-02.
>
> **Sealed by:** Philip (founder) · session 2026-10-02.
> **Baseline commit at seal:** `583fbfd4` on branch `main` of `Philip2024394/trades.git`.
> **Document length at seal:** 1164 lines pre-marker.
>
> **What sealing MEANS:**
> - The architectural decisions in this document are locked.
> - Changes require an explicit doctrine amendment (new revision), not an in-flight implementation detail.
> - §11.1a · §11.1b · §11.13 · §11.13.1 · §11.15 · §20 are all frozen/confirmed.
>
> **What sealing does NOT authorize:**
> - **F1** copy fence resolution — unauthorized
> - **F7** relationship conversation on join — unauthorized
> - **F9** Contacts AFFILIATES / MY AFFILIATES — unauthorized
> - All other F-units in §19 — unauthorized
> - Any `src/` change, migration, or database write — unauthorized
> - Any copy change in production — unauthorized
>
> **Governance:** sealing freezes the design; it does not open the build. The next authorization conversation is "which single smallest useful build unit to authorize first" — explicitly NOT F7.

**Status:** SEALED 2026-10-02 · design frozen · no build unit authorized.
**Authored:** 2026-10-02 after end-to-end verification showed the live affiliate loop does not deliver the intended user journey.
**Author of record:** Philip (founder) · drafting assistance: Claude Code session 2026-10-02.
**Target repo:** `D:/trades` · remote `Philip2024394/trades.git` · branch `main`.
**Baseline commit:** `583fbfd4` (legacy Xrated affiliate programme removal).

---

## 1 · What this document is

A specification for the **production bridge** that connects an already-signed-in NEX account to a working affiliate loop:

> Create account → NEX Chat → Affiliate slider → Marketplace → Inspect seller → Join → Affiliate shop/cover populates → Chat slider shows promoted sellers → Promote/share URL.

The Affiliate Journey Bridge is a **separately named initiative**. It is NOT an extension of AM-5 Rev 4, and it does NOT depend on AM-5-A being authorized.

## 2 · Scope walls — read before implementing

### 2a · NOT AM-5 Rev 4

AM-5 Rev 4 is sealed-but-not-authorized. Nothing in this bridge may:

- Create `nex_affiliate_terms` or any versioned-terms table.
- Add `commission_pct`, `settlement_frequency`, `qualifying_event`, or `returns_rule` columns to `nex_business`.
- Introduce the publication-source / owner-published / seed concept.
- Introduce AM-5 Rev 4 "qualifying event" semantics in server actions.
- Resurface AM-5 Rev 4 commercial-terms copy (`"7%+3%"`, `"flat 10% split 7+3"`) in production — see §13.

The am-5-preview mock (`src/app/admin/nex/affiliate/am-5-preview/` and its mirrored visitor route) stays as a **design reference** for the richer card/detail experience. The Bridge borrows the shape; it does not pull the data model.

### 2b · NOT AM-6

Step 10 — attribution, click tracking, order-time commission writes, cookie-based referral stamping — is **AM-6** territory. The Bridge delivers up to step 9 (a working share URL). AM-6 decides what happens when a buyer clicks the URL, what gets written at purchase time, how commissions settle, and how disputes are handled.

A developer who finds themselves writing cookie readers, order-time `referred_by_account_id` writes, or commission-insert logic has crossed into AM-6 without authorization. **Stop and ask.**

### 2c · G0 remains the main authorization boundary

G0 is the current main authorization boundary. The Affiliate Journey Bridge is unauthorized until the founder explicitly seals it (whether as a whole or step-by-step).

### 2d · One NEX account, three surfaces, free theme by default

Per `doctrine_nex_account_entitlement_model_2026_10_02`:

- Signup creates ONE `nex_account`. Theme is free by default. Paid themes are entitlement rows, not account tiers.
- An account can expose up to three surfaces: My NEX Chat, My Affiliate Shop, My Business. An account can be an affiliate without being a business.
- The Bridge does not add signup forks ("free vs paid"), account tier columns, or sibling account tables.

### 2e · Affiliate Network Chat is the canonical workspace

Founder principle (added 2026-10-02):

> **The Affiliate Network Chat is the canonical user-facing workspace for an affiliate relationship. Other affiliate surfaces exist only where discovery, marketplace browsing, or system administration requires them.**

**Why:** without this, teams tend to build parallel surfaces — "my earnings dashboard", "campaign manager page", "payouts page", "stats page" — each duplicating relationship data that already belongs to the chat.

**How to apply:**

- Keep the Marketplace: users need somewhere to discover sellers before joining (step 3).
- Keep public affiliate-shop pages: these are shareable showcases, not operator dashboards (step 7).
- AM-6 may eventually need admin/settlement surfaces for accounting; those are system-admin, not user-facing (deferred).
- Everything else — campaigns, materials, communication, promotion state, earnings — lives inside the relationship chat.
- Reject proposals to build "affiliate dashboards" when the same information can live in the chat hero.

The current private `/nex-native/affiliate` tile grid is a candidate for elimination OR demotion to a simple "pick a relationship chat to open" index. Decision deferred to founder — see §E in the extension review notes.

---

## 3 · The 10 steps at a glance

| # | Step | Primary surface | DB touchpoint | AM-6 touchpoint |
|---|---|---|---|---|
| 1 | Signup / theme entitlement | `/nex-native/create-account` | `nex_theme_entitlement` (new) | — |
| 2 | Marketplace entry | Chat shop-grid slider | — | — |
| 3 | Live seller cards | `/nex-native/affiliate/marketplace` | `nex_business`, `nex_product` | — |
| 4 | Seller detail | `/nex-native/affiliate/seller/[slug]` | `nex_business`, `nex_product` | — |
| 5 | Join seller | `joinSellerAffiliateNetworkAction` | `nex_affiliate_conversation` + `nex_affiliate_promotion` | — |
| 6 | Promoted-seller state | query layer | `nex_affiliate_promotion × nex_product` | — |
| 7 | Affiliate shop/cover route | `/nex-native/[accountSlug]/affiliate-shop` | reads step 6 view | — |
| 8 | Chat slider affiliate mode | `_shop-grid-modal.tsx` | reads step 6 view | — |
| 9 | Promote/share URL | affiliate-shop + card UI | — (shape only) | — |
| 10 | Attribution bridge | **AM-6** | **AM-6** | **AM-6** |

(Legend: "—" in the AM-6 touchpoint column means the step has no AM-6 writes. The AM-6 fence applies globally per §2b.)

---

## Step 1 · Signup · theme entitlement model

### Purpose

Confirm the entitlement model so no developer invents "free vs paid account" during Bridge work.

### UI surfaces

- `/nex-native/create-account` and its substeps (`kind`, etc.) — **no change** required at signup. Signup never asks "free or paid."
- Future theme-switcher UI (not part of this bridge) reads: `theme is free OR entitlement exists for account × theme`.

### DB touchpoints

- New table (future, not part of this bridge): `nex_theme_entitlement (account_id, theme_id, source, granted_at, expires_at?)`.
- `nex_account.chat_theme` remains the per-account preference. No new columns.

### Server actions

- None in this bridge. Entitlement grant/revoke lives in a separate payment-feature bridge.

### Acceptance criteria

- ✅ `nex_account` schema has no `account_tier` / `plan` / `is_paid` field.
- ✅ Signup form has no "free vs paid" branching.
- ✅ Chat theme switcher does not fail when a user lacks entitlement — it simply doesn't offer the paid theme.

### Current state

Per verification 2026-10-02: signup captures name/email/phone/password only; `kind` step offers profession-level choices (`professional / business_owner / reseller / student / seeking_work / exploring`). No tier. ✅ already correct.

---

## Step 2 · Marketplace entry (slider → marketplace)

### Purpose

The user discovers the affiliate programme from inside Chat without leaving the NEX surface.

### UI surfaces

- Chat shop-grid slider (`src/app/nex-native/chat/_shop-grid-modal.tsx`) already has an "affiliate" tile at line 32-36 → routes to `/nex-native/affiliate/join` today.
- **Change:** route to `/nex-native/affiliate/marketplace` directly if the account is already an affiliate (reads `isAffiliateAccount`); route to `/nex-native/affiliate/join` otherwise.

### DB touchpoints

- Reads `nex_affiliate_account` existence for the current account.

### Server actions

- None (navigation only).

### Acceptance criteria

- ✅ Non-affiliate taps "affiliate" tile → lands on join explainer.
- ✅ Existing affiliate taps "affiliate" tile → lands on marketplace directly.
- ✅ Entry tile remains inside the Chat shop-grid (not a separate app chrome).

### Current state

Entry exists but always routes to `/affiliate/join` regardless of enrollment state (verification point B).

---

## Step 3 · Live seller cards (richer marketplace)

### Purpose

Each marketplace card gives the affiliate enough information to decide whether to promote without leaving the marketplace.

### UI surfaces

- `src/app/nex-native/affiliate/marketplace/page.tsx` — `SellerCard` component.

### Card content (minimum)

- Logo / avatar
- Business display name + verified tick (if `verified_at`)
- Business type / category (from `nex_business.category_slug`)
- Short description (first 160 chars of `nex_business.bio` or equivalent)
- Up to 4 product thumbnails (`listProductThumbnailsForBusiness`)
- Markets / service area (string field; may be blank in v1)
- Trust chip (verified / unverified)
- **Open shop** → new tab to `/nex-native/[businessSlug]`
- **Join / Promoting ✓** CTA (depending on current promotion state)

### Deliberately out of scope for v1

- Per-card commission chip (see §13 copy fence).
- Settlement frequency, qualifying event, returns rule — AM-5 Rev 4 territory.

### DB touchpoints

- `nex_business`, `nex_product` (for thumbnails), `nex_affiliate_promotion` (for current state).

### Server actions

- Reads only in server component. CTAs call `joinSellerAffiliateNetworkAction` (first-time join) / `cancelPromotionAction` (pause promotion while keeping relationship) · see step 5.

### Acceptance criteria

- ✅ Card renders without a commission figure anywhere until §13 is resolved.
- ✅ Card renders thumbnail grid even if seller has <4 products (gracefully).
- ✅ Promote state reflects current `nex_affiliate_promotion` row (dropped_at IS NULL).

### Current state

Card renders logo + 4 thumbnails + name + slug + description + Open Shop + Promote. No per-card commission chip — correct per §13. Intro paragraph says "7% + 3%" which violates §13 and must be neutralized before this step is sealed.

---

## Step 4 · Seller detail route

### Purpose

Deeper inspection before committing to promote. Keeps the affiliate inside the NEX surface instead of forcing a new-tab trip to the public cover.

### UI surfaces

- New route: `/nex-native/affiliate/seller/[businessSlug]/page.tsx` (server component).
- Component shape: borrow from `src/app/admin/nex/affiliate/am-5-preview/_preview.tsx:569-808` `DetailView` — but **wired to real `nex_business` data**, not fixtures.

### Content (minimum)

- Identity header (logo + display name + category + location)
- Full description
- Catalogue grid (up to 8 thumbnails)
- Markets / service area
- Trust signals (verified / catalogue-live / markets-declared)
- Primary CTA: Promote / Cancel promotion
- Link back to marketplace

### Deliberately out of scope for v1

- Terms version history, qualifying events, returns rule display, "seller updated terms since you joined" badge — AM-5 Rev 4 territory.

### DB touchpoints

- `nex_business`, `nex_product`, `nex_affiliate_promotion`.

### Server actions

- `joinSellerAffiliateNetworkAction(businessId)` — F7 scope (new) · creates relationship + chat · may orchestrate `promoteSellerAction` internally.
- `promoteSellerAction(businessId)` / `cancelPromotionAction(businessId)` — exist today · promotion-state writes only per §11.1b Option X.

### Acceptance criteria

- ✅ Deep-link to any live reseller-enabled business works.
- ✅ Promoting from here is identical to promoting from the marketplace card (same action, same row).
- ✅ Non-reseller-enabled businesses 404 or redirect (do not expose them).

### Current state

Does not exist. Marketplace card's only inspection path is `Open shop` → public cover in a new tab (verification point D).

---

## Step 5 · Join seller (`joinSellerAffiliateNetworkAction`)

### Purpose

The user joins a seller's affiliate network. This creates the relationship, opens the Affiliate Network Chat (per §11.1b Option X), and ensures the join has immediate visible effect in the affiliate's shop by orchestrating a promotion row.

### UI surfaces

- CTA on marketplace card (step 3) and seller detail (step 4).

### DB touchpoints

- `nex_affiliate_conversation` — primary · created on join (per §11.1a / §11.1b).
- `nex_peer_conversation` — backing conversation created to carry the relationship chat.
- `nex_affiliate_account` — created if absent (via `joinAffiliateAction`).
- `nex_affiliate_promotion (affiliate_account_id, business_id, started_at, dropped_at)` — orchestrated via `promoteSellerAction` so joining has immediate visible effect.

### Server actions

- `joinSellerAffiliateNetworkAction(business_id)` — **NEW · F7 scope** · ensures affiliate-account exists · creates `nex_affiliate_conversation` + backing `nex_peer_conversation` · may internally call `promoteSellerAction` for immediate visibility.
- `joinAffiliateAction` — exists · idempotent · covers affiliate-account existence only.
- `promoteSellerAction` — exists · idempotent · promotion-state only per §11.1b Option X.
- `cancelPromotionAction` — exists · sets `dropped_at` on promotion row · does NOT end the relationship or close the chat (per §11.13 principle 3).

### Acceptance criteria

- ✅ `joinSellerAffiliateNetworkAction` on a non-affiliate account first ensures the affiliate-account row (via `joinAffiliateAction`), then creates the relationship (one-step join).
- ✅ Joining the same seller twice is a no-op (idempotent — relationship row resurrected per §11.13 principle 6).
- ✅ `promoteSellerAction` after joining is idempotent and writes the promotion row without re-creating the relationship.
- ✅ `cancelPromotionAction` sets `dropped_at` on the promotion row but leaves `nex_affiliate_conversation.status = 'active'` (per §11.13).
- ✅ `referred_by_account_id` on the promotion row is **not set** by the Bridge. (AM-6 reserves this.)

### Current state

⚠️ Partial. `joinAffiliateAction` + `promoteSellerAction` + migration 124 work today. `joinSellerAffiliateNetworkAction` + `nex_affiliate_conversation` do NOT yet exist — F7 will create them per §11.1b Option X and §11.13. The TODO comment at `_actions.ts:548-550` referring to `referredByAccountId · subsequent bridge` is correct and must remain untouched by the Bridge.

---

## Step 6 · Promoted-seller state (query layer)

### Purpose

A single source of truth for "which products should surface as promoted to this account."

### UI surfaces

- None directly. Consumed by steps 7, 8, 9.

### DB touchpoints

- View or query function over `nex_affiliate_promotion × nex_business × nex_product`.
- Existing function: `listPromotedProductsForAffiliate(accountId, limit)` in `src/lib/nex-native/affiliate-marketplace-service.ts`.

### Server actions

- Pure reads. No writes.

### Acceptance criteria

- ✅ Returns only products from businesses where `dropped_at IS NULL`.
- ✅ Returns only products that are themselves live (`nex_product.is_live = true` or equivalent).
- ✅ Includes the seller's `businessSlug` on each row so steps 7-9 can build URLs without a second query.
- ✅ Ordered by promotion recency OR by seller `verified_at` recency — pick one and document.

### Current state

✅ Function exists. Not yet consumed outside the private dashboard (`/nex-native/affiliate` tile grid).

---

## Step 7 · Affiliate shop/cover route

### Purpose

A public page that showcases the sellers an affiliate has joined. This is where the affiliate's shareable identity lives. Without this, joining a seller has no visible external effect.

### UI surfaces

- New route: `/nex-native/[accountSlug]/affiliate-shop/page.tsx` (server component).
- Alternative: `/nex-native/affiliate-shop/[accountSlug]/page.tsx` — pick during implementation. Prefer the slug-root form if `nex_account` has a usable public slug column.

### Content

- Affiliate's chat-theme-styled page (per One NEX Identity doctrine — theme inherits from `nex_account.chat_theme`).
- Grid of promoted products from step 6.
- Each tile links to the seller's own `/nex-native/[businessSlug]` with a `?ref=<affiliateHandle>` query (step 9).
- Explicit copy: "Promoted by @<handle>" or similar — makes the relationship visible, prevents confusion with the affiliate's own catalogue.

### Deliberately out of scope for v1

- Mixing with the affiliate's own `nex_product` catalogue if they also happen to be a business owner. Keep affiliate-shop strictly over promoted products. The business-owner's own catalogue stays at `/nex-native/[businessSlug]`.

### DB touchpoints

- Reads `listPromotedProductsForAffiliate(accountId)` from step 6.
- Reads `nex_account.chat_theme` for theming.

### Server actions

- None (read-only public page).

### Acceptance criteria

- ✅ Direct-link to the affiliate-shop URL works whether or not the viewer is signed in.
- ✅ Empty state (zero promoted sellers) renders a graceful "no shops yet" with a path back to the marketplace **for the owner** and nothing for anonymous viewers.
- ✅ Theme inheritance verified against `one_nex_identity_doctrine`.

### Current state

Does not exist (verification point F). `glob src/app/nex-native/[businessSlug]/**` returned 0 files; `[businessSlug]` route may live elsewhere — confirm during implementation.

---

## Step 8 · Chat slider affiliate mode

### Purpose

When a buyer taps the shop-grid slider inside an affiliate's chat, they see the sellers the affiliate promotes — not an empty catalogue.

### UI surfaces

- `src/app/nex-native/chat/_shop-grid-modal.tsx` + any shop-item fetch it performs.

### Behaviour

- Current: slider fetches by peer's own `shop_id` / own `nex_product` rows.
- Change: when peer has an active `nex_affiliate_account` AND no `nex_business`, fetch via `listPromotedProductsForAffiliate(peerAccountId)`.
- When peer has BOTH a `nex_business` AND affiliate promotions, surface a tab/mode toggle between "Own shop" and "Promoted". Default to Own shop.
- When peer is business-only, behaviour unchanged.

### DB touchpoints

- Reads step 6 output when in affiliate mode.

### Server actions

- None (reads only).

### Acceptance criteria

- ✅ Affiliate-only peer: slider shows promoted products.
- ✅ Business-only peer: slider shows own catalogue (unchanged).
- ✅ Dual peer: toggle visible, default to Own shop.
- ✅ Zero-promotion affiliate: slider shows empty state with a nudge to the affiliate telling them to join sellers (owner-only — strangers see "no shop yet").

### Current state

Slider only queries by peer's own `shop_id`, never affiliate state (verification point F).

---

## Step 9 · Promote / share URL

### Purpose

Give the affiliate a shareable URL for each promoted seller.

### URL shape

- `/<base>/<affiliateHandle>/s/<sellerSlug>` or `/<base>/<sellerSlug>?ref=<affiliateHandle>` — pick during implementation.
- Preferred: `?ref=` on the seller's own cover URL. Keeps the destination experience intact (buyer sees the seller's cover, not an affiliate-branded redirect page), while a short query parameter captures attribution.

### UI surfaces

- "Copy link" button on each tile of step 7 (affiliate shop).
- "Share link" button on each promoted seller card inside the private dashboard (`/nex-native/affiliate`).
- Both buttons: copy to clipboard, show "Copied ✓" micro-confirmation, no server call.

### DB touchpoints

- None. URL is a pure function of `account.handle` + `business.slug`.

### Server actions

- None.

### Acceptance criteria

- ✅ URL is deterministic (same inputs always produce same URL).
- ✅ Button available on every active promotion.
- ✅ Button is absent/disabled when the account has no public handle (prompts the user to set one).
- ✅ Clicking the URL as a buyer lands on the seller's cover page. **No server-side attribution handling.** The query param is a bare carrier — AM-6 decides what to do with it.

### Current state

No tracked URL. No copy-link button. The `_actions.ts:548-550` `referredByAccountId · reserved` comment is the only mention of attribution anywhere (verification point G).

---

## Step 10 · [FENCE: AM-6 attribution infrastructure]

**Out of scope for this bridge.** AM-6 owns:

- Reading the `?ref=` parameter on landing.
- Setting signed attribution cookies.
- Writing `referred_by_account_id` on `nex_affiliate_promotion` or on buyer-side rows.
- Order-time commission inserts.
- Settlement, payout, dispute, clawback.

A developer who implements any of the above as part of Bridge work has violated the fence. Attribution is a distinct product problem with its own privacy, security, and legal considerations — it must not be smuggled in while fixing UI.

---

## 11 · Affiliate Network Chat · relationship model (extension 2026-10-02)

**Status:** DESIGN EXTENSION ONLY · DO NOT IMPLEMENT YET. Added to the Bridge after step-10 fence to make clear this is relationship/UI layer, not attribution.

### 11.1 · Core decision

Joining a seller is **joining a relationship**, not just creating a promotion row.

- Joining a seller must also create/open an **Affiliate Network Chat** — one shared conversation between seller and affiliate.
- Both sides share one conversation ID. No duplicate independent chats.
- Reuses existing NEX peer-chat infrastructure. No separate messaging product.
- Which server action owns relationship creation is NOT yet decided — see §11.1b.

### 11.1a · Conversation model (RESOLVED 2026-10-02 · Option a)

A new table **`nex_affiliate_conversation`** references an existing `nex_peer_conversation` row. The affiliate relationship rows do NOT live on `nex_peer_conversation` itself.

```
nex_peer_conversation
        │
        │ conversation_id (FK)
        ▼
nex_affiliate_conversation
        ├── conversation_id   (PK, FK → nex_peer_conversation)
        ├── affiliate_account_id (FK → nex_account)
        ├── business_id         (FK → nex_business)
        ├── joined_at
        └── status              (active · seller_paused · affiliate_dropped)
```

**Load-bearing distinction (founder 2026-10-02):**

> **The conversation is the communication channel; `nex_affiliate_conversation` represents why that channel exists.**

**Rationale:**

- `nex_peer_conversation` stays the generic communication primitive. It must not accumulate domain-specific fields for every relationship type.
- `nex_affiliate_conversation` is the business-relationship projection rendered THROUGH a peer conversation.
- Later, if the affiliate relationship accrues more lifecycle state (terms version pointer, seller programme state, chat-hero flags), those columns live here — never on `nex_peer_conversation`.
- AM-5 Rev 4 artifacts (versioned terms, publication source, qualifying event) do NOT live on this table. If AM-5-A is authorized, it adds its own `nex_affiliate_terms` and the conversation row references them by FK — no inlining.
- Room for future AM-6 relationship-side data (last-attribution-check timestamp, dispute flag, etc.) without redesigning peer chat.

### 11.1b · Action ownership (RESOLVED 2026-10-02 · Option X)

**Resolution:** Option X — separate relationship action.

```
joinSellerAffiliateNetworkAction(business_id)
        │
        ├── verify eligibility
        ├── establish relationship
        ├── ensure nex_affiliate_conversation
        └── open conversation
```

Alongside:

```
promoteSellerAction        — remains concerned with promotion state only
cancelPromotionAction      — remains concerned with promotion state only
joinAffiliateAction        — remains concerned with affiliate-account existence only
```

**Why separate:** joining a seller's affiliate network and promoting a seller are different concepts. Later state space includes:

- joined but haven't promoted anything yet
- joined and actively promoting
- promotion paused by affiliate
- programme paused by seller
- relationship archived
- relationship resumed

If relationship-creation were hidden inside `promoteSellerAction`, those concepts would be unnecessarily coupled — and lifecycle operations would need surgery to disentangle them later.

**Implementation-time caveat:** if light inspection of the existing lifecycle reveals a concrete reason Option X cannot hold, the implementer MUST flag it to the founder before deviating. Silent conflation back into `promoteSellerAction` is rejected.

**Rejected Option Y (for the record):** extending `promoteSellerAction` to ensure the conversation would blur "promotion event" vs "relationship existence" semantically. Convenient today, costly later.

### 11.2 · Auto-chat creation on join

**Affiliate side welcome message (system-generated):**
> **Affiliate Network** · You're now connected with [Seller Name]. Commission: [current commission %]. You can now access their products and work directly with the seller on promotions and marketing materials.

**Seller side system notification:**
> **New Affiliate Joined** · [Affiliate Name] has joined your affiliate network. Commission: [current commission %]. You can now work directly with your affiliate on marketing materials, campaigns and promoted products.

*Illustrative-value convention: `[current commission %]` is a placeholder resolved by the applicable commission source at render time. Live UI reads from a doctrine source (§11.3), not an inlined literal. Today the sealed value is 10% direct · no recruiter cut (§11.15 CONFIRMED HELD).*

Both messages land in the SAME conversation. Reuse the NEX1 system-generated message pattern (per NEX1 doctrine).

### 11.3 · Chat hero area

A hero band renders above the conversation feed. Fields:

- Seller name
- Relationship type ("Affiliate Network")
- Affiliate name / shop label
- Joined date
- **Applicable commission for this relationship** (today: single sealed value from a central doctrine constant; later: per-relationship terms snapshot provided by AM-5-A when authorized)
- Status pill ("● Active" / "⏸ Paused")

**Rules:**

- No fabricated financial statistics.
- **The hero must be shaped to READ the commission from a doctrine source**, not inline a literal like `"10%"` in a component. The sealed value today is 10% direct · no recruiter cut (per §11.15 — unchanged until superseded). The UI contract must be such that when AM-5-A eventually provides a per-relationship terms snapshot, consuming it requires no component rewrite.

### 11.4 · AM-6 statistics placeholders (fenced)

The hero UI reserves clean space for future AM-6 figures:

- Promoted products count — ✅ Bridge data (step 6)
- Clicks — ⏳ AM-6
- Referrals — ⏳ AM-6
- Qualifying sales — ⏳ AM-6
- Commission generated / due / settled — ⏳ AM-6

For the current Bridge build:
- Display Bridge-backed values (promoted-products count is OK)
- Mark AM-6 fields as "coming with AM-6" or hide entirely
- **Never manufacture numbers.**

### 11.5 · Marketing Centre inside the chat

Hero/action area within the conversation surface:

> **Marketing** · Products · Banners · Images · Videos · Campaigns

Seller shares promotional content via the relationship chat. Affiliate accesses materials directly from the same chat. No separate CMS. Reuse existing attachment types (`nex_peer_message` attachments, `nex-theme-sticker` bucket pattern, etc.) wherever possible.

### 11.6 · Seller marketing message pattern

Rich message example:

> **NEW CAMPAIGN** · Scaffolders V2
> New October promotion. Use this banner when promoting the product.
> [Banner image]
> [View Product] [Add to My Affiliate Shop]

The two action buttons must map to existing product/capability architecture. Do not invent new DB capabilities to support this.

### 11.7 · Affiliate-side promotion actions

From received marketing material, the affiliate can:

- **View** — open seller's product page in NEX
- **Add to My Affiliate Shop** — write to `nex_affiliate_promotion` (already works)
- **Promote** — open promote-URL flow (step 9)
- **Copy promotion link** — Bridge produces URL shape; attribution semantics = AM-6

### 11.8 · Contacts / Friends · AFFILIATES section (affiliate side)

Add a new relationship list to Contacts/Friends:

> **AFFILIATES**
> HAMMEREX TOOLS · Affiliate Network · Active · [current commission %] · 8 promoted products
> ABC ACCOMMODATION · Affiliate Network · Active · [current commission %] · 4 promoted rooms
> XYZ SERVICES · Affiliate Network · Active · [current commission %] · 12 promoted services

*Per §11.3 illustrative-value convention: `[current commission %]` resolves at render time from the applicable commission source.*

Selecting an entry opens the Affiliate Network Chat.

### 11.9 · Contacts / Friends · MY AFFILIATES section (seller side)

Reciprocal list for seller/business owners:

> **MY AFFILIATES**
> John's NEX Shop · Affiliate · Active · Joined 02 Oct
> Sarah's Trade Network · Affiliate · Active · Joined 29 Sep

Selecting an affiliate opens the **same shared** Affiliate Network Chat (not a parallel conversation).

### 11.10 · Chat relationship identity

- Visually distinct from normal person-to-person chat (hero band + Marketing area).
- **Inherits the affiliate's chat_theme** per One NEX Identity doctrine (`one_nex_identity_doctrine_2026_09_30`).
- **No separate business chat theme.** Rejected.

### 11.11 · Chat slider · "My Affiliate Network" view

The existing shop-grid slider exposes the affiliate's network alongside their own shop options:

> **MY AFFILIATE NETWORK**
> Hammerex Tools · 8 products
> ABC Accommodation · 4 rooms
> XYZ Services · 12 services

Selecting one opens the corresponding Affiliate Network Chat.

**Critical:** the slider's affiliate mode must query affiliate relationships, not the user's own business catalogue. A normal NEX user can become an affiliate and build a network without ever activating Business NEX.

### 11.12 · Seller notification on join

When `joinSellerAffiliateNetworkAction` creates a new relationship, the seller receives a notification. Conceptual event: `affiliate.joined` with payload: affiliate, seller/business, relationship, published terms/version, timestamp.

**Before implementing a new event system:** inspect existing NEX chat/notification infrastructure. If a NEX1 system-generated welcome message plus the standard peer-conversation unread indicator already covers this, reuse it rather than add a new table.

### 11.13 · Relationship lifecycle (FROZEN 2026-10-02)

**Load-bearing principle:**

> **Stopping promotion must not automatically destroy the relationship.** Otherwise the chat-as-relationship model loses the very thing it is designed around.

**Seven lifecycle principles (founder-sealed 2026-10-02):**

1. **Joining creates/activates the relationship.** `joinSellerAffiliateNetworkAction` ensures `nex_affiliate_conversation` and opens the chat (per §11.1b).
2. **Promotion is independent of relationship existence.** An affiliate can be a joined relationship without actively promoting anything.
3. **Stopping promotion does not destroy the relationship.** The chat remains open; Contacts still shows the seller.
4. **Pausing a seller programme does not delete relationship history.** All prior promotions, messages, and relationship rows persist.
5. **Leaving/ending a relationship preserves the conversation/history but removes it from the active relationship list.** Archive internally; hide from active Contacts.
6. **Rejoining resurrects the existing relationship** where the identity pair `(affiliate_account_id, business_id)` is still valid, rather than silently creating duplicate relationships.
7. **Business-level programme pause is distinct from an individual affiliate relationship pause.** A seller can pause the whole programme without rewriting every individual relationship.

**State model (frozen):**

| Event | Relationship state | Chat | Contacts |
|---|---|---|---|
| Affiliate joins seller | Active | Opens | Visible |
| Affiliate promotes seller | Active | Same chat | Visible |
| Affiliate stops promoting | Active (promotion ended) | Remains | Visible |
| Seller pauses programme | business-level flag · relationship rows unchanged | Preserved | Visible, marked paused |
| Affiliate leaves network | Ended · archived internally | Preserved · hidden from active list | Hidden |
| Seller re-enables programme | business-level flag cleared · existing relationships resume | Existing chat | Restored to active list |
| Affiliate rejoins after leaving | Existing relationship row resurrected (identity pair still valid) | Same conversation | Restored to active list |

**Sub-decisions resolved (2026-10-02):**

- **Archive vs hide (principle 5):** both. `nex_affiliate_conversation.status = 'ended'` archives internally; the Contacts active list filters it out. Chat and history remain accessible via direct-link or a future "archived relationships" view. Do NOT destroy the row or the conversation.
- **Rejoin after leaving (principle 6):** resurrect the existing relationship row. `nex_affiliate_conversation.status` returns to `active`. No new row created. Prevents Seller A ↔ Affiliate B from accumulating as three relationship rows over time.
- **Pause (principle 7):** business-level programme pause lives on a `nex_business` flag (future column). Relationship-level state is NOT rewritten by a programme pause — the business flag is read alongside `nex_affiliate_conversation.status` when rendering state. This also means re-enabling the programme does not require per-relationship writes.

**Decomposition — two independent lifecycles sharing one chat:**

- **Relationship lifecycle** · owned by `nex_affiliate_conversation.status` · values: `active · ended`
- **Promotion lifecycle** · owned by `nex_affiliate_promotion.dropped_at` · promotion rows attach to the relationship; state independent
- **Programme lifecycle** · owned by a future `nex_business` flag · pauses the whole programme without touching per-relationship rows

An affiliate can end their last promotion while the relationship remains active. A seller can pause their whole programme while every individual relationship row stays untouched. The chat survives all three state spaces.

**Clean table separation after freeze:**

```
AFFILIATE RELATIONSHIP
nex_affiliate_conversation
        │
        ├── status                 (active · ended)
        ├── joined_at
        ├── affiliate_account_id
        ├── business_id
        └── conversation_id (FK)
                │
                ▼
        NEX PEER CHAT
        nex_peer_conversation + nex_peer_message
        (messages · attachments · generic communication)

PROMOTION
nex_affiliate_promotion
        │
        ├── started_at
        └── dropped_at

COMMERCIAL TERMS (AM-5 territory · if authorized)
nex_affiliate_terms
        │
        └── versioned terms

PROGRAMME STATE (future · per-business)
nex_business.affiliate_programme_paused_at

ATTRIBUTION / EARNINGS (AM-6 territory)
nex_affiliate_attribution · nex_affiliate_ledger · etc.
```

Each table owns one concern. Changes in one lifecycle never require writes to another's rows.

### 11.13.1 · Seller inactivity + affiliate-network protection (added 2026-10-02)

Lifecycle completeness item identified by founder after the §11.13 base-freeze. Extends §11.13 without reopening the seven principles.

**Rule (founder-sealed 2026-10-02):**

> NEX may monitor seller activity for affiliate-network health. Prolonged seller inactivity may cause the affiliate programme to enter a review or paused state after defined notification and grace periods. Existing affiliate relationships and chat history are preserved. NEX may recommend active alternative sellers, but does not silently transfer or replace an affiliate relationship.

**The principle:** NEX protects the affiliate relationship without frightening the affiliate or silently moving customers/sales elsewhere.

**Staged response to seller inactivity:**

| Stage | Trigger | Affiliate experience | Seller experience | Programme state |
|---|---|---|---|---|
| 0 | Days 0–9 of inactivity | — | — | Active |
| 1 · Monitor | Day 10 | Calm system message in network chat | — | Active |
| 2 · Seller notify | Continued inactivity | — | Multi-channel notifications; escalating to "action required" | Active, under review |
| 3 · Paused | Beyond defined grace period | Chat preserved + optional "find active sellers" affordance | Programme paused · products + affiliate history preserved | Paused |
| 4 · Seller returns | Seller re-activates | "Seller A is active again. Your original affiliate relationship is available." | Programme restored | Active |

**Health indicators in the network-chat hero** (extends §11.3 status pill):

- 🟢 Active
- 🟡 Seller activity is currently quiet
- 🟠 Seller review required
- ⚪ Affiliate programme paused

**Affiliate-side message example (Stage 1 · Monitor):**

> **NEX Network Update** — Your affiliate link is continuing to receive activity. We've noticed the seller hasn't been active recently. No action is needed from you right now. NEX is monitoring the connection and will keep you updated.

**Seller-side notification (Stage 2 · initial):**

> **NEX Affiliate Notice** — Your affiliate network currently has active affiliate connections. Please open NEX to review your affiliate notifications and seller activity.

**Seller-side escalation (Stage 2 · continued silence):**

> **Action required** — Your affiliate programme has been inactive for an extended period. Please sign in to NEX and review your affiliate network to keep your participation active.

**Pre-pause warning (Stage 2→3 transition):**

> Your affiliate network is currently inactive. If your account remains unattended, NEX may temporarily pause your participation in the affiliate network so that affiliates are not left waiting for an inactive seller.
>
> Your products and affiliate history will remain preserved, and you can return to the programme when you're active again.

Framing rule: NEX is **protecting affiliates, not punishing sellers.** Copy must not sound threatening or accusatory.

**Protection invariants (do not weaken):**

1. **NEX cannot silently replace a seller.** The affiliate joined Seller A; a dormant Seller A is NOT substituted with Seller B.
2. **NEX cannot pretend one seller replaced another.** Recommendations are offers to the affiliate, not relationship transfers.
3. **Existing relationships + chat history are preserved across every state.** Including Stage 3 pause and Stage 4 recovery.
4. **Return path is always available.** When a paused seller becomes active, the affiliate sees the "Seller A is active again" prompt and chooses what to do.
5. **The affiliate decides.** NEX surfaces options; it never writes a new relationship on the affiliate's behalf.

**Affiliate recommendation flow (Stage 3):**

```
SELLER A (inactive · paused)
   │
   ├── preserve existing relationship (nex_affiliate_conversation.status unchanged)
   ├── preserve chat/history (nex_peer_message)
   ├── notify seller (through approved channels)
   └── offer affiliate: "Find active sellers"
             │
             ▼
       Marketplace (filtered by Seller A's category)
             │
       ┌─────┴─────┐
       ▼           ▼
   SELLER B     SELLER C
    active       active
       │           │
       └─────┬─────┘
             ▼
    Affiliate chooses to join (or not)
       │
       └── new relationship row created ONLY if affiliate explicitly joins
```

**Where the "find active sellers" affordance lives:** inside the inactive network chat as a system message with a CTA that routes to Marketplace with a category filter. Not a separate page.

**Open sub-decisions (non-blocking · pending founder confirmation):**

- Exact day thresholds (Monitor at 10 · Seller notify at ? · Pause at ?)
- Which "approved channels" seller notifications use (NEX1 chat · email · push · all three?)
- Precise criteria for "seller inactive" (no login? no new products? no incoming message response?)
- Whether health indicators are affiliate-facing only, seller-facing only, or both
- Whether Stage 3 "find active sellers" is always offered or only when the affiliate taps a prompt

**Governance:** §11.13.1 extends §11.13 without reopening the seven base principles. It adds a NEX-initiated path into the already-sealed "programme paused" state (§11.13 principle 7 · seller programme pause is business-level). The relationship-level state space is unchanged.

### 11.14 · UX principle (central)

> **Joining an affiliate is joining a relationship, not merely activating a link.**

- NEX Chat = communication layer
- Affiliate shop = promotion layer
- AM-6 = commercial evidence / settlement layer

These are connected surfaces of ONE relationship.

### 11.15 · OPEN FOUNDER DECISION · 7%/3% split proposal

**Current sealed decision:** 10% total affiliate commission · no recruiter cut.

**Proposal under founder consideration (2026-10-02):** 10% total split as 7% direct affiliate + 3% network/recruiter share.

**Status (2026-10-02): HELD · CONFIRMED by founder 2026-10-02.** The sealed 10% direct model remains in force. 7%/3% is isolated as a proposal only. Deferred — not killed, not confirmed. Until explicit founder supersession:

Until the founder explicitly confirms supersession:

- The Bridge chat hero displays "10% commission" (sealed value).
- The marketplace copy fence (§13) remains in force — no "7%+3%" / "flat 10% split 7+3" copy anywhere in production.
- AM-5 Rev 4 commercial-term semantics are UNCHANGED.
- AM-6 commission ledger design is UNCHANGED.
- No hidden 3% logic appears anywhere in Bridge code.

If and when the founder confirms supersession, the change must propagate deliberately into:

1. Affiliate doctrine memory (`project_affiliate_journey_bridge_2026_10_02` + new doctrine entry)
2. AM-5 Rev 4 commercial terminology (new revision — Rev 5)
3. AM-6 commission ledger design (new network-share ledger lines)
4. Seller/affiliate chat hero copy
5. Marketplace + join page copy
6. Terms version model (if AM-5-A proceeds)

**Do not silently change AM-5 Rev 4.** This is an architectural change requiring explicit founder re-sealing of AM-5.

---

## 12 · Journey map

```
CREATE NEX ACCOUNT
        ↓
CHAT THEME (free by default, paid themes via entitlement)
        ↓
NEX CHAT
        ↓
AFFILIATE MARKETPLACE                            (step 2 · 3)
        ↓
VIEW SELLER                                       (step 4)
        ↓
JOIN                                              (step 5)
        ↓
AFFILIATE RELATIONSHIP CREATED                    (step 5 · 11.1)
        ↓
AFFILIATE NETWORK CHAT OPENS                      (step 11.2)
        ↓          ↓
SELLER NOTIFIED   AFFILIATE NOTIFIED              (step 11.2 · 11.12)
        ↓          ↓
SELLER ↔ AFFILIATE WORK TOGETHER                  (step 11.5 · 11.6)
        ↓
MARKETING MATERIALS SHARED                        (step 11.5 · 11.6 · 11.7)
        ↓
AFFILIATE SHOP (public showcase)                  (step 7)
        ↓
CHAT SLIDER / COVER (affiliate network surfaced)  (step 8 · 11.11)
        ↓
PROMOTE SELLER (copy-link UI)                     (step 9)
        ↓
──────────── AM-6 FENCE ────────────
TRACKED ATTRIBUTION                               (AM-6)
AM-6 COMMISSION / SETTLEMENT                      (AM-6)
```

---

## 13 · Live copy fence (AM-5 Rev 4 commission language)

Per `feedback_am5_commission_copy_violation_2026_10_02`:

- `src/app/nex-native/affiliate/marketplace/page.tsx:251-253` and `src/app/nex-native/affiliate/join/page.tsx:134-135` currently advertise AM-5 Rev 4 commercial terms.
- Replacement copy must be programme-level, not numeric: "Promote NEX sellers · earn when customers you refer buy" or founder-approved alternative.
- Do NOT add commission chips to cards. Do NOT add `commission_pct` to `nex_business`. Do NOT recreate `nex_affiliate_terms`.
- **Fix timing (2026-10-02 updated):** §11.15 CONFIRMED HELD (10% direct · no recruiter cut). F1 copy fence resolution is now **UNBLOCKED** on the design side and can proceed under the confirmed 10% model. Still requires per-unit authorization per §19.

If and when AM-5-A is authorized, the Bridge's step-3 card chip comes back into scope.

---

## 14 · Order of implementation

> **NON-AUTHORITATIVE** — §14 is design guidance only. It does not authorize implementation or establish build-unit priority. Build order requires explicit founder authorization per-unit.

A suggested sequence (not a sealed order — founder decides):

1. **§13 copy fix** (small defensive PR, standalone).
2. **Step 1** validation — write a tsc + runtime assertion that `nex_account` has no tier column; sign off that the signup flow is already correct.
3. **Step 6** solidification — add tests on `listPromotedProductsForAffiliate` covering dropped promotions and non-live products.
4. **Step 7** — new affiliate-shop route. Highest external user-value step. Unlocks step 9.
5. **Step 9** — copy-link UI. Pure frontend, no DB work.
6. **Step 2** — slider routing split (affiliate vs non-affiliate).
7. **Step 8** — chat slider affiliate mode. Requires step 6.
8. **Step 4** — seller detail route. Lowest urgency; `Open shop` works as a bypass.
9. **Step 3** polish — if §13 is resolved and a card chip is desired, add it last.
10. **(AM-6)** — attribution bridge, separately authorized.

---

## 15 · Acceptance for the Bridge as a whole

The Bridge is complete when a user can:

1. Create a NEX account.
2. Open Chat.
3. Tap the shop-grid "affiliate" tile.
4. See the marketplace with live seller cards.
5. Open a seller for a richer in-flow view.
6. Tap Join / Promote.
7. **Joining creates/opens the Affiliate Network Chat** (shared conversation).
8. **Seller receives a new-affiliate notification.**
9. **Affiliate receives a confirmation welcome message.**
10. **Both sides see the SAME relationship chat** (no duplicate conversations).
11. **Chat hero identifies seller, affiliate, relationship, and the applicable commission** (read from doctrine source per §11.3 · today's sealed value: 10% direct · no recruiter cut per §11.15 CONFIRMED HELD).
12. **Contacts/Friends contains an AFFILIATES section for the affiliate.**
13. **Seller-side contacts contain MY AFFILIATES.**
14. **Selecting a contact opens the relationship chat.**
15. **Seller marketing materials have a defined destination in the relationship chat.**
16. **Affiliate can access promoted seller content from the relationship chat.**
17. Navigate to their own affiliate-shop URL (public showcase · step 7).
18. See promoted sellers' products on their affiliate-shop.
19. Tap "copy link" on any promoted product and share the URL.
20. **Chat slider / cover surfaces are conceptually connected to the same relationship state.**
21. **A normal NEX user can become an affiliate without activating Business NEX.**

Without, in the process, having:

- Been offered a "free vs paid" signup choice.
- Been shown AM-5 Rev 4 commercial-terms copy ("7%+3%" / "flat 10% split 7+3").
- Triggered any attribution write (that's AM-6).
- Been shown fabricated or unsupported financial statistics.
- Seen a 7%/3% commercial split anywhere (sealed decision remains 10% direct until founder supersedes).

**Doctrine invariants verified by the Bridge:**

- AM-5 Rev 4 is unchanged.
- AM-6 attribution/ledger remains fenced.
- No database or production implementation is authorized merely by this specification.

---

## 16 · Doctrine references

- `project_affiliate_journey_bridge_2026_10_02` (memory) — this bridge's naming.
- `doctrine_nex_account_entitlement_model_2026_10_02` (memory) — one-account / three-surfaces / entitlement-not-tier.
- `feedback_am5_commission_copy_violation_2026_10_02` (memory) — §13 copy fence.
- `one_nex_identity_doctrine_2026_09_30` (memory) — theme inheritance across surfaces (affects step 7).
- `nex_theme_template_profession_lock_2026_09_30` (memory) — chat_theme vs cover_layout_id orthogonality (affects step 7 if composing cover from a layout).
- `doctrine_nex_business_architecture_frozen_rev6_2026_10_02` (memory) — "recommendation ≠ permission" test; apply to any seller-category gating in step 3/4.

---

## 17 · Sealing

This document is a draft. Founder-sealing confers authorization step-by-step or as a whole. Until sealed:

- No new routes IMPLEMENTED under `src/app/nex-native/affiliate/**` beyond what already exists.
- No new tables or columns IMPLEMENTED prior to seal + per-unit authorization. (The spec proposes `nex_affiliate_conversation` in §11.1a and references future AM-5 / AM-6 tables; those are design artifacts, not authorized schema.)
- No slider mode changes IMPLEMENTED.
- No URL-shape commitments IMPLEMENTED.
- **No change to the 10% commercial model.** The 7%/3% proposal in §11.15 remains an OPEN FOUNDER DECISION until explicit supersession.
- No new `nex_peer_conversation` subtype / `nex_affiliate_conversation` table / contacts section.
- No `affiliate.joined` event pipeline.
- No marketing-message type extension.

Founder-sealed sections should be moved to a sealed-section marker at the top of this file with the date and commit SHA, following the pattern of other `docs/doctrine/*.md` artifacts.

## 18 · Current status snapshot

- **Affiliate Journey Bridge:** 🔒 **SEALED 2026-10-02** · design frozen · no build unit authorized
- **AM-5 Rev 4:** SEALED (not authorized for implementation)
- **AM-6:** NOT OPEN
- **G0:** CURRENT MAIN AUTHORIZATION BOUNDARY
- **Commercial model:** 10% direct affiliate · no recruiter cut (sealed · held · confirmed 2026-10-02) · 7%/3% proposal deferred under §11.15 (not killed, not confirmed)
- **Design freeze state:** §11.1a · §11.1b · §11.13 · §11.13.1 · §11.15 · §20 presentation-regions all FROZEN/CONFIRMED/SEALED.

### 18.1 · Founder decision tracker

| Ref | Decision | Status |
|---|---|---|
| §11.15 | 7%/3% commercial-model supersession | **HELD · CONFIRMED 2026-10-02** · 10% direct · no recruiter cut remains active |
| §11.1a | Conversation table model (`nex_affiliate_conversation` separate from `nex_peer_conversation`) | **RESOLVED 2026-10-02** |
| §11.1b | Action ownership — Option X (`joinSellerAffiliateNetworkAction` as separate action) | **RESOLVED 2026-10-02** |
| §11.13 | Pause/stop/rejoin lifecycle semantics | **FROZEN 2026-10-02** · seven principles sealed · three sub-decisions resolved |
| §20 | Seven chat regions are presentation responsibilities, not independent surfaces | **RESOLVED 2026-10-02** |
| §2e / §18.2 | Fate of current private `/nex-native/affiliate` tile grid | **DIRECTIONAL** · demotion preferred · exact disposition deferred |
| §11.5 | Marketing Centre scope (in-chat only vs persistent campaign library) | **OPEN** · non-blocking |

### 18.2 · Current `/nex-native/affiliate` tile grid (directional: demote)

Per §2e the canonical workspace is the Affiliate Network Chat. The current private tile grid at `/nex-native/affiliate` duplicates information that will live in the chat hero + Contacts → AFFILIATES.

**Architectural direction (founder 2026-10-02):** demotion preferred. The OLD vs NEW diagram in §20A makes this explicit — the dashboard-style surface is replaced by relationship chats + Contacts entrypoints.

Exact disposition deferred:

- **Eliminate** — redirect to Contacts → AFFILIATES (purest form)
- **Demote to index** — simple "pick a relationship chat to open" list (safest transition)
- **Keep** — as a transition surface during Bridge build-out (lowest-change path)

Decision deferred to founder but the direction is set.

---

## 19 · Proposed build units (NON-AUTHORITATIVE)

> **NON-AUTHORITATIVE** — §19 is a planning artifact. No unit is authorized. Each unit requires explicit founder authorization before implementation begins.

Smallest/safest first. Each unit is self-contained, reviewable, and does not commit the next.

| Unit | Scope | Blast radius | Blocked by |
|---|---|---|---|
| **F1** Copy fence resolution (§13) | Neutralize AM-5 Rev 4 copy on `marketplace/page.tsx:251-253` + `join/page.tsx:134-135` | 2 files, no DB | Design unblocked by §11.15 CONFIRMED · unit authorization still required |
| **F2** Doctrine freeze | Seal spec text per founder review | docs only | founder review |
| **F3** Query-layer tests | Coverage: dropped promos, non-live products, empty cases on `listPromotedProductsForAffiliate` | test files only | — |
| **F4** Public affiliate-shop route (step 7) | New `/nex-native/[accountSlug]/affiliate-shop`, reads step 6, chat_theme inheritance | ≤4 new files | account public-slug confirmation |
| **F5** Copy-link UI (step 9) | Frontend only; deterministic URL shape; no attribution | ≤2 files, no DB | F4 |
| **F6** Slider routing split (step 2) | Route affiliate tile → marketplace OR join based on `isAffiliateAccount` | 1 file, no DB | — |
| **F7** Relationship conversation on join | New `nex_affiliate_conversation` table + `joinSellerAffiliateNetworkAction` (per §11.1b Option X · §11.13 lifecycle) | 1 migration + 1 new server action | Design unblocked · unit authorization still required |
| **F8** Chat hero component | Pure UI over F7 metadata; commission read from doctrine source | 1-2 new files | F7 |
| **F9** Contacts AFFILIATES / MY AFFILIATES | New Contacts/Friends sections; reads F7 | ≤3 files | F7 + Contacts inspection · design unblocked |
| **F10** Chat slider affiliate mode (step 8 + §11.11) | When peer is affiliate, slider sources from `listPromotedProductsForAffiliate` | 1-2 files | — |
| **F11** Marketing message template (§11.5/11.6) | Rich peer-message type for campaign/banner/product-link; reuse attachments | 1 enum extension + UI | F7 + F8 |
| **F12** Seller detail route (step 4) | Live `/nex-native/affiliate/seller/[slug]` wired to real data | ≤3 files | — |
| **F13** AM-6 placeholders (§11.4) | Pure UI empty states; no reads, no attribution | included in F8 | F8 |

**Blocking dependencies summary (updated 2026-10-02):**

- F1 → design-side unblocked (§11.15 CONFIRMED HELD 2026-10-02) · still requires per-unit authorization
- F7, F9 → design-side unblocked (§11.1b resolved · §11.13 frozen) · still require explicit per-unit authorization after seal
- Everything else can be scoped once founder review of this document is complete.

---

## 20 · Final architecture (visual)

```
                       DISCOVERY
                           │
                           ▼
                      MARKETPLACE
                           │
                           ▼
                        SELLER
                           │
                           │ Join
                           ▼
                  AFFILIATE RELATIONSHIP
                           │
          ┌────────────────┴────────────────┐
          ▼                                 ▼
   NETWORK CHAT                         CONTACTS
   (canonical workspace)                    │
          │                                 └── opens same chat
          │
          ├── Hero (identity + applicable terms + status)
          ├── Terms           (read from doctrine source)
          ├── Messages        (peer-chat primitive)
          ├── Marketing       (seller-shared materials)
          ├── Products        (promoted catalogue)
          ├── Promote         (copy-link UI → URL shape only)
          └── Performance*
                   │
                   ▼
                 AM-6 (attribution · earnings · settlement)

* Performance tiles render only when real AM-6 data exists.
  Until then: "coming with AM-6" or hidden.
```

**Invariants enforced by the architecture:**

- No fake statistics
- No duplicate affiliate dashboards
- No second chat system
- No separate business chat theme
- No hidden attribution
- No commercial-model change until §11.15 lands
- No standalone pages for the seven chat regions (see presentation-regions clarification below)

**Presentation-regions clarification (founder 2026-10-02):**

> **The seven chat regions (Hero · Terms · Messages · Marketing · Products · Promote · Performance\*) are presentation responsibilities within the Affiliate Network Chat. They do not imply seven independent affiliate information surfaces.**

The user does not navigate to "my affiliate stats page" or "my seller marketing page." They open the relationship chat and the relevant region is visible as a tile/section of that one workspace. Any proposal to spin a region out into a standalone page is rejected unless marketplace browsing or system administration genuinely requires it (per §2e).

---

## 20A · OLD vs NEW surface architecture

**OLD (dashboard-style, duplicative):**

```
Affiliate page
 ├─ dashboard
 ├─ promotions
 ├─ products
 ├─ stats
 └─ seller information
```

**NEW (relationship-as-workspace):**

```
Affiliate Marketplace
        ↓
     Discover
        ↓
       Join
        ↓
Affiliate Network Chat
        ├─ relationship
        ├─ terms
        ├─ conversation
        ├─ marketing
        ├─ products
        ├─ promotion
        └─ performance*
```

Contacts → Affiliates is simply another doorway into those same relationship chats.

The backend remains sophisticated. The user experience does not expose that complexity.

---

## 21 · Path to seal

Founder-stated sequence (2026-10-02):

1. **Resolve §11.1b** — ✅ DONE 2026-10-02 (Option X).
2. **Freeze §11.13 lifecycle** — ✅ DONE 2026-10-02 (seven principles · three sub-decisions · clean table separation).
3. **Formally decide whether §11.15 remains held** — ✅ DONE 2026-10-02 · founder confirmed HELD; 10% direct · no recruiter cut remains the active commercial model.
4. **Final consistency audit** — ✅ DONE 2026-10-02 · 2 blocking + 4 soft findings surgically applied.
5. **Seal the Bridge** — ✅ DONE 2026-10-02 · sealed-marker header present at top of file.
6. **Only then** — consider individual build-unit authorization per §19 · **next conversation: smallest useful build unit, NOT F7.**

**Governance invariant (do not weaken):** no build unit is authorized by passing through this sequence; the sequence only unblocks the authorization conversation. **F7 remains unauthorized even after §11.13 freezes.** "All design questions resolved" is not the same as "go build it" in NEX governance.
