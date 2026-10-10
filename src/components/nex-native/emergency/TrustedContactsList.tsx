// src/components/nex-native/emergency/TrustedContactsList.tsx
//
// Trusted contacts list + add form · sealed 2026-10-10 · extended
// by L3 (2026-10-10) to accept email + phone identifiers.
//
// Load-bearing invariants:
//   · Max 10 contacts enforced client-side. Server enforces again ·
//     the client limit is a UX convenience, not the security seal.
//   · Add form accepts THREE identifier fields (account id · email ·
//     phone). AT LEAST ONE must be present client-side before the
//     submit button becomes enabled. The server enforces the same
//     invariant via CHECK constraint (migration 196).
//   · Trusted contacts receive the alert FIRST · this ordering is
//     documented on-screen so users understand why the list matters.

"use client";

import * as React from "react";
import { EMERGENCY_PALETTE } from "./_palette";
import { SimulatedBadge } from "./SimulatedBadge";
import type { TrustedContactRow } from "./types";

export const MAX_TRUSTED_CONTACTS = 10;

export interface TrustedContactsListProps {
  initial: readonly TrustedContactRow[];
  services: {
    add: (args: {
      contactAccountId?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      contactLabel: string | null;
    }) => Promise<TrustedContactRow>;
    remove: (args: {
      trustedContactId?: string | null;
      contactAccountId?: string | null;
    }) => Promise<{ ok: true }>;
  };
  simulated?: boolean;
}

export function TrustedContactsList({
  initial,
  services,
  simulated = true,
}: TrustedContactsListProps): React.JSX.Element {
  const [contacts, setContacts] = React.useState<readonly TrustedContactRow[]>(
    initial,
  );
  const [accountId, setAccountId] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const atLimit = contacts.length >= MAX_TRUSTED_CONTACTS;

  const trimmedAccount = accountId.trim();
  const trimmedEmail = email.trim();
  const trimmedPhone = phone.trim();
  const hasIdentifier =
    trimmedAccount.length > 0
    || trimmedEmail.length > 0
    || trimmedPhone.length > 0;

  const handleAdd = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!hasIdentifier) {
        setError(
          "Enter at least one of: a NEX account id, an email, or a phone number.",
        );
        return;
      }
      if (atLimit) {
        setError(`You can have at most ${MAX_TRUSTED_CONTACTS} trusted contacts.`);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const row = await services.add({
          contactAccountId: trimmedAccount.length > 0 ? trimmedAccount : null,
          contactEmail: trimmedEmail.length > 0 ? trimmedEmail : null,
          contactPhone: trimmedPhone.length > 0 ? trimmedPhone : null,
          contactLabel: label.trim() || null,
        });
        setContacts((prev) => [...prev, row]);
        setAccountId("");
        setEmail("");
        setPhone("");
        setLabel("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add contact.");
      } finally {
        setBusy(false);
      }
    },
    [
      hasIdentifier,
      atLimit,
      services,
      trimmedAccount,
      trimmedEmail,
      trimmedPhone,
      label,
    ],
  );

  const handleRemove = React.useCallback(
    async (row: TrustedContactRow) => {
      setBusy(true);
      setError(null);
      try {
        await services.remove({
          trustedContactId: row.trustedContactId ?? null,
          contactAccountId: row.contactAccountId ?? null,
        });
        setContacts((prev) =>
          prev.filter((c) => {
            if (row.trustedContactId && c.trustedContactId) {
              return c.trustedContactId !== row.trustedContactId;
            }
            if (row.contactAccountId && c.contactAccountId) {
              return c.contactAccountId !== row.contactAccountId;
            }
            // Email/phone-only · fall back to channel identifiers.
            if (row.contactEmail) return c.contactEmail !== row.contactEmail;
            if (row.contactPhone) return c.contactPhone !== row.contactPhone;
            return true;
          }),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not remove contact.");
      } finally {
        setBusy(false);
      }
    },
    [services],
  );

  function contactKey(c: TrustedContactRow): string {
    return (
      c.trustedContactId
      ?? c.contactAccountId
      ?? c.contactEmail
      ?? c.contactPhone
      ?? `anon-${c.addedAt}`
    );
  }

  function primaryIdentifier(c: TrustedContactRow): string {
    return (
      c.contactLabel
      ?? c.contactAccountId
      ?? c.contactEmail
      ?? c.contactPhone
      ?? "(unknown)"
    );
  }

  function secondaryIdentifier(c: TrustedContactRow): string | null {
    const parts: string[] = [];
    if (c.contactLabel) {
      if (c.contactAccountId) parts.push(c.contactAccountId);
      if (c.contactEmail) parts.push(c.contactEmail);
      if (c.contactPhone) parts.push(c.contactPhone);
    } else {
      // Avoid showing the same string twice.
      const first = primaryIdentifier(c);
      if (c.contactEmail && c.contactEmail !== first) parts.push(c.contactEmail);
      if (c.contactPhone && c.contactPhone !== first) parts.push(c.contactPhone);
    }
    return parts.length > 0 ? parts.join(" · ") : null;
  }

  return (
    <section
      data-testid="nex-emergency-trusted-contacts"
      style={{
        padding: 20,
        background: EMERGENCY_PALETTE.surface,
        border: `1px solid ${EMERGENCY_PALETTE.divider}`,
        borderRadius: 14,
        color: EMERGENCY_PALETTE.textPrimary,
      }}
    >
      <SimulatedBadge live={!simulated} />
      <h2 style={{ margin: "14px 0 6px", fontSize: 20, fontWeight: 700 }}>
        Trusted contacts
      </h2>
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 12.5,
          color: EMERGENCY_PALETTE.textSecondary,
          lineHeight: 1.55,
        }}
      >
        Trusted contacts receive the emergency alert FIRST, before nearby
        responders. You can have up to {MAX_TRUSTED_CONTACTS} contacts. A
        trusted contact can be a NEX account, an email address, or a phone
        number — whichever reaches them.
      </p>

      <ul
        data-testid="nex-emergency-contacts-list"
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0 0 16px",
          display: "grid",
          gap: 8,
        }}
      >
        {contacts.length === 0 ? (
          <li
            style={{
              padding: 12,
              background: EMERGENCY_PALETTE.surfaceMuted,
              border: `1px dashed ${EMERGENCY_PALETTE.divider}`,
              borderRadius: 10,
              color: EMERGENCY_PALETTE.textSecondary,
              fontSize: 13,
            }}
          >
            No trusted contacts yet.
          </li>
        ) : (
          contacts.map((c) => {
            const key = contactKey(c);
            const secondary = secondaryIdentifier(c);
            return (
              <li
                key={key}
                data-nex-emergency-contact-id={c.contactAccountId ?? key}
                data-nex-emergency-contact-trusted-id={c.trustedContactId ?? ""}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  background: EMERGENCY_PALETTE.surfaceMuted,
                  border: `1px solid ${EMERGENCY_PALETTE.divider}`,
                  borderRadius: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {primaryIdentifier(c)}
                  </div>
                  {secondary ? (
                    <div
                      style={{
                        fontSize: 11,
                        color: EMERGENCY_PALETTE.textDim,
                      }}
                    >
                      {secondary}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  data-testid={`nex-emergency-contact-remove-${key}`}
                  onClick={() => handleRemove(c)}
                  disabled={busy}
                  style={{
                    padding: "6px 10px",
                    background: "transparent",
                    color: EMERGENCY_PALETTE.emergency,
                    border: `1px solid ${EMERGENCY_PALETTE.emergencyBorder}`,
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: busy ? "default" : "pointer",
                  }}
                >
                  Remove
                </button>
              </li>
            );
          })
        )}
      </ul>

      <form onSubmit={handleAdd} data-testid="nex-emergency-contact-add-form">
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: EMERGENCY_PALETTE.textDim,
          }}
        >
          Add contact
        </div>
        <p
          style={{
            margin: "6px 0 2px",
            fontSize: 11.5,
            color: EMERGENCY_PALETTE.textSecondary,
            lineHeight: 1.45,
          }}
        >
          Fill in at least one of: NEX account id, email, or phone.
        </p>
        <input
          type="text"
          name="accountId"
          placeholder="NEX account id (optional)"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          data-testid="nex-emergency-contact-account-id"
          style={textInputStyle}
          disabled={atLimit}
        />
        <input
          type="email"
          name="contactEmail"
          placeholder="Email (optional · e.g. mum@example.com)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="nex-emergency-contact-email"
          style={textInputStyle}
          disabled={atLimit}
          autoComplete="off"
        />
        <input
          type="tel"
          name="contactPhone"
          placeholder="Phone (optional · e.g. +62 812 345 67)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          data-testid="nex-emergency-contact-phone"
          style={textInputStyle}
          disabled={atLimit}
          autoComplete="off"
        />
        <input
          type="text"
          name="label"
          placeholder="Label (optional · e.g. 'Mum')"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          data-testid="nex-emergency-contact-label"
          style={textInputStyle}
          disabled={atLimit}
        />
        <button
          type="submit"
          disabled={busy || atLimit || !hasIdentifier}
          data-testid="nex-emergency-contact-submit"
          style={{
            marginTop: 10,
            padding: "10px 14px",
            background: EMERGENCY_PALETTE.cyan,
            color: EMERGENCY_PALETTE.bg,
            border: "none",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            cursor: busy || atLimit ? "default" : "pointer",
            opacity: busy || atLimit || !hasIdentifier ? 0.5 : 1,
          }}
        >
          {atLimit ? "List full" : busy ? "Adding…" : "Add"}
        </button>
      </form>

      {error ? (
        <p
          role="alert"
          data-testid="nex-emergency-contacts-error"
          style={{
            marginTop: 12,
            padding: 10,
            background: EMERGENCY_PALETTE.emergencyMuted,
            border: `1px solid ${EMERGENCY_PALETTE.emergencyBorder}`,
            borderRadius: 10,
            fontSize: 13,
            color: EMERGENCY_PALETTE.textPrimary,
          }}
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}

const textInputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 8,
  padding: "10px 12px",
  background: EMERGENCY_PALETTE.surfaceMuted,
  color: EMERGENCY_PALETTE.textPrimary,
  border: `1px solid ${EMERGENCY_PALETTE.divider}`,
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
};
