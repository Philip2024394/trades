// Admin API-key registry — the single source of truth for every
// third-party service key + internal secret the app relies on.
//
// This is DECLARATIVE data only — no values are stored here, only
// the env var name + metadata. The /admin/api-keys page reads
// process.env[envName] server-side to check presence (never to
// display the value).
//
// When you add a new integration:
//   1. Add its env var to .env.local
//   2. Add an entry here so it appears on /admin/api-keys with the
//      right provider link + description + affected area
//   3. That's it — no other wiring needed.

export type KeyCategory =
  | "ai"
  | "database"
  | "payments"
  | "comms"
  | "external-apis"
  | "oauth-social"
  | "hosting"
  | "push"
  | "internal-secrets";

export type KeyRequirement =
  | "required"      // app cannot run without it
  | "optional"      // feature degrades to fallback if missing
  | "dev-only";     // used for local scripts / not production

export type ApiKeyEntry = {
  envName:            string;
  provider:           string;      // e.g. "Anthropic", "Groq Cloud"
  purpose:            string;      // short "what this key does"
  areas:              string[];    // routes / features that consume it
  providerConsoleUrl: string;      // link to provider dashboard
  getKeyUrl:          string;      // link to create/rotate the key
  docsUrl?:           string;      // optional link to provider docs
  requirement:        KeyRequirement;
  fallbackBehaviour:  string;      // what happens if missing
  category:           KeyCategory;
  notes?:             string;
};

export const API_KEY_REGISTRY: ApiKeyEntry[] = [

  // ─── AI · language + speech ──────────────────────────────────────
  {
    envName:            "ANTHROPIC_API_KEY",
    provider:           "Anthropic",
    purpose:            "Claude LLM — video enrichment (Sonnet 4.6), Ask-AI answers (Haiku 4.5), homeowner assistant, AI Visualiser, quote analysis.",
    areas: [
      "/videos/[id] — Ask-AI panel + enrichment",
      "/api/videos/[id]/process-ai — Sonnet enrichment",
      "/api/videos/[id]/ask-ai — Haiku Q&A",
      "/api/homeowner/ai/ask — SiteBook assistant",
      "AI Visualiser (merchant image generation)",
      "Quote workspace analysis"
    ],
    providerConsoleUrl: "https://console.anthropic.com/",
    getKeyUrl:          "https://console.anthropic.com/settings/keys",
    docsUrl:            "https://docs.anthropic.com/",
    requirement:        "required",
    fallbackBehaviour:  "All AI features return null / show 'AI unavailable'. Ask-AI returns error.",
    category:           "ai",
    notes:              "Claude Opus 4.7 rejects the temperature parameter — code uses Sonnet 4.6 for enrichment + Haiku 4.5 for Ask-AI."
  },
  {
    envName:            "GROQ_API_KEY",
    provider:           "Groq Cloud",
    purpose:            "Whisper large-v3 audio transcription — reads every uploaded video's actual spoken content so AI answers are grounded in the transcript, not fabricated from the title.",
    areas: [
      "/api/videos/[id]/process-ai — real Whisper transcription step",
      "src/lib/videos/whisperTranscribe.ts"
    ],
    providerConsoleUrl: "https://console.groq.com/",
    getKeyUrl:          "https://console.groq.com/keys",
    docsUrl:            "https://console.groq.com/docs/speech-text",
    requirement:        "required",
    fallbackBehaviour:  "Video enrichment falls back to title-only (no real transcript). Ask-AI answers become generic. 25MB per-video cap.",
    category:           "ai"
  },
  {
    envName:            "OPENAI_API_KEY",
    provider:           "OpenAI",
    purpose:            "Embeddings + fallback text completion for the homeowner AI assistant when Anthropic is unavailable.",
    areas: [
      "/api/homeowner/ai/ask — fallback LLM",
      "src/lib/llm/embeddings.ts"
    ],
    providerConsoleUrl: "https://platform.openai.com/",
    getKeyUrl:          "https://platform.openai.com/api-keys",
    docsUrl:            "https://platform.openai.com/docs",
    requirement:        "optional",
    fallbackBehaviour:  "Homeowner assistant falls back to Anthropic-only. Embeddings unavailable.",
    category:           "ai"
  },

  // ─── Database ────────────────────────────────────────────────────
  {
    envName:            "NEXT_PUBLIC_SUPABASE_URL",
    provider:           "Supabase",
    purpose:            "Public URL of the Supabase project — used by browser + server clients.",
    areas: ["Every server + client Supabase call across the platform"],
    providerConsoleUrl: "https://supabase.com/dashboard/project/msdonkkechxzgagyguoe",
    getKeyUrl:          "https://supabase.com/dashboard/project/msdonkkechxzgagyguoe/settings/api",
    requirement:        "required",
    fallbackBehaviour:  "App will not start — every DB call fails.",
    category:           "database"
  },
  {
    envName:            "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    provider:           "Supabase",
    purpose:            "Anonymous public API key — safe to expose to the browser, gated by Row-Level Security policies.",
    areas: ["Every browser-side Supabase query (auth, public reads)"],
    providerConsoleUrl: "https://supabase.com/dashboard/project/msdonkkechxzgagyguoe/settings/api",
    getKeyUrl:          "https://supabase.com/dashboard/project/msdonkkechxzgagyguoe/settings/api",
    requirement:        "required",
    fallbackBehaviour:  "Client-side data fetches fail; auth flows break.",
    category:           "database"
  },
  {
    envName:            "SUPABASE_SERVICE_ROLE_KEY",
    provider:           "Supabase",
    purpose:            "SERVER-ONLY admin key that bypasses RLS. Used by supabaseAdmin for privileged writes (admin ops, cron jobs, webhooks).",
    areas: [
      "src/lib/supabaseAdmin.ts — every server-side privileged write",
      "All admin dashboards + cron jobs + webhooks"
    ],
    providerConsoleUrl: "https://supabase.com/dashboard/project/msdonkkechxzgagyguoe/settings/api",
    getKeyUrl:          "https://supabase.com/dashboard/project/msdonkkechxzgagyguoe/settings/api",
    requirement:        "required",
    fallbackBehaviour:  "All admin writes fail; cron jobs stop; user signup breaks.",
    category:           "database",
    notes:              "NEVER expose this to the browser. Bypasses all RLS policies."
  },

  // ─── Payments ────────────────────────────────────────────────────
  {
    envName:            "STRIPE_SECRET_KEY",
    provider:           "Stripe",
    purpose:            "Server-side Stripe API key — creates subscriptions, checkout sessions, refunds, connect accounts.",
    areas: [
      "Tier subscriptions (Starter / Professional / Business / Works)",
      "Washer packs (£4.99 / £14.99 / £49.99)",
      "Add-on subscriptions (Trade Center, AI Visualiser, etc)",
      "Trade Center store checkout",
      "Boost campaigns"
    ],
    providerConsoleUrl: "https://dashboard.stripe.com/",
    getKeyUrl:          "https://dashboard.stripe.com/apikeys",
    docsUrl:            "https://stripe.com/docs/api",
    requirement:        "required",
    fallbackBehaviour:  "All paid tier upgrades + purchases fail. Free tier still works.",
    category:           "payments",
    notes:              "Live vs test key: prefix is sk_live_ vs sk_test_. Check dashboard mode toggle."
  },
  {
    envName:            "STRIPE_WEBHOOK_SECRET",
    provider:           "Stripe",
    purpose:            "Signs incoming Stripe webhook events so we can verify authenticity (subscription created, payment succeeded, etc).",
    areas: [
      "/api/webhooks/stripe — subscription lifecycle",
      "/api/webhooks/stripe/washers — washer pack purchases"
    ],
    providerConsoleUrl: "https://dashboard.stripe.com/webhooks",
    getKeyUrl:          "https://dashboard.stripe.com/webhooks",
    requirement:        "required",
    fallbackBehaviour:  "Webhook events are rejected as unauthenticated; tier upgrades stall.",
    category:           "payments"
  },
  {
    envName:            "STRIPE_STORE_WEBHOOK_SECRET",
    provider:           "Stripe",
    purpose:            "Separate webhook signing secret for Trade Center store checkout events (Connect payments).",
    areas: ["/api/webhooks/stripe/store — TC store order fulfilment"],
    providerConsoleUrl: "https://dashboard.stripe.com/webhooks",
    getKeyUrl:          "https://dashboard.stripe.com/webhooks",
    requirement:        "optional",
    fallbackBehaviour:  "Trade Center store orders don't auto-fulfil.",
    category:           "payments"
  },
  {
    envName:            "PAYPAL_CLIENT_ID",
    provider:           "PayPal",
    purpose:            "PayPal REST API client ID — merchant payouts (weekly driver settlements, affiliate commissions).",
    areas: [
      "Merchant payouts",
      "Affiliate commission payouts",
      "PayPal-branded merchant checkout"
    ],
    providerConsoleUrl: "https://developer.paypal.com/dashboard/",
    getKeyUrl:          "https://developer.paypal.com/dashboard/applications",
    requirement:        "optional",
    fallbackBehaviour:  "PayPal payouts unavailable; Stripe/Wise still work.",
    category:           "payments"
  },
  {
    envName:            "PAYPAL_CLIENT_SECRET",
    provider:           "PayPal",
    purpose:            "Companion secret to PAYPAL_CLIENT_ID for server-to-server auth.",
    areas: ["Same as PAYPAL_CLIENT_ID"],
    providerConsoleUrl: "https://developer.paypal.com/dashboard/",
    getKeyUrl:          "https://developer.paypal.com/dashboard/applications",
    requirement:        "optional",
    fallbackBehaviour:  "PayPal integration falls back to disabled.",
    category:           "payments"
  },
  {
    envName:            "WISE_API_TOKEN",
    provider:           "Wise (TransferWise)",
    purpose:            "Wise Business API token — international merchant payouts + FX transfers.",
    areas: [
      "International trade payouts",
      "Cross-border affiliate commissions"
    ],
    providerConsoleUrl: "https://wise.com/business/",
    getKeyUrl:          "https://wise.com/settings/integrations",
    docsUrl:            "https://api-docs.wise.com/",
    requirement:        "optional",
    fallbackBehaviour:  "International payouts unavailable; UK Stripe still works.",
    category:           "payments"
  },

  // ─── Communications (email, SMS, WhatsApp) ───────────────────────
  {
    envName:            "POSTMARK_SERVER_TOKEN",
    provider:           "Postmark",
    purpose:            "Transactional email delivery — order receipts, quote replies, homeowner login links, review requests, shadow-merchant 6-touch drip, affiliate emails.",
    areas: [
      "/api/webhooks/postmark — inbound bounce/complaint handling",
      "Shadow-profile 6-touch acquisition drip (/admin/growth/shadow-profiles)",
      "Beacon customer notifications",
      "Review request emails",
      "Merchant referral emails",
      "Order paid receipts",
      "Trade join notifications",
      "Homeowner magic-link login"
    ],
    providerConsoleUrl: "https://account.postmarkapp.com/",
    getKeyUrl:          "https://account.postmarkapp.com/servers",
    docsUrl:            "https://postmarkapp.com/developer",
    requirement:        "required",
    fallbackBehaviour:  "All transactional emails silently drop (logged as 'dry-run'). User signups still succeed but no confirmation email arrives.",
    category:           "comms"
  },
  {
    envName:            "TWILIO_ACCOUNT_SID",
    provider:           "Twilio",
    purpose:            "Twilio account SID — SMS OTP delivery for trade login when WhatsApp OTP fails.",
    areas: [
      "Trade OTP fallback (SMS when WhatsApp unavailable)",
      "src/lib/tradeAuthDispatch.ts"
    ],
    providerConsoleUrl: "https://console.twilio.com/",
    getKeyUrl:          "https://console.twilio.com/us1/account/keys-credentials/api-keys",
    requirement:        "optional",
    fallbackBehaviour:  "SMS OTP unavailable; WhatsApp-only login.",
    category:           "comms"
  },
  {
    envName:            "TWILIO_AUTH_TOKEN",
    provider:           "Twilio",
    purpose:            "Twilio auth token paired with TWILIO_ACCOUNT_SID.",
    areas: ["Same as TWILIO_ACCOUNT_SID"],
    providerConsoleUrl: "https://console.twilio.com/",
    getKeyUrl:          "https://console.twilio.com/us1/account/keys-credentials/api-keys",
    requirement:        "optional",
    fallbackBehaviour:  "SMS OTP unavailable.",
    category:           "comms"
  },
  {
    envName:            "META_WHATSAPP_ACCESS_TOKEN",
    provider:           "Meta / WhatsApp Business API",
    purpose:            "WhatsApp Cloud API access token — sends OTP templates, quote notifications, order confirmations.",
    areas: [
      "Trade OTP delivery (primary channel)",
      "Homeowner quote replies",
      "Beacon notifications",
      "Booking confirmations"
    ],
    providerConsoleUrl: "https://business.facebook.com/wa/manage/",
    getKeyUrl:          "https://developers.facebook.com/apps/",
    docsUrl:            "https://developers.facebook.com/docs/whatsapp/cloud-api",
    requirement:        "required",
    fallbackBehaviour:  "WhatsApp messages fail; users fall back to SMS OTP or magic-link email.",
    category:           "comms",
    notes:              "Tokens expire — check META_WHATSAPP_TOKEN as alias if this specific one is missing."
  },
  {
    envName:            "META_WHATSAPP_PHONE_NUMBER_ID",
    provider:           "Meta / WhatsApp Business API",
    purpose:            "The phone-number ID (NOT the phone number) that WhatsApp messages are sent from.",
    areas: ["All WhatsApp send calls"],
    providerConsoleUrl: "https://business.facebook.com/wa/manage/phone-numbers/",
    getKeyUrl:          "https://business.facebook.com/wa/manage/phone-numbers/",
    requirement:        "required",
    fallbackBehaviour:  "WhatsApp send fails — no phone number to send from.",
    category:           "comms"
  },
  {
    envName:            "META_APP_ID",
    provider:           "Meta",
    purpose:            "Facebook App ID — OAuth login + WhatsApp Business integration parent.",
    areas: ["Meta OAuth flows", "WhatsApp webhook verification"],
    providerConsoleUrl: "https://developers.facebook.com/apps/",
    getKeyUrl:          "https://developers.facebook.com/apps/",
    requirement:        "optional",
    fallbackBehaviour:  "Meta OAuth login unavailable.",
    category:           "comms"
  },
  {
    envName:            "META_APP_SECRET",
    provider:           "Meta",
    purpose:            "Companion secret for META_APP_ID.",
    areas: ["Same as META_APP_ID"],
    providerConsoleUrl: "https://developers.facebook.com/apps/",
    getKeyUrl:          "https://developers.facebook.com/apps/",
    requirement:        "optional",
    fallbackBehaviour:  "Meta OAuth login unavailable.",
    category:           "comms"
  },
  {
    envName:            "META_WEBHOOK_VERIFY_TOKEN",
    provider:           "Meta",
    purpose:            "Shared secret Meta uses to verify our webhook endpoint (must match Meta app dashboard).",
    areas: ["/api/webhooks/meta"],
    providerConsoleUrl: "https://developers.facebook.com/apps/",
    getKeyUrl:          "https://developers.facebook.com/apps/",
    requirement:        "optional",
    fallbackBehaviour:  "Meta webhook subscription fails at handshake.",
    category:           "comms"
  },

  // ─── External APIs ───────────────────────────────────────────────
  {
    envName:            "COMPANIES_HOUSE_API_KEY",
    provider:           "UK Companies House",
    purpose:            "Free UK gov API — scrapes company data to build shadow merchant profiles for the 6-touch acquisition drip.",
    areas: [
      "/admin/growth/shadow-profiles — the acquisition engine",
      "src/lib/shadowMerchants/",
      "Company verification during trade signup"
    ],
    providerConsoleUrl: "https://developer.company-information.service.gov.uk/",
    getKeyUrl:          "https://developer.company-information.service.gov.uk/manage-applications",
    docsUrl:            "https://developer-specs.company-information.service.gov.uk/",
    requirement:        "optional",
    fallbackBehaviour:  "Shadow-profile scraper runs in dry-run mode (no writes). Live verification skipped.",
    category:           "external-apis"
  },
  {
    envName:            "GOOGLE_PLACES_API_KEY",
    provider:           "Google Cloud",
    purpose:            "Google Places API — address autocomplete for merchant signup + homeowner booking address entry.",
    areas: [
      "Merchant signup — address autocomplete",
      "Homeowner booking — job address",
      "SiteBook property location"
    ],
    providerConsoleUrl: "https://console.cloud.google.com/",
    getKeyUrl:          "https://console.cloud.google.com/apis/credentials",
    docsUrl:            "https://developers.google.com/maps/documentation/places/web-service",
    requirement:        "optional",
    fallbackBehaviour:  "Users type addresses manually (no autocomplete).",
    category:           "external-apis",
    notes:              "Costs ~£0.017 per autocomplete session. Restrict by domain in Google console."
  },
  {
    envName:            "IPQUALITYSCORE_KEY",
    provider:           "IPQualityScore",
    purpose:            "IP reputation + fraud scoring — blocks spam signups, VPN abuse, disposable email.",
    areas: [
      "Trade + homeowner signup fraud check",
      "Quote request spam filter"
    ],
    providerConsoleUrl: "https://www.ipqualityscore.com/user/dashboard",
    getKeyUrl:          "https://www.ipqualityscore.com/user/settings",
    docsUrl:            "https://www.ipqualityscore.com/documentation/overview",
    requirement:        "optional",
    fallbackBehaviour:  "No fraud scoring — bad actors may register (rely on rate limiting).",
    category:           "external-apis"
  },
  {
    envName:            "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    provider:           "Cloudflare Turnstile",
    purpose:            "Cloudflare's Captcha-free bot check on public forms (contact, quote, signup).",
    areas: [
      "Contact forms",
      "Quote request forms",
      "Signup forms"
    ],
    providerConsoleUrl: "https://dash.cloudflare.com/",
    getKeyUrl:          "https://dash.cloudflare.com/?to=/:account/turnstile",
    docsUrl:            "https://developers.cloudflare.com/turnstile/",
    requirement:        "optional",
    fallbackBehaviour:  "No bot check on public forms — expect spam.",
    category:           "external-apis"
  },

  // ─── OAuth · social login + publishing ───────────────────────────
  {
    envName:            "LINKEDIN_CLIENT_ID",
    provider:           "LinkedIn",
    purpose:            "LinkedIn OAuth + LinkedIn Share API — merchant can cross-post canteen updates.",
    areas: ["Merchant social publishing (LinkedIn)", "LinkedIn OAuth login"],
    providerConsoleUrl: "https://www.linkedin.com/developers/apps",
    getKeyUrl:          "https://www.linkedin.com/developers/apps",
    requirement:        "optional",
    fallbackBehaviour:  "LinkedIn cross-posting unavailable.",
    category:           "oauth-social"
  },
  {
    envName:            "LINKEDIN_CLIENT_SECRET",
    provider:           "LinkedIn",
    purpose:            "Companion secret for LINKEDIN_CLIENT_ID.",
    areas: ["Same as LINKEDIN_CLIENT_ID"],
    providerConsoleUrl: "https://www.linkedin.com/developers/apps",
    getKeyUrl:          "https://www.linkedin.com/developers/apps",
    requirement:        "optional",
    fallbackBehaviour:  "LinkedIn cross-posting unavailable.",
    category:           "oauth-social"
  },
  {
    envName:            "YOUTUBE_CLIENT_ID",
    provider:           "Google / YouTube",
    purpose:            "YouTube Data API OAuth — merchant links YouTube channel to Networkers TV.",
    areas: ["Networkers TV — YouTube channel import"],
    providerConsoleUrl: "https://console.cloud.google.com/",
    getKeyUrl:          "https://console.cloud.google.com/apis/credentials",
    requirement:        "optional",
    fallbackBehaviour:  "YouTube channel linking unavailable.",
    category:           "oauth-social"
  },
  {
    envName:            "YOUTUBE_CLIENT_SECRET",
    provider:           "Google / YouTube",
    purpose:            "Companion secret for YOUTUBE_CLIENT_ID.",
    areas: ["Same as YOUTUBE_CLIENT_ID"],
    providerConsoleUrl: "https://console.cloud.google.com/",
    getKeyUrl:          "https://console.cloud.google.com/apis/credentials",
    requirement:        "optional",
    fallbackBehaviour:  "YouTube channel linking unavailable.",
    category:           "oauth-social"
  },
  {
    envName:            "TIKTOK_CLIENT_KEY",
    provider:           "TikTok",
    purpose:            "TikTok Developer client key — future TikTok video import into Networkers TV.",
    areas: ["Networkers TV — TikTok import (planned)"],
    providerConsoleUrl: "https://developers.tiktok.com/",
    getKeyUrl:          "https://developers.tiktok.com/apps",
    requirement:        "optional",
    fallbackBehaviour:  "TikTok integration unavailable.",
    category:           "oauth-social"
  },
  {
    envName:            "TIKTOK_CLIENT_SECRET",
    provider:           "TikTok",
    purpose:            "Companion secret for TIKTOK_CLIENT_KEY.",
    areas: ["Same as TIKTOK_CLIENT_KEY"],
    providerConsoleUrl: "https://developers.tiktok.com/",
    getKeyUrl:          "https://developers.tiktok.com/apps",
    requirement:        "optional",
    fallbackBehaviour:  "TikTok integration unavailable.",
    category:           "oauth-social"
  },
  {
    envName:            "X_CLIENT_ID",
    provider:           "X (Twitter)",
    purpose:            "X API OAuth — merchant cross-posts canteen updates to X.",
    areas: ["Merchant social publishing (X)"],
    providerConsoleUrl: "https://developer.x.com/",
    getKeyUrl:          "https://developer.x.com/en/portal/dashboard",
    requirement:        "optional",
    fallbackBehaviour:  "X cross-posting unavailable.",
    category:           "oauth-social"
  },
  {
    envName:            "X_CLIENT_SECRET",
    provider:           "X (Twitter)",
    purpose:            "Companion secret for X_CLIENT_ID.",
    areas: ["Same as X_CLIENT_ID"],
    providerConsoleUrl: "https://developer.x.com/",
    getKeyUrl:          "https://developer.x.com/en/portal/dashboard",
    requirement:        "optional",
    fallbackBehaviour:  "X cross-posting unavailable.",
    category:           "oauth-social"
  },

  // ─── Hosting + deploy ────────────────────────────────────────────
  {
    envName:            "VERCEL_API_TOKEN",
    provider:           "Vercel",
    purpose:            "Vercel deploy hook + Edge Config writes — automated deploy triggers, feature-flag toggles.",
    areas: [
      "Admin-triggered deploys",
      "Feature-flag control panel"
    ],
    providerConsoleUrl: "https://vercel.com/dashboard",
    getKeyUrl:          "https://vercel.com/account/tokens",
    requirement:        "optional",
    fallbackBehaviour:  "Admin deploy button disabled; use Vercel dashboard directly.",
    category:           "hosting"
  },

  // ─── Push notifications ──────────────────────────────────────────
  {
    envName:            "XRATED_VAPID_PRIVATE_KEY",
    provider:           "Self-generated (Web Push VAPID)",
    purpose:            "VAPID private key — signs web push notification payloads for the browser Push API.",
    areas: [
      "PWA push notifications (quote replies, booking updates, Yard mentions)"
    ],
    providerConsoleUrl: "https://web-push-codelab.glitch.me/",
    getKeyUrl:          "https://vapidkeys.com/",
    docsUrl:            "https://developer.mozilla.org/en-US/docs/Web/API/Push_API",
    requirement:        "optional",
    fallbackBehaviour:  "Web push notifications disabled — users only see in-app + email.",
    category:           "push",
    notes:              "Generate once with `npx web-push generate-vapid-keys`. Never rotate without re-subscribing all users."
  },
  {
    envName:            "NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY",
    provider:           "Self-generated (Web Push VAPID)",
    purpose:            "Public half of the VAPID keypair — shipped to the browser to subscribe to push.",
    areas: ["Same as XRATED_VAPID_PRIVATE_KEY"],
    providerConsoleUrl: "https://vapidkeys.com/",
    getKeyUrl:          "https://vapidkeys.com/",
    requirement:        "optional",
    fallbackBehaviour:  "Push subscription fails silently.",
    category:           "push"
  },

  // ─── Internal secrets (not third-party — self-managed) ───────────
  {
    envName:            "ADMIN_PASSWORD",
    provider:           "Self-managed",
    purpose:            "Shared admin password for /admin/login (Phase 0 auth). Will be superseded by per-admin login in Phase 1.2.",
    areas: ["/admin/login — shared password gate"],
    providerConsoleUrl: "",
    getKeyUrl:          "",
    requirement:        "required",
    fallbackBehaviour:  "Admin login impossible.",
    category:           "internal-secrets",
    notes:              "Rotate quarterly. Use a passphrase manager, not env var edits in prod."
  },
  {
    envName:            "ADMIN_COOKIE_SECRET",
    provider:           "Self-managed",
    purpose:            "HMAC secret that signs the admin session cookie so it can't be forged.",
    areas: ["/admin/* — every admin route"],
    providerConsoleUrl: "",
    getKeyUrl:          "",
    requirement:        "required",
    fallbackBehaviour:  "Admin session cookies invalidated on every request.",
    category:           "internal-secrets"
  },
  {
    envName:            "HMAC_SECRET",
    provider:           "Self-managed",
    purpose:            "General-purpose HMAC signing secret for merchant session cookies (tn_network_merchant_sid).",
    areas: ["Merchant login sessions across all routes"],
    providerConsoleUrl: "",
    getKeyUrl:          "",
    requirement:        "required",
    fallbackBehaviour:  "Every merchant is silently logged out.",
    category:           "internal-secrets"
  },
  {
    envName:            "HOMEOWNER_COOKIE_SECRET",
    provider:           "Self-managed",
    purpose:            "HMAC secret for the SiteBook homeowner session cookie (tn_homeowner_sid).",
    areas: ["SiteBook — /sitebook + /homeowners routes"],
    providerConsoleUrl: "",
    getKeyUrl:          "",
    requirement:        "required",
    fallbackBehaviour:  "Homeowners logged out; SiteBook inaccessible.",
    category:           "internal-secrets"
  },
  {
    envName:            "CRON_SECRET",
    provider:           "Self-managed",
    purpose:            "Bearer token every cron endpoint checks (Authorization: Bearer $CRON_SECRET) — prevents random calls to /api/cron/*.",
    areas: ["All 17 Vercel crons under /api/cron/*"],
    providerConsoleUrl: "",
    getKeyUrl:          "",
    requirement:        "required",
    fallbackBehaviour:  "All cron jobs fail with 401 — no washer replenishment, no drip emails, no cleanup.",
    category:           "internal-secrets"
  },
  {
    envName:            "PAYMENTS_ENCRYPTION_KEY",
    provider:           "Self-managed",
    purpose:            "AES key that encrypts stored payment metadata (tokenised card refs, connect account IDs) at rest.",
    areas: ["Stripe Connect merchant records", "Stored payment metadata"],
    providerConsoleUrl: "",
    getKeyUrl:          "",
    requirement:        "required",
    fallbackBehaviour:  "Payment operations that require stored refs fail decryption.",
    category:           "internal-secrets",
    notes:              "Never rotate without a migration to re-encrypt existing rows."
  },
  {
    envName:            "TRADE_OTP_SECRET",
    provider:           "Self-managed",
    purpose:            "HMAC secret for trade login OTP tokens (WhatsApp / SMS codes).",
    areas: ["Trade login flow"],
    providerConsoleUrl: "",
    getKeyUrl:          "",
    requirement:        "required",
    fallbackBehaviour:  "Trade OTP validation always fails.",
    category:           "internal-secrets"
  },
  {
    envName:            "INBOX_TOKEN_SECRET",
    provider:           "Self-managed",
    purpose:            "HMAC secret for inbox reply-link tokens (email replies land back in the app with valid signed token).",
    areas: ["Homeowner/trade email reply threading"],
    providerConsoleUrl: "",
    getKeyUrl:          "",
    requirement:        "optional",
    fallbackBehaviour:  "Email reply threading falls back to plain link routing.",
    category:           "internal-secrets"
  }
];

/** Group registry entries by category (used by the /admin/api-keys page). */
export function groupByCategory(): Record<KeyCategory, ApiKeyEntry[]> {
  const groups = {} as Record<KeyCategory, ApiKeyEntry[]>;
  for (const entry of API_KEY_REGISTRY) {
    if (!groups[entry.category]) groups[entry.category] = [];
    groups[entry.category].push(entry);
  }
  return groups;
}

export const CATEGORY_LABELS: Record<KeyCategory, string> = {
  "ai":                "AI · language + speech",
  "database":          "Database · Supabase",
  "payments":          "Payments · Stripe + PayPal + Wise",
  "comms":             "Communications · email + SMS + WhatsApp",
  "external-apis":     "External APIs · gov + Google + anti-fraud",
  "oauth-social":      "OAuth · social login + publishing",
  "hosting":           "Hosting · Vercel",
  "push":              "Push notifications · Web Push",
  "internal-secrets":  "Internal secrets · self-managed"
};

export const CATEGORY_ORDER: KeyCategory[] = [
  "ai",
  "database",
  "payments",
  "comms",
  "external-apis",
  "oauth-social",
  "hosting",
  "push",
  "internal-secrets"
];
