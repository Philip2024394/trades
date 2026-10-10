"use client";

// src/app/nexapp/nex-agent/Nex1Brand.tsx
//
// The canonical NEX1 wordmark · "NE" white · "X" orange · "1" white.
// Used in the workstation header. Locked visual identity.

export function Nex1Brand({ size = 20 }: { size?: number }) {
  return (
    <span
      aria-label="NEX1"
      style={{
        fontSize: size,
        fontWeight: 900,
        fontFamily: "'JetBrains Mono', Menlo, Consolas, monospace",
        letterSpacing: "-0.02em",
        lineHeight: 1,
        userSelect: "none",
      }}
    >
      <span style={{ color: "#F9FAFB" }}>NE</span>
      <span style={{
        color: "#F97316",
        textShadow: "0 0 12px rgba(249, 115, 22, 0.45)",
      }}>X</span>
      <span style={{ color: "#F9FAFB" }}>1</span>
    </span>
  );
}
