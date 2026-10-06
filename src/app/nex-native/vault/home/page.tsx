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
import { redirect } from "next/navigation";
import { ChevronRight, Settings } from "lucide-react";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
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
  label: string;
  blurb: string;
  icon: React.ReactNode;
  href: string;
}

const FILE_CATEGORIES: FileCategory[] = [
  { key: "documents", label: "Documents",       blurb: "Contracts, manuals, reports…",       icon: <IconDocument  />, href: "/nex-native/vault/home/documents" },
  { key: "photos",    label: "Photos",          blurb: "Site photos, designs, reference…",   icon: <IconImage     />, href: "/nex-native/vault/home/photos" },
  { key: "videos",    label: "Videos",          blurb: "Site videos, training, walkthroughs…", icon: <IconVideo    />, href: "/nex-native/vault/home/videos" },
  { key: "plans",     label: "Plans & Drawings", blurb: "PDFs, CAD, technical drawings…",      icon: <IconBlueprint />, href: "/nex-native/vault/home/plans" },
  { key: "important", label: "Important",        blurb: "Contracts, certificates, credentials…", icon: <IconLock    />, href: "/nex-native/vault/home/important" },
  { key: "archived",  label: "Archived",         blurb: "Older files, backups…",               icon: <IconArchive  />, href: "/nex-native/vault/home/archived" },
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
        <HomeHeader />
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
          <Hero />
          <VaultQuickActions />
          <ChatsFriendsCard />
          <FileCategoriesList />
        </main>
      </div>
    </>
  );
}

function HomeHeader() {
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
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.14em", color: NEX.accent }}>NEX</span>
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.18em", color: NEX.textPrimary }}>VAULT</span>
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: NEX.textSecondary, letterSpacing: "0.005em" }}>
            Your important files. Secure. Always with you.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LockVaultNowButton />
          <Link
            href="/nex-native/vault/settings"
            aria-label="Vault settings"
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

function Hero() {
  return (
    <section
      data-nex-vault-hero
      aria-label="NEX Vault hero"
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
          NEX Vault
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
          Secure your documents, photos and important files.
        </p>
      </div>
    </section>
  );
}

function ChatsFriendsCard() {
  return (
    <section
      data-nex-vault-chats-friends
      aria-label="Chats and Friends doorway"
      style={{ marginTop: 20 }}
    >
      <Link
        href="/nex-native/vault/home/chats"
        data-nex-vault-chats-link
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
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: NEX.textPrimary }}>
            Chats &amp; Friends
          </p>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 12.5,
              color: NEX.textSecondary,
              lineHeight: 1.35,
            }}
          >
            Messages, people and shared files
          </p>
        </div>
        <ChevronRight size={18} strokeWidth={1.8} color={NEX.textMuted} aria-hidden />
      </Link>
    </section>
  );
}

function FileCategoriesList() {
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
              {c.label}
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
              {c.blurb}
            </span>
          </span>
          <ChevronRight size={18} strokeWidth={1.8} color={NEX.textMuted} aria-hidden />
        </Link>
      ))}
    </section>
  );
}
