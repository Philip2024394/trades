// src/app/nex-native/themes/gallery/page.tsx
//
// Public theme gallery · one URL, every active theme at a glance.
// -------------------------------------------------------------------
// Founder-set 2026-09-29 (Bridge 97). Not the same as the picker at
// /nex-native/chat-themes-library (which needs sign-in + writes the
// account's chat_theme). This gallery is:
//
//   · Public (no auth)
//   · Server-rendered · no JS · fast
//   · Every active theme rendered as a card showing the wallpaper
//     (or accent-gradient fallback when hero_image_url is null),
//     name, tagline, accent hex swatch, animation kind badge,
//     sort_order (for admin diagnosis), and tier chip
//   · Cards click through to the sealed preview pages when one
//     exists (theme-1, pink-dream, cyber-grid) · otherwise open a
//     detail-lite page with the same rendered card enlarged
//
// This is the surface a designer / stakeholder points at to say
// "show me every theme we currently have."

import Link from "next/link";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Preview page slugs for the small number of themes that have a
// dedicated sealed spec page. Everything else routes through the
// generic gallery detail (nothing exists yet for the 20-theme batch
// so cards for those themes just don't have a click target beyond
// the picker).
const SEALED_PREVIEW_HREF: Record<string, string> = {
  "theme-1": "/nex-native/themes/theme-1",
  "pink-dream": "/nex-native/themes/pink-dream",
  "cyber-grid": "/nex-native/themes/cyber-grid",
};

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  text: "#F2F5F8",
  textDim: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
};

export default async function ThemesGalleryPage() {
  const themes = await chatThemeService.listActiveThemes();

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; margin: 0; }
        [data-nex-gallery-root] * { box-sizing: border-box; }
        [data-nex-gallery-card]:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.55), 0 0 20px rgba(0,175,255,0.18);
        }
      `}</style>
      <main
        data-nex-gallery-root
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "24px 20px 60px",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <header style={{ marginBottom: 26 }}>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              NEX Chat Theme Library
            </h1>
            <p
              style={{
                marginTop: 6,
                color: NEX.textDim,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              Every active theme. {themes.length} total ·{" "}
              {themes.filter((t) => t.hero_image_url).length} with wallpapers ·{" "}
              {themes.filter((t) => !t.hero_image_url).length} awaiting
              wallpaper. Cards link to the sealed preview page when one exists.
            </p>
          </header>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 14,
            }}
          >
            {themes.map((t) => (
              <ThemeCard key={t.id} theme={t} />
            ))}
          </div>

          <footer
            style={{
              marginTop: 40,
              paddingTop: 20,
              borderTop: `1px dashed ${NEX.cyanSoft}`,
              color: NEX.textDim,
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: 0 }}>
              To pick a theme for your own chat, open{" "}
              <Link
                href="/nex-native/chat-themes-library"
                style={{ color: NEX.cyan }}
              >
                /nex-native/chat-themes-library
              </Link>{" "}
              while signed in. To adjust wallpapers or accents for the
              20-theme batch, see{" "}
              <code style={{ fontFamily: "ui-monospace, monospace" }}>
                scripts/nex-themes/THEMES.md
              </code>
              .
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}

function ThemeCard({
  theme,
}: {
  theme: Awaited<
    ReturnType<typeof chatThemeService.listActiveThemes>
  >[number];
}) {
  const wp = theme.hero_image_url;
  const accent = theme.accent_hex;
  const cfg = theme.wallpaper_config;
  const animKind = cfg?.moonGlow
    ? "halo"
    : cfg?.particleDrift
      ? "drift"
      : cfg?.sparkle
        ? "sparkle"
        : null;
  const bubblePreset = cfg?.bubbleStyle?.preset ?? null;
  // Sealed spec pages take priority for the 3 themes that have one
  // (theme-1, pink-dream, cyber-grid). Every other theme routes to
  // the dynamic viewer at /nex-native/themes/[id] · Bridge 97g.
  const previewHref =
    SEALED_PREVIEW_HREF[theme.id] ?? `/nex-native/themes/${theme.id}`;
  const isPremium = theme.category === "premium";
  const isBisnis = theme.tier === "bisnis";

  return (
    <Link
      href={previewHref}
      data-nex-gallery-card
      style={{
        display: "block",
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        background: wp
          ? undefined
          : `linear-gradient(135deg, ${accent}66 0%, ${NEX.panel} 65%)`,
        backgroundImage: wp ? `url(${wp})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        border: `1px solid ${NEX.cyanSoft}`,
        height: 200,
        textDecoration: "none",
        color: NEX.text,
        boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
        transition: "transform 200ms ease, box-shadow 200ms ease",
      }}
    >
      {/* Legibility scrim so the copy reads over any wallpaper */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(0deg, rgba(2,9,20,0.85) 0%, rgba(2,9,20,0.35) 55%, rgba(2,9,20,0.15) 100%)",
        }}
      />

      {/* Badges · top row */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          right: 8,
          display: "flex",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span
            style={{
              display: "inline-block",
              width: 12,
              height: 12,
              borderRadius: 3,
              background: accent,
              boxShadow: `0 0 6px ${accent}88`,
              border: "1px solid rgba(255,255,255,0.35)",
            }}
            aria-label={`Accent ${accent}`}
            title={accent}
          />
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 10,
              color: "rgba(255,255,255,0.9)",
              textShadow: "0 1px 3px rgba(0,0,0,0.6)",
            }}
          >
            {accent}
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {isBisnis && (
            <span style={chipStyle(NEX.orange)}>Bisnis</span>
          )}
          {isPremium && !isBisnis && (
            <span style={chipStyle(NEX.cyan)}>Premium</span>
          )}
          {animKind && (
            <span style={chipStyle("rgba(76,255,122,0.7)")}>{animKind}</span>
          )}
          {bubblePreset && (
            <span style={chipStyle("rgba(180,140,255,0.75)")}>{bubblePreset}</span>
          )}
          {!wp && <span style={chipStyle(NEX.textDim)}>no wallpaper</span>}
        </div>
      </div>

      {/* Bottom copy */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: 10,
          right: 10,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "-0.005em",
            textShadow: "0 1px 4px rgba(0,0,0,0.65)",
          }}
        >
          {theme.name}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 11,
            color: "rgba(230,240,255,0.82)",
            textShadow: "0 1px 3px rgba(0,0,0,0.55)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {theme.tagline ?? theme.id}
        </div>
      </div>
    </Link>
  );
}

function chipStyle(color: string): React.CSSProperties {
  return {
    fontSize: 9,
    fontWeight: 600,
    padding: "2px 6px",
    borderRadius: 4,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color,
    background: "rgba(2,9,20,0.72)",
    border: `1px solid ${color}55`,
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
  };
}
