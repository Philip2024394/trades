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
        { source: "/:slug/trusted-trades", destination: "/trade/:slug/trusted-trades" },
        { source: "/:slug/services-prices", destination: "/trade/:slug/services-prices" },
        { source: "/:slug/cart", destination: "/trade/:slug/cart" }
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
      { source: "/trade/:slug/trusted-trades", destination: "/:slug/trusted-trades", permanent: true },
      { source: "/trade/:slug/services-prices", destination: "/:slug/services-prices", permanent: true },
      { source: "/trade/:slug/cart", destination: "/:slug/cart", permanent: true }
    ];
  }
};

export default nextConfig;
