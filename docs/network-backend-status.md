# The Network — backend status

Living map of what's real, what's mock, and what's next. Updated as
each ship lands.

## Migrations to apply

Both migrations are in `supabase/migrations/`. Pick any of the three
apply methods from `docs/reviews-backend-deploy.md`.

| File | Purpose |
|---|---|
| `20260710120000_reviews.sql` | Reviews + events + accountability tables |
| `20260710130000_canteens.sql` | Canteens + members + products + posts tables |

## Auth model

Real HMAC-signed session cookie: **`xrated_trade_session`** — set by
`POST /api/trade-off/login` on successful password verify against
`hammerex_trade_off_listings.password_hash`. `src/lib/tradeSession.ts`
signs and verifies. `src/lib/merchantSession.ts` reads it as the
canonical identity used by every write endpoint below.

Testing fallback: `NETWORK_SESSION_STUB=1` env + `POST /api/merchant/session`
sets a plain slug cookie. Never enable in prod.

## Endpoints — real DB

### Reviews
| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/api/reviews/create` | Submit a new review | Anonymous cookie |
| POST | `/api/reviews/[id]/respond` | Merchant public reply | Trade session (must own review's merchant) |
| POST | `/api/reviews/publish-pending` | 72h cool-off cron | `x-cron-secret` header |

### Canteens
| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/api/canteens/create` | Host creates a canteen | Trade session |
| POST | `/api/canteens/[slug]/products/create` | Host adds product | Trade session + must be host |
| POST | `/api/canteens/[slug]/products/[id]/boost` | Apply boost plan | Trade session + must be host |
| DELETE | `/api/canteens/[slug]/products/[id]/boost` | Cancel active boost | Trade session + must be host |
| POST | `/api/canteens/[slug]/join` | Join as member | Trade session |
| DELETE | `/api/canteens/[slug]/join` | Leave (non-host only) | Trade session |

### Merchant session
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/trade-off/login` | Password login → sets `xrated_trade_session` |
| POST | `/api/merchant/session` | Testing stub (requires `NETWORK_SESSION_STUB=1`) |
| DELETE | `/api/merchant/session` | Clear stub cookie |

## Reads — real DB with mock fallback

| Surface | Reader | Fallback |
|---|---|---|
| Canteen detail page | `canteenBySlugFromDb` etc. | Yes |
| Merchant reviews page | `reviewsForMerchantFromDb` | Yes |
| Notebook merchant page | `eventsForMerchantFromDb` (derived) | Yes |
| Profile focus admin | Uses canteen server helpers | Yes |
| Leave-a-review back-link | `canteenHostedByMerchantFromDb` | Yes |

## What's still mock

- `platformSideLane()` in `src/lib/canteens.ts` — cross-canteen posts query needs
  writing (posts.kind='counter', status='live', sponsored-first sort)
- `browseAllProducts()` / `browseTradeFacets()` in Trade Center — cross-canteen product query
- `canteenProductById` used by CanteenPageShell — client-side lookup, needs server helper

## What's still missing (no write endpoint yet)

- Post to canteen chat (`POST /api/canteens/[slug]/posts/create`)
- Post to Counter (promoted canteen post — same table, `kind='counter'`)
- Owner dispute a review with evidence
- Admin freeze/verify/remove reviews
- Reviewer accountability recalc (background job)
- Canteen host handover
- Member role promotion (moderator)

## Environment checklist

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_COOKIE_SECRET=<32+ char hex>          # HMAC for session cookies
CRON_SECRET=<32+ char hex>                  # Guards publish-pending endpoint
NETWORK_SESSION_STUB=0                       # 1 only for local testing
```

Vercel cron for the 72h publish:
```json
{
  "crons": [
    { "path": "/api/reviews/publish-pending", "schedule": "*/15 * * * *" }
  ]
}
```

## Full smoke-test flow

Once migrations applied + secrets set:

```bash
# 1. Login as Mike (password already set via /api/trade-off/set-password)
curl -X POST http://localhost:3000/api/trade-off/login \
  -H "Content-Type: application/json" -c mike.cookies \
  -d '{ "whatsapp": "+447700900101", "password": "correct-horse-battery-staple" }'

# 2. Mike creates his canteen
curl -X POST http://localhost:3000/api/canteens/create \
  -H "Content-Type: application/json" -b mike.cookies \
  -d '{
    "slug": "uk-kitchen-fitters",
    "name": "UK Kitchen Fitters",
    "tagline": "Where kitchen chippies talk carcasses.",
    "tradeSlug": "kitchen-fitter",
    "tradeLabel": "Kitchen Fitters"
  }'

# 3. Mike adds a product
curl -X POST "http://localhost:3000/api/canteens/uk-kitchen-fitters/products/create" \
  -H "Content-Type: application/json" -b mike.cookies \
  -d '{
    "name": "Solid oak worktop 3m",
    "blurb": "Kiln-dried European oak",
    "priceGbp": 128,
    "featured": true
  }'

# 4. Mike boosts the product (30-day trade-targeted)
curl -X POST "http://localhost:3000/api/canteens/uk-kitchen-fitters/products/<id>/boost" \
  -H "Content-Type: application/json" -b mike.cookies \
  -d '{ "planId": "boost-30d" }'

# 5. Rachel (different merchant) joins Mike's canteen
curl -X POST http://localhost:3000/api/trade-off/login \
  -H "Content-Type: application/json" -c rachel.cookies \
  -d '{ "whatsapp": "+447700900103", "password": "..." }'

curl -X POST "http://localhost:3000/api/canteens/uk-kitchen-fitters/join" \
  -H "Content-Type: application/json" -b rachel.cookies \
  -d '{ "displayName": "Rachel Simms", "tradeLabel": "Kitchen Fitter", "city": "Liverpool" }'

# 6. Rachel reviews Mike (5-star, immediate publish)
curl -X POST http://localhost:3000/api/reviews/create \
  -H "Content-Type: application/json" -b rachel.cookies \
  -d '{
    "merchantSlug": "demo-mike-watson-drywall-manchester",
    "scores": { "quality": 5, "communication": 5, "punctuality": 5, "value": 5, "cleanliness": 5 },
    "body": "Worktops arrived perfect, invoice matched the quote, delivery on the day. Whole game.",
    "jobVerification": { "kind": "whatsapp-thread" },
    "photoUrls": []
  }'

# 7. Reload /trade/demo-mike-watson-drywall-manchester/reviews → Rachel's review is live
# 8. Reload /trade-off/notebook/demo-mike-watson-drywall-manchester → review-landed event shows
# 9. Mike replies to Rachel's review
curl -X POST "http://localhost:3000/api/reviews/<review-id>/respond" \
  -H "Content-Type: application/json" -b mike.cookies \
  -d '{ "body": "Cheers Rachel — glad the timing worked out. See you on the next fit." }'
```

Every step above hits real DB. Nothing mocked.
