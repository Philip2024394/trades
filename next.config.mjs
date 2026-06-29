import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: { root: __dirname },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "msdonkkechxzgagyguoe.supabase.co" }
    ]
  },
  // URL clean-up — public profile URLs read xratedtrade.com/<slug>
  // instead of xratedtrade.com/trade/<slug>. We don't move the route
  // files; we let Next.js's filesystem routing keep first-match priority
  // for system pages (/pricing, /signup, /admin etc.) and then use
  // afterFiles rewrites to internally serve single-segment paths from
  // the /trade/<slug>/* handlers. URL bar stays clean for the visitor.
  //
  // Routes guarded by the reserved-slug list in lib/tradeOff.ts — no
  // tradesperson can register a slug that collides with a future
  // system route.
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        { source: "/:slug", destination: "/trade/:slug" },
        { source: "/:slug/contact", destination: "/trade/:slug/contact" },
        { source: "/:slug/services", destination: "/trade/:slug/services" },
        { source: "/:slug/review", destination: "/trade/:slug/review" },
        { source: "/:slug/qr.png", destination: "/trade/:slug/qr.png" },
        { source: "/:slug/card.png", destination: "/trade/:slug/card.png" },
        { source: "/:slug/trusted-trades", destination: "/trade/:slug/trusted-trades" },
        { source: "/:slug/services-prices", destination: "/trade/:slug/services-prices" },
        { source: "/:slug/downloads", destination: "/trade/:slug/downloads" },
        { source: "/:slug/job-diary", destination: "/trade/:slug/job-diary" },
        { source: "/:slug/job-diary/:projectId", destination: "/trade/:slug/job-diary/:projectId" },
        { source: "/:slug/job-diary/:projectId/request-removal", destination: "/trade/:slug/job-diary/:projectId/request-removal" },
        { source: "/:slug/cart", destination: "/trade/:slug/cart" },
        { source: "/:slug/materials", destination: "/trade/:slug/materials" },
        { source: "/:slug/materials/:merchantSlug", destination: "/trade/:slug/materials/:merchantSlug" },
        { source: "/:slug/shop", destination: "/trade/:slug/shop" },
        { source: "/:slug/shop/:productSlug", destination: "/trade/:slug/shop/:productSlug" },
        { source: "/:slug/faq", destination: "/trade/:slug/faq" },
        // Trade Center Picks — list page + dedicated per-pick detail page.
        // Both serve out of /trade/<slug>/... handlers but the URL bar
        // stays on the clean /<slug>/... vanity form.
        { source: "/:slug/trade-center-picks", destination: "/trade/:slug/trade-center-picks" },
        { source: "/:slug/picks/:pickId", destination: "/trade/:slug/picks/:pickId" }
      ],
      fallback: []
    };
  },
  // Old /trade/<slug>/* URLs (van vinyls, shared business cards) keep
  // working but get permanently bounced to the clean form so Google
  // consolidates SEO authority on the new path.
  async redirects() {
    return [
      { source: "/trade/:slug", destination: "/:slug", permanent: true },
      { source: "/trade/:slug/contact", destination: "/:slug/contact", permanent: true },
      { source: "/trade/:slug/services", destination: "/:slug/services", permanent: true },
      { source: "/trade/:slug/review", destination: "/:slug/review", permanent: true },
      { source: "/trade/:slug/qr.png", destination: "/:slug/qr.png", permanent: true },
      { source: "/trade/:slug/card.png", destination: "/:slug/card.png", permanent: true },
      { source: "/trade/:slug/trusted-trades", destination: "/:slug/trusted-trades", permanent: true },
      { source: "/trade/:slug/services-prices", destination: "/:slug/services-prices", permanent: true },
      { source: "/trade/:slug/downloads", destination: "/:slug/downloads", permanent: true },
      { source: "/trade/:slug/job-diary", destination: "/:slug/job-diary", permanent: true },
      { source: "/trade/:slug/job-diary/:projectId", destination: "/:slug/job-diary/:projectId", permanent: true },
      { source: "/trade/:slug/job-diary/:projectId/request-removal", destination: "/:slug/job-diary/:projectId/request-removal", permanent: true },
      { source: "/trade/:slug/cart", destination: "/:slug/cart", permanent: true },
      { source: "/trade/:slug/materials", destination: "/:slug/materials", permanent: true },
      { source: "/trade/:slug/materials/:merchantSlug", destination: "/:slug/materials/:merchantSlug", permanent: true },
      { source: "/trade/:slug/shop", destination: "/:slug/shop", permanent: true },
      { source: "/trade/:slug/shop/:productSlug", destination: "/:slug/shop/:productSlug", permanent: true },
      { source: "/trade/:slug/faq", destination: "/:slug/faq", permanent: true },
      // Bounce old /trade/* trade-center-picks + per-pick detail URLs to
      // the clean form so Google consolidates SEO authority.
      { source: "/trade/:slug/trade-center-picks", destination: "/:slug/trade-center-picks", permanent: true },
      { source: "/trade/:slug/picks/:pickId", destination: "/:slug/picks/:pickId", permanent: true }
    ];
  }
};

export default nextConfig;
