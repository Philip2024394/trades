"use client";

// YardReplyComposer — compact reply box mounted under a Yard post
// detail. Posts to /api/trade-off/yard/posts/[id]/comments which lands
// the row in hammerex_yard_comments (the Yard v3 comments table). The
// trigger there keeps hammerex_trade_off_yard_posts.comment_count in
// sync, so the "N replies" count on cards updates without a manual
// bump. Auth comes from the server-side session cookie lookup via the
// slug + token props — no URL params required.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, AlertTriangle } from "lucide-react";

const MAX_LEN = 2000;

export function YardReplyComposer({
  slug,
  token,
  postId,
  displayName
}: {
  slug: string;
  token: string;
  postId: string;
  displayName: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/trade-off/yard/posts/${encodeURIComponent(postId)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            edit_token: token,
            body: trimmed
          })
        }
      );
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(
          data.error === "unauthorised"
            ? "Your sign-in expired. Sign in again from your dashboard."
            : data.error === "post_not_found"
              ? "This post no longer exists."
              : data.error === "listing_not_live"
                ? "Your listing is paused — restore it before commenting."
                : "Could not post your reply. Try again."
        );
        return;
      }
      setBody("");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPosting(false);
    }
  }

  const remaining = MAX_LEN - body.length;
  const disabled = posting || body.trim().length === 0;

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-[#1B1A17]/10 bg-white p-3 shadow-sm"
    >
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">
          Reply as {displayName}
        </p>
        <span
          className={`text-[10px] font-semibold tabular-nums ${
            remaining < 100 ? "text-red-700" : "text-[#1B1A17]/40"
          }`}
        >
          {remaining}
        </span>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MAX_LEN))}
        placeholder="Add something the poster would find useful…"
        rows={3}
        className="w-full resize-y rounded-lg border border-[#1B1A17]/10 bg-[#FBF6EC]/60 px-3 py-2 text-[13.5px] leading-[1.5] text-[#1B1A17] outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-300/40"
      />
      {error && (
        <p
          role="alert"
          className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-300 bg-red-50 px-2 py-1.5 text-[12px] font-semibold text-red-800"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      <div className="mt-2 flex items-center justify-end">
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-amber-400 px-4 text-[12.5px] font-black text-[#0A0A0A] shadow-sm transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {posting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Posting…
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" aria-hidden />
              Post reply
            </>
          )}
        </button>
      </div>
    </form>
  );
}
