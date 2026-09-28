"use client";

// src/app/nex-native/create-account/_create-submit.tsx
//
// Reference-styled submit button: transparent dark interior with a thin
// NEX orange border, orange uppercase label with letter spacing.

import { useFormStatus } from "react-dom";

export function NexCreateSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      style={{
        width: "100%",
        minHeight: 52,
        padding: "14px 20px",
        background: "transparent",
        color: "#FF7200",
        border: "1px solid #FF7200",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.20em",
        textTransform: "uppercase",
        cursor: pending ? "wait" : "pointer",
        opacity: pending ? 0.7 : 1,
        transition: "opacity 160ms ease-out",
      }}
    >
      {pending ? "Creating account…" : "Create account"}
    </button>
  );
}
