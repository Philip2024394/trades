// src/app/nex-native/home/page.tsx
//
// NEX signed-in home · phone-framed theme × cover-layout showcase hub.
// -------------------------------------------------------------------------
// Founder direction (Philip, 2026-10-02): the signed-in home surface
// should be a world-class mobile-first visualisation of the NEX product.
// Visitors land on a short "introduction to NEX, the new generation"
// panel, then swipe left/right through phone-framed previews of the
// available theme × cover-layout designs — the real preview surface
// (Bridge 98 · /cover/preview/{layoutId}?theme={themeId}) is one tap
// away on every slide.
//
// The three nav doorways (Chat · Themes · Profile) are preserved as a
// compact three-column secondary strip beneath the carousel so core
// navigation stays reachable without crowding the showcase.
//
// Signed-out visitors are bounced to /nex-native/sign-in so this
// surface never accidentally leaks a signed-in shape.

import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountProfileService from "@/lib/nex-native/account-profile-service";
import * as businessService from "@/lib/nex-native/business-service";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import type { NexAccountKind } from "@/lib/nex-native/types";
import { NEX_COMMERCE_ENABLED } from "@/lib/nex-native/launch-flags";
import { NexPageHeader } from "../_page-header";
import { COVER_LAYOUT_LABELS } from "../cover/layout-ids";
import type { CoverLayoutId } from "../cover/layout-ids";
import { ThemeCoverCarousel, type ThemeCoverSlide } from "./_theme-cover-carousel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tokens mirror /nex-native/create-account exactly so the signed-in home
// hub reads as a continuation of the signup brand, not a separate world.
const NEX = {
  bg: "#020914",
  panel: "#03101D",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.18)",
  orange: "#FF7200",
};

interface TileCopy {
  href: string;
  emoji: string;
  title: string;
}

/** Compact doorway · nav strip beneath the carousel. */
function shopTile(kind: NexAccountKind | null, hasBusiness: boolean): TileCopy {
  if (!NEX_COMMERCE_ENABLED) {
    return { href: "/nex-native/settings/theme", emoji: "🎨", title: "Themes" };
  }
  if (kind === "professional") {
    return { href: "/nex-native/settings/profile", emoji: "🧰", title: "My work" };
  }
  if (kind === "student" || kind === "seeking_work" || kind === "exploring") {
    return { href: "/nex-native/settings/profile", emoji: "🌱", title: "My journey" };
  }
  if (kind === "reseller") {
    return {
      href: hasBusiness ? "/nex-native/manage" : "/nex-native/onboarding",
      emoji: "🛒",
      title: "My reselling",
    };
  }
  return {
    href: hasBusiness ? "/nex-native/manage" : "/nex-native/onboarding",
    emoji: "🛍",
    title: hasBusiness ? "My shop" : "Create shop",
  };
}

function contactsTile(_kind: NexAccountKind | null): TileCopy {
  return { href: "/nex-native/chat", emoji: "👥", title: "Contacts" };
}

// ─── Carousel slide composition ─────────────────────────────────────────
// Founder direction 2026-10-02: carousel shows the viewer's CHAT THEME
// across different cover-layouts (information architecture) · the real
// theme data (hero_image_url, accent, bubble/composer rims, wallpaper
// overlays) paints every slide so what the viewer sees is their own
// theme loaded live, varied only by layout.
//
// Five showcase layouts picked for maximum IA variety (compact vs grid,
// portrait vs round, cafe vs shop vs personal brand). "See all →" at
// the top-right of the section links to the full 10-layout gallery.
const HOME_SHOWCASE_LAYOUTS: readonly CoverLayoutId[] = [
  "personal_brand",
  "product_landscape_round",
  "cafe",
  "product_round",
  "cafe_landscape",
];

const LAYOUT_BLURB: Partial<Record<CoverLayoutId, string>> = {
  cafe: "Portrait hero · product grid · Visit Us",
  cafe_landscape: "Café identity · landscape cards",
  cafe_round: "Café identity · round cards with magnifier rim",
  product: "Compact identity · Who-We-Are · shop grid",
  product_landscape: "Shop identity · landscape cards · 6 per page",
  product_round: "Shop identity · round cards · magnifier rim",
  product_landscape_round: "Shop · landscape round cards · bold",
  personal_brand: "Round portrait · Our Journey · tabs",
  personal_brand_landscape: "Personal brand · landscape cards",
  personal_brand_round: "Personal brand · round cards · magnifier rim",
};

export default async function HomePage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const [profile, ownedBusinesses, themes] = await Promise.all([
    accountProfileService.getProfileByAccountId(session.account.id).catch(() => null),
    businessService.listBusinessesByOwner(session.account.id).catch(() => []),
    chatThemeService.listActiveThemes().catch(() => []),
  ]);
  const kind = (profile?.kind ?? null) as NexAccountKind | null;
  const hasBusiness = ownedBusinesses.length > 0;

  // Rev 6 Phase 2 · Business NEX activation state. Any owned nex_business
  // with a non-null profile → activated. Otherwise → free user (even if a
  // shell row exists). Drives the activation banner below.
  const businessNexActivated = ownedBusinesses.some(
    (b) => (b as unknown as { profile?: unknown }).profile != null,
  );

  // Theme scope boundary doctrine · 2026-10-04 ·
  // doctrine_theme_scope_boundary_2026_10_04. The Home page is a
  // SYSTEM surface, not a conversation surface, so it always paints
  // in the NEX brand regardless of the viewer's picked chat_theme.
  // We still resolve `currentTheme` from the themes list so the
  // cover-preview SLIDES below can render each slide in the user's
  // theme (that's content showing them THEIR covers), but the page
  // chrome — hero gradient, atmosphere, headlines, panels — stays
  // locked to the NEX cyan accent.
  const rawTheme = (session.account.chat_theme as string | null) ?? null;
  const currentThemeId: string = rawTheme && rawTheme.length > 0 ? rawTheme : "theme-0";
  const currentTheme =
    themes.find((t) => t.id === currentThemeId) ?? themes[0] ?? null;
  const themeAccent: string = NEX.cyan;
  const themeName: string = "NEX";

  const slides: ThemeCoverSlide[] = currentTheme
    ? HOME_SHOWCASE_LAYOUTS.map((layoutId): ThemeCoverSlide => ({
        themeId: currentTheme.id,
        themeName: currentTheme.name,
        themeAccent: currentTheme.accent_hex,
        themeBubbleRim: currentTheme.bubble_rim_hex ?? currentTheme.accent_hex,
        themeComposerRim: currentTheme.composer_rim_hex ?? currentTheme.accent_hex,
        themeWallpaperUrl: currentTheme.hero_image_url,
        layoutId,
        layoutLabel: COVER_LAYOUT_LABELS[layoutId],
        layoutBlurb: LAYOUT_BLURB[layoutId] ?? "Tap to open this design",
        href: `/nex-native/cover/preview/${layoutId}?theme=${encodeURIComponent(currentTheme.id)}`,
      }))
    : [];

  const navTiles: TileCopy[] = [
    { href: "/nex-native/chat/inbox", emoji: "💬", title: "Chat" },
    { href: "/nex-native/calls", emoji: "📞", title: "Calls" },
    shopTile(kind, hasBusiness),
    contactsTile(kind),
  ];

  const displayName = session.account.display_name || "there";
  const handle = session.account.nex_handle ?? null;

  // Theme-asset warm-up · One NEX Identity doctrine demands atomic
  // theme reveal. Preload the current theme's wallpaper so the iframe's
  // first paint has it in cache; prefetch the first two upcoming slide
  // URLs so a fast swipe never catches an unloaded cover; prefetch the
  // three primary nav destinations so tapping Chat / Themes / Contacts
  // feels instant on the first attempt (Next's auto-prefetch waits for
  // hover + is disabled in dev).
  const preloadWallpaper = currentTheme?.hero_image_url ?? null;
  const prefetchSlideHrefs = slides.slice(1, 3).map((s) => s.href);
  // Both Chat and Contacts route to /nex-native/chat · dedupe so React
  // doesn't warn about duplicate <link> keys.
  const prefetchNavHrefs = Array.from(new Set(navTiles.map((t) => t.href)));

  return (
    <>
      {preloadWallpaper && (
        <link rel="preload" as="image" href={preloadWallpaper} />
      )}
      {prefetchSlideHrefs.map((href) => (
        <link key={`slide-${href}`} rel="prefetch" href={href} />
      ))}
      {prefetchNavHrefs.map((href) => (
        <link key={`nav-${href}`} rel="prefetch" href={href} />
      ))}
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        /* Scrollbars stay invisible across every NEX themes surface
           per founder direction 2026-10-02. Page still scrolls — only
           the rail is hidden. overflow-x: hidden keeps the full-bleed
           carousel from forcing a horizontal page scrollbar. */
        html, body { scrollbar-width: none; -ms-overflow-style: none; overflow-x: hidden; }
        html::-webkit-scrollbar, body::-webkit-scrollbar { width: 0; height: 0; display: none; }
        [data-nex-home-root] * { box-sizing: border-box; }
        [data-nex-home-tile]:hover {
          border-color: ${NEX.cyan};
          box-shadow: 0 0 24px rgba(0, 175, 255, 0.15);
        }
        [data-nex-home-tile]:focus-visible {
          outline: 2px solid ${NEX.cyan};
          outline-offset: 2px;
        }
      `}</style>
      <main
        data-nex-home-root
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "16px 20px 32px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Theme scope boundary doctrine · 2026-10-04 · the Home page
            is a NEX SYSTEM surface. Every atmospheric glow, grid and
            accent trim renders in NEX cyan regardless of the viewer's
            picked chat_theme. Only the cover-preview slides below can
            carry per-slide theme colour (that's content preview, not
            chrome). */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `
              radial-gradient(60% 48% at 50% 18%, ${themeAccent}3a, transparent 72%),
              radial-gradient(80% 60% at 50% 100%, ${themeAccent}1a, transparent 72%),
              radial-gradient(circle at 20% 10%, ${themeAccent}1c, transparent 50%)
            `,
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(${themeAccent}08 1px, transparent 1px), linear-gradient(90deg, ${themeAccent}08 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
            mask: "radial-gradient(70% 50% at 50% 30%, black 10%, transparent 85%)",
            WebkitMask: "radial-gradient(70% 50% at 50% 30%, black 10%, transparent 85%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", maxWidth: 420, margin: "0 auto" }}>
          {/* Shared header · magnifier (search) · NEX wordmark · gear (settings) */}
          <NexPageHeader dataScope="home" />

          {/* Cinematic hero · theme name as 56px gradient-text display word.
              If themeName is the generic "NEX" fallback we still render it as
              the brand mark — looks right. For real themes (Pink Dream, Night
              Sky, Joker) it paints emotively in the viewer's accent. */}
          <div style={{ marginTop: 26, textAlign: "center" }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: themeAccent,
                fontWeight: 700,
              }}
            >
              Welcome home, {displayName}
            </div>
            <h1
              style={{
                margin: "14px 0 0",
                fontSize: 56,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 0.95,
                background: `linear-gradient(180deg, ${NEX.textPrimary} 0%, ${themeAccent} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              NEX
            </h1>
            <div
              style={{
                marginTop: 10,
                fontSize: 12.5,
                color: NEX.textSecondary,
                letterSpacing: "0.04em",
              }}
            >
              The World At Your Fingertips.
            </div>
            {handle && (
              <div
                style={{
                  marginTop: 14,
                  fontSize: 18,
                  fontWeight: 700,
                  color: NEX.textSecondary,
                  letterSpacing: "0.02em",
                }}
              >
                <code style={{ fontFamily: "ui-monospace, monospace", color: themeAccent, fontSize: 20 }}>
                  {handle}
                </code>
              </div>
            )}
          </div>

          {/* Three round quick-action buttons · hero-level */}
          <div
            style={{
              marginTop: 24,
              display: "flex",
              justifyContent: "center",
              gap: 24,
            }}
          >
            {navTiles.map((t) => {
              const customIcon =
                t.title === "Contacts"
                  ? "/nex-native/home-icon-contacts.png"
                  : t.title === "Chat"
                  ? "/nex-native/home-icon-chat.png"
                  : t.title === "Themes"
                  ? "/nex-native/home-icon-themes.png"
                  : null;
              const label = (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    color: themeAccent,
                    textAlign: "center",
                  }}
                >
                  {t.title}
                </div>
              );
              if (customIcon) {
                return (
                  <Link
                    key={t.title}
                    href={t.href}
                    aria-label={t.title}
                    data-nex-home-tile
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textDecoration: "none",
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: 64,
                        height: 64,
                        filter: `drop-shadow(0 12px 20px ${themeAccent}55)`,
                      }}
                    >
                      <Image
                        src={customIcon}
                        alt=""
                        width={64}
                        height={64}
                        priority
                        unoptimized
                        style={{ width: 64, height: 64, display: "block" }}
                      />
                    </div>
                    {label}
                  </Link>
                );
              }
              return (
                <Link
                  key={t.title}
                  href={t.href}
                  aria-label={t.title}
                  data-nex-home-tile
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textDecoration: "none",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: 60,
                      height: 60,
                      borderRadius: "50%",
                      background: `linear-gradient(145deg, ${themeAccent}33, ${themeAccent}0a)`,
                      border: `1px solid ${themeAccent}66`,
                      boxShadow: `0 0 0 1px ${themeAccent}22, 0 12px 28px ${themeAccent}30`,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 24,
                      color: NEX.textPrimary,
                    }}
                  >
                    <span aria-hidden>{t.emoji}</span>
                  </div>
                  {label}
                </Link>
              );
            })}
          </div>

          {/* ─── Business NEX activation banner · Phase 2 · 2026-10-02 ──
              Shown ONLY when the account has not yet activated Business NEX.
              Framed as an invitation, never a nag · the free user's home
              is complete without it. Hidden entirely once a profile is set. */}
          {!businessNexActivated && (
            <Link
              href="/nex-native/business-setup"
              data-nex-activation-banner
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 18,
                padding: "14px 16px",
                background: NEX.panel,
                border: `1px solid ${NEX.orange}66`,
                borderRadius: 12,
                textDecoration: "none",
                color: NEX.textPrimary,
                boxShadow: `0 0 0 1px ${NEX.orange}22, 0 10px 24px ${NEX.orange}14`,
              }}
            >
              <div
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${NEX.orange}, #c74a00)`,
                  color: "#0B0F1A",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 20,
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                +
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    color: NEX.orange,
                  }}
                >
                  Business NEX
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 14,
                    fontWeight: 600,
                    color: NEX.textPrimary,
                  }}
                >
                  Create your Business NEX
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 11,
                    color: NEX.textSecondary,
                    lineHeight: 1.4,
                  }}
                >
                  Keep your chat and themes. Add a presence for what you sell, host, or offer.
                </div>
              </div>
              <span aria-hidden style={{ color: NEX.orange, fontSize: 20, flexShrink: 0 }}>
                →
              </span>
            </Link>
          )}

          {/* ─── Phone-framed theme × cover-layout carousel ───────────────── */}
          {slides.length > 0 ? (
            <section
              aria-label="Theme design showcase"
              style={{ marginTop: 22 }}
            >
              <ThemeCoverCarousel slides={slides} />
            </section>
          ) : (
            <div
              style={{
                marginTop: 22,
                padding: "22px 18px",
                borderRadius: 12,
                border: `1px dashed ${NEX.cyanSoft}`,
                textAlign: "center",
                color: NEX.textSecondary,
                fontSize: 12,
              }}
            >
              No themes available yet. Check back soon.
            </div>
          )}

          {/* ─── Introduction panel · "NEX · The new generation" ─────────────
              Positions NEX as a persistent presence (identity + chat + products
              + commerce in one space). Lives below the phone carousel so the
              reader sees NEX in motion before reading about it. */}
          <section
            aria-labelledby="nex-intro-heading"
            style={{
              marginTop: 22,
              padding: 18,
              background: NEX.panel,
              border: `1px solid ${themeAccent}66`,
              borderRadius: 12,
              position: "relative",
              overflow: "hidden",
              boxShadow: `0 0 0 1px ${themeAccent}22, 0 12px 32px ${themeAccent}14`,
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(80% 60% at 100% 0%, ${themeAccent}22, transparent 60%)`,
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative" }}>
              <h1
                id="nex-intro-heading"
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: "-0.005em",
                  lineHeight: 1.25,
                  color: NEX.textPrimary,
                }}
              >
                Your <span style={{ color: themeAccent }}>NEX</span> is your
                presence.
              </h1>
              <p
                style={{
                  marginTop: 12,
                  fontSize: 15,
                  lineHeight: 1.4,
                  color: themeAccent,
                  fontWeight: 700,
                }}
              >
                Keep the WOW from your customers.
              </p>
              <p
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: NEX.textSecondary,
                }}
              >
                Change your theme regularly. Keep your NEX fresh, surprising,
                and exciting — so customers always have something new to
                discover.
              </p>
              <p
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: NEX.textSecondary,
                }}
              >
                Your identity, chat, and whatever you offer — products,
                services, food, drinks — all live together in one space,
                transformed by your chosen theme.
              </p>
              <p
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: NEX.textPrimary,
                  fontWeight: 600,
                }}
              >
                Change the look. Change the feeling. Keep the{" "}
                <span style={{ color: themeAccent }}>WOW</span>.
              </p>
              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                <Link
                  href="/nex-native/settings/theme"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: themeAccent,
                    textDecoration: "none",
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: `1px solid ${themeAccent}88`,
                    background: `${themeAccent}18`,
                  }}
                >
                  Change theme →
                </Link>
              </div>
            </div>
          </section>

          {/* Footer hint */}
          <p
            style={{
              marginTop: 22,
              textAlign: "center",
              fontSize: 11,
              color: NEX.textSecondary,
              lineHeight: 1.5,
            }}
          >
            Every doorway leads back here. Tap the NEX mark at the top of any
            page to come home.
          </p>
        </div>
      </main>
    </>
  );
}
