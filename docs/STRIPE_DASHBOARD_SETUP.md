# Stripe Dashboard Setup — Live Account Compliance Checklist

> Required steps the OWNER must complete in the Stripe Dashboard before
> taking real payments. Code-side setup is already done (products,
> prices, webhook endpoint, Checkout, Customer Portal API integration);
> this document covers account profile, business identification,
> statement descriptor, Customer Portal, tax, and risk-review
> preparation — all of which can ONLY be done through the Dashboard UI
> (or Stripe Support), not through the API.

---

## 0. Critical first move — name your business in Stripe carefully

This is the single highest-leverage decision in the entire setup. Get
it wrong and Stripe Risk's automated content filters will flag the
account before a single live transaction clears.

**The problem.** Stripe Risk runs lexical pattern matching against the
business name, trading name, domain, and product description. The
domain `xratedtrade.com` is a near-miss against their adult-content
blocklist. "Xrated" as the lead identifier on the account will trigger
the same filter. The fact that the actual product is a worldwide B2B
SaaS for construction trades is irrelevant to the bot — only humans
see that nuance, and only if they read.

**The fix.** Lead with construction context everywhere a free-text
field is offered:

- **Legal name** in Stripe Dashboard → use your registered company
  name. If the limited company is called "Trade Off Ltd", use that.
  If it's registered under a different name, use that registered
  name verbatim. Do NOT enter "Xrated" as the legal entity.
- **Trading name (DBA)** → `Trade Off` or `Xrated Trades (Trade Off)`.
  Putting "Trade Off" first means the human reviewer sees the
  legitimate descriptor before the loaded one.
- **Statement descriptor** on customer card statements → `TRADE OFF`
  (5-22 chars, no special characters). Customers paying £14.99/month
  who see `XRATEDTRADE.COM` on their bank statement will dispute at a
  much higher rate; `TRADE OFF` reads as a normal business name.

Treat this section as a prerequisite to every other section below.

---

## 1. Business profile

Find the Business profile / Account details section in the Dashboard
(usually under Settings → Business settings).

### Fields to fill

- **Legal entity name** — exact registered name on Companies House.
- **Trading name (DBA)** — `Trade Off` preferred; `Xrated Trades` only
  as a secondary line if the field accepts both.
- **Companies House number** — required for UK limited companies; 8
  digits, found on the Companies House register.
- **VAT number** — only if VAT-registered. If you're under the £90,000
  threshold and not registered, leave blank; do not invent a number.
- **Registered business address** — must match Companies House.
- **Business phone** — UK landline or mobile; must be reachable for
  Stripe support to call.
- **Business website** — `https://xratedtrade.com`. Stripe will crawl
  this; make sure the homepage clearly shows construction tradespeople
  before submitting.
- **Support email** — `support@xratedtrade.com` (or whichever inbox
  you actually monitor). Stripe shows this to customers on refund
  notifications and dispute correspondence.

### Business description (paste verbatim)

> Worldwide subscription SaaS for construction tradespeople. Provides
> public profile pages, customer review systems, catalogue and cart
> features for merchant trades, and lead-capture tools. £14.99/month
> or £139.99/year recurring billing in GBP, with customers in the UK,
> EU, US, Australia and elsewhere; Stripe handles the FX from the
> cardholder's local currency to GBP at checkout. Operating under
> the trading name Trade Off (also known as Xrated Trades). No
> physical product is shipped — pure digital service. Target
> customers are self-employed tradespeople: builders, plumbers,
> electricians, plasterers, scaffolders, joiners, decorators, and
> similar, primarily in English-speaking markets.

### Industry / MCC

- **Industry category** — choose the closest of: Software as a
  Service (SaaS), Computer Services / IT, or Professional Services.
- **MCC (Merchant Category Code)** — Stripe assigns this from the
  industry selection. `5734` (Computer Software Stores) or `5817`
  (Digital Goods – Applications) are both appropriate. `7372`
  (Prepackaged Software) is also acceptable. Avoid anything in the
  7990s (recreation services) which can attract higher scrutiny.

---

## 2. Bank account for payouts

- **Currency** — GBP.
- **Country** — United Kingdom.
- **Sort code** — 6 digits.
- **Account number** — 8 digits.
- **Account holder name** — must match the registered legal entity
  name on the business profile. A mismatch here is a guaranteed
  payout hold.

If the limited company hasn't opened a business bank account yet,
Stripe will accept a personal sole-trader account only if the legal
entity is set to "Individual / Sole Trader". Once the Ltd is the
legal entity, only a business bank account in that Ltd's name will
clear payouts.

---

## 3. Statement descriptor

Two descriptors exist; both matter.

- **Shortened (static) descriptor** — appears on every card statement.
  Limit 22 characters. Allowed characters: letters, numbers, spaces,
  and a small set of punctuation (`&`, `.`, `-`, `,`). Recommended:
  `TRADE OFF`.
- **Full business name / soft descriptor** — appears alongside on
  some statements. Recommended: `Trade Off` (matching the trading
  name above).
- **Dynamic descriptor suffix** — optional. Stripe lets you suffix
  the static descriptor per charge, e.g. `TRADE OFF* MONTHLY` or
  `TRADE OFF* ANNUAL`. Useful for disputes because it tells the
  cardholder which plan they were on.

**Do NOT use** `XRATED`, `XRATEDTRADE`, or `XRATEDTRADE.COM` as the
statement descriptor. This is the single most common dispute trigger
("I didn't subscribe to anything called Xrated") and it primes the
chargeback system against you.

---

## 4. Customer Portal configuration

Find Settings → Billing → Customer portal. The code-side calls
`stripe.billingPortal.sessions.create()`; this will return HTTP 400
until the portal is configured here at least once.

### Features to enable

- **Update payment method** — ON.
- **Cancel subscription** — ON. Choose **end of billing period**
  (not immediate). This is the UK consumer-rights friendly default
  and reduces refund requests.
- **Switch plans** — ON. Allow movement between the Monthly, Annual,
  and Verified tiers so customers can self-serve upgrades without
  contacting support.
- **View and download invoices** — ON.
- **Update billing information** — ON (address, name, VAT ID).

### Branding

- **Headline** — "Manage your Trade Off subscription".
- **Customer support link** — `mailto:support@xratedtrade.com`.
- **Logo** — upload the same logo used on the marketing site.
- **Colours** — match the live site so users recognise it as yours.

### Save

The portal must be explicitly saved at least once or the API stays in
"not configured" mode and the redirect will fail.

---

## 5. Tax

UK VAT rules (as at 2026): VAT registration becomes mandatory once
taxable turnover exceeds £90,000 in any rolling 12-month period.

### If VAT-registered now

- Enable **Stripe Tax**.
- Register the UK VAT identity in Stripe Tax → Registrations.
- Stripe will start adding 20% VAT to each invoice automatically and
  reporting it in the Tax dashboard.
- Update the product pricing model: decide whether the £14.99 /
  £139.99 prices are **inclusive** of VAT or **exclusive**. For a
  consumer-facing UK SaaS, inclusive is the convention. Confirm this
  matches the prices configured in the Stripe products.

### If not VAT-registered yet

- Leave Stripe Tax disabled for now.
- Set a calendar reminder to check turnover quarterly. The £90,000
  threshold is hit faster than people expect when subscriptions
  compound.
- Enable Stripe Tax's "monitor thresholds" feature so it warns you
  before you cross the registration line.

### Selling into the EU (VAT OSS)

Once the merchant of record sits in the Republic of Ireland and you
are taking subscriptions from EU consumers, EU place-of-supply rules
make the subscription taxable in the **customer's country**, not
ours. The clean way to handle this is the EU **One Stop Shop (OSS)**
union scheme (the modern successor to VAT MOSS for cross-border
B2C digital services):

- Register for the **VAT OSS Union scheme** with Irish Revenue once
  cross-border EU B2C sales pass €10,000 in a calendar year. Below
  the threshold the supply is taxable in Ireland; above it, in the
  customer's country.
- Enable **Stripe Tax** and add an OSS registration so Stripe
  charges the correct EU country VAT rate at checkout (e.g. 19% DE,
  21% NL, 23% IE) and reports the per-country totals you'll need
  for the quarterly OSS return.
- Stripe Tax handles the B2B reverse-charge automatically when the
  customer adds a valid EU VAT ID at checkout.
- Confirm whether the displayed price is **VAT-inclusive** or
  **exclusive** at the product level — for consumer-facing UK SaaS
  inclusive is the convention, but EU rate variance (17%-27%) makes
  an exclusive-display + "VAT added at checkout" model easier to
  reconcile if your audience is heavily EU.

### Selling into the US (sales tax on digital goods)

The US has no federal VAT. Each state sets its own rules, and
**most states tax digital goods / SaaS** (as of 2026: ~30 states
including TX, WA, OH, PA, CT, NY for some categories). Liability is
**economic-nexus based**:

- Under the Streamlined Sales Tax / Wayfair framework, you become
  liable to register and collect once you cross a state's threshold
  — typically **$100,000 in sales OR 200 separate transactions per
  state in a rolling 12-month window** (a few states use only the
  $-threshold post-2023; check each one).
- Stripe Tax has a US digital-goods rule set: enable it and add
  registrations as you cross each state's threshold. Stripe will
  monitor thresholds for you and warn before you trip them.
- For low-volume US sales below every state's threshold, no
  registration is required and the price stays inclusive. Re-check
  quarterly because thresholds compound across renewing
  subscriptions surprisingly fast.
- Some states require a Streamlined Sales Tax (SST) registration
  instead of one-state-at-a-time — SST simplifies multi-state
  filing if you're already over five or six thresholds.

---

## 6. Webhooks

**Status: already configured by `scripts/setup-stripe.mjs`.**

- Endpoint URL: `https://xratedtrade.com/api/stripe/webhook`
- Events subscribed:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Signing secret: stored in `.env.local` as `STRIPE_WEBHOOK_SECRET`.

**No Dashboard action needed** unless:

- The production domain changes (then update the endpoint URL).
- The signing secret leaks (then rotate it in Dashboard and update
  `.env.local`).
- A new event type is needed (e.g. `invoice.payment_failed` for
  dunning emails) — add it in Dashboard and handle it in the route.

---

## 7. Risk + Radar settings

Find Settings → Radar → Rules.

### Starting rule set (recommended)

- **Block** if `:cvc_check: = 'fail'` — block CVC mismatches.
- **Block** if `:risk_level: = 'highest'` — Stripe's own ML signal.
- **Review** if `:card_country: != :ip_country:` — manual check on
  cross-border card use; you'll see most legitimate UK trades from
  UK IPs.
- **Review** if `:cardholder_name: = ''` — missing name is a weak
  fraud signal.

### Risk threshold

- Set the overall risk threshold to **Normal / Medium**. Low blocks
  too many real customers; High lets through obvious fraud. Medium
  is the default for SaaS subscriptions.
- **International note.** Selling worldwide means a meaningfully
  higher share of cross-border, cross-IP-country card use than a
  UK-only merchant would see. Stripe Radar's base ML signal already
  factors region into the risk score, so keep the threshold at
  **Medium** even though gut instinct on "more international = more
  fraud" might push you toward High. High at our volume will block
  too many genuinely-foreign tradies. The `:card_country: !=
  :ip_country:` review rule above catches the actual fraud pattern
  (stolen-card-from-elsewhere) without sledgehammering legitimate
  travellers or expats.

### Allowlist your own card

Add your own card fingerprint to the allowlist so internal test
purchases don't get blocked or accidentally inflate your risk score.

---

## 8. Public-facing policy URLs

Find Settings → Public details (sometimes "Customer-facing details").
These three URLs appear on Stripe-hosted Checkout pages and on
dispute evidence forms, and they materially reduce chargeback
liability under Stripe's seller protection.

- **Refund policy URL** — `https://xratedtrade.com/legal/refunds`
- **Terms of Service URL** — `https://xratedtrade.com/legal/terms`
- **Privacy Policy URL** — `https://xratedtrade.com/legal/privacy`

Verify each URL returns a 200 and renders the policy text before
saving in Stripe. Stripe Risk reviewers often click these.

---

## 9. Customer email receipts

Find Settings → Customer emails (or similar — the section where you
toggle Stripe-sent transactional emails).

### Enable

- **Successful payment receipts** — ON.
- **Subscription renewal reminders** — ON (the 7-day-before email
  reduces dispute volume noticeably).
- **Failed payment notifications** — ON.
- **Refund confirmations** — ON.

### Sender identity

- **From name** — `Trade Off`.
- **From email** — `noreply@xratedtrade.com` (or `billing@…`). The
  domain MUST have SPF and DKIM records verified in your DNS or the
  emails will land in spam. Stripe shows a verification status
  indicator next to the from-address field; do not save until it
  reads "verified".

---

## 10. Domain verification for Apple Pay / Google Pay

Mobile Safari and iOS Chrome users default to Apple Pay; Android
defaults to Google Pay. Without domain verification, the wallet
buttons silently disappear and you lose 30-40% of mobile conversions.

### Apple Pay

1. Find Settings → Payment methods → Apple Pay.
2. Add domain: `xratedtrade.com`.
3. Stripe gives a verification file — drop it into the repo at
   `public/.well-known/apple-developer-merchantid-domain-association`
   so it serves at
   `https://xratedtrade.com/.well-known/apple-developer-merchantid-domain-association`.
4. Click "Verify" in Dashboard.

### Google Pay

- Usually verifies automatically once Apple Pay is verified and the
  site is served over HTTPS with a valid cert. Check the same
  Payment methods section to confirm "Verified" status.

---

## 11. Final pre-launch checklist

Walk this list top-to-bottom. Don't open Checkout to real customers
until every box is ticked.

- [ ] Legal entity name set to registered Ltd name (not "Xrated").
- [ ] Trading name leads with "Trade Off".
- [ ] Companies House number entered and verified.
- [ ] VAT number entered (if registered) — or threshold-monitoring
      enabled (if not).
- [ ] Registered business address matches Companies House.
- [ ] Business phone number reachable.
- [ ] Business website `https://xratedtrade.com` set and live.
- [ ] Support email set to a monitored inbox.
- [ ] Business description pasted verbatim from section 1.
- [ ] Industry / MCC chosen (SaaS / Computer Services).
- [ ] GBP UK bank account added; account name matches legal entity.
- [ ] Statement descriptor set to `TRADE OFF`.
- [ ] Customer Portal configured and saved (Update payment / Cancel
      end-of-period / Switch plans / Invoices all ON).
- [ ] Stripe Tax enabled (if VAT-registered) OR threshold monitoring
      enabled.
- [ ] Webhook endpoint confirmed live at `/api/stripe/webhook`.
- [ ] Radar rules added; threshold set to Medium.
- [ ] Refund Policy, Terms, and Privacy URLs set and returning 200.
- [ ] Customer emails enabled; from-domain SPF/DKIM verified.
- [ ] Apple Pay domain verification file deployed and verified.
- [ ] Google Pay shows "Verified" in Payment methods.
- [ ] Live mode toggled ON in Dashboard.
- [ ] `.env.local` on production server has live (not test) keys.

---

## 12. Risk review — what to expect

**Be honest with yourself: there is a meaningful chance Stripe Risk
will flag this account for review at first transaction or first
payout.** The domain `xratedtrade.com` matches their adult-content
lexical filter, and "Xrated" in any of the free-text fields will
boost the signal. The mitigations in sections 0, 1, and 3 above
reduce that probability — they do not eliminate it.

### If Stripe Risk emails you

1. **Reply within 4 hours.** Slow replies escalate to the automated
   "extended review" track that can hold funds for 90+ days.
2. **Provide evidence the business is what you say it is:**
   - Screenshots of the live homepage showing tradespeople.
   - Screenshots of demo profile pages (there are 106 demo profiles
     live; use 4-5 varied trades — plumber, electrician, scaffolder,
     plasterer).
   - The pricing page showing £14.99 / £139.99 SaaS tiers.
   - Companies House page for the registered entity.
3. **Explain the brand name in one sentence.** Something like:
   > "Xrated Trades / Trade Off is a UK SaaS for construction
   > tradespeople. 'Trades' refers to construction trades. The brand
   > name is a play on industry slang ('X-rated work' = top-quality
   > work) and contains no adult content. Domain registered [date],
   > Companies House registered [date]."
4. **Mention there is no user-generated media** — no photo uploads,
   no video, no chat. The product is profile cards + reviews +
   contact buttons.
5. **Ask for a human reviewer** if the first response feels like a
   templated bot reply. Use the phrase: "Please escalate this to a
   manual reviewer; the automated flag is matching on the brand
   name, not the content of the business."

### If Stripe declines the account anyway

Options in order of cost and disruption:

- **Cheapest** — operate the Ltd under a separate Stripe account
  using only "Trade Off" branding (no Xrated anywhere). This means
  changing the customer-facing domain or operating a Trade Off
  marketing domain that proxies to the same app. The Ltd must be
  clean — a separate company with no Xrated trading history is
  safer if Stripe has explicitly declined the first entity.
- **Mid-cost** — switch to a UK-friendly competitor: **GoCardless**
  (Direct Debit, recurring SaaS-friendly, won't lexical-match the
  brand), **Mollie** (Dutch, broad UK acceptance, more permissive
  Risk team), or **Adyen** (enterprise; higher fixed costs but more
  contextual review).
- **Most expensive** — rebrand the domain. `tradeoff.uk` or similar
  removes the entire problem class but requires marketing rework,
  SEO migration, and a redirect campaign.

---

## 13. After Stripe goes live

In this order:

1. **£1 self-test.** Buy the Monthly plan on your own card.
   Confirm:
   - Stripe Dashboard shows a successful charge.
   - The webhook log shows `checkout.session.completed` received
     and returned 200.
   - The Supabase user row flipped `tier` to `app_paid`.
   - The receipt email arrived.
2. **Customer Portal round-trip.** From the user-side app, click
   "Manage subscription". Confirm:
   - Stripe portal loads on `billing.stripe.com`.
   - Update payment, cancel, and switch-plan flows all render.
   - Returning to the app respects the return URL.
3. **Refund test.** From Stripe Dashboard, refund the £1 charge.
   Confirm:
   - The webhook receives `customer.subscription.deleted` (or the
     subscription remains active until period end if you chose
     end-of-period cancellation).
   - The user's tier in Supabase reverts appropriately.
   - The refund confirmation email arrives.
4. **Disputable-charge dry run.** Use a Stripe test card that
   simulates a dispute (in test mode, then sandbox the dispute
   evidence form) so you know the workflow before a real dispute
   lands.
5. **Set a weekly Dashboard review** for the first month: check
   Payments, Disputes, Radar reviews, and Payouts every Monday
   morning. Catch problems before they compound.

---

## 14. International + currency

Trade Off sells worldwide, but pricing stays canonical GBP. This
section nails down how that interacts with Stripe.

### Pricing model

- **Canonical currency: GBP.** Every product / price object in
  Stripe is priced in `gbp` (`1499` for £14.99, `13999` for
  £139.99, `1999` for £19.99, `19999` for £199.99). Do not create
  per-currency twins of the same plan — that fragments analytics
  and makes refund maths painful.
- **Stripe auto-converts at checkout.** When a customer pays with
  a non-GBP card, Stripe's network rail converts the card-issuing
  currency to GBP at the standard interchange rate. The customer's
  bank sees a GBP charge and converts on their statement at the
  bank's own rate.
- **No FX markup from us.** We do not add a presenter-side margin.
  The marketing pricing page renders an approximate "≈ $X USD" row
  beneath the canonical £ price using indicative rates from
  `src/lib/fx.ts` (refreshed monthly against XE mid-market) — that
  row is presentational only and clearly labelled approximate.
- **Customer's bank may charge a small FX fee.** This is between
  the cardholder and their issuer; it is not visible to us and
  not refundable by us. The Refund Policy is silent on bank fees
  because we do not control them.

### Payment Method Configuration (PMC)

The live PMC `pmc_1TnF0rLecwtyH8qDNVvN81uB` now enables a worldwide
mix of payment methods at Stripe Checkout:

- **Card** — Visa, Mastercard, Amex, Discover, JCB, Diners (the
  default everywhere).
- **Link** — Stripe's one-click checkout for returning customers.
- **iDEAL** — Netherlands bank-redirect (NL-resident default).
- **Bancontact** — Belgium bank-redirect (BE-resident default).
- **Giropay** — Germany bank-redirect (DE option; sunsetting late
  2026, watch Stripe's migration notice).
- **EPS** — Austria bank-redirect (AT-resident default).
- **Klarna** — pay-later in DE, AT, NL, BE, FR, UK, US, AU. For a
  £14.99/mo SaaS the "Pay in 3" / instant-debit path is the one
  that actually fires.
- **Przelewy24 (P24)** — Poland bank-redirect.

Stripe Checkout dynamically surfaces only the methods that match
the visitor's country, currency, and amount; we don't have to
country-gate anything in code.

### Methods that need a capability request

For these, the owner must request the capability in **Settings →
Payments → Payment methods → Request access**, then add them to
the PMC once approved:

- **SEPA Direct Debit** — EUR-denominated bank debits across the
  SEPA zone. Useful for recurring B2B subscriptions where the
  customer prefers a bank rail to a card. Mandate flow adds ~3-5
  days to first payment confirmation.
- **BACS Direct Debit** — GBP-denominated bank debits in the UK.
  Same logic as SEPA but UK-side. 3-day setup window.
- **ACH Direct Debit** — USD-denominated bank debits in the US.
  Stripe will require a separate Plaid integration for instant
  bank verification. Liability and dispute window are different
  from cards (longer chargeback window).
- **BECS Direct Debit** — AUD-denominated bank debits in
  Australia. Niche but cheap and stable for AU subscriptions.

None of these is required to launch worldwide on cards alone. Add
them only once you see meaningful country-specific volume that
would benefit from the lower-fee bank rail.
