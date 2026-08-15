// NEX Auth · CustomerLoginForm (Philip 2026-08-14).

"use client";

import { useState } from "react";
import type { CustomerBusinessIdentity } from "@/lib/nex/business-context/types";

export function CustomerLoginForm({ business }: { business: CustomerBusinessIdentity }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/b/${business.slug}/customer/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email })
      }).then((r) => r.json());
      if (res.ok) {
        window.location.href = `/b/${business.slug}/chat`;
      } else {
        setError(res.error ?? "Something went wrong");
        setBusy(false);
      }
    } catch (e) {
      setError("Network error"); setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: business.brand.background, color: business.brand.foreground, fontFamily: business.brand.bodyFamily, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={submit} style={{ maxWidth: 380, width: "100%", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: business.brand.primary, color: business.brand.onPrimary, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 20, fontFamily: business.brand.headingFamily }}>
            {business.displayName.charAt(0)}
          </div>
          <div style={{ fontFamily: business.brand.headingFamily, fontSize: 18, fontWeight: 600 }}>
            {business.displayName}
          </div>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#4b5563" }}>
          Enter your email to start chatting.
        </p>
        <input
          type="email" required autoFocus
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{ width: "100%", padding: "12px 14px", fontSize: 15, border: "1px solid #d4d4d4", borderRadius: 8, outline: "none", marginBottom: 12, boxSizing: "border-box" }}
        />
        {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={busy || !email}
          style={{ width: "100%", padding: "12px 14px", background: business.brand.primary, color: business.brand.onPrimary, border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: busy ? "wait" : "pointer" }}>
          {busy ? "Signing in…" : "Continue"}
        </button>
        <div style={{ marginTop: 20, textAlign: "center", fontSize: 11, color: "#9ca3af" }}>
          Powered by NEX™
        </div>
      </form>
    </div>
  );
}
