// src/app/nex-head-quarters/nex-native-themes/page.tsx
//
// NEX HQ · Chat theme catalogue.
// ------------------------------
// Founder / HQ operators land here. Every theme in nex_chat_theme
// (migration 048) is listed grouped by tier. Links out to the builder
// for creating a new one.
//
// The HQ layout provides the sidebar chrome + heartbeat monitoring ·
// this module page is inside that shell. Auth is enforced at the HQ
// domain / middleware layer.

import Link from "next/link";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  panel: "#03101D",
  panelSoft: "rgba(3,16,29,0.6)",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.35)",
  orange: "#FF7200",
  green: "#16D66B",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
};

const BANNER_MESSAGES: Record<string, string> = {
  admin_disabled: "dev-admin mode is disabled in this environment",
  not_dev_admin: "only dev-admin@nex-native.local can create themes",
  missing_id: "theme id is required",
  invalid_id: "theme id format looks wrong",
  missing_name: "theme name is required",
  invalid_accent: "accent must be a hex colour",
  invalid_tier: "unknown tier",
  invalid_sort: "sort order out of range",
  image_too_big: "background image is over 5 MB",
  image_bad_type: "background image must be PNG · JPG · WebP · AVIF",
  upload_failed: "background image upload failed",
  create_failed: "database rejected the theme",
  theme_created: "theme created",
};

export default async function HqChatThemesPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; m?: string }>;
}) {
  const themes = await chatThemeService.listActiveThemes();
  const { standard, premium } = chatThemeService.groupByCategory(themes);
  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const isSuccess = banner?.code === "theme_created";

  return (
    <div style={{ padding: "16px 24px 40px", color: NEX.text }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          NEX Chat themes
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 13,
            color: NEX.textDim,
            lineHeight: 1.55,
            maxWidth: 640,
          }}
        >
          Every visual theme users can pick from lives here. Each theme
          paints message bubbles, the composer, and the ripple effect
          with its accent colour. Free themes are available to everyone.
          Premium themes require an active NEX Bisnis subscription — they
          are the paid unlockables that drive account upgrades. Sealed
          doctrine ·{" "}
          <code style={monoStyle}>
            doctrine_theme_ownership_2026_09_27
          </code>
          .
        </p>

        {banner && (
          <div
            role="status"
            style={{
              marginBottom: 18,
              padding: "10px 14px",
              borderRadius: 10,
              background: isSuccess
                ? "rgba(22,214,107,0.14)"
                : "rgba(255,120,0,0.14)",
              border: `1px solid ${
                isSuccess ? "rgba(22,214,107,0.5)" : "rgba(255,120,0,0.5)"
              }`,
              color: NEX.text,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              aria-hidden
              style={{
                fontSize: 14,
                color: isSuccess ? NEX.green : NEX.orange,
                fontWeight: 700,
              }}
            >
              {isSuccess ? "✓" : "!"}
            </span>
            <span>
              {BANNER_MESSAGES[banner.code] ?? banner.code} ·{" "}
              <span style={{ color: NEX.textDim }}>{banner.message}</span>
            </span>
          </div>
        )}

        <div style={{ marginBottom: 22 }}>
          <Link
            href="/nex-head-quarters/nex-native-themes/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 20px",
              borderRadius: 10,
              background: NEX.orange,
              color: "#0B0F1A",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            + Create a new theme
          </Link>
        </div>

        <ThemeSection
          title="Free themes · Gratis"
          subtitle="Available to every NEX user, forever."
          themes={standard}
        />
        <ThemeSection
          title="Premium themes · NEX Bisnis"
          subtitle="Locked until users upgrade to a paid Bisnis subscription."
          themes={premium}
        />
      </div>
    </div>
  );
}

const monoStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, monospace",
  fontSize: 12,
  background: "rgba(255,255,255,0.06)",
  padding: "1px 4px",
  borderRadius: 3,
};

function ThemeSection({
  title,
  subtitle,
  themes,
}: {
  title: string;
  subtitle: string;
  themes: chatThemeService.NexChatThemeRow[];
}) {
  if (themes.length === 0) return null;
  return (
    <section style={{ marginBottom: 28 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: NEX.cyan,
          fontWeight: 700,
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: 3,
          marginBottom: 12,
          fontSize: 12,
          color: NEX.textMute,
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        {themes.map((t) => (
          <ThemeCard key={t.id} theme={t} />
        ))}
      </div>
    </section>
  );
}

function ThemeCard({
  theme,
}: {
  theme: chatThemeService.NexChatThemeRow;
}) {
  return (
    <div
      style={{
        padding: "14px",
        borderRadius: 14,
        background: NEX.panel,
        border: `1px solid ${NEX.cyanSoft}`,
        boxShadow: `0 0 0 1px ${theme.accent_hex}22 inset`,
      }}
    >
      {theme.hero_image_url ? (
        <div
          aria-hidden
          style={{
            width: "100%",
            height: 90,
            marginBottom: 12,
            borderRadius: 10,
            backgroundImage: `url(${theme.hero_image_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            border: `1px solid ${theme.accent_hex}55`,
          }}
        />
      ) : null}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: theme.accent_hex,
            boxShadow: `0 0 12px ${theme.accent_hex}66`,
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{theme.name}</div>
          <div
            style={{
              fontSize: 11,
              color: NEX.textMute,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {theme.id} · {theme.accent_hex}
          </div>
        </div>
        <span
          style={{
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: 999,
            background:
              theme.tier === "bisnis"
                ? "rgba(255,120,0,0.18)"
                : "rgba(22,214,107,0.18)",
            color: theme.tier === "bisnis" ? NEX.orange : NEX.green,
          }}
        >
          {theme.tier}
        </span>
      </div>
      {theme.tagline && (
        <div
          style={{
            fontSize: 12,
            color: NEX.textDim,
            lineHeight: 1.45,
          }}
        >
          {theme.tagline}
        </div>
      )}
    </div>
  );
}
