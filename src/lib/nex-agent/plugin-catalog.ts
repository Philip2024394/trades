// src/lib/nex-agent/plugin-catalog.ts
//
// Curated catalog of world-class plugins/integrations for modern web apps.
// Chosen for serious founder-facing value: Google search reach · performance ·
// auth · payments · content · email · analytics · AI · deployment.
//
// Each plugin carries:
//   - id · category · brand · icon
//   - "why it wins" · concrete founder benefits
//   - install approach · rough setup complexity
//   - the prompt NEX1 receives when founder clicks Add
//
// Guardrail: no plugin recommendation ships a secret key · founder-only
// action to enable · never bypasses Security Agent scan on install commit.

export type PluginCategory =
  | "seo-search"
  | "analytics-perf"
  | "auth"
  | "payments"
  | "content-media"
  | "email"
  | "search"
  | "communication"
  | "ai"
  | "deployment"
  | "monitoring";

export interface Plugin {
  readonly id: string;
  readonly brand: string;
  readonly name: string;
  readonly category: PluginCategory;
  readonly icon: string;              // single-char / short glyph
  readonly tagline: string;           // one-liner under the icon
  readonly description: string;       // paragraph in the detail view
  readonly benefits: readonly string[];
  readonly setupComplexity: "low" | "medium" | "high";
  readonly recommendedFor: readonly string[];  // e.g. ["landing-page", "saas", "ecommerce"]
  readonly featured: boolean;         // top-of-grid badge
  readonly promptTemplate: string;    // prompt NEX1 receives on "Add"
}

const CATEGORIES: Record<PluginCategory, string> = {
  "seo-search":    "SEO · Google Search",
  "analytics-perf":"Analytics · Performance",
  "auth":          "Authentication",
  "payments":      "Payments",
  "content-media": "Content · Media",
  "email":         "Email",
  "search":        "In-app Search",
  "communication": "Communication",
  "ai":            "AI · Machine Learning",
  "deployment":    "Deployment · Edge",
  "monitoring":    "Monitoring · Errors",
};

export function categoryLabel(c: PluginCategory): string { return CATEGORIES[c]; }

export const PLUGIN_CATALOG: readonly Plugin[] = [
  // ─── SEO · Google Search ─────────────────────────────────────
  {
    id: "google-search-console",
    brand: "Google",
    name: "Search Console",
    category: "seo-search",
    icon: "🔍",
    tagline: "Direct Google indexing + performance metrics",
    description: "Google Search Console gives the founder a direct pipeline to Google's index. Verify site ownership · submit sitemap · see which queries drive traffic · monitor Core Web Vitals from Google's own crawler · request re-indexing for changed pages.",
    benefits: [
      "See exactly which Google queries land users on your pages",
      "Submit sitemap so Google indexes new pages faster",
      "Get alerts when Googlebot can't crawl a page",
      "Core Web Vitals grades that directly affect ranking",
      "Rich Result eligibility check for structured data",
    ],
    setupComplexity: "low",
    recommendedFor: ["landing-page", "saas", "marketplace", "directory", "blog", "docs", "ecommerce"],
    featured: true,
    promptTemplate: "Integrate Google Search Console into the project. 1) Add a DNS TXT verification record instruction. 2) Generate/update sitemap.xml with lastmod dates. 3) Wire Google's site-verification meta tag into the root layout. 4) Add robots.txt with sitemap declaration. 5) Ensure every page has proper canonical + description meta. Document setup steps in docs/integrations/google-search-console.md.",
  },
  {
    id: "structured-data-json-ld",
    brand: "Schema.org",
    name: "JSON-LD Schema",
    category: "seo-search",
    icon: "⌘",
    tagline: "Rich Google Search results eligibility",
    description: "Google's rich results (star ratings · product cards · FAQ accordions · article previews · event listings) all depend on schema.org JSON-LD markup embedded in pages. This unlocks visual + ranking advantages competitors without schema simply cannot get.",
    benefits: [
      "Star-rating cards for reviews · product cards for ecommerce",
      "FAQ accordions in Google SERP · doubles clickable surface",
      "Article + BreadcrumbList schema for editorial content",
      "Organization + WebSite schema for sitelinks search box",
      "Validated via Google's Rich Results Test",
    ],
    setupComplexity: "medium",
    recommendedFor: ["ecommerce", "marketplace", "directory", "blog", "portfolio"],
    featured: true,
    promptTemplate: "Add JSON-LD schema.org markup site-wide. 1) Root layout: Organization + WebSite schema. 2) Per-page: appropriate schema type (Product · Article · FAQPage · BreadcrumbList · Event) computed from page content. 3) Server-render JSON-LD as <script type=\"application/ld+json\"> so Googlebot sees it in initial HTML. 4) Add a src/lib/seo/json-ld.ts helper. 5) Test with Google Rich Results Test URL for one representative page.",
  },
  {
    id: "sitemap-robots",
    brand: "Next.js",
    name: "Sitemap + Robots",
    category: "seo-search",
    icon: "🗺",
    tagline: "Auto-generated sitemap.xml + robots.txt",
    description: "Next.js App Router supports first-class sitemap.ts and robots.ts route handlers. NEX1 wires these up so every new page you build gets indexed with fresh lastmod dates automatically · Googlebot uses the freshness signal to prioritise re-crawls.",
    benefits: [
      "sitemap.xml regenerates on every deploy · always current",
      "robots.txt blocks admin/staging routes to preserve crawl budget",
      "Auto-lastmod dates from filesystem mtime or DB updated_at",
      "Supports large sites via sitemap index files",
    ],
    setupComplexity: "low",
    recommendedFor: ["landing-page", "saas", "marketplace", "directory", "blog", "docs", "ecommerce", "portfolio"],
    featured: false,
    promptTemplate: "Create src/app/sitemap.ts and src/app/robots.ts. sitemap.ts walks every public route + returns entries with lastModified. robots.ts declares Sitemap URL + disallows /admin, /nex-head-quarters, /api, /nexapp/nex-agent (workstation should never index). Wire updated_at from the appropriate DB tables for content pages.",
  },
  {
    id: "opengraph-og-images",
    brand: "@vercel/og",
    name: "OG Image Generator",
    category: "seo-search",
    icon: "🖼",
    tagline: "Auto-generated 1200×630 share previews",
    description: "Every page shared on Facebook · X · LinkedIn · Slack · Discord · WhatsApp pulls an Open Graph image. Missing OG image = plain-text share = terrible CTR. @vercel/og generates branded 1200×630 previews on-demand from page metadata.",
    benefits: [
      "Auto-branded social previews for every page",
      "Dynamic per-page content (title · author · category)",
      "Runs at the edge · sub-100ms cold generation",
      "Uses your existing typography + brand colors",
    ],
    setupComplexity: "medium",
    recommendedFor: ["landing-page", "saas", "marketplace", "blog", "portfolio", "ecommerce"],
    featured: false,
    promptTemplate: "Add @vercel/og for dynamic OG image generation. Create src/app/api/og/route.tsx that renders a 1200×630 image with the page title + brand mark (NEX orange X). Wire openGraph.images metadata in every page.tsx to point at /api/og?title=...&subtitle=... Ensure the images use the NEX DNA colors (deep navy background · cyan accents · NEX orange X).",
  },

  // ─── Analytics · Performance ─────────────────────────────────
  {
    id: "vercel-analytics",
    brand: "Vercel",
    name: "Vercel Analytics",
    category: "analytics-perf",
    icon: "📊",
    tagline: "Cookieless privacy-first page views",
    description: "Vercel Analytics is a cookieless first-party analytics for Next.js apps. No consent banner required in most jurisdictions · zero client bundle overhead · integrates in one component call. Sees Real User Monitoring (RUM) data Google itself uses to grade Core Web Vitals.",
    benefits: [
      "No cookie banner needed · GDPR-compliant by design",
      "First-party · never blocked by ad-blockers",
      "Zero-config setup for Next.js apps",
      "Includes Web Vitals RUM · same metrics Google uses",
    ],
    setupComplexity: "low",
    recommendedFor: ["landing-page", "saas", "marketplace", "blog", "webapp", "portfolio", "ecommerce"],
    featured: false,
    promptTemplate: "Install @vercel/analytics and @vercel/speed-insights. Wire <Analytics /> and <SpeedInsights /> into src/app/layout.tsx. Document env-based enable/disable so preview + local dev don't pollute production data.",
  },
  {
    id: "posthog",
    brand: "PostHog",
    name: "PostHog Analytics",
    category: "analytics-perf",
    icon: "🎯",
    tagline: "Product analytics · session replay · feature flags",
    description: "PostHog combines product analytics · session replay · feature flags · experimentation · surveys · error tracking in one open-source platform. See exactly what users do · why they drop off · which features they discover.",
    benefits: [
      "Session replay watches real users navigate the app",
      "Funnel analysis pinpoints where users drop off",
      "Feature flags roll out features to % of users",
      "A/B tests with statistical significance built in",
      "Self-hostable · data sovereignty option",
    ],
    setupComplexity: "medium",
    recommendedFor: ["saas", "marketplace", "webapp", "ecommerce"],
    featured: true,
    promptTemplate: "Install posthog-js and posthog-node. Wire the client-side capture in a top-level PostHogProvider client component. Wire server-side capture for critical events (signup · purchase · plan upgrade). Set autocapture: true for click/pageview events. Add a src/lib/analytics/events.ts registry of canonical event names.",
  },

  // ─── Authentication ──────────────────────────────────────────
  {
    id: "clerk",
    brand: "Clerk",
    name: "Clerk Auth",
    category: "auth",
    icon: "🔐",
    tagline: "Pre-built UI · social sign-in · MFA · orgs",
    description: "Clerk is the fastest way to add production-grade authentication with world-class UX. Beautiful pre-built components · social login (Google · Apple · GitHub · etc.) · magic links · MFA · organizations · user management dashboard · SOC 2 Type II compliant.",
    benefits: [
      "Drop-in <SignIn /> and <UserButton /> components · zero design work",
      "Every social login provider · magic links · passkeys · SMS · TOTP",
      "Multi-tenant orgs + roles + permissions out of the box",
      "User management dashboard · no admin UI to build",
    ],
    setupComplexity: "low",
    recommendedFor: ["saas", "marketplace", "webapp", "ecommerce"],
    featured: true,
    promptTemplate: "Install @clerk/nextjs. Wire ClerkProvider around the root layout. Add middleware for protected routes. Create sign-in and sign-up pages using <SignIn /> and <SignUp />. Add environment variables to .env.example (never commit real keys). Document webhook setup for user provisioning.",
  },
  {
    id: "supabase-auth",
    brand: "Supabase",
    name: "Supabase Auth",
    category: "auth",
    icon: "🔑",
    tagline: "PostgreSQL-backed auth + RLS",
    description: "Supabase Auth pairs authentication with Postgres row-level security · the tightest data-integrity story available. Every table policy can reference auth.uid() so users only ever see rows they're allowed to see · enforced at the database layer.",
    benefits: [
      "Row-level security policies enforced at the DB layer",
      "Social login + magic links + phone OTP",
      "Auth events fire Postgres triggers for user provisioning",
      "Real-time subscriptions respect RLS by default",
    ],
    setupComplexity: "medium",
    recommendedFor: ["saas", "marketplace", "webapp", "directory"],
    featured: false,
    promptTemplate: "Install @supabase/ssr and @supabase/supabase-js. Configure createClient for browser + server + middleware contexts. Add environment variables to .env.example. Wire RLS policies for the primary user-owned tables. Document callback URL configuration.",
  },

  // ─── Payments ────────────────────────────────────────────────
  {
    id: "stripe",
    brand: "Stripe",
    name: "Stripe Payments",
    category: "payments",
    icon: "💳",
    tagline: "Cards · subscriptions · marketplaces · Connect",
    description: "Stripe is the industry-standard payment processor. Handles cards · wallets · bank debits · subscriptions · marketplaces (Connect) · in-person (Terminal) · billing · tax · fraud prevention. World-class developer experience with Test Mode + webhooks.",
    benefits: [
      "One-line checkout via Stripe Checkout · zero PCI scope for you",
      "Subscriptions with trials · dunning · plan changes · prorations",
      "Marketplace/Connect for platforms that pay third parties",
      "Automatic tax calculation in 30+ countries",
      "Best-in-class fraud detection (Radar)",
    ],
    setupComplexity: "medium",
    recommendedFor: ["saas", "marketplace", "ecommerce"],
    featured: true,
    promptTemplate: "Install stripe and @stripe/stripe-js. Wire server-side Stripe client with STRIPE_SECRET_KEY. Create /api/checkout/session for one-off payments and /api/subscription for recurring. Add webhook handler at /api/webhooks/stripe with signature verification. Never commit real keys · use STRIPE_SECRET_KEY environment variable only.",
  },

  // ─── Content · Media ─────────────────────────────────────────
  {
    id: "cloudinary",
    brand: "Cloudinary",
    name: "Cloudinary Media",
    category: "content-media",
    icon: "🎨",
    tagline: "Image · video · AI transforms · CDN",
    description: "Cloudinary handles upload · storage · optimization · transformation · delivery for images and video. Auto WebP/AVIF conversion · smart cropping · AI background removal · face-aware resize · edge CDN with 99.99% uptime.",
    benefits: [
      "Auto-optimize every image to WebP/AVIF · smaller files · better Core Web Vitals",
      "URL-based transforms · resize/crop/filter without new uploads",
      "AI features · background removal · smart focal-point cropping",
      "Video adaptive streaming (HLS) · no encoding infrastructure needed",
    ],
    setupComplexity: "low",
    recommendedFor: ["marketplace", "ecommerce", "blog", "portfolio"],
    featured: false,
    promptTemplate: "Install next-cloudinary. Add environment variables for cloud name + upload preset (unsigned). Create a <CloudinaryImage /> wrapper for next/image that swaps in Cloudinary URLs. Add server-side signed uploads for authenticated user avatars. Document setup steps in docs/integrations/cloudinary.md.",
  },

  // ─── Email ───────────────────────────────────────────────────
  {
    id: "resend",
    brand: "Resend",
    name: "Resend Email",
    category: "email",
    icon: "✉",
    tagline: "React Email templates · high deliverability",
    description: "Resend is transactional email built for developers · founded by the team behind React Email. Templates are React components. Every email lives in a git-tracked file. Deliverability rivals SendGrid + Postmark. First 3,000 emails/month free.",
    benefits: [
      "React Email templates · version-controlled + code-reviewed",
      "Deliverability tracked per-domain · anti-bounce protection",
      "Webhook events for opens · clicks · bounces · complaints",
      "Batch sending API for newsletters + campaigns",
    ],
    setupComplexity: "low",
    recommendedFor: ["saas", "marketplace", "ecommerce", "blog", "webapp"],
    featured: true,
    promptTemplate: "Install resend and @react-email/components. Create src/emails/ directory with react-email templates. Wire a sendEmail helper in src/lib/email/resend.ts. Add domain verification instructions. Never commit RESEND_API_KEY.",
  },

  // ─── In-app Search ───────────────────────────────────────────
  {
    id: "algolia",
    brand: "Algolia",
    name: "Algolia Search",
    category: "search",
    icon: "⚡",
    tagline: "Instant search · typo-tolerant · ranked",
    description: "Algolia delivers sub-100ms typo-tolerant search-as-you-type across millions of records. Instantsearch React components handle the UI · federated search across multiple indices · A/B test ranking strategies · analytics on every search.",
    benefits: [
      "Sub-100ms results even at millions-of-records scale",
      "Typo tolerance built in · users find what they mean",
      "Instant search UI React components ship out of the box",
      "Search analytics · see what users type and don't find",
    ],
    setupComplexity: "medium",
    recommendedFor: ["marketplace", "directory", "ecommerce", "blog", "docs"],
    featured: false,
    promptTemplate: "Install algoliasearch and react-instantsearch. Configure Algolia app ID + search-only API key on the client (admin key server-only). Create an Algolia index with attributes matching your primary searchable entity. Wire an <InstantSearch> component with SearchBox + Hits + Pagination. Set up a webhook or cron that re-indexes on record changes.",
  },

  // ─── Monitoring · Errors ─────────────────────────────────────
  {
    id: "sentry",
    brand: "Sentry",
    name: "Sentry Monitoring",
    category: "monitoring",
    icon: "⚠",
    tagline: "Errors · performance · session replay",
    description: "Sentry catches errors + performance issues in production before your users report them. Full stack traces with source maps · breadcrumbs showing what the user did before the error · session replay of the exact click that broke.",
    benefits: [
      "Every production error grouped + de-duped · no noise",
      "Session replay of the seconds before the error",
      "Performance monitoring · slow API calls + DB queries flagged",
      "Release health · which deploys crash for whom",
    ],
    setupComplexity: "medium",
    recommendedFor: ["saas", "marketplace", "webapp", "ecommerce"],
    featured: true,
    promptTemplate: "Install @sentry/nextjs and run the configuration wizard. Configure server + client + edge Sentry configs. Wire source-map upload in production builds. Set traces sample rate conservatively (0.1) for cost control. Never commit SENTRY_AUTH_TOKEN.",
  },

  // ─── Communication ───────────────────────────────────────────
  {
    id: "twilio",
    brand: "Twilio",
    name: "Twilio SMS + Voice",
    category: "communication",
    icon: "📱",
    tagline: "SMS · voice · WhatsApp · verification",
    description: "Twilio powers SMS · voice calls · WhatsApp Business API · phone number verification · two-factor authentication. Every major consumer app runs on Twilio somewhere. Pay-as-you-go with volume discounts.",
    benefits: [
      "Send SMS to 180+ countries · reliable delivery",
      "Phone number verification for signup (OTP)",
      "WhatsApp Business API for direct customer messaging",
      "Programmable voice for phone-based flows",
    ],
    setupComplexity: "medium",
    recommendedFor: ["saas", "marketplace", "ecommerce"],
    featured: false,
    promptTemplate: "Install twilio node SDK. Configure account SID + auth token server-only. Create /api/otp/send and /api/otp/verify endpoints. Rate-limit OTP requests per phone number (max 3/hour). Store OTP with 5-minute TTL + hashed. Never commit TWILIO_AUTH_TOKEN.",
  },

  // ─── AI ──────────────────────────────────────────────────────
  {
    id: "anthropic-claude",
    brand: "Anthropic",
    name: "Anthropic Claude",
    category: "ai",
    icon: "◈",
    tagline: "Claude API · reasoning · long context · vision",
    description: "Anthropic's Claude models offer strong reasoning · long context windows (up to 200K+ tokens) · vision · tool use · and Constitutional AI safety. Ideal for founder-facing AI features where response quality + safety matter.",
    benefits: [
      "200K+ context window · long documents in a single prompt",
      "Vision · Claude reads screenshots · sketches · charts",
      "Tool use · Claude calls your APIs to gather info",
      "Constitutional AI safety · fewer harmful outputs by default",
    ],
    setupComplexity: "medium",
    recommendedFor: ["saas", "webapp"],
    featured: false,
    promptTemplate: "Install @anthropic-ai/sdk. Create src/lib/ai/anthropic.ts with a typed client. Never expose ANTHROPIC_API_KEY to the client · server-side proxy only. Add a /api/ai/chat endpoint with rate limiting + prompt injection guards. Log usage for cost tracking.",
  },

  // ─── Deployment · Edge ───────────────────────────────────────
  {
    id: "cloudflare-workers",
    brand: "Cloudflare",
    name: "Cloudflare CDN + Workers",
    category: "deployment",
    icon: "☁",
    tagline: "Edge CDN · DDoS · Workers · R2 storage",
    description: "Cloudflare wraps the app in a global CDN + DDoS protection + edge compute (Workers) + object storage (R2) + AI models (Workers AI) + queues + KV store. The most complete edge platform on the internet · free tier is generous.",
    benefits: [
      "Global CDN with 300+ locations · sub-50ms TTFB worldwide",
      "DDoS protection · L3/4/7 attacks absorbed automatically",
      "Workers run at the edge · execute logic close to the user",
      "R2 storage · zero egress fees vs S3",
    ],
    setupComplexity: "low",
    recommendedFor: ["landing-page", "saas", "marketplace", "webapp", "ecommerce", "portfolio"],
    featured: false,
    promptTemplate: "Configure Cloudflare CDN in front of the app. Add Cloudflare-specific security headers (in addition to existing X-Robots-Tag etc.). Set up Cloudflare Turnstile as an anti-bot layer on forms. Document DNS + SSL setup in docs/integrations/cloudflare.md.",
  },
];

export function pluginsByCategory(): ReadonlyArray<{ category: PluginCategory; label: string; plugins: readonly Plugin[] }> {
  const map = new Map<PluginCategory, Plugin[]>();
  for (const p of PLUGIN_CATALOG) {
    const arr = map.get(p.category) ?? [];
    arr.push(p);
    map.set(p.category, arr);
  }
  return Array.from(map.entries()).map(([category, plugins]) => ({ category, label: CATEGORIES[category], plugins }));
}

export function pluginById(id: string): Plugin | null {
  return PLUGIN_CATALOG.find((p) => p.id === id) ?? null;
}
