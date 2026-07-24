"use client";

import { useState } from "react";

export function BrainAdminLoginForm() {
  const [token, setToken]   = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError]   = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const res  = await fetch("/api/brain-admin/session/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ invite_token: token.trim() })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setStatus("error");
        setError(json.detail ?? json.error ?? `Request failed (${res.status})`);
        return;
      }
      window.location.assign("/admin-brains/queue?brain_slug=staircase");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-xs font-medium text-[#0A0A0A]/70">Invite token</span>
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="mt-1 w-full rounded border border-[#0A0A0A]/20 bg-[#FBF6EC] px-3 py-2 text-sm font-mono"
          placeholder="paste the token from your onboarding email"
          autoComplete="off"
        />
      </label>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={status === "submitting" || token.trim() === ""}
        className="w-full rounded bg-[#0A0A0A] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {status === "submitting" ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
