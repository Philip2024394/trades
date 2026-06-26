# Xrated Trades

Linktree-for-tradies SaaS. Public profile + dashboard + add-ons marketing for tradespeople. Standalone Next.js 16 app split off from the Hammerex monorepo at commit 04b308f.

Tech stack: Next.js 16, React 19, Tailwind 3.4, TypeScript 5.6, Supabase. Local dev server runs on port 3008.

## Getting started

```
npm install
cp .env.local.example .env.local
```

Fill in the Supabase / Resend / admin WhatsApp values in `.env.local`, then:

```
npm run dev
```

The app is served at http://localhost:3008.
