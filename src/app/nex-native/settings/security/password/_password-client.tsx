"use client";

// src/app/nex-native/settings/security/password/_password-client.tsx
//
// NEX Phase 1.0 Security · Password change form (client component).
// POSTs to /api/nex-native/security/password/change · the route
// verifies the current password via Supabase sign-in and updates via
// the admin API.

import * as React from "react";

const NEX = {
  cyan: "#00AFFF",
  orange: "#FF7800",
  green: "#16D66B",
  rose: "#FF6B8A",
  panel: "rgba(16,30,52,0.72)",
  panelAccent: "rgba(0,175,255,0.26)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
};

export function PasswordChangeForm(): React.JSX.Element {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    if (next.length < 8) {
      setBanner({ tone: "error", text: "Password must be at least 8 characters." });
      return;
    }
    if (next !== confirm) {
      setBanner({ tone: "error", text: "New password and confirmation do not match." });
      return;
    }
    if (current === next) {
      setBanner({ tone: "error", text: "New password must be different from the current one." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/nex-native/security/password/change", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current, new: next }),
      });
      const data = await res.json();
      if (!data.ok) {
        setBanner({
          tone: "error",
          text: friendlyError(data.error ?? "unknown"),
        });
        return;
      }
      setBanner({
        tone: "ok",
        text: "Password changed. Next sign-in will use the new password.",
      });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      setBanner({
        tone: "error",
        text: e instanceof Error ? e.message : "Network error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      data-nex-password-form
      onSubmit={onSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      {banner && (
        <div
          role="status"
          data-nex-password-banner={banner.tone}
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

      <Field
        label="Current password"
        name="current"
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
      />
      <Field
        label="New password"
        name="new"
        value={next}
        onChange={setNext}
        autoComplete="new-password"
        hint="At least 8 characters. Mix letters, numbers, and symbols for best protection."
      />
      <Field
        label="Confirm new password"
        name="confirm"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />

      <button
        type="submit"
        data-nex-password-submit
        disabled={busy || !current || !next || !confirm}
        style={{
          marginTop: 6,
          padding: "12px 16px",
          borderRadius: 10,
          background: "linear-gradient(180deg, #00C8FF 0%, #00AFFF 100%)",
          border: `1px solid ${NEX.cyan}`,
          color: "#0B0F1A",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: busy ? "wait" : "pointer",
          fontFamily: "inherit",
          opacity: busy || !current || !next || !confirm ? 0.6 : 1,
        }}
      >
        {busy ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
}): React.JSX.Element {
  return (
    <label
      style={{ display: "flex", flexDirection: "column", gap: 4 }}
      data-nex-password-field={name}
    >
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: NEX.textDim,
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <input
        type="password"
        name={name}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "11px 12px",
          borderRadius: 10,
          background: NEX.panel,
          border: `1px solid ${NEX.panelAccent}`,
          color: NEX.text,
          fontSize: 14,
          fontFamily: "inherit",
        }}
      />
      {hint && (
        <span style={{ fontSize: 11, color: NEX.textDim, lineHeight: 1.5 }}>
          {hint}
        </span>
      )}
    </label>
  );
}

function friendlyError(code: string): string {
  switch (code) {
    case "wrong_current_password":
      return "Current password is incorrect.";
    case "weak_password":
      return "New password must be at least 8 characters.";
    case "same_password":
      return "New password must be different from the current one.";
    case "not_signed_in":
      return "Session expired. Please sign in again.";
    case "no_email_on_account":
      return "Your account has no email on file; password change is unavailable.";
    case "server_misconfigured":
      return "The server is misconfigured for password change. Contact support.";
    default:
      return code;
  }
}
