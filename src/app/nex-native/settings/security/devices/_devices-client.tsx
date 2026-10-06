"use client";

// src/app/nex-native/settings/security/devices/_devices-client.tsx
//
// NEX Phase 1.0 Security · Devices page client surface.
// Sealed 2026-10-06. Owns the interactive bits: session row controls
// (sign out · trust toggle), credential rename form, revoke, and the
// global "sign out all other sessions" button. Server-side mutations
// land through the /api/nex-native/security/* endpoints.

import * as React from "react";
import Link from "next/link";

const NEX = {
  cyan: "#00AFFF",
  orange: "#FF7800",
  green: "#16D66B",
  rose: "#FF6B8A",
  panel: "rgba(16,30,52,0.72)",
  panelAccent: "rgba(0,175,255,0.26)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
};

export interface SessionView {
  id: string;
  device_label: string;
  approx_location: string;
  user_agent: string | null;
  last_seen_iso: string;
  created_iso: string;
  trusted: boolean;
  is_current: boolean;
  revoked: boolean;
}

export interface CredentialView {
  credential_id: string;
  label: string;
  created_iso: string;
  last_used_iso: string | null;
}

export interface DevicesClientProps {
  sessions: SessionView[];
  credentials: CredentialView[];
}

export function DevicesClient({
  sessions,
  credentials,
}: DevicesClientProps): React.JSX.Element {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  const refresh = () => {
    window.location.reload();
  };

  async function signOutSession(sessionId: string) {
    setBusy(`revoke:${sessionId}`);
    setBanner(null);
    try {
      const res = await fetch("/api/nex-native/security/sessions/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "revoke failed");
      setBanner({ tone: "ok", text: "Session signed out." });
      refresh();
    } catch (e) {
      setBanner({ tone: "error", text: e instanceof Error ? e.message : "Error" });
    } finally {
      setBusy(null);
    }
  }

  async function toggleTrusted(sessionId: string, trusted: boolean) {
    setBusy(`trust:${sessionId}`);
    setBanner(null);
    try {
      const res = await fetch("/api/nex-native/security/sessions/trust", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, trusted }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "trust toggle failed");
      refresh();
    } catch (e) {
      setBanner({ tone: "error", text: e instanceof Error ? e.message : "Error" });
    } finally {
      setBusy(null);
    }
  }

  async function signOutAllOthers() {
    const confirmed = window.confirm(
      "Sign out of every other device? You will stay signed in on THIS device. Other devices will be bounced to sign-in on their next request.",
    );
    if (!confirmed) return;
    setBusy("revoke-all");
    setBanner(null);
    try {
      const res = await fetch("/api/nex-native/security/sessions/revoke-all", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "sign-out-all failed");
      setBanner({
        tone: "ok",
        text: `Signed out ${data.revoked_count} other ${data.revoked_count === 1 ? "device" : "devices"}.`,
      });
      refresh();
    } catch (e) {
      setBanner({ tone: "error", text: e instanceof Error ? e.message : "Error" });
    } finally {
      setBusy(null);
    }
  }

  async function revokeCredential(credentialId: string) {
    const confirmed = window.confirm(
      "Revoke this face sign-in credential? You can enrol a new one anytime from Devices.",
    );
    if (!confirmed) return;
    setBusy(`cred-revoke:${credentialId}`);
    setBanner(null);
    try {
      const res = await fetch("/api/nex-native/security/credentials/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential_id: credentialId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "revoke failed");
      setBanner({ tone: "ok", text: "Credential revoked." });
      refresh();
    } catch (e) {
      setBanner({ tone: "error", text: e instanceof Error ? e.message : "Error" });
    } finally {
      setBusy(null);
    }
  }

  async function renameCredential(credentialId: string, currentLabel: string) {
    const next = window.prompt("Rename this face sign-in credential:", currentLabel);
    if (next === null) return;
    const trimmed = next.trim();
    if (trimmed.length === 0) return;
    setBusy(`cred-rename:${credentialId}`);
    setBanner(null);
    try {
      const res = await fetch("/api/nex-native/security/credentials/rename", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential_id: credentialId, label: trimmed }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "rename failed");
      setBanner({ tone: "ok", text: "Credential renamed." });
      refresh();
    } catch (e) {
      setBanner({ tone: "error", text: e instanceof Error ? e.message : "Error" });
    } finally {
      setBusy(null);
    }
  }

  const otherSessionCount = sessions.filter((s) => !s.is_current && !s.revoked).length;

  return (
    <div
      data-nex-devices-client
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      {banner && (
        <div
          role="status"
          data-nex-devices-banner={banner.tone}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background:
              banner.tone === "ok"
                ? "rgba(22,214,107,0.12)"
                : "rgba(255,107,138,0.12)",
            border: `1px solid ${
              banner.tone === "ok" ? "rgba(22,214,107,0.4)" : "rgba(255,107,138,0.4)"
            }`,
            color: NEX.text,
            fontSize: 12,
          }}
        >
          {banner.text}
        </div>
      )}

      <section data-nex-devices-sessions aria-labelledby="sessions-head">
        <SectionHead id="sessions-head" label="Active sessions" />
        {sessions.length === 0 ? (
          <EmptyState text="No active sessions yet · signing in anywhere will add one here." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                busy={busy}
                onRevoke={() => signOutSession(s.id)}
                onToggleTrust={() => toggleTrusted(s.id, !s.trusted)}
              />
            ))}
          </div>
        )}
        {otherSessionCount > 0 && (
          <button
            type="button"
            data-nex-devices-signout-all
            onClick={signOutAllOthers}
            disabled={busy !== null}
            style={{
              marginTop: 14,
              padding: "12px 16px",
              borderRadius: 10,
              background: "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
              border: "1px solid rgba(255,120,0,0.6)",
              color: "#0B0F1A",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: busy ? "wait" : "pointer",
              fontFamily: "inherit",
              width: "100%",
            }}
          >
            {busy === "revoke-all"
              ? "Signing out…"
              : `Sign out all other sessions (${otherSessionCount})`}
          </button>
        )}
      </section>

      <section data-nex-devices-credentials aria-labelledby="creds-head">
        <SectionHead id="creds-head" label="Face sign-in credentials" />
        {credentials.length === 0 ? (
          <EmptyState text="No face sign-in enrolled yet. Add one to sign in with Face ID / Touch ID / Windows Hello." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {credentials.map((c) => (
              <CredentialRow
                key={c.credential_id}
                cred={c}
                busy={busy}
                onRename={() => renameCredential(c.credential_id, c.label)}
                onRevoke={() => revokeCredential(c.credential_id)}
              />
            ))}
          </div>
        )}
        <Link
          href="/nex-native/sign-in?enroll=1"
          prefetch={false}
          data-nex-devices-add-face
          style={{
            display: "inline-block",
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 10,
            background: "transparent",
            border: `1px solid ${NEX.cyan}`,
            color: NEX.cyan,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          + Add another face
        </Link>
      </section>
    </div>
  );
}

function SectionHead({ id, label }: { id: string; label: string }): React.JSX.Element {
  return (
    <h2
      id={id}
      style={{
        margin: "0 0 10px",
        fontSize: 11,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: NEX.cyan,
        fontWeight: 800,
      }}
    >
      {label}
    </h2>
  );
}

function EmptyState({ text }: { text: string }): React.JSX.Element {
  return (
    <div
      style={{
        padding: "16px 14px",
        borderRadius: 10,
        background: "rgba(16,30,52,0.4)",
        border: "1px dashed rgba(139,169,209,0.26)",
        fontSize: 12,
        color: NEX.textDim,
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}

function SessionRow({
  session,
  busy,
  onRevoke,
  onToggleTrust,
}: {
  session: SessionView;
  busy: string | null;
  onRevoke: () => void;
  onToggleTrust: () => void;
}): React.JSX.Element {
  const revoked = session.revoked;
  const isBusy = busy?.endsWith(session.id) === true;
  return (
    <div
      data-nex-session-row={session.id}
      data-nex-session-current={session.is_current ? "true" : "false"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "14px 16px",
        borderRadius: 12,
        background: NEX.panel,
        border: session.is_current
          ? `1px solid ${NEX.green}`
          : `1px solid ${NEX.panelAccent}`,
        opacity: revoked ? 0.6 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: NEX.text }}>
          {session.device_label}
        </div>
        {session.is_current && (
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 800,
              padding: "2px 6px",
              borderRadius: 999,
              background: "rgba(22,214,107,0.18)",
              color: NEX.green,
              border: `1px solid ${NEX.green}`,
            }}
          >
            Current
          </span>
        )}
        {session.trusted && (
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 800,
              padding: "2px 6px",
              borderRadius: 999,
              background: "rgba(0,175,255,0.14)",
              color: NEX.cyan,
              border: `1px solid ${NEX.cyan}`,
            }}
          >
            Trusted
          </span>
        )}
        {revoked && (
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 800,
              padding: "2px 6px",
              borderRadius: 999,
              background: "rgba(255,107,138,0.12)",
              color: NEX.rose,
              border: `1px solid ${NEX.rose}`,
            }}
          >
            Signed out
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 12,
          color: NEX.textDim,
          lineHeight: 1.5,
        }}
      >
        {session.approx_location} · last seen {formatRelative(session.last_seen_iso)}
      </div>
      {!revoked && !session.is_current && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
          <button
            type="button"
            data-nex-session-signout={session.id}
            onClick={onRevoke}
            disabled={isBusy}
            style={pillButtonStyle(NEX.orange)}
          >
            Sign out
          </button>
          <button
            type="button"
            data-nex-session-trust={session.id}
            onClick={onToggleTrust}
            disabled={isBusy}
            style={pillButtonStyle(session.trusted ? NEX.textMute : NEX.cyan)}
          >
            {session.trusted ? "Untrust" : "Trust"}
          </button>
        </div>
      )}
    </div>
  );
}

function CredentialRow({
  cred,
  busy,
  onRename,
  onRevoke,
}: {
  cred: CredentialView;
  busy: string | null;
  onRename: () => void;
  onRevoke: () => void;
}): React.JSX.Element {
  const isBusy = busy?.endsWith(cred.credential_id) === true;
  return (
    <div
      data-nex-credential-row={cred.credential_id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "14px 16px",
        borderRadius: 12,
        background: NEX.panel,
        border: `1px solid ${NEX.panelAccent}`,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: NEX.text }}>
        {cred.label}
      </div>
      <div style={{ fontSize: 12, color: NEX.textDim, lineHeight: 1.5 }}>
        Enrolled {formatRelative(cred.created_iso)}
        {cred.last_used_iso ? ` · last used ${formatRelative(cred.last_used_iso)}` : " · never used"}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
        <button
          type="button"
          data-nex-credential-rename={cred.credential_id}
          onClick={onRename}
          disabled={isBusy}
          style={pillButtonStyle(NEX.cyan)}
        >
          Rename
        </button>
        <button
          type="button"
          data-nex-credential-revoke={cred.credential_id}
          onClick={onRevoke}
          disabled={isBusy}
          style={pillButtonStyle(NEX.orange)}
        >
          Revoke
        </button>
      </div>
    </div>
  );
}

function pillButtonStyle(tone: string): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    background: "transparent",
    border: `1px solid ${tone}`,
    color: tone,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

function formatRelative(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return iso;
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.round(days / 365);
  return `${years}y ago`;
}
