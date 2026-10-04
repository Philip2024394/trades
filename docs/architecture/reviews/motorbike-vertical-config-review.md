# Motorbike Vertical Configuration · Design Review

**Status:** Review artifact. **Not doctrine.** Not sealed.
**Scope:** Proposed source changes for founder review before any implementation is authorised.
**Date:** 2026-10-04
**Supersedes:** nothing · this is the first review of this vertical

---

## 1 · Executive summary

A motorbike rental / sale business can be added to NEX without creating a new UI shell, a new business category, a new capability, a new table, or any doctrine amendment. The entire v1 configuration lives in **four source files**:

| # | File | Change size |
|---|---|---|
| 1 | `src/lib/nex-native/business/types.ts` | +1 line |
| 2 | `src/lib/nex-native/business/subtypes.ts` | +3 lines |
| 3 | `src/lib/nex-native/business/terminology.ts` | +6 lines |
| 4 | `src/app/nex-native/cover/primitives.tsx` | +1 optional prop · 2 conditional guards |

Plus one caller-chain thread (CoverCatalog → CoverProductGrid → CoverProductCard) wiring the new prop so motorbike shops render without an ambiguous standalone price badge.

**Explicitly deferred:** `nex_offer` table, rental booking capability, structured bike attributes, calendar availability, delivery-zone schema, dedicated motorbike manage surface, Rev 6 doctrine amendment, the 7-missing-layouts contract mismatch.

---

## 2 · Decisions sealed by founder for this review

1. **Category** — `motorbike_shop` belongs under the existing **Products** category. No new category.
2. **Subtype count** — ONE subtype only. No `motorbike_rental`, no `motorbike_dealer`, no `motorbike_rental_and_sale`. Rental vs sale is an offer distinction, not a business kind.
3. **Rental vs sale in v1** — remains unstructured in the seller's product description (e.g. "Rp 150k/day · Rp 900k/wk · Buy Rp 32M"). No `nex_offer` schema change.
4. **Price-mismatch guardrail** — path **P-1**: preserve the `nex_product.price_pence` data unchanged; modify the shared product-card primitive so a `motorbike_shop` product does NOT display `price_pence` as an unlabeled standalone price. Shared card stays generic; motorbike config controls the suppression.
5. **CTA terminology** — v1 uses **Message** only. No `Rent`, no `Buy` resolved via subtype — those verbs belong to the future Offer system when it ships.
6. **Terminology scope** — keep strictly to keys currently in use by shipped UI. No `offer.item` entry (nex_offer doesn't exist).
7. **Info-pages recommendations** — documentation only in this review. Do not invent a preset mechanism.

---

## 3 · Proposed source diffs

### 3.1 · File 1 of 4 · `src/lib/nex-native/business/types.ts`

**Current (lines 59-64):**
```ts
export type ProductsSubtype =
  | "retail"
  | "manufacturer"
  | "wholesale"
  | "local_artisan"
  | "exporter";
```

**Proposed:**
```ts
export type ProductsSubtype =
  | "retail"
  | "manufacturer"
  | "wholesale"
  | "local_artisan"
  | "exporter"
  | "motorbike_shop";
```

**Impact:** One new string literal added to the `ProductsSubtype` union. Any code switching exhaustively on `ProductsSubtype` will get a TypeScript error until it handles the new case. This is intentional — forces callers to update.

---

### 3.2 · File 2 of 4 · `src/lib/nex-native/business/subtypes.ts`

Three small additions, each inside an existing block, maintaining alignment with surrounding entries.

**Addition A · `PRODUCTS_SUBTYPES` array (current lines 52-58):**
```ts
export const PRODUCTS_SUBTYPES: readonly ProductsSubtype[] = [
  "retail",
  "manufacturer",
  "wholesale",
  "local_artisan",
  "exporter",
  "motorbike_shop",
] as const;
```

**Addition B · `BUSINESS_SUBTYPE_CATEGORY` map (current lines 100-105), add after `exporter`:**
```ts
  // Products
  retail:             "products",
  manufacturer:       "products",
  wholesale:          "products",
  local_artisan:      "products",
  exporter:           "products",
  motorbike_shop:     "products",
```

**Addition C · `BUSINESS_SUBTYPE_LABEL` map (current lines 135-139), add after `exporter`:**
```ts
  retail:             "Retail",
  manufacturer:       "Manufacturer",
  wholesale:          "Wholesale",
  local_artisan:      "Local artisan",
  exporter:           "Exporter",
  motorbike_shop:     "Motorbike shop",
```

**Impact:** `motorbike_shop` is now a valid subtype under Products, labeled "Motorbike shop" in UI listings. Non-breaking.

---

### 3.3 · File 3 of 4 · `src/lib/nex-native/business/terminology.ts`

**One `BY_SUBTYPE` entry added**, placed inside the Products section after `exporter` (current line 175) and before the `// Services` comment at line 176.

**Proposed insertion:**
```ts
  motorbike_shop: {
    "product.catalog":   { en: "Fleet",    id: "Armada" },
    "product.item":      { en: "Bike",     id: "Motor"  },
    "enquiry.action":    { en: "Message",  id: "Chat"   },
  },
```

**Notes:**
- Three keys only — the exact set in current shipped use.
- `product.catalog` → **Fleet** (fits the fleet/listing visual language, not retail "Shop")
- `product.item` → **Bike** (specific noun, more honest than "Product")
- `enquiry.action` → **Message** (neutral · never implies "Rent" or "Buy" since the terminology engine cannot tell the two apart)
- **No `offer.item` entry** — nex_offer doesn't ship yet; defining terminology for a non-existent primitive would be premature.
- **No "Rent" or "Buy" verbs** — those depend on offer-type knowledge which is not available at the subtype layer.

Indonesian labels follow the file's existing bilingual convention.

---

### 3.4 · File 4 of 4 · `src/app/nex-native/cover/primitives.tsx` (price-guardrail · P-1)

The shared product card must remain generic. The change below adds **one optional prop** to `CoverProductCard` that lets a caller suppress the standalone price badge. Default behavior is unchanged for every existing caller (retail, cafe, every current layout).

#### 3.4.1 · `CoverProductCard` signature

**Current (lines 662-679):**
```ts
export function CoverProductCard({
  product,
  peerAccountId,
  eyebrow,
  variant = "grid",
}: {
  product: CoverProduct;
  peerAccountId: string;
  eyebrow?: string | null;
  /** Founder direction 2026-09-30 · "grid" (default) renders the
   *  square-image tile stacked above the meta column. "landscape"
   *  renders the image on the LEFT (fixed square) and the meta column
   *  on the RIGHT · used by Template 11 (Product Seller · Landscape).
   *  "round" renders the image as a circle with a small magnifier
   *  button on the rim and the product name centred below · used by
   *  Template 14 (Personal Brand · Round Products). */
  variant?: "grid" | "landscape" | "round";
}): React.JSX.Element {
```

**Proposed:**
```ts
export function CoverProductCard({
  product,
  peerAccountId,
  eyebrow,
  variant = "grid",
  showPrice = true,
}: {
  product: CoverProduct;
  peerAccountId: string;
  eyebrow?: string | null;
  variant?: "grid" | "landscape" | "round";
  /** Phase 4A · Motorbike vertical configuration 2026-10-04.
   *  When false, the card does NOT render the formatted price_pence
   *  badge. This is used by verticals where price_pence is a
   *  single-number field insufficient to represent the actual
   *  commercial offer (e.g. a motorbike shop whose listings carry
   *  "Rp 150k/day · Rp 900k/wk · Buy Rp 32M" in the description).
   *  The price_pence data is preserved untouched — only the standalone
   *  rendering is suppressed. Default remains true for every existing
   *  caller. When nex_offer ships this prop can be deprecated and
   *  replaced with structured-offer-aware rendering. */
  showPrice?: boolean;
}): React.JSX.Element {
```

#### 3.4.2 · Round variant guard (current line 897)

**Current:**
```tsx
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "var(--nex-accent)",
              letterSpacing: "0.01em",
              fontVariantNumeric: "tabular-nums",
              textAlign: "center",
            }}
          >
            {priceLabel}
          </div>
```

**Proposed:**
```tsx
          {showPrice ? (
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "var(--nex-accent)",
                letterSpacing: "0.01em",
                fontVariantNumeric: "tabular-nums",
                textAlign: "center",
              }}
            >
              {priceLabel}
            </div>
          ) : null}
```

#### 3.4.3 · Grid/landscape variant guard (current line ~1120-1138)

**Current:**
```tsx
            {/* Founder direction 2026-09-30 · price must ALWAYS show
                in full · no ellipsis truncation. Long values wrap to
                a second line rather than clipping. */}
            <div
              style={{
                flex: "1 1 auto",
                minWidth: 0,
                fontSize: 12,
                fontWeight: 800,
                color: "var(--nex-accent)",
                letterSpacing: "0.01em",
                lineHeight: 1.25,
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
            >
              {priceLabel}
            </div>
```

**Proposed:**
```tsx
            {/* Founder direction 2026-09-30 · price must ALWAYS show
                in full when rendered · no ellipsis truncation. Long
                values wrap to a second line rather than clipping.
                Phase 4A 2026-10-04 · suppressed entirely when the
                caller passes showPrice=false (motorbike-shop pattern,
                see signature docblock). */}
            {showPrice ? (
              <div
                style={{
                  flex: "1 1 auto",
                  minWidth: 0,
                  fontSize: 12,
                  fontWeight: 800,
                  color: "var(--nex-accent)",
                  letterSpacing: "0.01em",
                  lineHeight: 1.25,
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                }}
              >
                {priceLabel}
              </div>
            ) : null}
```

#### 3.4.4 · `CoverProductGrid` thread-through

Current `CoverProductGrid` (line 1175+) accepts a product list and renders `<CoverProductCard>` for each (line 1212). The grid component must also accept and forward `showPrice`:

**Change to `CoverProductGrid` signature (same file):** add an optional `showPrice?: boolean` prop that defaults to `true` and is forwarded as a prop on every rendered `CoverProductCard`. Zero behavior change for existing callers (retail, cafe, etc.) because the default is `true`.

#### 3.4.5 · `CoverCatalog` thread-through (`src/app/nex-native/cover/CoverCatalog.tsx`)

Same pattern. `CoverCatalog` accepts an optional `showPrice?: boolean` default `true`, forwards to the `CoverProductGrid` it renders internally. Zero behavior change for existing callers.

#### 3.4.6 · Where the motorbike decision is made

The caller — the cover layout rendering code that reads the business row and chooses `CoverCatalog` with product data — computes:

```ts
const showPrice = business.subtype !== "motorbike_shop";
```

and passes `showPrice={showPrice}` to `CoverCatalog`. The business row's `subtype` field is already available in the content-loading path; no new data fetch is required.

**File that actually computes and passes this** is the cover layouts file (`src/app/nex-native/cover/layouts.tsx`) or the cover-content-loader, whichever renders `CoverCatalog`. The exact line to edit will be verified in the implementation phase (not this review) because this review deliberately does not touch layouts.tsx (large file, higher regression risk if guessed wrong).

---

### 3.5 · What the motorbike product card looks like after P-1

For a motorbike shop bike product:

```
┌──────────────────────────────┐
│ [bike photo]                 │
│                              │
│ Honda PCX 160                │
│ 2024 · 160cc · CVT · black   │  ← from product.description
│ Rp 150k/day                  │
│ Rp 900k/week                 │
│ Rp 2.8M/month                │
│ Buy: Rp 32M                  │
│                              │
│                 ○ Message    │  ← CTA (neutral, from terminology)
└──────────────────────────────┘
```

For every other business (retail, cafe, etc.) — rendering is unchanged (price badge still shown).

---

## 4 · Info-pages seller recommendations (documentation only)

**No code change.** No new preset mechanism added. These are suggestions a seller help note can carry (or a `/manage/info` empty-state hint can display) when the business subtype is `motorbike_shop`.

**Recommended sealed-page activations:**

| Page key | Use |
|---|---|
| `about_us` | Shop story · how long operating · owner introduction |
| `delivery` | Hotel / villa pickup zones · drop-off service · fee if any |
| `hours` | Rental hours · after-hours contact |
| `payment` | Accepted methods (cash, transfer, GoPay / OVO, international cards) |
| `returns` | Damage / loss policy · deposit refund terms |
| `services` | What's included: 2 helmets · raincoat · phone holder · full tank · basic + theft insurance |
| `faq` | Common rental questions (licence · what if it rains · what if it breaks down) |

**Recommended custom buttons** (seller fills these in on `/manage/info`, up to 3):

| Icon | Label | Suggested body |
|---|---|---|
| 🚚 | Delivery | Free pickup / drop-off across Canggu, Seminyak, Ubud, Sanur, Kuta, Uluwatu, Airport |
| 🪖 | Insurance | What insurance covers · deductible · what happens on damage |
| 📅 | Rental terms | Minimum rental period · security deposit · what documents are needed |

These are recommendations — the seller controls which (if any) to activate. If motorbike adoption grows and we see the same custom buttons being added again and again across shops, THAT is the evidence to later consider a universal preset mechanism (benefits motorbike + car rental + surfboard rental + any future rental vertical).

---

## 5 · Explicitly deferred (NOT in v1)

Each item requires separate authorization + evidence of need before being considered.

| Deferred | Trigger that would justify building it |
|---|---|
| `nex_offer` table + per-offer rental tiers | Multiple verticals (motorbike + car + surfboard + tools) all actively need structured commercial-unit data, not just motorbike |
| Rental booking engine (date-range · availability · deposit · conflict detection) | Enquiry-based rental proven to leak revenue; sellers report real friction |
| Structured bike attributes (make / model / cc / year as columns) | Seller filter/browse proven necessary · to arrive as universal `nex_product.attributes jsonb`, benefits every vertical |
| Delivery-zone schema (polygon or named-zone enum) | Multi-location fleet or paid-delivery-by-zone necessary |
| Dedicated `/manage/motorbike` surface | Description convention proven insufficient AND multiple verticals share same pattern |
| Multi-location fleet | First motorbike shop with >1 location signs up and needs it |
| Rev 6 doctrine amendment codifying "verticals-change-presentation-first" principle | Motorbike + at least one more vertical both ship successfully using this pattern |
| cover-layout-suggest.ts automatic mapping `motorbike_shop → product` | Not necessary · founder confirmed sellers can pick layout manually; adding a mapping is useful but not architecture-proving |
| 7-missing-layouts contract mismatch (migration 100 declares 10 ids, 3 archetypes ship) | Separate P0/P1 architecture-integrity finding · deliberately NOT part of this build |

---

## 6 · Scope boundaries · what this review does NOT touch

Confirmed per founder instruction:

- No `nex_offer` table, columns, or type
- No new business category (reusing Products)
- No new UI shell / archetype (reusing `product`)
- No new React component (extending existing `CoverProductCard`)
- No new capability
- No new cover layout
- No cover-layout-suggest.ts change
- No ALTER TABLE on `nex_product`
- No ALTER TABLE on `nex_business`
- No ALTER TABLE on `nex_business_profile`
- No migration
- No DB write
- No seed data
- No touching the 7-missing-layouts contract mismatch
- No Rev 6 doctrine amendment
- No sealing the "verticals-change-presentation-first" principle
- No info-pages preset mechanism
- No info-pages data change
- No chat_theme changes (motorbike-rental theme is already live from a prior sealed task · untouched)
- No commits
- No pushes

**The only permitted artifact of this authorization is this review document.** Zero source file modifications. No files other than this `.md` written.

---

## 7 · Open items awaiting founder decision before implementation

| # | Item | Status |
|---|---|---|
| D1 | Four source files (3 vertical config + 1 card primitive) · scope confirmed? | Review requested |
| D2 | Exact priceLabel suppression lines (3.4.2 + 3.4.3) · acceptable? | Review requested |
| D3 | `CoverCatalog` / `CoverProductGrid` thread-through pattern (3.4.4-3.4.5) · acceptable? | Review requested |
| D4 | Caller-side computation `business.subtype !== "motorbike_shop"` lives in cover layouts.tsx — acceptable to touch that file during implementation? Or isolate into a helper? | Review requested |
| D5 | Review this document, then separately authorise implementation of the four-file change · OR request revisions · OR reject · OR defer | Pending |

---

## 8 · Future-proofing · how this v1 upgrades cleanly

When `nex_offer` ships (Rev 6 Phase 2), the migration path for existing motorbike shops is:

1. Add nex_offer rows per bike product · `offer_kind: 'rental_daily' | 'rental_weekly' | 'rental_monthly' | 'sale'` with structured prices
2. Terminology engine can then safely resolve `product.action` to "Rent" vs "Buy" because the offer kind is known per product
3. The `showPrice={false}` prop on `CoverProductCard` deprecates in favor of structured-offer-aware rendering (card shows "From Rp 150k/day" or "Rp 32M" + the right CTA based on offer data)
4. The description convention sellers used in v1 becomes documentation they can delete once their structured offers are in place

**Zero data loss. Zero shop breakage. Zero re-onboarding.** The architecture leaves room.

---

## 9 · Appendix · exact files inspected during this review

| File | Lines read | Purpose |
|---|---|---|
| `src/lib/nex-native/business/subtypes.ts` | 1-163 (full) | Confirm addition points for new subtype |
| `src/lib/nex-native/business/types.ts` | 59-64 | Confirm `ProductsSubtype` union |
| `src/lib/nex-native/business/terminology.ts` | 1-180 | Confirm `BY_SUBTYPE` pattern + Products section insertion point |
| `src/lib/nex-native/info-pages.ts` | 1-125 | Confirm no preset mechanism exists (none found; "documentation only" conclusion correct) |
| `src/app/nex-native/cover/CoverCatalog.tsx` | 1-80 | Confirm it forwards to CoverProductGrid |
| `src/app/nex-native/cover/primitives.tsx` | 550-902, 1120-1150 | Confirm `CoverProductCard` signature + both price-render locations |
| `nex-supabase/migrations/136_nex_chat_theme_motorbike_rental.sql` | (already applied) | Chat theme row exists · untouched by this review |

---

**END OF REVIEW DOCUMENT**

Standing by for founder decision on D1-D5 before any implementation.
