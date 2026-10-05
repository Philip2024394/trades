// src/app/nex-native/dev/theme-world-shadow/page.tsx
//
// Phase 0 shadow route · founder-approved 2026-10-05, baseline 7fd561b7.
//
// Side-by-side comparator for the wallpaper zone + overlays. Left half
// renders a hard-coded copy of the shell's wallpaper block (shell lines
// 798-847) · right half renders the <ThemeWorld> primitive from
// chat-render/theme-world.tsx. Both halves receive identical props.
//
// If the two halves render byte-equivalently, Phase 3 can swap the
// shell's inline block for an import from the primitive. Phase 0
// acceptance = Playwright screenshot diff ≤ 0.5% across the matrix of
// themes and overlay configs defined in SHADOW_MATRIX below.
//
// DEV ONLY · gated by NODE_ENV !== "production" (always true under
// `next dev`), with NEX_DEV_ROUTES=1 as an explicit prod-override for
// preview deployments. Returns notFound() otherwise so a prod bundle
// never exposes the comparator. Noindex meta kept belt-and-braces.

import { notFound } from "next/navigation";
import * as React from "react";
import {
  ThemeWorld,
  ParticleDrift,
  SparkleField,
  MistDrift,
  type WallpaperConfig,
} from "@/lib/nex-native/chat-render/theme-world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ShadowCase {
  id: string;
  label: string;
  wallpaperUrl: string;
  config: WallpaperConfig;
}

// 1×1 solid-colour PNG as a data URI · reliable across every environment,
// no public/-dir dependency, no network fetch, and `backgroundSize: cover`
// makes the single pixel fill the whole 390×720 stage uniformly. The hue
// is incidental to the equivalence proof · what matters is that BOTH sides
// receive the same URL so the wallpaper + scrim layers paint identically.
const WALLPAPER_PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO8rPr0PwAG5wLU/EMB7gAAAABJRU5ErkJggg==";

// Production wallpaper_config shapes pulled straight from the live
// migrations so we don't drift from the deployed catalogue:
//   · vitamins   migration 137 · outlined + particleDrift + sparkle
//   · motorbike  migration 136 · outlined + particleDrift + sparkle
// If the catalogue adds a new combination of overlays, append a row.

const SHADOW_MATRIX: ShadowCase[] = [
  {
    id: "no-overlay",
    label: "wallpaper + scrim only",
    wallpaperUrl: WALLPAPER_PX,
    config: {},
  },
  {
    id: "sparkle-only",
    label: "sparkle overlay",
    wallpaperUrl: WALLPAPER_PX,
    config: {
      sparkle: { color: "#FFEDAA", count: 24, size: 3, twinkleSeconds: 3 },
    },
  },
  {
    id: "particles-only",
    label: "particleDrift overlay",
    wallpaperUrl: WALLPAPER_PX,
    config: {
      particleDrift: {
        color: "#F8C8DC",
        count: 16,
        size: 4,
        speedSeconds: 14,
      },
    },
  },
  {
    id: "mist-only",
    label: "mistDrift overlay",
    wallpaperUrl: WALLPAPER_PX,
    config: {
      mistDrift: {
        color: "rgba(220,235,225,0.45)",
        count: 8,
        size: 160,
        blur: 44,
        speedSeconds: 22,
      },
    },
  },
  {
    id: "sparkle-and-mist",
    label: "sparkle + mist combined",
    wallpaperUrl: WALLPAPER_PX,
    config: {
      sparkle: { color: "#D4F1FF", count: 32, size: 2, twinkleSeconds: 2.5 },
      mistDrift: {
        color: "rgba(90,110,140,0.5)",
        count: 10,
        size: 200,
        speedSeconds: 26,
      },
    },
  },
  {
    id: "production-vitamins",
    label: "production · vitamins (migration 137) · outlined + drift + sparkle",
    wallpaperUrl: WALLPAPER_PX,
    config: {
      bubbleStyle: { preset: "outlined" },
      particleDrift: {
        color: "rgba(255,170,80,0.52)",
        count: 18,
        size: 4,
        speedSeconds: 14,
      },
      sparkle: {
        color: "rgba(255,230,160,0.85)",
        count: 26,
        size: 2,
        twinkleSeconds: 2.5,
      },
    },
  },
  {
    id: "production-motorbike",
    label:
      "production · motorbike rental (migration 136) · outlined + drift + sparkle",
    wallpaperUrl: WALLPAPER_PX,
    config: {
      bubbleStyle: { preset: "outlined" },
      particleDrift: {
        color: "rgba(180,200,220,0.42)",
        count: 14,
        size: 3,
        speedSeconds: 20,
      },
      sparkle: {
        color: "rgba(220,235,255,0.75)",
        count: 20,
        size: 2,
        twinkleSeconds: 3,
      },
    },
  },
  {
    id: "all-three-overlays",
    label: "stress · particles + sparkle + mist together",
    wallpaperUrl: WALLPAPER_PX,
    config: {
      particleDrift: {
        color: "#F8C8DC",
        count: 20,
        size: 4,
        speedSeconds: 12,
      },
      sparkle: {
        color: "#D4F1FF",
        count: 40,
        size: 3,
        twinkleSeconds: 2.5,
      },
      mistDrift: {
        color: "rgba(90,110,140,0.5)",
        count: 12,
        size: 180,
        speedSeconds: 24,
      },
    },
  },
];

export default async function ThemeWorldShadowPage(): Promise<React.JSX.Element> {
  const isDev = process.env.NODE_ENV !== "production";
  const prodOverride = process.env.NEX_DEV_ROUTES === "1";
  if (!isDev && !prodOverride) {
    notFound();
  }

  return (
    <>
      <style>{`
        html, body { background: #020914 !important; color: #F4F7FC; }
        body { font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
      `}</style>
      <meta name="robots" content="noindex, nofollow" />
      <main
        style={{
          padding: "24px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700 }}>
          ThemeWorld shadow comparator
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 13,
            lineHeight: 1.55,
            color: "#8BA9D1",
            maxWidth: 820,
          }}
        >
          Each row renders the <strong>same</strong> wallpaper config twice:
          left = inline block copied from <code>_portrait-bloom-shell.tsx</code>{" "}
          (lines 798–847), right = <code>&lt;ThemeWorld&gt;</code>. Playwright
          captures both halves and asserts visual equivalence (≤ 0.5% diff).
          Dev-only route · gated by <code>NEX_DEV_ROUTES=1</code>.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {SHADOW_MATRIX.map((c) => (
            <ShadowRow key={c.id} shadowCase={c} />
          ))}
        </div>
      </main>
    </>
  );
}

function ShadowRow({
  shadowCase,
}: {
  shadowCase: ShadowCase;
}): React.JSX.Element {
  return (
    <section
      data-nex-shadow-case={shadowCase.id}
      style={{
        border: "1px solid rgba(139,169,209,0.18)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h2
        style={{
          margin: "0 0 12px",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#8BA9D1",
        }}
      >
        {shadowCase.id} · {shadowCase.label}
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {/* ─── LEFT · inline shell replica ─── */}
        <div data-nex-shadow-side="shell">
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#8BA9D1",
              marginBottom: 6,
            }}
          >
            Shell (inline)
          </div>
          <div
            data-nex-shadow-stage="shell"
            style={{
              position: "relative",
              width: 390,
              height: 720,
              overflow: "hidden",
              borderRadius: 10,
              background: "#020914",
              // transform establishes a new containing block so any
              // position:fixed descendant (MistDrift) resolves to this
              // stage, not the viewport · without this, left + right
              // stages capture different horizontal slices of a single
              // viewport-wide mist layer and byte-equivalence fails.
              transform: "translateZ(0)",
            }}
          >
            <ShellWallpaperZone
              wallpaperUrl={shadowCase.wallpaperUrl}
              wallpaperConfig={shadowCase.config}
            />
          </div>
        </div>

        {/* ─── RIGHT · ThemeWorld primitive ─── */}
        <div data-nex-shadow-side="theme-world">
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#8BA9D1",
              marginBottom: 6,
            }}
          >
            ThemeWorld
          </div>
          <div
            data-nex-shadow-stage="theme-world"
            style={{
              position: "relative",
              width: 390,
              height: 720,
              overflow: "hidden",
              borderRadius: 10,
              background: "#020914",
              transform: "translateZ(0)",
            }}
          >
            <ThemeWorld
              wallpaperUrl={shadowCase.wallpaperUrl}
              wallpaperConfig={shadowCase.config}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// Hard-coded replica of shell lines 798-847. Any update to the shell's
// wallpaper block must be mirrored here · Phase 3 replaces this with a
// <ThemeWorld /> import once equivalence is proven.
function ShellWallpaperZone({
  wallpaperUrl,
  wallpaperConfig,
}: {
  wallpaperUrl: string;
  wallpaperConfig: WallpaperConfig;
}): React.JSX.Element {
  return (
    <>
      <div
        aria-hidden
        data-nex-shell-replica="wallpaper"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${wallpaperUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          filter: "saturate(1.05)",
          zIndex: 0,
        }}
      />
      <div
        aria-hidden
        data-nex-shell-replica="scrim"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(2,9,20,0.08) 0%, rgba(2,9,20,0.14) 40%, rgba(2,9,20,0.32) 70%, rgba(2,9,20,0.6) 95%, rgba(2,9,20,0.78) 100%)",
          zIndex: 0,
        }}
      />
      {wallpaperConfig?.particleDrift && (
        <ParticleDrift config={wallpaperConfig.particleDrift} />
      )}
      {wallpaperConfig?.sparkle && (
        <SparkleField config={wallpaperConfig.sparkle} />
      )}
      {wallpaperConfig?.mistDrift && (
        <MistDrift config={wallpaperConfig.mistDrift} />
      )}
    </>
  );
}
