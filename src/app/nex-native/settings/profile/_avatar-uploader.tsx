"use client";

// src/app/nex-native/settings/profile/_avatar-uploader.tsx
//
// Client-side image picker + preview + submit for the settings/profile
// avatar slot. Renders the current avatar (or initials fallback), opens
// a file picker when tapped, shows a live preview, and posts the file
// to uploadAvatarAction on submit.
//
// Bridge 37 (2026-09-28) · restyled to match the chat card palette:
// dark navy panel + cyan accents + orange primary action. Matches the
// visual language of /nex-native/chat so the profile surface reads as
// one continuous NEX product.

import { useRef, useState } from "react";
import { uploadAvatarAction } from "../../_actions";

interface Props {
  currentAvatarUrl: string | null;
  displayName: string;
  handle: string | null;
}

const NEX = {
  panel: "#03101D",
  fieldBg: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
  red: "#EF4444",
};

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function NexAvatarUploader({ currentAvatarUrl, displayName, handle }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const displayed = preview ?? currentAvatarUrl;

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(null);
      setSelectedName(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg(`Image must be ≤ 5 MB · yours is ${(file.size / 1024 / 1024).toFixed(1)} MB`);
      e.target.value = "";
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMsg(`Only JPEG, PNG, or WebP · got ${file.type || "unknown"}`);
      e.target.value = "";
      return;
    }
    setSelectedName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <form
      ref={formRef}
      action={uploadAvatarAction}
      data-nex-avatar-uploader
      style={{
        marginBottom: 16,
        padding: 16,
        background: NEX.panel,
        border: `1px solid ${NEX.cyanSoft}`,
        borderRadius: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Choose profile image"
          data-nex-avatar-choose
          style={{
            position: "relative",
            flexShrink: 0,
            width: 80,
            height: 80,
            borderRadius: "50%",
            border: `2px solid ${NEX.cyanSoft}`,
            background: NEX.cyanFaint,
            color: NEX.cyan,
            display: "grid",
            placeItems: "center",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.05em",
            cursor: "pointer",
            overflow: "visible",
          }}
        >
          {displayed ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={displayed}
              alt="Profile"
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <span>{initialsFrom(displayName)}</span>
          )}
          <span
            aria-hidden
            style={{
              position: "absolute",
              bottom: -3,
              right: -3,
              width: 26,
              height: 26,
              borderRadius: "50%",
              border: `2px solid ${NEX.panel}`,
              background: NEX.cyan,
              color: "#0B0F1A",
              display: "grid",
              placeItems: "center",
              fontSize: 12,
            }}
          >
            📷
          </span>
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: NEX.textPrimary,
            }}
          >
            Profile image
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: NEX.textSecondary,
              lineHeight: 1.45,
            }}
          >
            JPEG, PNG, or WebP · up to 5 MB · shown on your NEX cards + profile.
          </div>
          {selectedName && (
            <div
              data-nex-avatar-selected
              style={{
                marginTop: 8,
                fontSize: 12,
                color: NEX.textPrimary,
              }}
            >
              Selected · <span style={{ fontWeight: 500 }}>{selectedName}</span>
            </div>
          )}
          {handle && (
            <div
              style={{
                marginTop: 4,
                fontSize: 10,
                color: NEX.textSecondary,
                opacity: 0.7,
                letterSpacing: "0.02em",
              }}
            >
              Path{" "}
              <code style={{ fontFamily: "ui-monospace, monospace" }}>
                {handle}/avatar
              </code>
            </div>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        name="avatar"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={onFileChange}
      />

      {errorMsg && (
        <p
          role="status"
          data-nex-avatar-error
          style={{
            marginTop: 12,
            padding: "6px 10px",
            borderRadius: 6,
            background: "rgba(239,68,68,0.10)",
            color: NEX.red,
            fontSize: 12,
            border: "1px solid rgba(239,68,68,0.35)",
          }}
        >
          {errorMsg}
        </p>
      )}

      {preview && (
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="submit"
            data-nex-avatar-upload
            style={{
              minHeight: 40,
              padding: "8px 16px",
              borderRadius: 8,
              background: NEX.orange,
              color: "#0B0F1A",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              border: "none",
              cursor: "pointer",
            }}
          >
            Upload image
          </button>
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              setSelectedName(null);
              setErrorMsg(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            style={{
              minHeight: 40,
              padding: "8px 16px",
              borderRadius: 8,
              background: "transparent",
              color: NEX.textSecondary,
              border: `1px solid ${NEX.cyanFaint}`,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.04em",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </form>
  );
}
