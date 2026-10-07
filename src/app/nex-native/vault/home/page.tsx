// src/app/nex-native/vault/home/page.tsx
//
// NEX Vault · workspace home (post-unlock).
//
// Full-screen mobile-first secure-storage workspace. No bottom navigation
// footer. Content scrolls under a sticky glass header.
//
// Governed by:
//   · vault-research.md §10.0 · one-line simplicity principle at unlock
//   · vault-research.md §10.0.1 · one doorway per theme
//   · vault-research.md §10.0.2 · one-interior rule (interior palette locked)
//   · founder spec 2026-10-03 · dark + glass + modern iconography

import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ChevronRight, Lock, Settings, Users } from "lucide-react";
import { resolveServerLocale, tFor } from "@/lib/nex/i18n/server";
import type { I18nKey } from "@/lib/nex/i18n/keys";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import * as vaultEntryService from "@/lib/nex-native/vault-entry-service";
import * as accountService from "@/lib/nex-native/account-service";
import { mapChatThemeToDoorwaySlug } from "./_resolve-theme";
import { NEX, GLASS, GLASS_CHIP } from "./_palette";
import { VaultQuickActions } from "./_upload-dialog";
import { LockVaultNowButton } from "./_lock-button-client";
import { MigrationRunner } from "./_migration-runner-client";
import {
  IconChats,
  IconDocument,
  IconImage,
  IconVideo,
  IconBlueprint,
  IconLock,
  IconArchive,
} from "./_room-icons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FileCategory {
  key: string;
  labelKey: I18nKey;
  blurbKey: I18nKey;
  icon: React.ReactNode;
  href: string;
}

const FILE_CATEGORIES: FileCategory[] = [
  { key: "documents", labelKey: "vault.home.cat.documents.label", blurbKey: "vault.home.cat.documents.blurb", icon: <IconDocument  />, href: "/nex-native/vault/home/documents" },
  { key: "photos",    labelKey: "vault.home.cat.photos.label",    blurbKey: "vault.home.cat.photos.blurb",    icon: <IconImage     />, href: "/nex-native/vault/home/photos" },
  { key: "videos",    labelKey: "vault.home.cat.videos.label",    blurbKey: "vault.home.cat.videos.blurb",    icon: <IconVideo     />, href: "/nex-native/vault/home/videos" },
  { key: "plans",     labelKey: "vault.home.cat.plans.label",     blurbKey: "vault.home.cat.plans.blurb",     icon: <IconBlueprint />, href: "/nex-native/vault/home/plans" },
  { key: "important", labelKey: "vault.home.cat.important.label", blurbKey: "vault.home.cat.important.blurb", icon: <IconLock      />, href: "/nex-native/vault/home/important" },
  { key: "archived",  labelKey: "vault.home.cat.archived.label",  blurbKey: "vault.home.cat.archived.blurb",  icon: <IconArchive   />, href: "/nex-native/vault/home/archived" },
];

export default async function VaultWorkspaceHomePage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/home");
  }

  // Vault Phase A · require configured Vault to view home. Server-side
  // "unlocked" state is tracked by nex_session.last_vault_unlock_at but
  // the authoritative in-tab state is the client VMK singleton. We route
  // based on the configured flag only here; the Lock Vault Now button
  // reflects live client state.
  const { data: setup } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .select("account_id")
    .eq("account_id", session.account.id)
    .maybeSingle();
  if (!setup) {
    redirect("/nex-native/vault/setup");
  }

  const chatTheme = (session.account.chat_theme as string | null) ?? null;
  const doorwaySlug = mapChatThemeToDoorwaySlug(chatTheme);

  // Phase B.7 · Vault surfaces consume the universal NEX i18n pipe.
  const headerBag = await headers();
  const locale = resolveServerLocale({
    accountLocale: (session.account.locale as string | null) ?? null,
    acceptLanguage: headerBag.get("accept-language"),
  });
  const t = tFor(locale);

  // B.4 follow-up (2026-10-07) · the Vaulted Chats section replaces
  // the Phase-A ChatsFriendsCard doorway so each row navigates
  // directly to the sealed B.4 Vault chat route at /vault/home/chats/
  // [conversationId] (one click into the actual conversation · no
  // extra drill-down page). Peer display names + a count are
  // metadata-only · no protected message content is revealed by Vault
  // Home rendering alone · the per-conversation chat page gates
  // plaintext behind VMK unlock.
  const [vaultedConversations, vaultedFriendIds] = await Promise.all([
    vaultEntryService.listVaultedConversationsForAccount(session.account.id),
    vaultEntryService.listVaultedFriendIdsForAccount(session.account.id),
  ]);
  const vaultedChatsRows: Array<{
    conversationId: string;
    peerAccountId: string;
    displayName: string;
    handle: string | null;
  }> = await Promise.all(
    vaultedConversations.map(async (v) => {
      const peer = await accountService.getAccountById(v.peerAccountId);
      return {
        conversationId: v.conversation.id,
        peerAccountId: v.peerAccountId,
        displayName: peer?.display_name ?? "Private contact",
        handle: peer?.nex_handle ?? null,
      };
    }),
  );

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        [data-nex-vault-home] * { box-sizing: border-box; }
        [data-nex-vault-home] button { font-family: inherit; }
        [data-nex-vault-home] a { text-decoration: none; color: inherit; }
      `}</style>
      <div
        data-nex-vault-home
        data-nex-vault-theme-source={doorwaySlug}
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
        <HomeHeader t={t} />
        <main
          id="main"
          style={{
            position: "relative",
            padding: "16px 16px 32px",
            maxWidth: 480,
            margin: "0 auto",
            zIndex: 1,
          }}
        >
          <MigrationRunner />
          <Hero t={t} />
          <VaultedChatsSection
            rows={vaultedChatsRows}
            vaultedFriendCount={vaultedFriendIds.length}
            t={t}
          />
          <ContactsEntryTile t={t} />
          <VaultQuickActions />
          <FileCategoriesList t={t} />
        </main>
      </div>
    </>
  );
}

function HomeHeader({ t }: { t: (k: I18nKey) => string }) {
  return (
    <header
      data-nex-vault-home-header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        padding: "14px 16px 12px",
        background: "rgba(6, 4, 10, 0.72)",
        backdropFilter: NEX.backdropBlur,
        WebkitBackdropFilter: NEX.backdropBlur,
        borderBottom: `1px solid ${NEX.glassBorder}`,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.14em", color: NEX.accent }}>{t("vault.home.brandNex")}</span>
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.18em", color: NEX.textPrimary }}>{t("vault.home.brandVault")}</span>
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: NEX.textSecondary, letterSpacing: "0.005em" }}>
            {t("vault.home.tagline")}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LockVaultNowButton />
          <Link
            href="/nex-native/vault/settings"
            aria-label={t("vault.home.settingsLinkLabel")}
            data-nex-vault-settings-link
            style={{
              ...GLASS_CHIP,
              width: 40,
              height: 40,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: NEX.textPrimary,
            }}
          >
            <Settings size={18} strokeWidth={1.6} aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ t }: { t: (k: I18nKey) => string }) {
  return (
    <section
      data-nex-vault-hero
      aria-label={t("vault.home.heroEyebrow")}
      style={{
        marginTop: 18,
        borderRadius: 24,
        overflow: "hidden",
        position: "relative",
        background: "#0a0608",
        aspectRatio: "16 / 11",
        boxShadow: NEX.cardShadow,
        border: `1px solid ${NEX.glassBorder}`,
      }}
    >
      <Image
        src="/nex-native/vault/nex-doorway.png"
        alt=""
        fill
        priority
        sizes="(max-width: 480px) 100vw, 480px"
        style={{ objectFit: "cover", objectPosition: "center 30%" }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(10,6,8,0) 40%, rgba(10,6,8,0.82) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "18px 18px 20px",
          color: "#F7EFE4",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: NEX.accent,
            fontWeight: 700,
          }}
        >
          {t("vault.home.heroEyebrow")}
        </p>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 14,
            lineHeight: 1.4,
            color: "#F7EFE4",
            maxWidth: 320,
          }}
        >
          {t("vault.home.heroBody")}
        </p>
      </div>
    </section>
  );
}

function VaultedChatsSection(props: {
  rows: Array<{
    conversationId: string;
    peerAccountId: string;
    displayName: string;
    handle: string | null;
  }>;
  vaultedFriendCount: number;
  t: (k: I18nKey) => string;
}) {
  const { t } = props;
  // Section header
  const header = (
    <h2
      data-nex-vault-chats-section-title
      style={{
        fontSize: 11,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: NEX.accent,
        fontWeight: 700,
        margin: "0 2px 10px",
      }}
    >
      {t("vault.home.chats.sectionTitle")}
    </h2>
  );

  if (props.rows.length === 0) {
    // Empty state · the Vault is set up but nothing has been moved
    // in yet · we do NOT reveal protected content so this message is
    // safe to show regardless of lock state.
    return (
      <section
        data-nex-vault-chats-section
        data-nex-vault-chats-empty="true"
        aria-label={t("vault.home.chats.sectionTitle")}
        style={{ marginTop: 20 }}
      >
        {header}
        <div
          style={{
            ...GLASS,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 16px",
            borderRadius: 20,
            minHeight: 72,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: NEX.accentSoft,
              color: NEX.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: `1px solid ${NEX.accentStrong}`,
            }}
          >
            <IconChats />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 600,
                color: NEX.textPrimary,
              }}
            >
              {t("vault.home.chats.empty.title")}
            </p>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 12.5,
                color: NEX.textSecondary,
                lineHeight: 1.35,
              }}
            >
              {t("vault.home.chats.empty.body")}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      data-nex-vault-chats-section
      data-nex-vault-chats-empty="false"
      aria-label={t("vault.home.chats.sectionTitle")}
      style={{
        marginTop: 20,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {header}
      {props.rows.map((r) => (
        <Link
          key={`vconv-${r.conversationId}`}
          href={`/nex-native/vault/home/chats/${r.conversationId}`}
          data-nex-vault-home-chat-link
          data-nex-vault-home-chat-conversation-id={r.conversationId}
          style={{
            ...GLASS,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 16px",
            borderRadius: 18,
            minHeight: 64,
            color: NEX.textPrimary,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background: NEX.accentSoft,
              color: NEX.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: `1px solid ${NEX.accentStrong}`,
            }}
          >
            <IconChats />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: "block",
                fontSize: 15,
                fontWeight: 600,
                color: NEX.textPrimary,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {r.displayName}
            </span>
            <span
              style={{
                display: "block",
                marginTop: 2,
                fontSize: 12,
                color: NEX.textSecondary,
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {r.handle ?? t("vault.home.chatRow.handleFallback")}
            </span>
          </span>
          <span
            aria-hidden
            data-nex-vault-home-chat-badge
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              borderRadius: 999,
              background: NEX.accentSoft,
              color: NEX.accent,
              border: `1px solid ${NEX.accentStrong}`,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              marginRight: 4,
            }}
          >
            <Lock size={11} strokeWidth={2} />
            {t("vault.contacts.vaultBadge")}
          </span>
          <ChevronRight size={18} strokeWidth={1.8} color={NEX.textMuted} aria-hidden />
        </Link>
      ))}
      {props.vaultedFriendCount > 0 ? (
        // The whole-friend-vault path still has its own doorway page ·
        // link here so users with vaulted friends can still reach it.
        <Link
          href="/nex-native/vault/home/chats"
          data-nex-vault-home-friends-doorway
          style={{
            ...GLASS_CHIP,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 16px",
            borderRadius: 18,
            minHeight: 52,
            color: NEX.textPrimary,
            marginTop: 2,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: NEX.textSecondary }}>
            {props.vaultedFriendCount === 1
              ? t("vault.home.friendsVaulted.one")
              : t("vault.home.friendsVaulted.many").replace(
                  "{count}",
                  String(props.vaultedFriendCount),
                )}
          </span>
          <ChevronRight size={16} strokeWidth={1.8} color={NEX.textMuted} aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}

/** Vault Home · Contacts navigation tile. First-class entry at the
 *  same level as Chats + Settings · routes to the sealed Vault
 *  Contacts page which reuses the existing NEX friends system (zero
 *  duplicate contacts, zero duplicate conversation). */
function ContactsEntryTile({ t }: { t: (k: I18nKey) => string }) {
  return (
    <section
      data-nex-vault-contacts-entry
      aria-label={t("vault.home.contacts.sectionTitle")}
      style={{ marginTop: 24 }}
    >
      <h2
        data-nex-vault-contacts-entry-title
        style={{
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: NEX.accent,
          fontWeight: 700,
          margin: "0 2px 10px",
        }}
      >
        {t("vault.home.contacts.sectionTitle")}
      </h2>
      <Link
        href="/nex-native/vault/home/contacts"
        data-nex-vault-contacts-entry-link
        style={{
          ...GLASS,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 16px",
          borderRadius: 18,
          minHeight: 64,
          color: NEX.textPrimary,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            background: NEX.accentSoft,
            color: NEX.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: `1px solid ${NEX.accentStrong}`,
          }}
        >
          <Users size={20} strokeWidth={1.8} aria-hidden />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: 15,
              fontWeight: 600,
              color: NEX.textPrimary,
            }}
          >
            {t("vault.home.contacts.rowTitle")}
          </span>
          <span
            style={{
              display: "block",
              marginTop: 2,
              fontSize: 12.5,
              color: NEX.textSecondary,
              lineHeight: 1.3,
            }}
          >
            {t("vault.home.contacts.rowBlurb")}
          </span>
        </span>
        <ChevronRight size={18} strokeWidth={1.8} color={NEX.textMuted} aria-hidden />
      </Link>
    </section>
  );
}

function FileCategoriesList({ t }: { t: (k: I18nKey) => string }) {
  return (
    <section
      data-nex-vault-categories
      aria-label="File categories"
      style={{
        marginTop: 24,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {FILE_CATEGORIES.map((c) => (
        <Link
          key={c.key}
          href={c.href}
          data-nex-vault-category={c.key}
          style={{
            ...GLASS_CHIP,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 16px",
            borderRadius: 18,
            minHeight: 64,
            color: NEX.textPrimary,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: NEX.accentSoft,
              color: NEX.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: `1px solid ${NEX.accentStrong}`,
            }}
          >
            {c.icon}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: "block",
                fontSize: 14.5,
                fontWeight: 600,
                color: NEX.textPrimary,
              }}
            >
              {t(c.labelKey)}
            </span>
            <span
              style={{
                display: "block",
                fontSize: 12,
                color: NEX.textSecondary,
                marginTop: 2,
                lineHeight: 1.3,
              }}
            >
              {t(c.blurbKey)}
            </span>
          </span>
          <ChevronRight size={18} strokeWidth={1.8} color={NEX.textMuted} aria-hidden />
        </Link>
      ))}
    </section>
  );
}
