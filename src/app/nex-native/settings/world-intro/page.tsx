// src/app/nex-native/settings/world-intro/page.tsx
//
// NEX Settings · World Intro · sealed 2026-10-06 · Phase 1.0 upgrade
// from scaffold to REAL toggle.
//
// Flow:
//   · Reads `nex_account.world_intro_enabled` (default TRUE).
//   · POST form via setWorldIntroEnabledAction persists the new value.
//   · The peer-chat mount gate (peer/[accountId]/page.tsx) reads this
//     flag before deciding whether to play the intro to a visitor.
//
// Doctrine:
//   · Zero fake controls. The ON/OFF button posts to a real server
//     action against a real column.
//   · No duplicate intro mechanism. The existing ThemeIntroInterstitial
//     + nex_theme_intro_seen flow is unchanged · we simply gate it on
//     the owner's new preference.
//   · OFF skips the intro entirely for every visitor to this account's
//     chat · Standard Intro and Custom Intro both.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { NexPageHeader } from "../../_page-header";
import {
  NEX_SETTINGS,
  NEX_SETTINGS_FONT,
  SettingsBackLink,
} from "../_settings-shell";
import { setWorldIntroEnabledAction } from "../_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function WorldIntroSettingsPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const enabled = session.account.world_intro_enabled;

  return (
    <>
      <style>{`html, body { background: ${NEX_SETTINGS.bg} !important; }`}</style>
      <main
        data-nex-settings-page="world-intro"
        data-nex-world-intro-enabled={enabled ? "true" : "false"}
        style={{
          minHeight: "100dvh",
          background: NEX_SETTINGS.bg,
          color: NEX_SETTINGS.textPrimary,
          fontFamily: NEX_SETTINGS_FONT,
          padding: "16px 20px 32px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-world-intro" />
          <SettingsBackLink />

          <div
            style={{
              marginTop: 14,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: NEX_SETTINGS.textSecondary,
            }}
          >
            Your NEX
          </div>

          <h1
            style={{
              margin: "6px 0 10px",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            World Intro
          </h1>

          <p
            style={{
              margin: "0 0 14px",
              fontSize: 14,
              color: NEX_SETTINGS.textPrimary,
              lineHeight: 1.6,
            }}
          >
            Show a short introduction when someone enters your World.
          </p>
          <p
            style={{
              margin: "0 0 20px",
              fontSize: 13,
              color: NEX_SETTINGS.textSecondary,
              lineHeight: 1.6,
            }}
          >
            When it&apos;s off, visitors go straight into your chat.
          </p>

          <div
            data-nex-world-intro-status
            data-nex-world-intro-status-state={enabled ? "on" : "off"}
            style={{
              padding: "16px 18px",
              background: NEX_SETTINGS.panel,
              border: `1px solid ${NEX_SETTINGS.panelAccent}`,
              borderRadius: 12,
              marginBottom: 16,
            }}
          >
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
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: enabled ? "#22C55E" : "#8BA9D1",
                  boxShadow: enabled
                    ? "0 0 8px rgba(34,197,94,0.6)"
                    : "none",
                }}
              />
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                World Intro is {enabled ? "on" : "off"}
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: NEX_SETTINGS.textSecondary,
                lineHeight: 1.55,
              }}
            >
              {enabled
                ? "First-time visitors see your World's short intro once · returning visitors go straight into your chat."
                : "Nobody sees your World Intro · every visitor enters the chat directly."}
            </p>
          </div>

          <form
            action={setWorldIntroEnabledAction}
            data-nex-world-intro-form
            style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
          >
            <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
            <button
              type="submit"
              data-nex-world-intro-toggle={enabled ? "turn-off" : "turn-on"}
              style={{
                flex: "1 1 auto",
                padding: "12px 18px",
                borderRadius: 999,
                background: enabled ? "transparent" : NEX_SETTINGS.cyan,
                color: enabled ? NEX_SETTINGS.cyan : NEX_SETTINGS.bg,
                border: `1px solid ${NEX_SETTINGS.cyan}`,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.04em",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {enabled ? "Turn off" : "Turn on"}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
