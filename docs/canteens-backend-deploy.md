# Canteens backend — deploy checklist

Same shape as `reviews-backend-deploy.md`. Real DB + server reader
with mock fallback. Apply once, then the fallback keeps everything
working end-to-end.

## 1. Apply the migration

The SQL lives at `supabase/migrations/20260710130000_canteens.sql`.
Four tables (canteens, canteen_members, canteen_products, canteen_posts),
indexes, RLS policies, one shared trigger.

Same three options as reviews:

```bash
# Option A — Supabase CLI
supabase db push

# Option B — Management API
curl -X POST "https://api.supabase.com/v1/projects/msdonkkechxzgagyguoe/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "$(jq -Rs '.' < supabase/migrations/20260710130000_canteens.sql)"

# Option C — Paste into Supabase dashboard SQL editor
```

## 2. Seed the first canteen — matches the current mock

Copy Mike Watson's `uk-kitchen-fitters` canteen into real rows so
`/trade-off/yard/canteens/uk-kitchen-fitters` reads from the DB
instead of falling back to mocks.

```sql
-- Canteen
INSERT INTO hammerex_canteens (
  slug, name, tagline, trade_slug, trade_label, host_slug,
  host_display_name, member_count, posts_last_30d, activity_streak_months,
  header_bg_url, is_founding_100
) VALUES (
  'uk-kitchen-fitters',
  'UK Kitchen Fitters',
  'Where kitchen chippies talk carcasses, worktops and horror-story customers.',
  'kitchen-fitter',
  'Kitchen Fitters',
  'demo-mike-watson-drywall-manchester',
  'Mike Watson',
  128, 64, 2,
  'https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2006_18_07%20AM.png',
  true
) RETURNING id;
-- Copy the returned uuid — you'll need it for the members + products insert below.

-- Admin (Mike)
INSERT INTO hammerex_canteen_members (
  canteen_id, member_slug, display_name, trade_label, city, avatar_url,
  role, whatsapp, bio_short, postcode_area, office_hours,
  showroom_address_line, showroom_postcode,
  verified_companies_house, verified_insurance_gbp, verified_trust_score,
  availability, response_time, phone, email,
  instagram_handle, facebook_handle, website_url,
  reviews_avg, reviews_count, portfolio_count, country
) VALUES (
  '<canteen-uuid-from-above>',
  'demo-mike-watson-drywall-manchester',
  'Mike Watson',
  'Drywaller',
  'Manchester',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&crop=faces',
  'admin',
  '447700900101',
  'Board changes + rewires. NW callouts. Verified merchant.',
  'M14',
  'Mon–Fri · 8:00–17:00' || chr(10) || 'Sat · 9:00–13:00' || chr(10) || 'Sun · closed',
  '42 Trade Row',
  'M14 5AB',
  true, 5000000, 87,
  'Available next week', 'Usually replies in 2h',
  '+447700900101', 'mike@watsons.trade',
  'watsonsjoinery', 'watsonsjoinery', 'watsons.trade',
  4.9, 128, 48, 'UK'
);
```

## 3. Verify the read path

Reload `/trade-off/yard/canteens/uk-kitchen-fitters`. It should still
render with Mike as admin — but now from the DB, not the mock. Check
the Network tab: `hammerex_canteens` + `hammerex_canteen_members`
queries should fire.

Delete the seed row and reload — the mock fallback should render Mike
again. This proves the fallback works.

## 4. What's now real end-to-end

| Surface | Reads from | Writes to |
|---|---|---|
| Canteen detail page | ✅ DB + mock fallback | (no write path yet) |
| Reviews page | ✅ DB + mock fallback | ✅ POST /api/reviews/create |
| Leave-a-review success screen back-link | ✅ DB canteen lookup | — |
| Notebook merchant page | ✅ DB canteen banner + hostSlug | (events still mock) |
| Trade Center browse | Still mock (uses browseAllProducts on mock arrays) | (no write path yet) |
| Canteen product focus | Uses in-shell mock lookup | — |
| Owner response to review | — | ✅ POST /api/reviews/[id]/respond |

## 5. What still needs shipping

**Reads still on mocks:**
- `platformSideLane()` — reads mock SideLanePost array. Real read
  needs `hammerex_canteen_posts` populated + a cross-canteen query
  filtered by `kind='counter' AND status='live'`.
- `canteenProductById()` (still called from `CanteenPageShell`) —
  needs shell to call the server helper, or a client hydration path.
- `browseAllProducts()` in Trade Center — reads from mock arrays.
- Notebook events — currently derived from mock, will fan over real
  yard posts / reviews / canteen posts / product interactions once
  those tables are live.

**No write endpoints yet:**
- Create canteen (host)
- Add product (host)
- Boost product (host)
- Join canteen (member)
- Post to canteen (member)
- Post to Counter (host, promotes a listing)
- Owner dispute-with-evidence for low reviews

**Auth:**
- Merchant session cookie (`network_merchant_slug`) is expected by
  the review-respond endpoint. Nothing sets it yet. Blocked on the
  auth system.

## 6. Files touched this ship

New:
- `supabase/migrations/20260710130000_canteens.sql`
- `src/lib/canteens.server.ts`
- `docs/canteens-backend-deploy.md`

Modified:
- `src/app/trade-off/yard/canteens/[slug]/page.tsx` — reads via canteens.server
- `src/app/trade/[slug]/reviews/page.tsx` — reads via canteens.server (hosted canteen + banner)
- `src/app/trade/[slug]/reviews/new/page.tsx` — reads via canteens.server
- `src/app/trade-off/notebook/[slug]/page.tsx` — reads via canteens.server
