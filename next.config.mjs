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
        { source: "/:slug/cart/success", destination: "/trade/:slug/cart/success" },
        { source: "/:slug/materials", destination: "/trade/:slug/materials" },
        { source: "/:slug/materials/:merchantSlug", destination: "/trade/:slug/materials/:merchantSlug" },
        { source: "/:slug/shop", destination: "/trade/:slug/shop" },
        { source: "/:slug/shop/:productSlug", destination: "/trade/:slug/shop/:productSlug" },
        { source: "/:slug/faq", destination: "/trade/:slug/faq" },
        { source: "/:slug/key-cutting", destination: "/trade/:slug/key-cutting" },
        { source: "/:slug/key-cutting/postal-form", destination: "/trade/:slug/key-cutting/postal-form" },
        { source: "/:slug/plant-hire", destination: "/trade/:slug/plant-hire" },
        { source: "/:slug/plant-hire/delivery-zones", destination: "/trade/:slug/plant-hire/delivery-zones" },
        { source: "/:slug/plant-hire/machines", destination: "/trade/:slug/plant-hire/machines" },
        { source: "/:slug/plant-hire/machines/:category", destination: "/trade/:slug/plant-hire/machines/:category" },
        { source: "/:slug/plant-hire/breakdown", destination: "/trade/:slug/plant-hire/breakdown" },
        { source: "/:slug/plant-hire/haulage", destination: "/trade/:slug/plant-hire/haulage" },
        { source: "/:slug/plant-hire/finder", destination: "/trade/:slug/plant-hire/finder" },
        { source: "/:slug/plant-hire/compare", destination: "/trade/:slug/plant-hire/compare" },
        { source: "/:slug/plant-hire/book", destination: "/trade/:slug/plant-hire/book" },
        { source: "/:slug/plant-hire/cart", destination: "/trade/:slug/plant-hire/cart" },
        { source: "/:slug/plant-hire/delivery-report", destination: "/trade/:slug/plant-hire/delivery-report" },
        { source: "/:slug/plant-hire/damage-report", destination: "/trade/:slug/plant-hire/damage-report" },
        { source: "/:slug/plant-hire/my-hires", destination: "/trade/:slug/plant-hire/my-hires" },
        { source: "/:slug/plant-hire/extend", destination: "/trade/:slug/plant-hire/extend" },
        { source: "/:slug/plant-hire/careers", destination: "/trade/:slug/plant-hire/careers" },
        { source: "/:slug/plant-hire/trade-accounts", destination: "/trade/:slug/plant-hire/trade-accounts" },
        { source: "/:slug/plant-hire/parts", destination: "/trade/:slug/plant-hire/parts" },
        { source: "/:slug/plant-hire/compliance", destination: "/trade/:slug/plant-hire/compliance" },
        { source: "/:slug/plant-hire/credentials", destination: "/trade/:slug/plant-hire/credentials" },
        { source: "/:slug/plant-hire/video", destination: "/trade/:slug/plant-hire/video" },
        { source: "/:slug/plant-hire/calculator", destination: "/trade/:slug/plant-hire/calculator" },
        { source: "/:slug/plant-hire/pay", destination: "/trade/:slug/plant-hire/pay" },
        { source: "/:slug/plant-hire/pay/success", destination: "/trade/:slug/plant-hire/pay/success" },
        { source: "/:slug/plant-hire/pay/cancel", destination: "/trade/:slug/plant-hire/pay/cancel" },
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
      { source: "/trade/:slug/cart/success", destination: "/:slug/cart/success", permanent: true },
      { source: "/trade/:slug/materials", destination: "/:slug/materials", permanent: true },
      { source: "/trade/:slug/materials/:merchantSlug", destination: "/:slug/materials/:merchantSlug", permanent: true },
      { source: "/trade/:slug/shop", destination: "/:slug/shop", permanent: true },
      { source: "/trade/:slug/shop/:productSlug", destination: "/:slug/shop/:productSlug", permanent: true },
      { source: "/trade/:slug/faq", destination: "/:slug/faq", permanent: true },
      { source: "/trade/:slug/key-cutting", destination: "/:slug/key-cutting", permanent: true },
      { source: "/trade/:slug/key-cutting/postal-form", destination: "/:slug/key-cutting/postal-form", permanent: true },
      { source: "/trade/:slug/plant-hire", destination: "/:slug/plant-hire", permanent: true },
      { source: "/trade/:slug/plant-hire/delivery-zones", destination: "/:slug/plant-hire/delivery-zones", permanent: true },
      { source: "/trade/:slug/plant-hire/machines", destination: "/:slug/plant-hire/machines", permanent: true },
      { source: "/trade/:slug/plant-hire/machines/:category", destination: "/:slug/plant-hire/machines/:category", permanent: true },
      { source: "/trade/:slug/plant-hire/breakdown", destination: "/:slug/plant-hire/breakdown", permanent: true },
      { source: "/trade/:slug/plant-hire/haulage", destination: "/:slug/plant-hire/haulage", permanent: true },
      { source: "/trade/:slug/plant-hire/finder", destination: "/:slug/plant-hire/finder", permanent: true },
      { source: "/trade/:slug/plant-hire/compare", destination: "/:slug/plant-hire/compare", permanent: true },
      { source: "/trade/:slug/plant-hire/book", destination: "/:slug/plant-hire/book", permanent: true },
      { source: "/trade/:slug/plant-hire/cart", destination: "/:slug/plant-hire/cart", permanent: true },
      { source: "/trade/:slug/plant-hire/delivery-report", destination: "/:slug/plant-hire/delivery-report", permanent: true },
      { source: "/trade/:slug/plant-hire/damage-report", destination: "/:slug/plant-hire/damage-report", permanent: true },
      { source: "/trade/:slug/plant-hire/my-hires", destination: "/:slug/plant-hire/my-hires", permanent: true },
      { source: "/trade/:slug/plant-hire/extend", destination: "/:slug/plant-hire/extend", permanent: true },
      { source: "/trade/:slug/plant-hire/careers", destination: "/:slug/plant-hire/careers", permanent: true },
      { source: "/trade/:slug/plant-hire/trade-accounts", destination: "/:slug/plant-hire/trade-accounts", permanent: true },
      { source: "/trade/:slug/plant-hire/parts", destination: "/:slug/plant-hire/parts", permanent: true },
      { source: "/trade/:slug/plant-hire/compliance", destination: "/:slug/plant-hire/compliance", permanent: true },
      { source: "/trade/:slug/plant-hire/credentials", destination: "/:slug/plant-hire/credentials", permanent: true },
      { source: "/trade/:slug/plant-hire/video", destination: "/:slug/plant-hire/video", permanent: true },
      { source: "/trade/:slug/plant-hire/calculator", destination: "/:slug/plant-hire/calculator", permanent: true },
      { source: "/trade/:slug/plant-hire/pay", destination: "/:slug/plant-hire/pay", permanent: true },
      { source: "/trade/:slug/plant-hire/pay/success", destination: "/:slug/plant-hire/pay/success", permanent: true },
      { source: "/trade/:slug/plant-hire/pay/cancel", destination: "/:slug/plant-hire/pay/cancel", permanent: true },
      // Bounce old /trade/* trade-center-picks + per-pick detail URLs to
      // the clean form so Google consolidates SEO authority.
      { source: "/trade/:slug/trade-center-picks", destination: "/:slug/trade-center-picks", permanent: true },
      { source: "/trade/:slug/picks/:pickId", destination: "/:slug/picks/:pickId", permanent: true }
    ];
  }
};

export default nextConfig;
