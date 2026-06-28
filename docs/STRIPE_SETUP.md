# Stripe Setup — Xrated Trades

This doc covers everything you (the operator) must do in the Stripe Dashboard
and your environment before paid tiers + add-ons can take money.

The code is already wired up. After you complete the steps below and paste
your keys into `.env.local` (or your Vercel project env), it will work in
test mode immediately. Switch to live keys to take real money.

---

## 1. Install the SDK

`stripe` has been added to `package.json` but you still need to install it:

```bash
npm install
```

---

## 2. Create products in the Stripe Dashboard

You need **12 products** total: 2 tier products + 10 add-on products. Each
tier product needs TWO recurring prices (monthly + annual). Each add-on
needs a single recurring price (monthly is fine; change if you want).

Go to **Dashboard → Products → Add product** and create:

### Tier products (2 products, 4 prices total)

| Product name              | Price 1                 | Price 2                |
| ------------------------- | ----------------------- | ---------------------- |
| Trades App — Paid Tier    | Monthly recurring (GBP) | Annual recurring (GBP) |
| Trades App — Verified Tier | Monthly recurring (GBP) | Annual recurring (GBP) |

After creating each price, copy the **price ID** (`price_xxx...`) — that's
what goes in the env vars below, NOT the product ID.

### Add-on products (10 products, 10 prices)

Create one product per add-on, each with a single recurring monthly price:

1. Trade Centre
2. Services Grid
3. Downloads
4. Job Diary
5. Wholesale Mode
6. Custom Domain
7. Lead Alerts
8. Materials Network
9. Quote Pipeline
10. FAQ Page

Pricing is yours to set — the code reads whatever the price ID points to.

---

## 3. Set up the webhook

Go to **Dashboard → Developers → Webhooks → Add endpoint**.

- **Endpoint URL:** `https://xratedtrade.com/api/stripe/webhook`
- **Events to send:** select these three exactly:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

After creating the endpoint, click **Reveal signing secret** and copy it.
That goes into `STRIPE_WEBHOOK_SECRET` below.

For local testing, use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3008/api/stripe/webhook
```

The CLI prints a `whsec_...` secret for the duration of the session — paste
THAT into your local `.env.local` while testing locally.

---

## 4. Environment variables

Add all 14 vars to `.env.local` (and your Vercel project env for production):

```env
# Stripe core (2 vars)
STRIPE_SECRET_KEY=sk_test_...           # sk_live_... in production
STRIPE_WEBHOOK_SECRET=whsec_...

# Tier price IDs (4 vars)
STRIPE_PRICE_PAID_MONTHLY=price_...
STRIPE_PRICE_PAID_ANNUAL=price_...
STRIPE_PRICE_VERIFIED_MONTHLY=price_...
STRIPE_PRICE_VERIFIED_ANNUAL=price_...

# Add-on price IDs (10 vars)
STRIPE_PRICE_ADDON_TRADE_CENTER=price_...
STRIPE_PRICE_ADDON_SERVICES_GRID=price_...
STRIPE_PRICE_ADDON_DOWNLOADS=price_...
STRIPE_PRICE_ADDON_JOB_DIARY=price_...
STRIPE_PRICE_ADDON_WHOLESALE_MODE=price_...
STRIPE_PRICE_ADDON_CUSTOM_DOMAIN=price_...
STRIPE_PRICE_ADDON_LEAD_ALERTS=price_...
STRIPE_PRICE_ADDON_MATERIALS_NETWORK=price_...
STRIPE_PRICE_ADDON_QUOTE_PIPELINE=price_...
STRIPE_PRICE_ADDON_FAQ_PAGE=price_...
```

Optional but recommended:

```env
# Used for success_url / cancel_url; defaults to request origin if unset.
NEXT_PUBLIC_SITE_URL=https://xratedtrade.com
```

---

## 5. Verify

After the env vars are set and `npm install` has run:

1. POST a test payload to `/api/stripe/checkout`:
   ```json
   {
     "tier": "paid",
     "billing": "monthly",
     "listing_slug": "your-test-listing",
     "addon_slugs": []
   }
   ```
   You should get back `{ "url": "https://checkout.stripe.com/..." }`.

2. Complete the checkout in test mode (card `4242 4242 4242 4242`, any
   future expiry, any CVC).

3. The webhook should fire and flip the listing's `tier` to `app_paid`
   with a `paid_expires_at` ~30 days out (monthly) or ~365 days out
   (annual). Check the row in Supabase:
   ```sql
   select tier, paid_expires_at, last_payment_plan, addons_enabled
   from hammerex_trade_off_listings
   where slug = 'your-test-listing';
   ```

---

## 6. Files in the codebase

- `src/lib/stripe.ts` — SDK init, `getStripe()` helper.
- `src/lib/stripePrices.ts` — Tier + add-on price-ID resolver.
- `src/app/api/stripe/checkout/route.ts` — POST creates a Checkout Session.
- `src/app/api/stripe/webhook/route.ts` — POST handles Stripe events.
- `docs/STRIPE_SETUP.md` — this file.

---

## 7. Going live

1. Repeat steps 2–3 in the **Live** mode toggle of the Stripe Dashboard.
2. Swap every env var from `sk_test_` / `price_` (test) to `sk_live_` /
   the matching live `price_` IDs.
3. Update the webhook signing secret to the live endpoint's secret.
4. Redeploy.

Nothing else changes — the code is mode-agnostic.
