# Reviews backend — deploy checklist

Real DB + endpoints for the reviews system. Apply once, then the
mock/real fallback keeps everything working end-to-end.

## 1. Apply the migration

The SQL lives at `supabase/migrations/20260710120000_reviews.sql`.
Three tables, indexes, RLS policies, one trigger.

Options for applying:

### Option A — Supabase CLI (if wired)
```bash
supabase db push
```

### Option B — Management API (matches reference_hammerex_supabase_admin.md pattern)
```bash
curl -X POST "https://api.supabase.com/v1/projects/msdonkkechxzgagyguoe/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "$(jq -Rs '.' < supabase/migrations/20260710120000_reviews.sql)"
```

### Option C — SQL editor in the Supabase dashboard
Paste the file contents and run.

## 2. Smoke test — write a real review

```bash
curl -X POST http://localhost:3000/api/reviews/create \
  -H "Content-Type: application/json" \
  -d '{
    "merchantSlug": "demo-mike-watson-drywall-manchester",
    "scores": { "quality": 5, "communication": 5, "punctuality": 5, "value": 5, "cleanliness": 5 },
    "body": "Backend smoke test — this row should land in hammerex_trade_off_reviews with status=published and appear on Mikes reviews page immediately.",
    "jobVerification": { "kind": "whatsapp-thread" },
    "photoUrls": [],
    "reviewerDisplayName": "Smoke Test"
  }'
```

Expected response:
```json
{
  "ok": true,
  "id": "<uuid>",
  "status": "published",
  "publishAt": "<now-iso>",
  "overall": 5,
  "coolOffActive": false
}
```

## 3. Smoke test — the 72h window

Submit a review with any score under 4 average:

```bash
curl -X POST http://localhost:3000/api/reviews/create \
  -H "Content-Type: application/json" \
  -d '{
    "merchantSlug": "demo-mike-watson-drywall-manchester",
    "scores": { "quality": 3, "communication": 3, "punctuality": 3, "value": 3, "cleanliness": 3 },
    "body": "Under-4 review — should enter the 72h cool-off window and NOT appear on the public reviews page until publish_at passes.",
    "jobVerification": { "kind": "invoice" },
    "photoUrls": []
  }'
```

Expected response:
```json
{
  "ok": true,
  "id": "<uuid>",
  "status": "pending",
  "publishAt": "<+72h>",
  "overall": 3,
  "coolOffActive": true
}
```

Reload `/trade/demo-mike-watson-drywall-manchester/reviews` — the
pending row must NOT be visible (RLS policy `reviews_read_published`
enforces this at the DB level).

## 4. Verify the fallback still works

Delete every row for a merchant, or hit the reviews page for a slug
with zero rows. The mock reviews from `src/lib/reviews.ts` should
render — that keeps the demo alive until real reviews accumulate.

## 5. 72h cool-off publish cron

Endpoint: `POST /api/reviews/publish-pending`. Guarded by
`x-cron-secret` header matching `process.env.CRON_SECRET`. Flips
pending → published where `publish_at <= now()` AND admin hasn't
frozen or removed the row. Idempotent, safe to hit every minute.

### Setup
```bash
# 1. Set CRON_SECRET in your .env.local + Vercel envs
export CRON_SECRET=$(openssl rand -hex 32)

# 2. Add to vercel.json for scheduled runs (every 15 min)
{
  "crons": [
    { "path": "/api/reviews/publish-pending", "schedule": "*/15 * * * *" }
  ]
}

# 3. Manual smoke test — apply the -3-star row from step 3, then:
curl -X POST http://localhost:3000/api/reviews/publish-pending \
  -H "x-cron-secret: $CRON_SECRET"

# Response (no rows ripe yet if publish_at is in the future):
# { "ok": true, "published": 0 }

# 4. To fast-test the publish flow, manually backdate a pending row
# in SQL editor, then re-hit the cron:
UPDATE hammerex_trade_off_reviews
   SET publish_at = now() - interval '1 minute'
 WHERE status = 'pending' LIMIT 1;
```

## 6. Merchant session (interim)

The respond endpoint requires a `network_merchant_slug` cookie. Until
real auth lands, a testing stub sets the cookie manually.

### Enable the stub
```bash
# .env.local
NETWORK_SESSION_STUB=1
```

### Set the cookie
```bash
curl -X POST http://localhost:3000/api/merchant/session \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{ "slug": "demo-mike-watson-drywall-manchester" }'
```

### Respond to a review as Mike
```bash
curl -X POST "http://localhost:3000/api/reviews/<review-id>/respond" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{ "body": "Thanks for the honest feedback. Well be tightening the delivery window next month." }'
```

### Log out
```bash
curl -X DELETE http://localhost:3000/api/merchant/session -b cookies.txt
```

**SECURITY**: never enable `NETWORK_SESSION_STUB=1` in production. It
lets anyone claim any merchant slug. Real auth (WhatsApp OTP +
password) replaces this endpoint before launch.

## 7. What still needs shipping

**Blocked on this session's ship:**
- ✅ Migration + 3 tables + indexes + RLS + trigger
- ✅ `POST /api/reviews/create` writes to DB (was stub)
- ✅ `POST /api/reviews/[id]/respond` — owner public reply endpoint
- ✅ Reviews page reads from DB with mock fallback
- ✅ Anonymous reviewer cookie set on first review
- ✅ 72h cool-off publish cron (`POST /api/reviews/publish-pending`)
- ✅ Merchant session helper + stub login endpoint

**Needs a follow-up session:**
- Merchant dispute dashboard at `/trade/[slug]/reviews/pending`
- Admin freeze/remove/verify endpoints
- Reviewer accountability updater (recalculates `weight_multiplier`
  when a review is disputed/removed)
- Real auth — WhatsApp OTP + password verification against
  `hammerex_trade_off_listings.password_hash`

## 6. Files changed this ship

New:
- `supabase/migrations/20260710120000_reviews.sql`
- `src/lib/reviews.server.ts` — server-side reader
- `src/app/api/reviews/[id]/respond/route.ts` — owner reply endpoint
- `docs/reviews-backend-deploy.md` — this file

Modified:
- `src/app/api/reviews/create/route.ts` — real DB write
- `src/app/trade/[slug]/reviews/page.tsx` — reads via reviews.server
