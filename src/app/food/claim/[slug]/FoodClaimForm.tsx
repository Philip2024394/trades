// Client form for entering the 6-digit claim code.
// Posts to /api/nex-food/claim/verify.

"use client";

import { useState, type FormEvent } from "react";

export function FoodClaimForm({ publicListingRef }: { publicListingRef: string }) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ businessName: string } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const resp = await fetch("/api/nex-food/claim/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: publicListingRef, code: code.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error ?? "Unknown error");
      setSuccess({ businessName: data.businessName });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div style={{
        padding: "18px 16px",
        borderRadius: 10,
        background: "rgba(16, 185, 129, 0.10)",
        border: "1px solid rgba(16, 185, 129, 0.35)",
        color: "#a7f3d0",
        fontSize: 14,
        lineHeight: 1.55,
      }}>
        <strong style={{ fontSize: 16 }}>Claim successful.</strong>
        <div style={{ marginTop: 8 }}>
          <strong>{success.businessName}</strong> is now yours on NEX.
        </div>
        <div style={{ marginTop: 12, fontSize: 12.5, color: "rgba(167, 243, 208, 0.75)" }}>
          Next: your NEX owner dashboard will unlock so you can manage your menu,
          dish photos, prices and customer enquiries. We&apos;ll message you the link
          via WhatsApp when the dashboard is ready.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>6-digit code from WhatsApp</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="\d{6}"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D+/g, "").slice(0, 6))}
          disabled={submitting}
          style={{
            padding: "14px 16px",
            fontSize: 22,
            letterSpacing: 8,
            textAlign: "center",
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10,
            color: "#f4f4f4",
            outline: "none",
            fontFamily: "monospace",
          }}
          required
        />
      </label>

      {error && (
        <div style={{
          padding: "10px 12px",
          borderRadius: 8,
          background: "rgba(239, 68, 68, 0.10)",
          border: "1px solid rgba(239, 68, 68, 0.30)",
          color: "#fecaca",
          fontSize: 12.5,
        }}>{error}</div>
      )}

      <button
        type="submit"
        disabled={submitting || code.length !== 6}
        style={{
          padding: "13px 20px",
          fontSize: 14.5,
          fontWeight: 700,
          letterSpacing: 0.3,
          background: submitting || code.length !== 6 ? "rgba(255,255,255,0.08)" : "#f97316",
          color: submitting || code.length !== 6 ? "rgba(255,255,255,0.45)" : "#0a0a0a",
          border: "none",
          borderRadius: 10,
          cursor: submitting || code.length !== 6 ? "not-allowed" : "pointer",
          transition: "background 120ms ease",
        }}
      >
        {submitting ? "Verifying…" : "Claim my business"}
      </button>
    </form>
  );
}
