// src/app/nex-native/vault/settings/page.tsx
//
// Vault settings · Stage 2 scope: ONLY controls that are genuinely wired.
// No fake security, recovery, device-management or encryption settings
// (founder decision D4 · 2026-10-03).

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { resolveServerLocale, tFor } from "@/lib/nex/i18n/server";
import type { I18nKey } from "@/lib/nex/i18n/keys";
import { resolveVaultDoorwaySlug } from "../home/_resolve-theme";
import { NEX, GLASS, GLASS_CHIP } from "../home/_palette";
import { VaultShellHeader } from "../_vault-shell-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SettingsRow {
  key: string;
  titleKey: I18nKey;
  bodyKey: I18nKey;
  href: string;
  external?: boolean;
}

const ROWS: SettingsRow[] = [
  { key: "door-theme",    titleKey: "vault.settings.doorTheme.title",  bodyKey: "vault.settings.doorTheme.body",  href: "/nex-native/chat-themes-library" },
  { key: "lock-vault",    titleKey: "vault.settings.lockVault.title",  bodyKey: "vault.settings.lockVault.body",  href: "/nex-native/vault" },
  { key: "vault-devices", titleKey: "vault.settings.devices.title",    bodyKey: "vault.settings.devices.body",    href: "/nex-native/vault/settings/devices" },
  { key: "vault-recovery",titleKey: "vault.settings.recovery.title",   bodyKey: "vault.settings.recovery.body",   href: "/nex-native/vault/settings/recovery" },
  { key: "vault-rotate",  titleKey: "vault.settings.rotate.title",     bodyKey: "vault.settings.rotate.body",     href: "/nex-native/vault/settings/rotate" },
  { key: "back-to-nex",   titleKey: "vault.settings.backToNex.title",  bodyKey: "vault.settings.backToNex.body",  href: "/nex-native/home" },
  { key: "terms",         titleKey: "vault.settings.about.title",      bodyKey: "vault.settings.about.body",      href: "/nex-native/about/terms" },
];

export default async function VaultSettingsPage() {
  const themeSlug = await resolveVaultDoorwaySlug();
  if (!themeSlug) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/settings");
  }
  const session = await resolveNexAppSessionFromContext();
  const headerBag = await headers();
  const locale = resolveServerLocale({
    accountLocale: (session?.account.locale as string | null) ?? null,
    acceptLanguage: headerBag.get("accept-language"),
  });
  const t = tFor(locale);
  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        [data-nex-vault-settings] * { box-sizing: border-box; }
        [data-nex-vault-settings] a { text-decoration: none; color: inherit; }
      `}</style>
      <div
        data-nex-vault-settings
        data-nex-vault-theme-source={themeSlug}
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily: NEX.sans,
          position: "relative",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            background: NEX.bgGradient,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <VaultShellHeader t={t} />
        <SettingsTitleBlock t={t} />
        <main
          id="main"
          style={{
            position: "relative",
            padding: "0 16px 32px",
            maxWidth: 480,
            margin: "0 auto",
            zIndex: 1,
          }}
        >
          <section
            data-nex-vault-settings-list
            style={{
              marginTop: 8,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {ROWS.map((r) => (
              <Link
                key={r.key}
                href={r.href}
                data-nex-vault-settings-row={r.key}
                style={{
                  ...GLASS_CHIP,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "14px 16px",
                  borderRadius: 18,
                  minHeight: 64,
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 14.5,
                      fontWeight: 600,
                      color: NEX.textPrimary,
                    }}
                  >
                    {t(r.titleKey)}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      color: NEX.textSecondary,
                      marginTop: 4,
                      lineHeight: 1.4,
                    }}
                  >
                    {t(r.bodyKey)}
                  </span>
                </span>
                <ChevronRight size={18} strokeWidth={1.8} color={NEX.textMuted} aria-hidden style={{ marginTop: 2 }} />
              </Link>
            ))}
          </section>

          <section
            data-nex-vault-honesty-footer
            aria-label="Honest limits"
            style={{
              ...GLASS,
              marginTop: 28,
              padding: "16px 18px",
              borderRadius: 16,
              fontSize: 11.5,
              color: NEX.textMuted,
              lineHeight: 1.55,
            }}
          >
            <p style={{ margin: 0, color: NEX.textSecondary, fontWeight: 600 }}>
              {t("vault.settings.honestLimits.title")}
            </p>
            <p style={{ margin: "6px 0 0" }}>{t("vault.settings.honestLimits.para1")}</p>
            <p style={{ margin: "10px 0 0" }}>{t("vault.settings.honestLimits.para2")}</p>
            <p style={{ margin: "10px 0 0" }}>{t("vault.settings.honestLimits.para3")}</p>
          </section>
        </main>
      </div>
    </>
  );
}

function SettingsTitleBlock({ t }: { t: (k: I18nKey) => string }) {
  return (
    <section
      data-nex-vault-settings-title-block
      style={{
        position: "relative",
        zIndex: 1,
        maxWidth: 480,
        margin: "0 auto",
        padding: "4px 20px 12px",
      }}
    >
      <h1
        data-nex-vault-settings-title
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "0.005em",
          color: NEX.textPrimary,
        }}
      >
        {t("vault.settings.header.title")}
      </h1>
      <p
        style={{
          margin: "4px 0 0",
          fontSize: 13,
          color: NEX.textSecondary,
          letterSpacing: "0.005em",
        }}
      >
        {t("vault.settings.header.subtitle")}
      </p>
    </section>
  );
}
