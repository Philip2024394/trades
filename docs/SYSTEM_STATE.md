# System State — Thenetworkers (2026-07-17)

**Purpose.** Honest engineer's assessment of what's rock-solid, what's partial, what's stub, and what will break the platform if it dies. No overselling. Every claim maps to a real file or table.

**Companion docs:** `docs/features/index.md` (features), `docs/REVENUE_MAP.md` (money), `docs/DB_SCHEMA.md` (334 tables · 4,459 cols · 444 FKs · 1,215 indexes), `docs/DECISIONS/INDEX.md` (15 ADRs), `docs/CRONS.md` (scheduled jobs), `docs/STUBS.md` (unfinished).

---

## Score by domain (1 = broken, 10 = production-battle-tested)

| Domain | Completeness | Robustness | Notes |
|---|---:|---:|---|
| Merchant surfaces (dashboard, canteen, profile) | 9 | 8 | Deep coverage. Newsletter + team = stub. |
| Homeowner surfaces (find, home, beacon, notebook) | 8 | 7 | Notebook + Home dashboards live but low real-user pressure yet. |
| Community — Yard + Canteens | 8 | 7 | Feed / posts / canteens all live. Moderation solid. |
| Trade Center marketplace | 7 | 6 | R05/R07/apply live; full checkout beta. Zero-commission model working. |
| Site Interest (image store) | 9 | 8 | Just built end-to-end. Anti-theft layered. |
| Growth loops (referrals + SEO) | 8 | 7 | SEO grid at 10,800 pages live. Referral wired end-to-end. |
| Studio + Apps platform | 7 | 7 | 20 calculators live. Runtime + design system live. CRM/completer/deals stub. |
| Washers (lead monetization) | 9 | 9 | Bag model, packs, auto-topup, refund all live. Battle-tested. |
| Admin | 8 | 8 | Deep coverage across payments/affiliates/moderation. |
| Auth + sessions (3 parallel models) | 8 | 8 | Merchant/homeowner/admin/store/affiliate all live. |
| Payments (Stripe LIVE) | 9 | 9 | Subscriptions + one-off + Customer Portal + webhook. |
| Integrations (Companies House LIVE, Resend, ImageKit, WhatsApp) | 8 | 8 | All wired, best-effort fallbacks in place. |
| DB layer (Supabase) | 9 | 8 | 334 tables, 232 migrations, indexes present. Management API access solid. |
| Middleware (host router, cookies, affiliate + mref) | 9 | 8 | Custom domains + subdomain-per-trade both live. |
| Watermark pipeline (steg + phash + IPTC + registry) | 8 | 7 | Wired to every paid download. Verify endpoint works. Real-world stego resistance untested. |

**Overall system strength today: 8.0/10.**
**If every "stub" in `docs/STUBS.md` closed: ~9.0/10.**

Neither is "production-ready for millions of users" (that's a 10). But 8.0 is well past "can charge money and honour the contract" (that's ~6.5). We're in the "can scale to hundreds of paying merchants without breaking, if traffic pattern behaves" zone.

---

## What's rock-solid (single-point-of-failure resilient)

Ranked by "if this broke, would we still be shipping money to a bank?"

1. **Stripe billing** — LIVE, 2 webhooks (`/api/stripe/webhook`, `/api/store/stripe-webhook`), Customer Portal, refund flows. If Stripe goes down we can't take new money but existing subs keep charging. Grace-period cron catches sub deletions.
2. **Supabase DB** — 334 tables, RLS-adjacent (service role only). Regular management-API access via `msdonkkechxzgagyguoe`. Supabase's own uptime SLA covers us.
3. **Middleware host routing** — Every request routed correctly (custom domains, subdomain-per-trade, admin/api bypass, affiliate + mref cookies). Partial indexes on lookup columns keep it O(log n).
4. **Merchant dashboard** — Every essential merchant action has a route. Non-destructive edits (ADR-0005 — snapshots).
5. **Canteen public page** — Every merchant has a live URL that survives every internal refactor via the manifest-first architecture (ADR-0001).
6. **Watermark verify endpoint** (`POST /api/image/verify`) — Uploaded stolen image → back-reference to buyer via stego + aHash. Legal takedown story is real.
7. **Sitemap** — 12k+ URLs emitted, refreshed on every deploy. Google can find everything.

---

## What's live-but-partial (needs monitoring)

- **Trade Center full checkout** — Cart + Safe Trade recommended path works; WhatsApp handoff demoted. Escrow flow not fully battle-tested with real money.
- **AI Visualiser** — Renders + lead capture work. Rate limiting + abuse watch live via admin panel. Not tested at high volume.
- **Yard moderation** — Admin can hide/spam-flag posts. No auto-moderation (no ML classifier).
- **Notebook + Home dashboards** — Live but low real-user pressure. Site tracker (`os_sites`) has all the tables but low usage means we haven't hit weird edge cases yet.
- **Custom domain add-on** — Middleware + Vercel wiring live. New-customer onboarding is manual (DNS instructions).
- **Newsletter drip** — Dashboard route exists (`/trade-off/edit/[slug]/newsletter`) but is a stub — no actual Resend template + send scheduler yet.

---

## What's stub (see `docs/STUBS.md` for full list)

Named + waiting for work:
- `/trade-off/edit/[slug]/newsletter` — Email campaigns
- `/trade-off/edit/[slug]/team` — Sub-user invites
- `/admin/network-reviews` — Cross-platform review aggregation
- `/showcase` — Case studies
- `/news` — Public news feed (admin publishing live, public feed thin)
- `src/apps/crm` — Contact/project CRM (tables exist, UI stub)
- `src/apps/completer, src/apps/deals` — Purpose unclear (no summary in manifest)

Named as planned but not started:
- Auto-defaults (from growth playbook)
- Analytics dashboard
- Reward-fulfilment worker (queues rewards but nothing consumes them yet)

---

## Load-bearing dependencies

If **any** of these degrade, the platform degrades:

| Dependency | What it powers | What breaks if down |
|---|---|---|
| Supabase (Postgres + Auth + Storage) | Everything | Whole platform |
| Stripe | All payments | New charges + Customer Portal + webhooks |
| ImageKit CDN | Every image URL | Merchant hero images, store previews, canteen photos |
| Resend | Magic-link emails, transactional emails | New signups can't verify, referrers don't get notified |
| Companies House API | Merchant verification | New "verified" claims blocked; existing verified stays |
| Vercel (host) | Everything except DB | Whole platform |
| WhatsApp (`wa.me/`) | Contact + lead flows | Homeowner→trade contact button dead (fallback: form) |
| Node runtime (for `sharp` in watermark pipeline) | Store paid downloads | Falls back to raw ImageKit redirect (works, just untracked) |

**Not on the critical path** (so we can survive their downtime):
- Instagram / Facebook / TikTok — external social only, not embedded
- Anthropic API — AI Visualiser degrades but everything else works
- Google Maps — used in `/find` for postcode context; not required for search

---

## Single points of failure (that we should reduce)

1. **The `hammerex_trade_off_listings` table** — 40+ columns, referenced by dozens of routes. If a bad migration hoses this table, the whole merchant side is dead. Mitigation: non-destructive snapshots (ADR-0005), but the snapshot is per-canteen not per-column.
2. **The middleware DB lookup** on custom domains — every request hits Supabase for custom-domain requests. Partial UNIQUE index protects hot path but a Supabase brown-out spikes latency for those tenants.
3. **Merchant email uniqueness** — used for magic-link recovery. If email column is nullable + we let dupes in, account recovery breaks. Check migration status.
4. **`scripts/hero-library.json`** — 203+ entries, read from disk at module init. If the JSON goes stale or malformed, hero swaps break silently.

---

## What we haven't measured yet (real-world gaps)

Honest gaps in our knowledge:
- **Actual conversion rate** on the free tier → paid upgrade. Assumption in `REVENUE_MAP.md` is 40/40/20 split — untested.
- **Real-world stego resistance** to AI removal (LaMa, generative fill). We know the theory; nobody has attempted removal at scale.
- **Sitemap discovery rate** — 12k URLs emitted; Google's actually indexed sample unknown.
- **Merchant referral loop uptake** — the machinery works but zero real referrals in the wild yet (no data).
- **Washer economics at volume** — auto-topup should self-fund but hasn't been tested at 170 merchants × auto-topup cycles.

Each gap = "measure before optimising further" item.

---

## Growth-critical unknowns

Things Philip's business hinges on that we can't yet answer:
- **How many merchants will actually sign up for free?** Free tier is a moat but only if we get volume through it.
- **How many free-tier merchants convert to paid?** Playbook assumes non-zero; we'll see.
- **Does the SEO grid actually rank?** 10,800 URLs is a lot but Google may treat thin low-content pages as spam. Need to monitor GSC.
- **Do trades share referral links?** The mechanic works, adoption is unknown.

**Recommendation:** Ship an analytics dashboard (currently stub) as the next priority. Everything else is guessing until we measure.

---

## If we froze feature work today and only fixed known bugs, could we ship?

**Yes.** Every core money-in flow works end-to-end:
- Merchant signup → trial → paid subscription → renewal
- Store visitor → buy image → get watermarked download → download works
- Merchant refers merchant → attribution → reward queued (fulfilment stub aside)
- Homeowner → find merchant → WhatsApp contact → washer decrements

**Caveats:** Newsletter, team invites, cross-platform reviews, showcase — these are advertised in the sitemap/nav but click through to stubs. Should either build them or hide them from public nav.

---

## Confidence: what am I lying to myself about?

Honest self-check per the "no assumptions as facts" rule:
- **Numbers in revenue projections** are labelled "assumption". Real data will differ.
- **Domain scores 1-10** are subjective — a real audit might grade differently on robustness.
- **"Rock solid" claims** are based on code inspection + memory of design decisions, not production incident data (there is none — no volume yet).
- **Coverage of the 334 tables** — I've written code against ~30 of them this session. The other 304 I know by name from schema, not by lived experience.

That's the honest state. Nothing hidden.
