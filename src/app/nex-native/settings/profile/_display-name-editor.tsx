"use client";

// src/app/nex-native/settings/profile/_display-name-editor.tsx
//
// Bridge 80 · Freely-editable username with emoji support + live
// character counter. Sits at the top of the Personal tab and
// updates via updateDisplayNameAction · shows inline success + error
// banners without a page-level reload.
//
// Founder direction 2026-09-29: "phone for account creation only ·
// nex-XXXX id for friends to connect · username freely chosen with
// emoji, only length is bounded."

import * as React from "react";
import { useTransition } from "react";
import {
  NEX_DISPLAY_NAME_MIN,
  NEX_DISPLAY_NAME_MAX,
} from "@/lib/nex-native/types";
import { updateDisplayNameAction } from "../../_actions";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  fieldBg: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
  green: "#22E37A",
  greenFaint: "rgba(34, 227, 122, 0.14)",
  red: "#FF3355",
  redFaint: "rgba(255, 51, 85, 0.10)",
};

export function DisplayNameEditor({
  initialName,
}: {
  initialName: string;
}): React.JSX.Element {
  const [value, setValue] = React.useState(initialName);
  const [status, setStatus] = React.useState<
    { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved"; at: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  // Count Unicode code points so emoji + ZWJ sequences read as intended.
  const codePoints = React.useMemo(() => [...value.trim()].length, [value]);
  const tooShort = codePoints < NEX_DISPLAY_NAME_MIN;
  const tooLong = codePoints > NEX_DISPLAY_NAME_MAX;
  const dirty = value.trim() !== initialName.trim();
  const canSubmit = dirty && !tooShort && !tooLong && !isPending;

  const submit = React.useCallback(() => {
    if (!canSubmit) return;
    const trimmed = value.trim();
    setStatus({ kind: "saving" });
    startTransition(async () => {
      const fd = new FormData();
      fd.set("display_name", trimmed);
      const res = await updateDisplayNameAction(fd);
      if (res.ok) {
        setStatus({ kind: "saved", at: Date.now() });
        setValue(res.displayName);
      } else {
        setStatus({
          kind: "error",
          message: friendlyError(res.error),
        });
      }
    });
  }, [canSubmit, value]);

  // Auto-clear success chip after 3s.
  React.useEffect(() => {
    if (status.kind !== "saved") return;
    const t = setTimeout(() => setStatus({ kind: "idle" }), 3000);
    return () => clearTimeout(t);
  }, [status]);

  const counterColor =
    tooLong ? NEX.red
    : tooShort ? NEX.textMute
    : codePoints > NEX_DISPLAY_NAME_MAX - 5 ? NEX.orange
    : NEX.textSecondary;

  return (
    <section
      style={{
        padding: 16,
        background: NEX.panel,
        border: `1px solid ${NEX.cyanSoft}`,
        borderRadius: 14,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: NEX.cyan,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        Your name
      </div>
      <div
        style={{
          fontSize: 12,
          color: NEX.textSecondary,
          lineHeight: 1.55,
          marginBottom: 12,
        }}
      >
        This is what friends see on your messages · emoji welcome
        (e.g. Aisha 📷) · {NEX_DISPLAY_NAME_MIN}–{NEX_DISPLAY_NAME_MAX} characters.
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "stretch",
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          maxLength={NEX_DISPLAY_NAME_MAX * 4 /* generous slack for surrogate pairs */}
          placeholder="Aisha 📷"
          aria-label="Your display name"
          style={{
            flex: "1 1 220px",
            minHeight: 44,
            padding: "10px 12px",
            fontSize: 16,
            background: NEX.fieldBg,
            border: `1px solid ${
              tooLong ? NEX.red : NEX.cyanSoft
            }`,
            borderRadius: 10,
            color: NEX.textPrimary,
            outline: "none",
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          style={{
            minHeight: 44,
            padding: "10px 18px",
            borderRadius: 10,
            border: "none",
            background: canSubmit ? NEX.orange : "rgba(255,114,0,0.35)",
            color: "#0B0F1A",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: canSubmit ? "pointer" : "not-allowed",
            transition: "background 160ms ease",
          }}
        >
          {status.kind === "saving" || isPending ? "Saving…" : "Save"}
        </button>
      </div>

      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: counterColor,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>
          {tooLong
            ? `Too long · trim ${codePoints - NEX_DISPLAY_NAME_MAX} character${
                codePoints - NEX_DISPLAY_NAME_MAX === 1 ? "" : "s"
              }`
            : tooShort
              ? `Need at least ${NEX_DISPLAY_NAME_MIN} characters`
              : dirty ? "Ready to save · press Enter or Save" : " "}
        </span>
        <span>{codePoints} / {NEX_DISPLAY_NAME_MAX}</span>
      </div>

      {status.kind === "saved" && (
        <StatusChip color={NEX.green} bg={NEX.greenFaint} text="✓ Saved" />
      )}
      {status.kind === "error" && (
        <StatusChip color={NEX.red} bg={NEX.redFaint} text={`⚠ ${status.message}`} />
      )}
    </section>
  );
}

function StatusChip({
  color,
  bg,
  text,
}: {
  color: string;
  bg: string;
  text: string;
}): React.JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        marginTop: 10,
        padding: "6px 10px",
        borderRadius: 8,
        background: bg,
        border: `1px solid ${color}66`,
        color,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.02em",
        display: "inline-block",
      }}
    >
      {text}
    </div>
  );
}

function friendlyError(code: string): string {
  if (code === "not_signed_in") return "Please sign in again.";
  if (code.startsWith("too_short_min_")) {
    const n = code.split("_").pop();
    return `Please use at least ${n} characters.`;
  }
  if (code.startsWith("too_long_max_")) {
    const n = code.split("_").pop();
    return `Please keep it under ${n} characters.`;
  }
  return code;
}
