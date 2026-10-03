"use client";

// src/app/nex-head-quarters/surface-health/_controls-client.tsx
//
// Client sub-components that wrap the Server Actions as HTML forms.
// Keeping the mutation UI tiny · one admin-token field + one labelled
// submit button per action. No user conversation content is ever
// surfaced here; only the structured diagnostic dimensions.

import * as React from "react";
import { useActionState } from "react";
import {
  transitionAction,
  setKillSwitchAction,
  type ActionResult,
} from "./_actions";

const BTN: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "#111",
  color: "#fff",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const INPUT: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid rgba(0,0,0,0.2)",
  background: "#fff",
  fontSize: 12,
  width: 180,
};

const WARN: React.CSSProperties = {
  color: "#a33",
  fontSize: 11,
  marginTop: 4,
};

const OK: React.CSSProperties = {
  color: "#0a0",
  fontSize: 11,
  marginTop: 4,
};

export function TransitionButton({ rowId }: { rowId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    transitionAction,
    null,
  );
  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <input type="hidden" name="id" value={rowId} />
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="password"
          name="admin_token"
          placeholder="HQ admin token"
          autoComplete="off"
          required
          style={INPUT}
        />
        <input
          type="text"
          name="reason"
          placeholder="reason (optional)"
          style={{ ...INPUT, width: 220 }}
        />
        <button type="submit" style={BTN} disabled={pending} data-testid="transition-submit">
          {pending ? "…" : "ongoing → investigating"}
        </button>
      </div>
      {state && !state.ok && (
        <div style={WARN} data-testid="transition-error">
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div style={OK} data-testid="transition-ok">
          transitioned
        </div>
      )}
    </form>
  );
}

export function KillSwitchToggle({
  themeId,
  themeName,
  disabled,
}: {
  themeId: string;
  themeName: string;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    setKillSwitchAction,
    null,
  );
  const nextDisabled = !disabled;
  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <input type="hidden" name="theme_id" value={themeId} />
      <input type="hidden" name="disabled" value={nextDisabled ? "true" : "false"} />
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="password"
          name="admin_token"
          placeholder="HQ admin token"
          autoComplete="off"
          required
          style={INPUT}
        />
        <input
          type="text"
          name="actor"
          placeholder="actor label"
          required
          style={{ ...INPUT, width: 140 }}
        />
        <input
          type="text"
          name="reason"
          placeholder="reason (optional)"
          style={{ ...INPUT, width: 180 }}
        />
        <button
          type="submit"
          style={BTN}
          disabled={pending}
          data-testid={`kill-switch-${themeId}`}
        >
          {pending ? "…" : nextDisabled ? `disable ${themeName}` : `enable ${themeName}`}
        </button>
      </div>
      {state && !state.ok && (
        <div style={WARN} data-testid={`kill-switch-error-${themeId}`}>
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div style={OK} data-testid={`kill-switch-ok-${themeId}`}>
          updated
        </div>
      )}
    </form>
  );
}
