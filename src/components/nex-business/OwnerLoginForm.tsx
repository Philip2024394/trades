// NEX Auth · OwnerLoginForm (Philip 2026-08-14).

"use client";

import { useState } from "react";

export function OwnerLoginForm({ defaultBusinessSlug }: { defaultBusinessSlug: string }) {
  const [email, setEmail] = useState("");
  const [businessSlug, setBusinessSlug] = useState(defaultBusinessSlug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/nex/owner/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, businessSlug })
      }).then((r) => r.json());
      if (res.ok) {
        window.location.href = `/b/${businessSlug}/workspace`;
      } else {
        setError(res.error === "owner-not-authorised-for-business"
          ? `That email is not authorised for "${businessSlug}"`
          : res.error ?? "Something went wrong");
        setBusy(false);
      }
    } catch (e) {
      setError("Network error"); setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#111827", color: "#e5e7eb", fontFamily: "Inter, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={submit} style={{ maxWidth: 420, width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 12, padding: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", opacity: 0.6, marginBottom: 6 }}>NEX Workspace</div>
        <h1 style={{ margin: "0 0 18px", fontSize: 22, fontWeight: 600, color: "#fff" }}>Owner sign in</h1>
        <label style={{ display: "block", fontSize: 12, marginBottom: 4, opacity: 0.85 }}>Email</label>
        <input
          type="email" required autoFocus
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="owner@yourbusiness.co.uk"
          style={{ width: "100%", padding: "10px 12px", background: "#111827", color: "#fff", fontSize: 15, border: "1px solid #374151", borderRadius: 8, outline: "none", marginBottom: 14, boxSizing: "border-box" }}
        />
        <label style={{ display: "block", fontSize: 12, marginBottom: 4, opacity: 0.85 }}>Business</label>
        <input
          type="text" required
          value={businessSlug} onChange={(e) => setBusinessSlug(e.target.value)}
          placeholder="rowan-staircases"
          style={{ width: "100%", padding: "10px 12px", background: "#111827", color: "#fff", fontSize: 15, border: "1px solid #374151", borderRadius: 8, outline: "none", marginBottom: 14, boxSizing: "border-box" }}
        />
        {error && <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={busy || !email || !businessSlug}
          style={{ width: "100%", padding: "12px 14px", background: "#F97316", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: busy ? "wait" : "pointer" }}>
          {busy ? "Signing in…" : "Enter NEX Workspace"}
        </button>
        <div style={{ marginTop: 18, fontSize: 11, opacity: 0.5, textAlign: "center" }}>
          Seeded dev accounts:<br />
          owner@rowanstaircases.co.uk → rowan-staircases<br />
          owner@harborne-plumbing.co.uk → harborne-plumbing
        </div>
      </form>
    </div>
  );
}
