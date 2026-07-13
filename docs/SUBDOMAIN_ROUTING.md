# Subdomain-per-trade routing

## What it does

`bobs-plumbing.theconstructionnotebook.com` → renders `/trade/bobs-plumbing` without any DB round-trip. The URL bar shows the subdomain; the app renders the trade profile.

Also works on `bobs-plumbing.xratedtrade.com` during the rebrand window.

## Ordering vs custom domains

`src/middleware.ts` checks in this order:

1. System hosts (bypass) — `theconstructionnotebook.com`, `www.*`, `localhost`, `*.vercel.app`
2. **Subdomain-per-trade** (this feature) — `<slug>.theconstructionnotebook.com` → `/trade/<slug>`
3. Custom domain (existing) — Supabase lookup on `hammerex_trade_off_listings.custom_domain`

Subdomains are tested BEFORE the DB lookup so they never spend a query.

## Reserved subdomains

The following will NOT be rewritten to trade profiles even if a slug of the same name exists:

`www`, `api`, `admin`, `app`, `cdn`, `static`, `docs`, `mail`, `help`, `blog`, `assets`

Slug validation regex: `/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/`. Must be 3-64 chars, lowercase kebab, no leading/trailing hyphen. This matches the DB slug shape.

## What you MUST do in Cloudflare / DNS

**One wildcard record covers every trade — no per-trade DNS work.**

1. Cloudflare DNS for `theconstructionnotebook.com`:
   - Add a wildcard record: `* CNAME cname.vercel-dns.com` (proxy off, DNS-only, so Vercel handles cert)
   - Or if using Cloudflare proxied: `* CNAME cname.vercel-dns.com` (proxy on) — SSL/TLS mode: Full (strict)

2. Vercel project settings → Domains:
   - Add the wildcard: `*.theconstructionnotebook.com`
   - Vercel provisions a wildcard cert automatically (Let's Encrypt)

3. Repeat for `xratedtrade.com` if keeping the legacy root live during the rebrand.

## Testing locally

Middleware ONLY fires on non-localhost hosts. To test locally:

- Edit `/etc/hosts` (Windows: `C:\Windows\System32\drivers\etc\hosts`):
  ```
  127.0.0.1 bobs-plumbing.theconstructionnotebook.com
  ```
- Visit `http://bobs-plumbing.theconstructionnotebook.com:3008` — should render the trade profile

## Testing on Vercel preview

Vercel preview URLs (`*.vercel.app`) bypass the router. To smoke-test the wildcard on preview:
1. Deploy to a preview branch
2. Add a temporary alias `*.preview.theconstructionnotebook.com` on the preview deploy
3. Hit `bobs-plumbing.preview.theconstructionnotebook.com`

## Rollback

Remove `SUBDOMAIN_ROOTS` entries from `src/middleware.ts` — reverts to path-based (`/trade/bobs-plumbing`) which still works from the root domain.
