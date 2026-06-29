# Affiliate Programme — External Integrations

Phase 3 ships SCAFFOLDS for five external services. Each helper
short-circuits with `{ ok: true, skipped: true }` when its env vars are
not configured, so the app never breaks because an integration is
unwired. To switch one on, set the env vars listed below and replace
the marked TODO block inside the helper with the live API call.

---

## 1. WhatsApp Business API

- **Helper**: `src/lib/whatsappBusiness.ts` — `sendWhatsAppMessage(to, body)`
- **Env**:
  - `WHATSAPP_BUSINESS_TOKEN` — long-lived access token from Meta
  - `WHATSAPP_BUSINESS_PHONE_ID` — registered phone number ID
- **Steps to enable**:
  1. Set both env vars in Vercel project settings (Production + Preview).
  2. Uncomment the Graph API POST block inside the helper.
  3. Confirm by sending a test message to your own WhatsApp number.

The existing `affiliateEmails.ts` notifications can optionally also
fan out via WhatsApp once you wire this up — just call
`sendWhatsAppMessage(affiliate.whatsapp, body)` alongside the Resend
call.

---

## 2. PayPal Payouts API

- **Helper**: `src/lib/paypalPayouts.ts` — `sendPayout({ paypal_email, amount_gbp, note })`
- **Env**:
  - `PAYPAL_CLIENT_ID`
  - `PAYPAL_SECRET`
  - `PAYPAL_PAYOUT_MODE` — `live` or `sandbox` (defaults to `sandbox`)
- **Steps to enable**:
  1. Create a REST API app in the PayPal developer dashboard.
  2. Copy the client ID + secret into Vercel env.
  3. Uncomment the OAuth + payout block inside the helper.

---

## 3. Wise (TransferWise) Business API

- **Helper**: `src/lib/wisePayouts.ts` — `sendWisePayout({ email, amount_gbp, note })`
- **Env**:
  - `WISE_API_TOKEN`
  - `WISE_PROFILE_ID`
- **Steps to enable**:
  1. Create a Wise Business account + API token (scopes: transfers).
  2. Look up the profile ID via `GET /v1/profiles`.
  3. Implement the four-step Wise transfer flow described in the helper.

---

## 4. IPQualityScore VPN detection

- **Helper**: `src/lib/vpnDetection.ts` — `detectVpn(ip)`
- **Env**: `IPQUALITYSCORE_KEY`
- **Steps to enable**:
  1. Sign up at ipqualityscore.com (the free tier covers thousands of
     lookups/month).
  2. Set `IPQUALITYSCORE_KEY`.
  3. Uncomment the lookup block.

When set, the affiliate signup API can call `detectVpn()` and either
reject or flag the row.

---

## 5. Cloudflare Turnstile

- **Component**: `src/components/xrated/TurnstileChallenge.tsx`
- **Env**:
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — exposed to the browser
  - `TURNSTILE_SECRET_KEY` — verified server-side in the signup API
- **Steps to enable**:
  1. Create a Turnstile widget at dash.cloudflare.com → Turnstile.
  2. Set both env vars in Vercel.
  3. Server-side, verify the `turnstile_token` posted by the signup form
     against `https://challenges.cloudflare.com/turnstile/v0/siteverify`
     with `TURNSTILE_SECRET_KEY` before allowing the row to insert.

The widget already conditionally renders on `/affiliates/signup`: it
shows only when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set, so prod can
go live independently of dev.
