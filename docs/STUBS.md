# Stub Inventory — Thenetworkers

_Every unfinished feature, with effort-to-ship estimate. Sort by effort inside each domain — quick wins at the top._

**Snapshot:** 24 stubs total (S: 9, M: 9, L: 6).

Signals combined:
1. `docs/features/index.md` entries marked **stub / not built / partial**.
2. Grep in `src/`: "coming soon", `TODO:` on missing features, "not implemented", `placeholder`, leading comments containing `stub / scaffold / wip / wireframe`.
3. `src/apps/*` modules without a `manifest.ts` (Blueprint reads them as "no summary").

Sources of truth: features index is the primary contract; grep results caught extras that are shipped-behind-a-coming-soon-label but shouldn't be marketed as live.

---

## Merchant surfaces

- **Merchant impersonation** — `/admin/support/impersonate` (linked from `/admin/(authed)/support/page.tsx`, no route yet). Effort: **S**. Missing: signed impersonation cookie + audit log write + banner while viewing. Value: kills every "can you screenshot?" support round-trip.
- **Send comms to a member** — `/admin/support/comms` (linked from support hub, no route yet). Effort: **S**. Missing: WhatsApp/email composer + template library + delivery log. Value: admin can respond without leaving the dashboard.
- **AddOn "coming soon" gate** — `src/app/api/trade-off/addons/toggle/route.ts:51` + `src/app/api/stripe/addon-attach/route.ts:78` both reject unfinished add-ons with "This add-on is coming soon." Effort: **S**. Value: audit which add-ons are still flagged so we ship or delete each.
- **PlantHire advanced question editor** — `src/components/trade-off/PlantHireExtraEditors.tsx:1201` "advanced question editing coming soon." Effort: **M**. Missing: custom-question CRUD UI for the hire preset. Value: unlocks bespoke plant hire quoting.
- **Trade image library (Templates)** — `src/app/trade-off/edit/[slug]/templates/ThemeControls.tsx:877` "Trade image library — coming soon". Effort: **M**. Missing: browseable curated-per-trade image picker. Value: cuts merchant-onboarding time to zero.
- **Templates preview** — `src/app/trade-off/edit/[slug]/templates/TemplatesShell.tsx:1234, 1489` "Preview coming soon". Effort: **M**. Missing: template thumbnail generator + preview modal. Value: merchants pick blindly today.
- **`/trade-off/edit/[slug]/newsletter`** — Features index marks stub. In reality dashboard + CSV export shipped (Model A: merchant sends via own tool). Effort: **M** to move to full in-platform sending (Resend template + audience picker + scheduler). Value: growth playbook lists this as unbuilt. Reality check: index is stale — either flip to "live (CSV-only)" or actually ship in-platform send.
- **`/trade-off/edit/[slug]/team`** — Features index marks stub. Route + `TeamEditor` component present (108-line page). Effort: **S** to reclassify to live, or **L** to add sub-user *invites* (separate edit tokens + role scoping). Value: real sub-user invites needed for VAT-registered merchants with staff.
- **Merchant subscription tiers Starter (£9.99) + Business (£24.99)** — `src/app/trade-off/pricing/PricingTierCards.tsx:9,18` marked "Coming soon". Effort: **L**. Missing: Stripe products + feature-gate map + entitlement plumbing across every add-on. Value: fills the pricing ladder; waitlist already capturing intent at `/trade-off/waitlist`.
- **Verified trades waitlist queue ops** — `src/app/trade-off/verified-waitlist/page.tsx:7` "TODO once the queue ops are built". Effort: **L**. Missing: `/api/trade-off/verified-waitlist` endpoints + admin approvals + verification pipeline. Value: verified badge is a Trust anchor.

## Homeowner surfaces

- **Homeowner Property Vault plans** — `/api/os/vault/checkout/route.ts:9` returns "Plan not yet available for purchase — coming soon" when Stripe products missing. Effort: **S**. Missing: create Stripe products + wire price IDs into `hammerex_os_vault_plans`. Value: revenue line for homeowners.
- **Home sign-in secondary providers** — `src/app/home/sign-in/SignInForm.tsx:159` shows `badge="Coming soon"`. Effort: **M**. Missing: OAuth (likely Google) for homeowner login. Value: faster homeowner onboarding.

## Community — Yard + Canteens

- **Canteen own-post actions** — `src/app/trade-off/yard/canteens/[slug]/CanteenPageShell.tsx:2246,2269,2282` — Edit / Pin / Boost post all `window.alert("… coming soon")`. Effort: **S** each. Missing: (a) edit-post modal, (b) pin flag on `hammerex_yard_posts`, (c) boost consumes washer(s). Value: closes 3-dot menu promise (ADR-0014).
- **Contact details on canteen contact tab** — `src/components/xrated/yard/CanteenTabbedSection.tsx:2382` "Contact details coming soon". Effort: **S**. Missing: pull phone/email/address from listing + render. Value: contact tab is user-visible dead space today.
- **Canteen tile sections still labelled "coming soon"** — `CanteenPageShell.tsx:3040,3103,3152,3202,3243,3287` — Service listing / Live listing / Inline profile editor / Edit Trending Today / Manage Reviews / Kitchen Designs. Effort: **M** per tile (6 tiles). Missing: each tile's editor + persistence. Value: canteen editor promises features that don't work.
- **The Counter** — Features index says "partial" (`project_the_counter_naming.md`). Effort: **M**. Missing: unified stream feed pulling every canteen product + deal + post. Value: platform-wide flowing marketplace stream.

## Trade Center marketplace

- **`src/apps/tradecenter/components/pdp/TrustAndSocialProof.tsx:122`** — "Coming soon — orders £100+ will be held by our regulated escrow partner." Effort: **L**. Missing: escrow partner integration (regulated third-party, per Constitution Rule #6). Value: unlocks Safe Trade CTA elevation.
- **`src/apps/tradecenter/components/CategoryRail.tsx:6`** — "scaffolds for now — real filtering wired in a follow-up." Effort: **M**. Missing: real filter query + facet counts + URL sync. Value: Trade Center browse UX.
- **`src/app/tc/checkout/canteen/[id]/page.tsx:9`** — Safe Trade / Stripe Connect / escrow "intentionally stubbed at WhatsApp handoff". Effort: **L**. Missing: merchant KYC + Stripe Connect account + escrow release timer. Value: turns TC from directory into a bookable checkout. Same escrow blocker as TrustAndSocialProof.
- **`/tc/rates` verified regional data** — `src/app/tc/rates/page.tsx:154` "Verified regional rate data — coming soon". Effort: **M**. Missing: aggregation of anonymised quote data → rate benchmark. Value: R05/R07 apply/confidence value-add.
- **`/tc/routes`** — `src/app/tc/routes/page.tsx:5` "post-MVP feature stub, marked coming soon." Effort: **M**. Missing: whatever "routes" means in TC context (unclear). Value: unclear — flag for Philip.

## Site Interest (image store)

- **Store login prod email** — `src/app/api/store/login/request/route.ts:48` "TODO: prod email delivery". Effort: **S**. Missing: swap dev logger for Resend send. Value: store magic-links go to actual inbox.

## Studio + Apps platform

- **`src/apps/completer`** — Job-completion / follow-up analyser. Effort: **M**. Missing: `manifest.ts` (has `components/FinishTheJobPanel.tsx` + `lib/analyseJob.ts` + `data/jobArchetypes.ts`, no manifest wiring so not installable through registry). Value: turns finished jobs into review + upsell prompts.
- **`src/apps/deals`** — Time-boxed discount surface. Effort: **M**. Missing: `manifest.ts` + surfaces + admin publishing. Only `data/deals.ts` (Deal type + seed data) exists. Value: seasonal margin play.
- **`src/apps/crm`** — Contact/project CRM. Effort: **L**. Manifest exists (App #005, event contracts + trade allowlist declared) but no `components/`, `lib/`, `pages/`, or migrations. Missing: contact list UI + timeline aggregator + follow-up drafter. Value: highest-leverage retention lever — closes "did we get back to them?" loop.
- **`src/apps/jobs`, `src/apps/jobBoard`, `src/apps/tradeCounter`** — Effort: **?**. Purpose unclear (no `manifest.ts`, just `components/` + `data/`). Flag for Philip: are these live-in-page-only, or genuine stubs?
- **Studio module registry — "waitlist" section** — `src/lib/studio/modules/registry.ts:1538` groups modules as "Coming soon (waitlist)". Effort: **M**. Value: audit what Studio blocks are gated behind waitlist; ship or drop each.
- **Channels — social distributors** — `src/lib/channels/{gbp,pinterest,linkedin,facebook,tiktok,threads,youtubeShorts}.ts` all "Stubbed for MVP." Effort: **L**. Missing: real API integrations (or an explicit "manual paste" fallback UI). Value: cross-post growth loop for merchants.

## Growth loops

- **Auto-defaults** — `docs/features/index.md:128` "not built" (per growth playbook). Effort: **M**. Missing: apply sensible defaults across missing merchant fields at signup. Value: 3 of the 5 growth-playbook levers.
- **Analytics** — `docs/features/index.md:129` "not built". Effort: **M**. Missing: merchant impressions/click funnel + admin cohort dashboard. Value: last growth-playbook lever.
- **Materials Network referrals notification** — `src/app/api/trade-off/materials-network/referrals/{create,fulfil}/route.ts` both "Stub-notifies via push_log". Effort: **S**. Missing: actual WhatsApp/email side-channel notification. Value: referral loop is silent today.

## Marketing / platform pages

- **`/showcase`** — Features index says stub. Reality: 277-line page with live listings + JSON-LD + ItemList. Effort: **S** to flip index to "live". Value: index accuracy.
- **`/news`** — Features index says stub ("admin publishing live, feed thin"). Reality: 269-line SSR feed reading from `hammerex_xrated_news_posts`. Effort: **S** to reclassify + populate more posts. Value: index accuracy + SEO surface.
- **`/trade-off/how` product screenshots** — `src/app/trade-off/how/page.tsx:258` "(Coming soon — screenshot drops in here.)". Effort: **S**. Missing: screenshot capture + drop-in. Value: visual proof on the main how-it-works page.
- **`/trade-off/pricing` invite-only tier** — `src/app/trade-off/pricing/page.tsx:646` "Coming soon · By application". Effort: **M**. Missing: application flow + Stripe SKU. Value: high-margin bespoke tier.

## Admin

- **`/admin/network-reviews`** — Features index marks stub. Reality: 6-axis review moderation shell exists at `src/app/admin/network-reviews/page.tsx` (SSR, freeze/remove/verify actions, wired to `/api/admin/reviews/[id]/action`). Effort: **S** to reclassify to live in the index. Value: index accuracy.
- **`/admin/(authed)/layout.tsx:163`** — Admin nav item with `title="Coming soon"` (unnamed). Effort: **S**. Missing: identify + ship or hide the placeholder nav entry.
- **Stubbed integrations for third-party** — `src/lib/{wisePayouts,whatsappBusiness,vpnDetection,paypalPayouts}.ts` all `// TODO: implement when env vars set.` Effort: **M** each. Value: unlock affiliate payouts (Wise/PayPal), fraud protection (VPN), WhatsApp Business API scale-out.
- **Review confirmation email** — `src/app/api/trade-off/reviews/route.ts:5` "confirmation link (TODO: confirmation email)". Effort: **S**. Missing: Resend template + send call. Value: verified-review guarantee actually verified.

---

## Notes on classification

**Stale features-index entries** — 4 items marked stub are actually shipped or partly shipped: `/showcase`, `/news`, `/admin/network-reviews`, `/trade-off/edit/[slug]/newsletter` (CSV-only shipped, in-platform send absent). Update the index next session.

**No-manifest apps** — `completer`, `deals`, `jobs`, `jobBoard`, `tradeCounter` in `src/apps/` have partial code but no `manifest.ts`, so they're invisible to the App Registry (violates ADR-0001). Either add manifests or move code into feature folders under `src/lib/` or `src/components/`.

**Stripe-partner-blocked** — Escrow (TC £100+ orders) and Safe Trade checkout both wait on a regulated partner integration (Constitution Rule #6). Neither ships without that partner selection first.
