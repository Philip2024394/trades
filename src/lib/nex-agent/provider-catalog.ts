// src/lib/nex-agent/provider-catalog.ts
//
// Backend provider catalog · Supabase · Firebase · Neon · PlanetScale · Turso ·
// Convex · MongoDB Atlas · Upstash · Vercel Postgres · Vercel KV · Vercel Blob ·
// Cloudflare D1. Every provider carries setup steps + env vars + install
// command + code snippet + docs URL so the "Connect" wizard is deterministic.
//
// Discipline:
//   - NEVER embeds a real secret · always references env vars
//   - Every wizard opens the provider's official console URL for signup/keys
//   - NEX1 receives a step-by-step prompt with concrete file paths + env vars
//   - Security Agent scans the eventual commit before it lands on any branch

export type ProviderCategory =
  | "postgres" | "mysql" | "sqlite" | "nosql" | "firebase"
  | "realtime-backend" | "redis" | "storage" | "vector-db";

export interface ProviderEnvVar {
  readonly name: string;
  readonly description: string;
  readonly secret: boolean;                // if true · warn founder + never log
  readonly example: string | null;         // documented format · never a real value
}

export interface ProviderStep {
  readonly title: string;
  readonly body: string;
  readonly ctaLabel?: string;
  readonly ctaUrl?: string;
}

export interface DatabaseProvider {
  readonly id: string;
  readonly brand: string;
  readonly name: string;
  readonly category: ProviderCategory;
  readonly icon: string;
  readonly tagline: string;
  readonly description: string;
  readonly benefits: readonly string[];
  readonly pricing: string;
  readonly signupUrl: string;
  readonly docsUrl: string;
  readonly installCommand: string;
  readonly envVars: readonly ProviderEnvVar[];
  readonly steps: readonly ProviderStep[];
  readonly featured: boolean;
  readonly promptTemplate: string;
}

export const PROVIDER_CATALOG: readonly DatabaseProvider[] = [
  // ─── Supabase ────────────────────────────────────────────────
  {
    id: "supabase",
    brand: "Supabase",
    name: "Supabase",
    category: "postgres",
    icon: "◈",
    tagline: "Postgres + Auth + Storage + Realtime",
    description: "Supabase is a full open-source Firebase-alternative built on PostgreSQL. Auth · row-level security · storage · realtime subscriptions · edge functions · vector search — all in one platform with a proper SQL database underneath.",
    benefits: [
      "Real PostgreSQL · SQL not query DSL",
      "Row-level security · policies enforced at the DB layer",
      "Real-time subscriptions on any table",
      "Object storage + auth included in the same project",
    ],
    pricing: "Free tier · 500MB DB · 1GB storage · unlimited API requests",
    signupUrl: "https://supabase.com/dashboard/sign-up",
    docsUrl: "https://supabase.com/docs/guides/getting-started/quickstarts/nextjs",
    installCommand: "npm i @supabase/ssr @supabase/supabase-js",
    envVars: [
      { name: "NEXT_PUBLIC_SUPABASE_URL",       description: "Your project's REST endpoint · public · safe to expose",     secret: false, example: "https://xxxxx.supabase.co" },
      { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",  description: "Anonymous key · RLS-limited · public · safe to expose",       secret: false, example: "eyJhbGci..." },
      { name: "SUPABASE_SERVICE_ROLE_KEY",      description: "Server-only key · bypasses RLS · NEVER expose to client",     secret: true,  example: "eyJhbGci..." },
    ],
    steps: [
      { title: "Sign up + create project",   body: "Create a Supabase account (free) and start a new project. Wait for it to provision (~2 min).", ctaLabel: "Open Supabase", ctaUrl: "https://supabase.com/dashboard/sign-up" },
      { title: "Grab keys from Settings → API", body: "Copy Project URL · anon key · service_role key. Paste into your .env.local exactly as-named in envVars above." },
      { title: "Install the client",          body: "Run: npm i @supabase/ssr @supabase/supabase-js" },
      { title: "NEX1 scaffolds the wiring",   body: "Click Connect → NEX1 creates src/lib/supabase/{client,server,middleware}.ts + wires cookies + RLS starter policy + docs." },
      { title: "Try a first query",           body: "After NEX1 lands the code, create a test table in Supabase Studio and query it from a Server Component." },
    ],
    featured: true,
    promptTemplate: `Integrate Supabase into the project.

FILES TO CREATE:
- src/lib/supabase/client.ts      → createBrowserClient({ cookieMethods... })
- src/lib/supabase/server.ts      → createServerClient with async cookies() in Next 15+
- src/lib/supabase/middleware.ts  → refresh session on every request
- src/middleware.ts               → wire the supabase middleware (if not already present)
- docs/integrations/supabase.md   → setup steps + env var list
- .env.example                    → add NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY placeholders

DISCIPLINE:
- Never commit real keys · use process.env.* only
- Server-only imports for SERVICE_ROLE_KEY · never in client bundle
- RLS-first · every user-owned table gets a starter policy in docs
- Same-origin cookies · secure + httpOnly in production

VERIFY: type-check clean · docs/integrations/supabase.md documents the DNS/auth callback + how to enable RLS on new tables.`,
  },

  // ─── Firebase ────────────────────────────────────────────────
  {
    id: "firebase",
    brand: "Google",
    name: "Firebase",
    category: "firebase",
    icon: "🔥",
    tagline: "Firestore + Auth + Storage + Hosting",
    description: "Firebase is Google's mobile+web app platform. Firestore document DB · Authentication · Cloud Storage · Cloud Functions · Hosting · Real-time DB · Analytics — deep Google Cloud integration.",
    benefits: [
      "Firestore realtime document listeners · offline persistence",
      "Firebase Auth · 20+ providers · phone OTP",
      "Cloud Functions for serverless backend logic",
      "Backed by Google Cloud · massive scale on tap",
    ],
    pricing: "Free tier · Firestore 1GB · 20K writes/day · Storage 5GB",
    signupUrl: "https://console.firebase.google.com/",
    docsUrl: "https://firebase.google.com/docs/web/setup",
    installCommand: "npm i firebase firebase-admin",
    envVars: [
      { name: "NEXT_PUBLIC_FIREBASE_API_KEY",            description: "Web API key · public",                    secret: false, example: "AIzaSy..." },
      { name: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",        description: "Auth domain",                             secret: false, example: "your-app.firebaseapp.com" },
      { name: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",         description: "Project ID",                              secret: false, example: "your-app" },
      { name: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",     description: "Storage bucket",                          secret: false, example: "your-app.appspot.com" },
      { name: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",description: "FCM sender ID",                           secret: false, example: "1234567890" },
      { name: "NEXT_PUBLIC_FIREBASE_APP_ID",             description: "App ID",                                  secret: false, example: "1:1234:web:abc" },
      { name: "FIREBASE_ADMIN_PRIVATE_KEY",              description: "Admin SDK service account key · server-only", secret: true, example: "-----BEGIN PRIVATE KEY-----\\n..." },
      { name: "FIREBASE_ADMIN_CLIENT_EMAIL",             description: "Admin SDK service account email",         secret: true,  example: "firebase-adminsdk@your-app.iam.gserviceaccount.com" },
    ],
    steps: [
      { title: "Sign in + create Firebase project", body: "Log into Firebase Console with a Google account. Create a new project. Register a Web app inside it.", ctaLabel: "Open Firebase Console", ctaUrl: "https://console.firebase.google.com/" },
      { title: "Copy web config", body: "From Project Settings → General → Your apps → Web app · copy the config block into .env.local." },
      { title: "Generate Admin SDK service account", body: "Project Settings → Service accounts → Generate new private key. Extract client_email + private_key into env." },
      { title: "Install + NEX1 scaffolds wiring", body: "Run: npm i firebase firebase-admin · then Click Connect · NEX1 creates client + admin helpers + auth middleware." },
    ],
    featured: true,
    promptTemplate: `Integrate Firebase (Firestore + Auth + Storage) into the project.

FILES TO CREATE:
- src/lib/firebase/client.ts     → initializeApp with NEXT_PUBLIC_FIREBASE_* env vars
- src/lib/firebase/admin.ts      → firebase-admin server client (never imported by client)
- src/lib/firebase/auth.ts       → sign-in · sign-up · signOut helpers · onAuthStateChanged
- src/lib/firebase/firestore.ts  → typed collection helpers
- docs/integrations/firebase.md  → setup + service account guide
- .env.example                   → all NEXT_PUBLIC_FIREBASE_* + FIREBASE_ADMIN_* placeholders

DISCIPLINE:
- firebase-admin only imported by server files (never in client bundles)
- Firestore security rules starter shipped in docs
- Auth callbacks work with Next App Router server actions

VERIFY: type-check clean · docs explain how to enable email/password + Google auth + set up Firestore security rules.`,
  },

  // ─── Neon ────────────────────────────────────────────────────
  {
    id: "neon",
    brand: "Neon",
    name: "Neon Postgres",
    category: "postgres",
    icon: "◉",
    tagline: "Serverless Postgres · branching · autoscale",
    description: "Neon is serverless PostgreSQL with database branching (git-like) and instant scale-to-zero. Test schema changes on a branch. Merge on green. Same Postgres, faster iteration cycle than any traditional host.",
    benefits: [
      "Real Postgres · every extension · every SQL feature",
      "Database branches · try migrations on a copy · destroy after",
      "Scales to zero · pay only for actual compute time",
      "Sub-second cold start via connection pooling",
    ],
    pricing: "Free tier · 0.5GB storage · 100 compute hours/month",
    signupUrl: "https://console.neon.tech/signup",
    docsUrl: "https://neon.tech/docs/guides/nextjs",
    installCommand: "npm i @neondatabase/serverless",
    envVars: [
      { name: "DATABASE_URL", description: "Neon connection string with sslmode=require", secret: true, example: "postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require" },
    ],
    steps: [
      { title: "Sign up + create project", body: "Sign up at Neon Console · create a new project · pick a region close to your users.", ctaLabel: "Open Neon Console", ctaUrl: "https://console.neon.tech/signup" },
      { title: "Copy connection string",   body: "In Neon Dashboard · Connection Details · copy the DATABASE_URL. Include ?sslmode=require." },
      { title: "Install serverless driver", body: "Run: npm i @neondatabase/serverless" },
      { title: "NEX1 scaffolds queries",    body: "Click Connect · NEX1 creates src/lib/db/neon.ts with a typed query helper + example." },
    ],
    featured: true,
    promptTemplate: `Integrate Neon serverless Postgres into the project.

FILES TO CREATE:
- src/lib/db/neon.ts             → export a neon() client using @neondatabase/serverless + process.env.DATABASE_URL
- src/lib/db/query.ts            → typed sql\`...\` helper with runtime type-guards
- db/migrations/README.md        → migration workflow (create · dry-run · apply)
- docs/integrations/neon.md      → setup + branching workflow guide
- .env.example                   → DATABASE_URL placeholder with sslmode=require example

DISCIPLINE:
- DATABASE_URL server-only · never NEXT_PUBLIC
- All queries parameterised · no string concatenation
- Migrations version-controlled under db/migrations/

VERIFY: type-check clean · sample query in server component demonstrating the client.`,
  },

  // ─── Vercel Postgres ─────────────────────────────────────────
  {
    id: "vercel-postgres",
    brand: "Vercel",
    name: "Vercel Postgres",
    category: "postgres",
    icon: "▲",
    tagline: "Neon-under-the-hood · zero-config on Vercel",
    description: "Vercel's managed Postgres · powered by Neon · with tight Vercel integration. Env vars auto-injected on deploy · one-click provision from the Vercel dashboard · no separate account needed.",
    benefits: [
      "Auto-injected env vars on every Vercel deploy",
      "Provisioned from the Vercel project dashboard",
      "Real Postgres underneath · same features as Neon",
      "Free tier for hobbyists · scales with usage",
    ],
    pricing: "Included in Vercel Hobby · 256MB · 60h compute/month",
    signupUrl: "https://vercel.com/dashboard/stores",
    docsUrl: "https://vercel.com/docs/storage/vercel-postgres",
    installCommand: "npm i @vercel/postgres",
    envVars: [
      { name: "POSTGRES_URL",            description: "Auto-injected by Vercel",                                     secret: true, example: "postgres://..." },
      { name: "POSTGRES_PRISMA_URL",     description: "Pooled connection · use with Prisma",                          secret: true, example: "postgres://...?pgbouncer=true" },
      { name: "POSTGRES_URL_NON_POOLING",description: "Direct connection · use for migrations",                        secret: true, example: "postgres://..." },
    ],
    steps: [
      { title: "Open Vercel Dashboard → Storage", body: "From your Vercel project · Storage tab · Create Database → Postgres · pick a region.", ctaLabel: "Open Vercel Storage", ctaUrl: "https://vercel.com/dashboard/stores" },
      { title: "Connect to project",              body: "Attach the database to your project. Vercel auto-injects POSTGRES_* env vars for you." },
      { title: "Install client",                  body: "Run: npm i @vercel/postgres" },
      { title: "NEX1 scaffolds queries",          body: "Click Connect · NEX1 creates src/lib/db/vercel-postgres.ts + example query." },
    ],
    featured: false,
    promptTemplate: `Integrate Vercel Postgres into the project.

FILES TO CREATE:
- src/lib/db/vercel-postgres.ts  → import { sql } from "@vercel/postgres" · export typed wrappers
- docs/integrations/vercel-postgres.md → connection guide + provisioning steps
- .env.example                   → document POSTGRES_URL · POSTGRES_PRISMA_URL · POSTGRES_URL_NON_POOLING placeholders

DISCIPLINE:
- POSTGRES_URL server-only · Next runtime auto-provides on Vercel
- Use POSTGRES_URL_NON_POOLING for one-shot migration scripts
- Never commit real values · they're auto-injected by Vercel deploy

VERIFY: type-check clean · sample server component query works.`,
  },

  // ─── PlanetScale ─────────────────────────────────────────────
  {
    id: "planetscale",
    brand: "PlanetScale",
    name: "PlanetScale MySQL",
    category: "mysql",
    icon: "🪐",
    tagline: "MySQL Vitess · branching · non-blocking migrations",
    description: "PlanetScale is MySQL powered by Vitess (the tech behind YouTube). Zero-downtime schema changes · database branching · connection pooling · point-in-time recovery. Scales to any size without ops overhead.",
    benefits: [
      "Non-blocking schema changes · rename a column live",
      "Database branches for testing migrations",
      "Vitess sharding under the hood · infinite scale",
      "Serverless driver with edge runtime support",
    ],
    pricing: "Hobby $0/mo · 5GB storage · 1B row reads/mo",
    signupUrl: "https://app.planetscale.com/sign-up",
    docsUrl: "https://planetscale.com/docs/tutorials/planetscale-quick-start-guide",
    installCommand: "npm i @planetscale/database",
    envVars: [
      { name: "DATABASE_URL", description: "PlanetScale connection URL with SSL", secret: true, example: "mysql://user:pass@aws.connect.psdb.cloud/db?sslaccept=strict" },
    ],
    steps: [
      { title: "Sign up + create org + database", body: "Create PlanetScale account · new organization · new database · pick a region.", ctaLabel: "Open PlanetScale", ctaUrl: "https://app.planetscale.com/sign-up" },
      { title: "Create branch + password",        body: "Create a 'main' production branch · then a development branch · then create a password to get DATABASE_URL." },
      { title: "Install driver",                  body: "Run: npm i @planetscale/database" },
      { title: "NEX1 scaffolds client",           body: "Click Connect · NEX1 creates src/lib/db/planetscale.ts using @planetscale/database serverless driver." },
    ],
    featured: false,
    promptTemplate: `Integrate PlanetScale MySQL into the project using the serverless driver.

FILES TO CREATE:
- src/lib/db/planetscale.ts      → connect() with process.env.DATABASE_URL · typed execute wrapper
- docs/integrations/planetscale.md → branching workflow · non-blocking migrations
- .env.example                   → DATABASE_URL placeholder

DISCIPLINE:
- Only serverless driver (@planetscale/database) · never mysql2 · edge-runtime safe
- All queries parameterised · use format execute("SELECT ... WHERE id = ?", [id])
- Migrations go through PlanetScale branch → deploy request workflow

VERIFY: type-check clean · example query using the serverless driver.`,
  },

  // ─── Turso ───────────────────────────────────────────────────
  {
    id: "turso",
    brand: "Turso",
    name: "Turso SQLite",
    category: "sqlite",
    icon: "🌐",
    tagline: "Distributed edge SQLite · libSQL",
    description: "Turso is distributed SQLite (libSQL) that runs at 30+ edge locations. Same SQLite API you know but with global replication. Perfect for read-heavy apps with users worldwide.",
    benefits: [
      "SQLite at the edge · sub-10ms reads globally",
      "Free tier · 500 databases · unlimited replicas",
      "Local dev with actual sqlite3 files · no drift",
      "Vector search built in via libSQL",
    ],
    pricing: "Free · 500 databases · 9GB storage · 1B row reads",
    signupUrl: "https://app.turso.tech/",
    docsUrl: "https://docs.turso.tech/quickstart",
    installCommand: "npm i @libsql/client",
    envVars: [
      { name: "TURSO_DATABASE_URL", description: "libSQL URL · libsql:// scheme",              secret: false, example: "libsql://your-db.turso.io" },
      { name: "TURSO_AUTH_TOKEN",   description: "Auth token for the database",                 secret: true,  example: "eyJhbGci..." },
    ],
    steps: [
      { title: "Install CLI + sign up", body: "Install Turso CLI · run: turso auth signup", ctaLabel: "Open Turso", ctaUrl: "https://app.turso.tech/" },
      { title: "Create database + token", body: "turso db create your-app · turso db show your-app · turso db tokens create your-app" },
      { title: "Install libSQL client",   body: "Run: npm i @libsql/client" },
      { title: "NEX1 scaffolds client",   body: "Click Connect · NEX1 creates src/lib/db/turso.ts + docs on running locally with a .sqlite file." },
    ],
    featured: false,
    promptTemplate: `Integrate Turso (distributed libSQL SQLite) into the project.

FILES TO CREATE:
- src/lib/db/turso.ts            → createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN })
- docs/integrations/turso.md     → local dev workflow · libSQL vs sqlite3 differences
- .env.example                   → TURSO_DATABASE_URL + TURSO_AUTH_TOKEN placeholders

DISCIPLINE:
- Local dev uses file: URLs so tests don't hit cloud · gitignore the file
- All writes via parameterised execute · never string concatenation
- Migrations via turso db shell your-db < db/migrations/*.sql

VERIFY: type-check clean · example execute + rows() call.`,
  },

  // ─── Convex ──────────────────────────────────────────────────
  {
    id: "convex",
    brand: "Convex",
    name: "Convex",
    category: "realtime-backend",
    icon: "◇",
    tagline: "TypeScript-native reactive backend",
    description: "Convex is a reactive TypeScript backend where queries + mutations auto-subscribe. Write your backend in a src/convex/ folder as TS functions. Convex pushes updates to every subscribed client automatically.",
    benefits: [
      "Backend logic in TypeScript · same language as frontend",
      "Reactive by default · queries auto-refresh on data change",
      "Optimistic UI built into useMutation hook",
      "Serverless functions co-located with the schema",
    ],
    pricing: "Free · unlimited seats · 1M function calls/month",
    signupUrl: "https://dashboard.convex.dev/",
    docsUrl: "https://docs.convex.dev/quickstart/nextjs",
    installCommand: "npm i convex && npx convex dev",
    envVars: [
      { name: "NEXT_PUBLIC_CONVEX_URL", description: "Your Convex deployment URL · public", secret: false, example: "https://xxx.convex.cloud" },
      { name: "CONVEX_DEPLOY_KEY",      description: "Deploy key for CI",                    secret: true,  example: "deploy_key_xxx" },
    ],
    steps: [
      { title: "Sign up",                 body: "Create a Convex account.", ctaLabel: "Open Convex Dashboard", ctaUrl: "https://dashboard.convex.dev/" },
      { title: "Install + init",          body: "Run: npm i convex && npx convex dev · this walks you through project setup interactively." },
      { title: "Define first schema",     body: "Convex creates convex/schema.ts · add your tables + indexes there." },
      { title: "NEX1 scaffolds provider", body: "Click Connect · NEX1 creates ConvexProvider client component + example query/mutation." },
    ],
    featured: false,
    promptTemplate: `Integrate Convex reactive backend into the project.

FILES TO CREATE:
- src/app/ConvexClientProvider.tsx  → "use client" · ConvexReactClient + <ConvexProvider>
- src/app/layout.tsx                → wrap children with <ConvexClientProvider>
- convex/schema.ts                  → starter schema with one example table
- convex/example.ts                 → one query + one mutation as examples
- docs/integrations/convex.md       → dev workflow (npx convex dev)
- .env.local                        → NEXT_PUBLIC_CONVEX_URL (set by convex dev CLI)

DISCIPLINE:
- convex/ folder is the source of truth · every schema change goes through convex dev
- Never bypass Convex validators · they enforce schema at write time
- Auth integration goes through Convex Auth or Clerk-Convex bridge

VERIFY: type-check clean · npx convex dev started · sample query works.`,
  },

  // ─── MongoDB Atlas ───────────────────────────────────────────
  {
    id: "mongodb-atlas",
    brand: "MongoDB",
    name: "MongoDB Atlas",
    category: "nosql",
    icon: "🍃",
    tagline: "Managed MongoDB · Atlas Search · Vector",
    description: "MongoDB Atlas is managed MongoDB with global clusters · Atlas Search (Lucene-backed) · vector search · triggers · charts. The mainstream document DB choice with SOC 2, HIPAA, GDPR ready out of the box.",
    benefits: [
      "Document model · JSON-like BSON · schema-flexible",
      "Atlas Search combines full-text + vector + faceted",
      "Global clusters · low-latency reads worldwide",
      "SOC 2 · HIPAA · ISO 27001 compliant tier",
    ],
    pricing: "Free M0 cluster · 512MB storage · shared",
    signupUrl: "https://www.mongodb.com/cloud/atlas/register",
    docsUrl: "https://www.mongodb.com/docs/drivers/node/current/quick-start/",
    installCommand: "npm i mongodb",
    envVars: [
      { name: "MONGODB_URI", description: "Atlas connection string with SRV DNS", secret: true, example: "mongodb+srv://user:pass@cluster.mongodb.net/db" },
    ],
    steps: [
      { title: "Sign up + free M0 cluster", body: "Create account · deploy free M0 cluster · pick a region.", ctaLabel: "Open MongoDB Atlas", ctaUrl: "https://www.mongodb.com/cloud/atlas/register" },
      { title: "Whitelist IP + create user",  body: "Security → Network Access → 0.0.0.0/0 (dev) or your Vercel IPs. Database Access → create user." },
      { title: "Grab connection string",     body: "Connect → Drivers → Node · copy the mongodb+srv:// URI with your password substituted." },
      { title: "Install driver",             body: "Run: npm i mongodb" },
      { title: "NEX1 scaffolds client",      body: "Click Connect · NEX1 creates src/lib/db/mongo.ts with connection pooling." },
    ],
    featured: false,
    promptTemplate: `Integrate MongoDB Atlas into the project.

FILES TO CREATE:
- src/lib/db/mongo.ts            → MongoClient with global connection pool · lazy connect
- docs/integrations/mongodb.md   → connection guide · IP whitelist · users
- .env.example                   → MONGODB_URI placeholder

DISCIPLINE:
- Global MongoClient instance to avoid connection storms in serverless
- Use { ignoreUndefined: true } · never insert undefined values
- Indexes documented in docs/integrations/mongodb-indexes.md

VERIFY: type-check clean · example findOne query on a collection.`,
  },

  // ─── Upstash Redis ───────────────────────────────────────────
  {
    id: "upstash-redis",
    brand: "Upstash",
    name: "Upstash Redis",
    category: "redis",
    icon: "⚡",
    tagline: "Serverless Redis · per-request pricing · REST API",
    description: "Upstash Redis is Redis for serverless: pay per request · REST-callable from any edge · global replication · zero connection management. Perfect for rate-limiting · caching · session store · leaderboards.",
    benefits: [
      "Pay-per-request · no idle connection cost",
      "REST + Redis wire protocol · works from Cloudflare Workers, Vercel Edge",
      "Global replication with multi-region reads",
      "Free tier · 10K requests/day · 256MB DB size",
    ],
    pricing: "Free · 10K commands/day · 256MB",
    signupUrl: "https://console.upstash.com/",
    docsUrl: "https://upstash.com/docs/redis/sdks/ts/getstarted",
    installCommand: "npm i @upstash/redis @upstash/ratelimit",
    envVars: [
      { name: "UPSTASH_REDIS_REST_URL",   description: "REST endpoint",  secret: false, example: "https://xxx.upstash.io" },
      { name: "UPSTASH_REDIS_REST_TOKEN", description: "REST auth token · server-only", secret: true, example: "AXXAxxxx..." },
    ],
    steps: [
      { title: "Create database",   body: "Sign up · create a Global Redis database.", ctaLabel: "Open Upstash Console", ctaUrl: "https://console.upstash.com/" },
      { title: "Copy REST creds",   body: "Copy REST URL + REST token from the database detail page." },
      { title: "Install SDK",       body: "Run: npm i @upstash/redis @upstash/ratelimit" },
      { title: "NEX1 scaffolds",    body: "Click Connect · NEX1 creates src/lib/redis/upstash.ts + rate-limit middleware helper." },
    ],
    featured: false,
    promptTemplate: `Integrate Upstash Redis (rate-limit + cache) into the project.

FILES TO CREATE:
- src/lib/redis/upstash.ts       → Redis.fromEnv() singleton
- src/lib/redis/rate-limit.ts    → Ratelimit.slidingWindow helper factory
- docs/integrations/upstash-redis.md → setup + rate-limit patterns
- .env.example                   → UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

DISCIPLINE:
- Token server-only · never exposed to client bundles
- Rate-limit helpers use ephemeral keys per user/IP
- Cache TTLs documented in code · never unbounded

VERIFY: type-check clean · sample rate-limit works.`,
  },

  // ─── Cloudflare D1 ───────────────────────────────────────────
  {
    id: "cloudflare-d1",
    brand: "Cloudflare",
    name: "Cloudflare D1",
    category: "sqlite",
    icon: "☁",
    tagline: "Serverless SQLite at the edge",
    description: "Cloudflare D1 is serverless SQLite integrated with Workers · Pages · Durable Objects. Read from anywhere globally via Cloudflare's edge network. Perfect for apps deployed on Cloudflare Pages.",
    benefits: [
      "Free tier · 5GB storage · 5M reads/day",
      "Reads from any Cloudflare edge location",
      "SQL familiar to anyone who knows SQLite",
      "Integrates with Cloudflare Workers + Pages seamlessly",
    ],
    pricing: "Free · 5GB · 5M reads/day · 100K writes/day",
    signupUrl: "https://dash.cloudflare.com/sign-up",
    docsUrl: "https://developers.cloudflare.com/d1/get-started/",
    installCommand: "npm i -D wrangler",
    envVars: [
      { name: "CLOUDFLARE_ACCOUNT_ID",  description: "Cloudflare account ID",  secret: false, example: "abc123..." },
      { name: "CLOUDFLARE_D1_TOKEN",    description: "API token with D1 access", secret: true, example: "eyJhbGci..." },
    ],
    steps: [
      { title: "Sign up + install wrangler", body: "npm i -D wrangler · then wrangler login.", ctaLabel: "Open Cloudflare", ctaUrl: "https://dash.cloudflare.com/sign-up" },
      { title: "Create D1 database",         body: "wrangler d1 create your-db · copy the returned bindings into wrangler.toml." },
      { title: "Run first migration",        body: "wrangler d1 execute your-db --file=./schema.sql" },
      { title: "NEX1 scaffolds Worker",      body: "Click Connect · NEX1 creates a src/workers/ folder + wrangler.toml + D1 binding wiring." },
    ],
    featured: false,
    promptTemplate: `Integrate Cloudflare D1 (edge SQLite) into the project.

FILES TO CREATE:
- wrangler.toml                  → D1 database binding
- src/workers/db.ts              → env.DB.prepare() typed wrapper
- schema.sql                     → starter table definitions
- docs/integrations/cloudflare-d1.md → wrangler workflow · migrations

DISCIPLINE:
- Prepared statements only · env.DB.prepare(...).bind(...)
- Migrations live in db/migrations/*.sql · applied via wrangler
- Deployed with Cloudflare Pages Functions or Workers

VERIFY: type-check clean · sample worker route calls the D1 binding.`,
  },

  // ─── Vercel KV ───────────────────────────────────────────────
  {
    id: "vercel-kv",
    brand: "Vercel",
    name: "Vercel KV",
    category: "redis",
    icon: "▲",
    tagline: "Redis at the Vercel edge · auto-provisioned",
    description: "Vercel KV is Redis powered by Upstash · one-click provision from the Vercel dashboard · env vars auto-injected. Perfect for rate-limiting · caching · sessions when you're already on Vercel.",
    benefits: [
      "One click provision · env vars auto-injected",
      "REST-callable from Vercel Edge functions",
      "Free tier included in Vercel Hobby",
      "Same Upstash backend · same API",
    ],
    pricing: "Included in Vercel Hobby · 10K commands/day",
    signupUrl: "https://vercel.com/dashboard/stores",
    docsUrl: "https://vercel.com/docs/storage/vercel-kv",
    installCommand: "npm i @vercel/kv",
    envVars: [
      { name: "KV_URL",              description: "Redis-protocol connection URL · auto-injected",     secret: true, example: "redis://..." },
      { name: "KV_REST_API_URL",     description: "REST endpoint · auto-injected",                     secret: false, example: "https://xxx.upstash.io" },
      { name: "KV_REST_API_TOKEN",   description: "REST token · auto-injected · server-only",         secret: true, example: "AXXAxx..." },
    ],
    steps: [
      { title: "Vercel Dashboard → Storage → Create KV", body: "From the Vercel project · Storage tab · Create · KV.", ctaLabel: "Open Vercel Storage", ctaUrl: "https://vercel.com/dashboard/stores" },
      { title: "Connect to project", body: "Attach the KV database to your project · env vars auto-inject on next deploy." },
      { title: "Install client", body: "Run: npm i @vercel/kv" },
      { title: "NEX1 scaffolds", body: "Click Connect · NEX1 creates src/lib/kv/vercel-kv.ts + rate-limit helper." },
    ],
    featured: false,
    promptTemplate: `Integrate Vercel KV (Redis) into the project.

FILES TO CREATE:
- src/lib/kv/vercel-kv.ts        → import { kv } from "@vercel/kv" · typed helpers
- src/lib/kv/rate-limit.ts       → per-IP rate limiter
- docs/integrations/vercel-kv.md → setup + patterns

DISCIPLINE:
- KV_REST_API_TOKEN server-only · never NEXT_PUBLIC
- Keys namespaced (project:feature:id) to avoid collisions
- TTLs documented per key family

VERIFY: type-check clean · sample get/set works.`,
  },

  // ─── Vercel Blob ─────────────────────────────────────────────
  {
    id: "vercel-blob",
    brand: "Vercel",
    name: "Vercel Blob",
    category: "storage",
    icon: "🫧",
    tagline: "S3-compatible file storage · edge-cached",
    description: "Vercel Blob is object storage optimized for Vercel apps. Direct browser uploads · edge-cached URLs · TypeScript-typed metadata. For user uploads · assets · generated images · reports.",
    benefits: [
      "Direct browser → Blob uploads · no server relay",
      "Global CDN in front of every blob URL",
      "Free tier · 500MB storage · 1GB bandwidth",
      "TypeScript SDK · zero-config on Vercel",
    ],
    pricing: "Included in Vercel Hobby · 500MB storage",
    signupUrl: "https://vercel.com/dashboard/stores",
    docsUrl: "https://vercel.com/docs/storage/vercel-blob",
    installCommand: "npm i @vercel/blob",
    envVars: [
      { name: "BLOB_READ_WRITE_TOKEN", description: "Read-write token · server-only", secret: true, example: "vercel_blob_rw_xxx" },
    ],
    steps: [
      { title: "Vercel Dashboard → Storage → Create Blob", body: "From project · Storage tab · Create · Blob.", ctaLabel: "Open Vercel Storage", ctaUrl: "https://vercel.com/dashboard/stores" },
      { title: "Connect to project", body: "Attach the Blob store · BLOB_READ_WRITE_TOKEN auto-injected." },
      { title: "Install SDK", body: "Run: npm i @vercel/blob" },
      { title: "NEX1 scaffolds upload API", body: "Click Connect · NEX1 creates /api/upload/blob route + client upload helper." },
    ],
    featured: false,
    promptTemplate: `Integrate Vercel Blob storage into the project.

FILES TO CREATE:
- src/app/api/upload/route.ts    → handleUpload with allowedContentTypes + auth check
- src/lib/blob/upload.ts         → client-side helper wrapping @vercel/blob upload
- docs/integrations/vercel-blob.md → security guide

DISCIPLINE:
- BLOB_READ_WRITE_TOKEN server-only · never exposed
- allowedContentTypes MUST be restricted · never accept application/octet-stream from anonymous
- Auth check runs BEFORE issuing upload token · never grant upload token to unauthenticated requests

VERIFY: type-check clean · sample upload flow works from a page.`,
  },
];

export function providersByCategory(): ReadonlyArray<{ category: ProviderCategory; label: string; providers: readonly DatabaseProvider[] }> {
  const labels: Record<ProviderCategory, string> = {
    postgres: "PostgreSQL",
    mysql: "MySQL",
    sqlite: "SQLite / Edge",
    nosql: "NoSQL Document",
    firebase: "Firebase / Google",
    "realtime-backend": "Realtime Backend",
    redis: "Redis / Cache",
    storage: "Storage / Blob",
    "vector-db": "Vector Search",
  };
  const map = new Map<ProviderCategory, DatabaseProvider[]>();
  for (const p of PROVIDER_CATALOG) {
    const arr = map.get(p.category) ?? [];
    arr.push(p);
    map.set(p.category, arr);
  }
  return Array.from(map.entries()).map(([category, providers]) => ({ category, label: labels[category], providers }));
}

export function providerById(id: string): DatabaseProvider | null {
  return PROVIDER_CATALOG.find((p) => p.id === id) ?? null;
}
