// src/app/nex-native/chat-themes-library/page.tsx
//
// User-facing chat theme browser · Bridge 4.
// ------------------------------------------
// Server component · fetches every active theme + resolves the caller's
// effective tier + current active theme id, then hands over to the
// client browser (search / filter / grid / enlarge preview).
//
// URL renamed 2026-10-04 · was /nex-native/settings/theme ·
// old URL still 301s to this location (see next.config.mjs redirects).
//
// Doctrine · doctrine_theme_ownership_2026_09_27.md.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  effectiveTier,
  hasUsedThemesTrial,
  isThemesTrialActive,
  themesTrialExpiresAt,
} from "@/lib/nex-native/account-service";
import { startThemesTrialAction } from "../_actions";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { updateChatThemeAction } from "../_actions";
import type { NexAccountRow } from "@/lib/nex-native/types";
import { ThemeBrowserClient, type BrowserThemeRow } from "./_theme-browser-client";
import { TrialCountdownBanner } from "./_trial-countdown-banner";
import { NexPageHeader } from "../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  cyan: "#00AFFF",
  orange: "#FF7800",
  green: "#16D66B",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
};

const SUCCESS_CODES = new Set(["theme_updated"]);

export default async function ThemePickerPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; m?: string }>;
}) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  // Read tier + trial state + current theme from the latest DB row
  // (session may be stale). Bridge 56g · themes_trial_used_at is
  // required by effectiveTier so trial-active accounts unlock the
  // premium catalogue automatically for the 7-day window.
  const row = await nexSupabaseAdmin
    .from("nex_account")
    .select("tier, bisnis_expires_at, chat_theme, themes_trial_used_at")
    .eq("id", session.account.id)
    .maybeSingle();
  const account = (row.data ?? {}) as Pick<
    NexAccountRow,
    "tier" | "bisnis_expires_at" | "chat_theme" | "themes_trial_used_at"
  >;
  const currentTier = effectiveTier(account);
  const currentThemeId = account.chat_theme ?? "default";
  const canUsePremium = currentTier === "bisnis" || currentTier === "pro";
  // Bridge 63 · trial signals for the theme picker banner + inline CTAs.
  const trialActive = isThemesTrialActive(account);
  const trialUsed = hasUsedThemesTrial(account);
  const trialExpiresIso = themesTrialExpiresAt(account);

  // Viewer's own profile photo · used by themes that don't ship
  // their own hero_image_url (Rose · Origin · etc.) to preview the
  // Portrait Bloom mechanic with the viewer's actual face.
  const viewerAvatarUrl = await (async () => {
    try {
      const svc = await import("@/lib/nex-native/account-profile-service");
      const profile = await svc.getProfileByAccountId(session.account.id);
      return profile?.avatar_url ?? null;
    } catch {
      return null;
    }
  })();

  const themes = await chatThemeService.listActiveThemes();
  const browserThemes: BrowserThemeRow[] = themes.map((t) => ({
    id: t.id,
    name: t.name,
    tagline: t.tagline,
    accent_hex: t.accent_hex,
    bubble_rim_hex: t.bubble_rim_hex,
    composer_rim_hex: t.composer_rim_hex,
    tier: t.tier,
    category: t.category,
    hero_image_url: t.hero_image_url,
    sort_order: t.sort_order,
    // Phase 4A · gallery-always-plays intro.
    intro_video_url: t.intro_video_url,
    intro_poster_url: t.intro_poster_url,
  }));

  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const isSuccess = banner ? SUCCESS_CODES.has(banner.code) : false;

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        /* Slow pulse for the "FREE" badge on the trial banner · one
         * cycle every ~2.4s · ease-in-out so the fade in/out feels
         * breathing, not blinking. Governed by the themes-trial rule
         * sealed 2026-10-04. */
        @keyframes nex-themes-trial-free-pulse {
          0%   { opacity: 1;    transform: scale(1);    box-shadow: 0 0 0 0 rgba(255,120,0,0.5); }
          50%  { opacity: 0.55; transform: scale(1.04); box-shadow: 0 0 0 8px rgba(255,120,0,0); }
          100% { opacity: 1;    transform: scale(1);    box-shadow: 0 0 0 0 rgba(255,120,0,0); }
        }
      `}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "20px 16px 40px",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-theme" />

          <h1
            style={{
              margin: "18px 0 6px",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            NEX Themes
          </h1>
          <p
            style={{
              margin: "0 0 18px",
              fontSize: 13,
              color: NEX.textDim,
              lineHeight: 1.55,
            }}
          >
            Every friend sees YOUR theme when they open your chat. Free
            themes are yours forever. Premium themes unlock with{" "}
            <Link
              href="/nex-native/settings/tier"
              style={{ color: NEX.orange, textDecoration: "underline" }}
            >
              NEX Bisnis
            </Link>
            .
          </p>

          {banner && (
            <div
              role="status"
              style={{
                marginBottom: 14,
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
              }}
            >
              {isSuccess
                ? `Theme saved · ${banner.message}`
                : banner.message}
            </div>
          )}

          {/* Bridge 63 · trial state banner · shows above the theme grid
             so the user always knows why the padlock is (or isn't) up.
             Three states:
               · active   → green "N days left" chip
               · unused   → orange "Try 7 days free" inline CTA form
               · used     → dim "Trial used · subscribe to keep premium" */}
          {trialActive && trialExpiresIso ? (
            <TrialCountdownBanner expiresIso={trialExpiresIso} />
          ) : !trialUsed && currentTier === "gratis" ? (
            <form
              action={startThemesTrialAction}
              style={{
                marginBottom: 18,
                padding: "14px 16px",
                borderRadius: 12,
                background:
                  "linear-gradient(135deg, rgba(255,120,0,0.14) 0%, rgba(3,16,29,0.72) 100%)",
                border: "1px solid rgba(255,120,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: `linear-gradient(180deg, #FF9033 0%, ${NEX.orange} 100%)`,
                      color: "#0B0F1A",
                      fontSize: 9.5,
                      fontWeight: 900,
                      letterSpacing: "0.14em",
                      animation:
                        "nex-themes-trial-free-pulse 2.4s ease-in-out infinite",
                    }}
                  >
                    FREE
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: NEX.orange,
                      fontWeight: 800,
                    }}
                  >
                    Your first premium theme is on us
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: NEX.text,
                    lineHeight: 1.5,
                  }}
                >
                  Try every premium theme free for 7 days · one time per
                  account · no payment needed.
                </div>
              </div>
              <input type="hidden" name="package_id" value="bisnis" />
              <button
                type="submit"
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  background:
                    "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
                  border: "1px solid rgba(255,120,0,0.6)",
                  color: "#0B0F1A",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: "0 6px 14px rgba(255,120,0,0.4)",
                  whiteSpace: "nowrap",
                }}
              >
                Start 7-day trial
              </button>
            </form>
          ) : trialUsed && currentTier === "gratis" ? (
            <div
              style={{
                marginBottom: 18,
                padding: "12px 16px",
                borderRadius: 12,
                background: "rgba(139,169,209,0.06)",
                border: "1px solid rgba(139,169,209,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 12, color: NEX.textDim, lineHeight: 1.5 }}>
                Trial already used · subscribe to keep premium themes.
              </div>
              <Link
                href="/nex-native/settings/tier"
                style={{
                  fontSize: 11,
                  color: NEX.orange,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  textDecoration: "underline",
                }}
              >
                See plans →
              </Link>
            </div>
          ) : null}

          <ThemeBrowserClient
            themes={browserThemes}
            currentThemeId={currentThemeId}
            canUsePremium={canUsePremium}
            activateAction={updateChatThemeAction}
            viewerAvatarUrl={viewerAvatarUrl}
          />
        </div>
      </main>
    </>
  );
}
