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
import { useT } from "@/lib/nex/i18n/I18nProvider";
import { NEX, GLASS, GLASS_CHIP } from "../_palette";
import { MoveToVaultAffordance } from "../../_move-to-vault-affordance";
import { VaultContactActionSheet } from "./_vault-contact-action-sheet";

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
  /** True iff EITHER the canonical conversation OR the friendship
   *  itself is in the viewer's Vault (bug-fix 2026-10-07 · recognises
   *  friend-vault entries). Pure metadata · no message content is
   *  read to compute it. */
  isVaulted: boolean;
  /** Phase 1 Security · peer's most-recent live-session
   *  approx_country · 2-letter ISO code or null if never signed in
   *  from a tracked session. Peer-visibility policy sealed 2026-10-07
   *  limits exposure to country level (NOT city). */
  approxCountry: string | null;
  /** Phase B.7 formatRelativeFrom(peer.last_seen_at, locale) · a
   *  locale-aware RELATIVE phrase (never an exact timestamp). Null
   *  when the peer has no tracked session. */
  lastSeenRelative: string | null;
}

interface Props {
  viewerAccountId: string;
  rows: VaultContactRow[];
}

export function VaultContactsClient({ rows }: Props) {
  const t = useT();
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
            heading={t("vault.contacts.empty.noneTitle")}
            body={t("vault.contacts.empty.noneBody")}
          />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            heading={t("vault.contacts.empty.noMatchTitle")}
            body={t("vault.contacts.empty.noMatchBody")}
          />
        ) : (
          <section
            data-nex-vault-contacts-list
            aria-label={t("vault.contacts.listAriaLabel")}
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
  const t = useT();
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
          aria-label={t("vault.contacts.header.backLabel")}
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
            {t("vault.contacts.header.title")}
          </h1>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 11.5,
              color: NEX.textSecondary,
              letterSpacing: "0.005em",
            }}
          >
            {t("vault.contacts.header.subtitle")}
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
  const t = useT();
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
        placeholder={t("vault.contacts.search.placeholder")}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        aria-label={t("vault.contacts.search.ariaLabel")}
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

  // Vaulted contact · the row is wrapped in the new Vault-contact
  // action sheet which exposes Move-from-Vault / Delete-from-Vault /
  // Block through long-press · right-click · 3-dot chip. Tapping
  // the row still opens the sealed B.4 Vault chat (which enforces
  // unlock) if there is a conversation · otherwise it links to the
  // sealed /chat/peer path (which falls back to normal chat because
  // the vault entry is friend-only). The row body carries the
  // sealed data-attributes used by the deterministic + Playwright
  // suites so existing invariants hold.
  if (row.isVaulted) {
    const chatHref = vaultedTarget ?? normalChatTarget;
    // Whether the FRIENDSHIP is in Vault (vs just the conversation).
    // The server derives isVaulted from either axis · the client
    // can distinguish by whether a conversation id was resolved AND
    // the conversation-vault branch applies. In practice the sheet
    // calls both remove-actions · each is idempotent · so we pass
    // isFriendVaulted=true conservatively when there is no
    // conversation id (that's the only path where friend-vault must
    // apply) · and when there IS a conversation id we also pass true
    // because the user may have vaulted the friend AND the chat.
    const isFriendVaulted = true;
    return (
      <VaultContactActionSheet
        friendId={row.friendId}
        friendName={row.displayName}
        conversationId={row.conversationId}
        isFriendVaulted={isFriendVaulted}
      >
        <Link
          href={chatHref}
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
      </VaultContactActionSheet>
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
  const t = useT();
  // Build the second line from the data we're authorised to expose:
  // handle · approx country · relative last-seen. Each piece is
  // dropped silently when its source is null · the line never
  // reveals exact timestamps, cities, IPs, UAs, or device labels.
  const subLineParts: string[] = [];
  if (row.handle) subLineParts.push(row.handle);
  if (row.approxCountry) {
    subLineParts.push(formatCountryCode(row.approxCountry));
  }
  if (row.lastSeenRelative) {
    subLineParts.push(
      t("vault.contacts.row.seenPrefixTemplate").replace(
        "{relative}",
        row.lastSeenRelative,
      ),
    );
  }
  const subLine =
    subLineParts.length > 0
      ? subLineParts.join(" · ")
      : t("vault.contacts.row.defaultHandle");
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
        data-nex-vault-contact-subline
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
        {subLine}
      </span>
    </span>
  );
}

/** Render a 2-letter ISO country code as a flag emoji followed by
 *  the uppercase code. Peer-visibility policy caps country output
 *  at this level · we never render city, IP, UA, or exact timestamp
 *  on this surface. */
function formatCountryCode(code: string): string {
  const trimmed = code.trim();
  if (trimmed.length !== 2) return trimmed.toUpperCase();
  const upper = trimmed.toUpperCase();
  const A = 0x1f1e6; // regional indicator symbol letter A
  const flag =
    String.fromCodePoint(A + (upper.charCodeAt(0) - 65)) +
    String.fromCodePoint(A + (upper.charCodeAt(1) - 65));
  return `${flag} ${upper}`;
}

function VaultBadge() {
  const t = useT();
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
        background: NEX.secureSoft,
        color: NEX.secure,
        border: `1px solid ${NEX.secureStrong}`,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.14em",
        marginRight: 4,
      }}
    >
      <Lock size={11} strokeWidth={2} />
      {t("vault.contacts.vaultBadge")}
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
