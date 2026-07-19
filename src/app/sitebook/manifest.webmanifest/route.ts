// /sitebook/manifest.webmanifest — PWA manifest for the homeowner
// SiteBook. Installable to iPhone / Android home screens with a
// distinct brand identity from the merchant PWA.
//
// Scope is `/sitebook/` so it only takes over the homeowner area
// once installed — merchant surfaces continue using their own PWA.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  const manifest = {
    name:        "SiteBook — Your Home Projects",
    short_name:  "SiteBook",
    description: "Track every project, invite trades, save every warranty. Your house's memory, forever.",
    id:          "/sitebook/",
    scope:       "/sitebook/",
    start_url:   "/sitebook",
    display:     "standalone",
    orientation: "portrait",
    theme_color: "#FFB300",
    background_color: "#FBF6EC",
    icons: [
      {
        src:   "/favicon-192.png",
        sizes: "192x192",
        type:  "image/png",
        purpose: "any"
      },
      {
        src:   "/favicon-512.png",
        sizes: "512x512",
        type:  "image/png",
        purpose: "any"
      },
      {
        src:   "/favicon-512.png",
        sizes: "512x512",
        type:  "image/png",
        purpose: "maskable"
      }
    ],
    shortcuts: [
      {
        name:      "New project",
        short_name:"New",
        url:       "/sitebook/new",
        icons:     [{ src: "/favicon-192.png", sizes: "192x192" }]
      },
      {
        name:      "Export",
        short_name:"Export",
        url:       "/sitebook/export",
        icons:     [{ src: "/favicon-192.png", sizes: "192x192" }]
      }
    ],
    categories: ["productivity", "lifestyle", "utilities"]
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type":  "application/manifest+json",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
