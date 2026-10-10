// src/app/nex-native/settings/_coming-soon.tsx
//
// Reusable "Coming soon" settings surface · sealed 2026-10-06.
// --------------------------------------------------------------
// Used by every settings sub-route whose backend has not landed yet
// (notifications, chat-settings, privacy, blocked, security, storage,
// data-usage, help, about). Keeps the information architecture
// complete without faking functionality that doesn't exist · per
// founder §28 ("Do not fake the missing capability").
//
// Each caller supplies:
//   · dataScope       data-nex-settings-page="<scope>" (test anchor)
//   · groupLabel      "Messages" · "Privacy & Safety" · etc.
//   · title           user-facing page title
//   · description     one short paragraph in ordinary language
//   · explain         optional second paragraph (what this will do)
//   · ctaHref         optional CTA (usually NEX1 chat intent) for
//                     users who want to request this feature now
//   · ctaLabel        optional CTA label

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { NexPageHeader } from "../_page-header";
import {
  NEX_SETTINGS,
  NEX_SETTINGS_FONT,
  SettingsBackLink,
} from "./_settings-shell";

export interface ComingSoonPageProps {
  dataScope: string;
  groupLabel: string;
  title: string;
  description: string;
  explain?: string;
  ctaHref?: string | null;
  ctaLabel?: string | null;
}

export async function ComingSoonSettingsPage(
  props: ComingSoonPageProps,
): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const {
    dataScope,
    groupLabel,
    title,
    description,
    explain,
    ctaHref,
    ctaLabel,
  } = props;

  return (
    <>
      <style>{`html, body { background: ${NEX_SETTINGS.bg} !important; }`}</style>
      <main
        data-nex-settings-page={dataScope}
        style={{
          minHeight: "100dvh",
          background: NEX_SETTINGS.bg,
          color: NEX_SETTINGS.textPrimary,
          fontFamily: NEX_SETTINGS_FONT,
          padding: "16px 20px 32px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope={`settings-${dataScope}`} />
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
            {groupLabel}
          </div>

          <h1
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              margin: "6px 0 10px",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
            <span
              aria-label="coming soon"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 8px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: NEX_SETTINGS.orange,
                border: `1px solid ${NEX_SETTINGS.orange}`,
                borderRadius: 5,
                lineHeight: 1.2,
              }}
            >
              Soon
            </span>
          </h1>

          <p
            style={{
              margin: "0 0 14px",
              fontSize: 14,
              color: NEX_SETTINGS.textPrimary,
              lineHeight: 1.55,
            }}
          >
            {description}
          </p>
          {explain && (
            <p
              style={{
                margin: "0 0 20px",
                fontSize: 13,
                color: NEX_SETTINGS.textSecondary,
                lineHeight: 1.55,
              }}
            >
              {explain}
            </p>
          )}

          <div
            style={{
              marginTop: 10,
              padding: "16px 18px",
              background: NEX_SETTINGS.panel,
              border: `1px solid rgba(0,175,255,0.18)`,
              borderRadius: 12,
              color: NEX_SETTINGS.textSecondary,
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            This section isn't live yet. The design is ready · the
            controls will arrive once the supporting backend is in
            place. Nothing is faked here on purpose.
          </div>

          {ctaHref && ctaLabel && (
            <a
              href={ctaHref}
              data-nex-settings-cta
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 20,
                padding: "12px 18px",
                borderRadius: 999,
                background: NEX_SETTINGS.cyan,
                color: NEX_SETTINGS.bg,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textDecoration: "none",
                boxShadow: `0 4px 14px ${NEX_SETTINGS.cyan}44`,
              }}
            >
              {ctaLabel}
            </a>
          )}
        </div>
      </main>
    </>
  );
}
