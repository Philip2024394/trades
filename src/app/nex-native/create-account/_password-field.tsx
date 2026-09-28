"use client";

// src/app/nex-native/create-account/_password-field.tsx
//
// Client-side password field with an eye toggle · matches the NEX
// reference design: cyan line-art eye icon, no filled variant.

import { useState } from "react";

export function NexPasswordField(props: {
  name: string;
  placeholder: string;
  ariaLabel: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        required
        type={visible ? "text" : "password"}
        name={props.name}
        placeholder={props.placeholder}
        minLength={props.minLength ?? 6}
        aria-label={props.ariaLabel}
        autoComplete="new-password"
        style={{
          width: "100%",
          minHeight: 48,
          padding: "12px 44px 12px 14px",
          background: "#04101F",
          color: "#F2F5F8",
          border: "1px solid rgba(0, 175, 255, 0.35)",
          borderRadius: 8,
          fontFamily: "inherit",
          fontSize: 14,
          letterSpacing: "0.01em",
          outline: "none",
        }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          width: 36,
          height: 36,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#00AFFF",
        }}
      >
        {visible ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a19.7 19.7 0 0 1 4.22-5.19" />
      <path d="M9.9 5.24A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a19.55 19.55 0 0 1-2.79 3.78" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
