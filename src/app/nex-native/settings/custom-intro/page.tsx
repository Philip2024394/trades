// src/app/nex-native/settings/custom-intro/page.tsx
//
// NEX Settings · Custom Intro · Phase 1.0 upgrade sealed 2026-10-06.
// --------------------------------------------------------------
// Replaces the Phase 1 scaffold with the real multi-state surface:
//   · not_purchased    → "Get Custom Intro Rp500,000" → NEX1 chat
//   · purchased_no_video → upload a short MP4
//   · active           → preview + replace + "Turn off"
//   · disabled         → preview + "Turn on"
//
// Payment pathway is UNCHANGED (sealed): user pays via NEX1 support
// chat, admin manually grants the entitlement row. The server never
// trusts a client-side "I paid" claim. Upload lands in the NEX-owned
// MinIO bucket via the sealed object-storage adapter.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { NEX_OFFICIAL_CHAT_HREF } from "@/lib/nex-native/nex-official";
import {
  getCustomIntroPresentationState,
  CUSTOM_INTRO_PRICE_IDR,
} from "@/lib/nex-native/custom-intro-service";
import { NexPageHeader } from "../../_page-header";
import {
  NEX_SETTINGS,
  NEX_SETTINGS_FONT,
  SettingsBackLink,
} from "../_settings-shell";
import { CustomIntroClient } from "./_custom-intro-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CustomIntroSettingsPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const presentation = await getCustomIntroPresentationState(session.account.id);
  const nex1Href = `${NEX_OFFICIAL_CHAT_HREF}?intent=custom_intro_500k`;

  return (
    <>
      <style>{`html, body { background: ${NEX_SETTINGS.bg} !important; }`}</style>
      <main
        data-nex-settings-page="custom-intro"
        data-nex-custom-intro-presentation={presentation.state}
        style={{
          minHeight: "100dvh",
          background: NEX_SETTINGS.bg,
          color: NEX_SETTINGS.textPrimary,
          fontFamily: NEX_SETTINGS_FONT,
          padding: "16px 20px 32px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-custom-intro" />
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
            Custom Intro
          </h1>

          <p
            style={{
              margin: "0 0 18px",
              fontSize: 13,
              color: NEX_SETTINGS.textSecondary,
              lineHeight: 1.6,
            }}
          >
            Your own short video, played when someone enters your chat.
            Visitors see your identity before a single bubble arrives.
          </p>

          <CustomIntroClient
            state={presentation.state}
            priceIdr={CUSTOM_INTRO_PRICE_IDR}
            nex1Href={nex1Href}
            accountId={session.account.id}
            videoKey={presentation.row?.video_url ?? null}
            durationMs={presentation.row?.video_duration_ms ?? null}
          />
        </div>
      </main>
    </>
  );
}
