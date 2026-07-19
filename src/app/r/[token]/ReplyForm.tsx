"use client";

// Reply form used on /r/[token]. Public — no auth. The token in the URL
// is the credential. POSTs to /api/reply/[token] which validates + rate-
// limits + writes the reply back to the correct SiteBook thread & post.

import { useState } from "react";
import { Send } from "lucide-react";

const BRAND_YELLOW = "#FFB300";

export function ReplyForm({ token, tradeName }: { token: string; tradeName: string }) {
  const [body, setBody]     = useState("");
  const [busy, setBusy]     = useState(false);
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const trimmed             = body.trim();
  const canSend             = trimmed.length >= 2 && !busy && !sent;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/reply/${token}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ body: trimmed })
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setError(prettyError(data.error));
        setBusy(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: "#166534" }}>
          Reply sent
        </p>
        <p className="mt-1 text-[14px] font-black text-neutral-900">
          Landed in their SiteBook
        </p>
        <p className="mt-1.5 text-[12.5px] text-neutral-600">
          They'll see it in their feed under the original message. Bookmark this page — you can reply again anytime from the same link.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <label className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
        Your reply as {tradeName}
      </label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 4000))}
        rows={5}
        placeholder="Type your reply here…"
        className="mt-2 w-full rounded-xl border-2 border-neutral-200 bg-white px-3 py-2.5 text-[14px] leading-relaxed text-neutral-900 outline-none placeholder-neutral-400 focus:border-neutral-900"
      />
      <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
        <span>{trimmed.length} / 4000</span>
        <span className="text-neutral-400">This lands directly in their SiteBook</span>
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSend}
        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-[12.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition hover:brightness-95 disabled:opacity-50"
        style={{ backgroundColor: BRAND_YELLOW }}
      >
        <Send size={14} strokeWidth={2.5}/>
        {busy ? "Sending…" : "Send reply"}
      </button>
    </form>
  );
}

function prettyError(code: string): string {
  switch (code) {
    case "empty-body":   return "Type a reply first.";
    case "too-long":     return "Reply is too long (max 4000 characters).";
    case "not-found":    return "This reply link is no longer valid.";
    case "revoked":      return "The homeowner has closed this conversation.";
    case "rate-limited": return "Too many replies in a short time. Wait an hour and try again.";
    default:             return "Couldn't send that reply. Try again in a moment.";
  }
}
