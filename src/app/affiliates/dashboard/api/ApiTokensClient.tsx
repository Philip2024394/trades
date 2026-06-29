"use client";

// Client island — create + list + revoke API tokens.
import { useState } from "react";

type TokenRow = {
  id: string;
  label: string | null;
  prefix: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

export function ApiTokensClient({
  initial
}: {
  initial: TokenRow[];
}): React.ReactElement {
  const [tokens, setTokens] = useState<TokenRow[]>(initial);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  async function createToken(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/affiliates/dashboard/api/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label })
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        token?: string;
        row?: TokenRow;
        error?: string;
      };
      if (!body.ok || !body.token || !body.row) {
        setErr(body.error ?? "Could not create token.");
        return;
      }
      setJustCreated(body.token);
      setTokens((prev) => [body.row!, ...prev]);
      setLabel("");
    } finally {
      setBusy(false);
    }
  }

  async function revokeToken(id: string) {
    if (!confirm("Revoke this token? It can't be undone.")) return;
    setBusy(true);
    try {
      await fetch(`/api/affiliates/dashboard/api/tokens/${id}`, {
        method: "DELETE"
      });
      setTokens((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, revoked_at: new Date().toISOString() } : t
        )
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-brand-line bg-brand-surface p-5">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
          Create new token
        </h2>
        <form onSubmit={createToken} className="mt-3 flex flex-wrap gap-3">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. My website widget)"
            className="h-10 flex-1 rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
            maxLength={80}
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-accent px-4 text-[13px] font-bold text-black disabled:opacity-60"
          >
            {busy ? "Creating…" : "Generate token"}
          </button>
        </form>
        {err && (
          <p className="mt-2 text-[13px] font-semibold text-red-500">{err}</p>
        )}
        {justCreated && (
          <div className="mt-4 rounded-lg border border-brand-accent bg-brand-accent/10 p-3">
            <p className="text-[13px] font-bold text-brand-accent">
              Copy this now — it will not be shown again.
            </p>
            <code className="mt-1 block break-all font-mono text-[13px] text-brand-text">
              {justCreated}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(justCreated)}
              className="mt-2 inline-flex h-8 items-center justify-center rounded border border-brand-line bg-brand-surface px-3 text-[13px] font-bold text-brand-text hover:bg-brand-line"
            >
              Copy
            </button>
          </div>
        )}
      </section>

      <section className="overflow-x-auto rounded-xl border border-brand-line bg-brand-surface">
        <table className="min-w-full text-[13px]">
          <thead className="bg-brand-bg/40 text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Token</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Last used</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.id} className="border-t border-brand-line">
                <td className="px-3 py-2">{t.label ?? "—"}</td>
                <td className="px-3 py-2 font-mono">
                  {t.prefix}…
                </td>
                <td className="px-3 py-2 text-brand-muted">
                  {new Date(t.created_at).toLocaleDateString("en-GB")}
                </td>
                <td className="px-3 py-2 text-brand-muted">
                  {t.last_used_at
                    ? new Date(t.last_used_at).toLocaleString("en-GB")
                    : "Never"}
                </td>
                <td className="px-3 py-2">
                  {t.revoked_at ? (
                    <span className="text-red-400">Revoked</span>
                  ) : (
                    <span className="text-green-400">Active</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {!t.revoked_at && (
                    <button
                      type="button"
                      onClick={() => revokeToken(t.id)}
                      className="rounded-lg border border-brand-line bg-brand-bg px-2 py-1 text-[13px] font-bold text-red-400 hover:bg-brand-line"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {tokens.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-brand-muted"
                >
                  No tokens yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
