"use client";

// src/app/nex-native/vault/home/contacts/_contacts-client.tsx
//
// Vault Contacts · client surface.
// --------------------------------
// Sticky Vault header · Back + title · Search field · list of
// friend rows. Each row routes according to the CANONICAL
// conversation state resolved on the server:
//
//   · vaulted-and-exists → sealed /vault/home/chats/<convId> (B.4)
//   · exists-not-vaulted → /chat/peer/<friendId> + Move-to-Vault chip
//                           (reuses sealed B.5 MoveToVaultAffordance ·
//                           SAME conversationId, no duplicate)
//   · no conversation    → /chat/peer/<friendId> (sealed path · the
//                           first send calls getOrCreatePeerConversation
//                           which assigns the canonical pair id)
//
// The row NEVER reveals a message preview, attachment, or any
// plaintext · identity + a Vault-badge boolean only.

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Search } from "lucide-react";
import { NEX, GLASS, GLASS_CHIP } from "../_palette";
import { MoveToVaultAffordance } from "../../_move-to-vault-affordance";

export interface VaultContactRow {
  friendId: string;
  displayName: string;
  handle: string | null;
  /** Canonical nex_peer_conversation.id if a conversation already
   *  exists between the viewer and this friend · null if the pair
   *  has never messaged. We NEVER create a conversation from this
   *  surface · a null here routes to the sealed chat path which
   *  only inserts a row on the first actual send. */
  conversationId: string | null;
  /** True iff the canonical conversation is in the viewer's Vault.
   *  Pure metadata · no message content is read to compute it. */
  isVaulted: boolean;
}

interface Props {
  viewerAccountId: string;
  rows: VaultContactRow[];
}

export function VaultContactsClient({ rows }: Props) {
  const [query, setQuery] = useState("");
  const normalisedQuery = query.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    if (normalisedQuery === "") return rows;
    return rows.filter((r) => {
      if (r.displayName.toLowerCase().includes(normalisedQuery)) return true;
      if (r.handle && r.handle.toLowerCase().includes(normalisedQuery)) {
        return true;
      }
      return false;
    });
  }, [rows, normalisedQuery]);

  return (
    <div
      data-nex-vault-contacts
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
      <ContactsHeader />
      <main
        id="main"
        data-nex-vault-contacts-main
        style={{
          position: "relative",
          padding: "16px 16px 32px",
          maxWidth: 480,
          margin: "0 auto",
          zIndex: 1,
        }}
      >
        <SearchField value={query} onChange={setQuery} />

        {rows.length === 0 ? (
          <EmptyState
            heading="No contacts yet"
            body="Add a friend on NEX and they'll appear here. Vault stays in sync with your NEX contacts automatically."
          />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            heading="No contact matches"
            body="Try a shorter search · the whole list stays available when you clear the field."
          />
        ) : (
          <section
            data-nex-vault-contacts-list
            aria-label="Vault contacts"
            style={{
              marginTop: 14,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {filteredRows.map((row) => (
              <ContactRowView key={row.friendId} row={row} />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

function ContactsHeader() {
  return (
    <header
      data-nex-vault-contacts-header
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
          gap: 12,
        }}
      >
        <Link
          href="/nex-native/vault/home"
          aria-label="Back to Vault Home"
          data-nex-vault-contacts-back
          style={{
            ...GLASS_CHIP,
            width: 38,
            height: 38,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: NEX.textPrimary,
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={18} strokeWidth={1.8} aria-hidden />
        </Link>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <h1
            data-nex-vault-contacts-title
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "0.005em",
              color: NEX.textPrimary,
            }}
          >
            Contacts
          </h1>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 11.5,
              color: NEX.textSecondary,
              letterSpacing: "0.005em",
            }}
          >
            Your NEX contacts · tap to open or move into Vault.
          </p>
        </div>
      </div>
    </header>
  );
}

function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label
      data-nex-vault-contacts-search
      style={{
        ...GLASS_CHIP,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 14,
        color: NEX.textPrimary,
      }}
    >
      <Search size={16} strokeWidth={1.8} color={NEX.textSecondary} aria-hidden />
      <input
        type="search"
        inputMode="search"
        placeholder="Search contacts…"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        aria-label="Search contacts"
        data-nex-vault-contacts-search-input
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          color: NEX.textPrimary,
          fontSize: 14,
          outline: "none",
          padding: "4px 0",
          fontFamily: "inherit",
          minWidth: 0,
        }}
      />
    </label>
  );
}

function ContactRowView({ row }: { row: VaultContactRow }) {
  const vaultedTarget = row.conversationId
    ? `/nex-native/vault/home/chats/${row.conversationId}`
    : null;
  const normalChatTarget = `/nex-native/chat/peer/${row.friendId}`;

  // Vaulted conversation · open the sealed B.4 Vault chat. The B.4
  // page enforces unlock before any plaintext renders.
  if (row.isVaulted && vaultedTarget) {
    return (
      <Link
        href={vaultedTarget}
        data-nex-vault-contact
        data-nex-vault-contact-state="vaulted"
        data-nex-vault-contact-friend-id={row.friendId}
        data-nex-vault-contact-conversation-id={row.conversationId ?? ""}
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
        <ContactAvatar row={row} />
        <ContactIdentity row={row} />
        <VaultBadge />
        <ChevronRight size={18} strokeWidth={1.8} color={NEX.textMuted} aria-hidden />
      </Link>
    );
  }

  // Conversation exists but is not in Vault · route to the sealed
  // normal chat path AND offer the sealed Move-to-Vault chip so the
  // user can promote the conversation to Vault without duplicating
  // it. The chip's long-press / right-click / 3-dot UI is sealed.
  if (row.conversationId) {
    return (
      <MoveToVaultAffordance
        mode={{
          kind: "move-conversation",
          conversationId: row.conversationId,
          friendName: row.displayName,
        }}
        showChip
      >
        <Link
          href={normalChatTarget}
          data-nex-vault-contact
          data-nex-vault-contact-state="not-vaulted"
          data-nex-vault-contact-friend-id={row.friendId}
          data-nex-vault-contact-conversation-id={row.conversationId}
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
          <ContactAvatar row={row} />
          <ContactIdentity row={row} />
          <ChevronRight size={18} strokeWidth={1.8} color={NEX.textMuted} aria-hidden />
        </Link>
      </MoveToVaultAffordance>
    );
  }

  // No conversation yet · route to the sealed normal chat path. The
  // sealed chat page calls getOrCreatePeerConversation on the first
  // send which assigns the canonical pair id. We do NOT create a
  // conversation from this Contacts surface.
  return (
    <Link
      href={normalChatTarget}
      data-nex-vault-contact
      data-nex-vault-contact-state="no-conversation"
      data-nex-vault-contact-friend-id={row.friendId}
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
      <ContactAvatar row={row} />
      <ContactIdentity row={row} />
      <ChevronRight size={18} strokeWidth={1.8} color={NEX.textMuted} aria-hidden />
    </Link>
  );
}

function ContactAvatar({ row }: { row: VaultContactRow }) {
  const seed = row.displayName.charCodeAt(0) || 65;
  const hue = (seed * 23) % 360;
  const letter = (row.displayName.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        background: `hsla(${hue}, 32%, 32%, 0.9)`,
        color: NEX.textPrimary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 15,
        fontWeight: 700,
        flexShrink: 0,
        border: `1px solid ${NEX.glassBorder}`,
      }}
    >
      {letter}
    </span>
  );
}

function ContactIdentity({ row }: { row: VaultContactRow }) {
  return (
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
        {row.displayName}
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
        {row.handle ?? "NEX contact"}
      </span>
    </span>
  );
}

function VaultBadge() {
  return (
    <span
      aria-hidden
      data-nex-vault-contact-badge
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
      VAULT
    </span>
  );
}

function EmptyState({ heading, body }: { heading: string; body: string }) {
  return (
    <section
      data-nex-vault-contacts-empty
      aria-label="No contacts to show"
      style={{
        ...GLASS,
        marginTop: 14,
        padding: "16px 18px",
        borderRadius: 18,
        color: NEX.textPrimary,
      }}
    >
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{heading}</p>
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 12.5,
          color: NEX.textSecondary,
          lineHeight: 1.4,
        }}
      >
        {body}
      </p>
    </section>
  );
}
