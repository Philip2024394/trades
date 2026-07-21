// Root fallback Open Graph image — 1200×630, generated on the edge
// via Next.js ImageResponse. Every page that doesn't ship its own
// opengraph-image.tsx falls back to THIS. Was previously a square
// logo (poor share preview quality); this replaces it with a proper
// landscape share card featuring the brand mark and tagline.
//
// Docs: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt     = "Thenetworkers — of the construction trades";
export const size    = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height:         "100%",
          width:          "100%",
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "flex-start",
          justifyContent: "center",
          padding:        "80px",
          background:     "linear-gradient(135deg, #0A0A0A 0%, #1a1a1a 55%, #2a2a2a 100%)",
          color:          "#FFFFFF",
          fontFamily:     "system-ui, -apple-system, Roboto, sans-serif"
        }}
      >
        {/* Yellow dot brand mark */}
        <div
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          16,
            marginBottom: 28
          }}
        >
          <div
            style={{
              width:        20,
              height:       20,
              borderRadius: 999,
              background:   "#FFB300",
              boxShadow:    "0 4px 20px rgba(255,179,0,0.55)"
            }}
          />
          <span
            style={{
              fontSize:      22,
              fontWeight:    800,
              letterSpacing: "0.14em",
              textTransform: "uppercase"
            }}
          >
            thenetworkers.app
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize:      92,
            fontWeight:    900,
            lineHeight:    1.02,
            letterSpacing: "-0.02em",
            marginBottom:  20
          }}
        >
          The Networkers.
        </div>

        <div
          style={{
            fontSize:      54,
            fontWeight:    800,
            lineHeight:    1.05,
            color:         "#FFB300",
            marginBottom:  32
          }}
        >
          Of the construction trades.
        </div>

        {/* Sub */}
        <div
          style={{
            fontSize:   26,
            fontWeight: 500,
            color:      "rgba(255,255,255,0.86)",
            maxWidth:   940,
            lineHeight: 1.35
          }}
        >
          Free-for-life business app. Canteen · Yard · Trade Center · Notebook.
          No card. No commission. Ever.
        </div>
      </div>
    ),
    size
  );
}
