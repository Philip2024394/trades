"use client";

// TradeInviteView — the client body of /sitebook-invite/[token].
// Renders each post the trade can see + an inline reply composer.
// No signup, no auth beyond the token. Replies POST to
// /api/sitebook-invite/[token]/reply.

import { useState } from "react";
import { MessageCircle, Send, Loader2 } from "lucide-react";

const BRAND_GREEN = "#166534";

type Post = {
  id:                string;
  project_id:        string;
  title:             string | null;
  body:              string;
  cover_photo_url:   string | null;
  created_at:        string;
  visibility:        string;
};

export function TradeInviteView({
  token, posts, projectTitleById, tradeName, canReply
}: {
  token:            string;
  posts:            Post[];
  projectTitleById: [string, string][];
  tradeName:        string;
  canReply:         boolean;
}) {
  const titleMap = new Map(projectTitleById);

  if (posts.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border-2 border-dashed bg-white p-8 text-center" style={{ borderColor: "rgba(0,0,0,0.10)" }}>
        <p className="text-[14px] font-black text-neutral-900">No posts to see yet</p>
        <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-600">
          The owner will add posts here as the project unfolds. You&rsquo;ll see them the next time you open this link.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {posts.map((p) => (
        <PostReplyCard
          key={p.id}
          post={p}
          projectTitle={titleMap.get(p.project_id) ?? "Project"}
          token={token}
          tradeName={tradeName}
          canReply={canReply}
        />
      ))}
    </div>
  );
}

function PostReplyCard({
  post, projectTitle, token, tradeName, canReply
}: {
  post:         Post;
  projectTitle: string;
  token:        string;
  tradeName:    string;
  canReply:     boolean;
}) {
  const [draft,  setDraft]  = useState<string>("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error,  setError]  = useState<string>("");
  const when = new Date(post.created_at).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || status === "sending") return;
    setStatus("sending");
    setError("");
    const res = await fetch(`/api/sitebook-invite/${token}/reply`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ postId: post.id, body })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setStatus("error");
      setError(data.error || "Reply failed");
      return;
    }
    setDraft("");
    setStatus("sent");
  }

  return (
    <article className="rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-neutral-700">
          {projectTitle}
        </span>
        <span className="text-[10.5px] font-bold text-neutral-500">{when}</span>
      </div>
      {post.title && (
        <h2 className="mt-2 text-[15px] font-black leading-tight text-neutral-900">{post.title}</h2>
      )}
      <p className={"whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-800 " + (post.title ? "mt-1.5" : "mt-2")}>
        {post.body}
      </p>

      {post.cover_photo_url && (
        <div className="mt-3 max-w-[240px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.cover_photo_url} alt="" className="w-full rounded-lg shadow-sm"/>
        </div>
      )}

      {canReply ? (
        <form onSubmit={submit} className="mt-3 flex items-start gap-2 border-t border-neutral-100 pt-3">
          <span className="inline-flex h-7 items-center rounded-full bg-blue-100 px-2 text-[10px] font-black uppercase tracking-wider text-blue-900">
            You · {tradeName}
          </span>
          <div className="flex flex-1 items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-1.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Reply directly to the owner…"
              className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-neutral-400"
              disabled={status === "sending"}
            />
            <button
              type="submit"
              disabled={!draft.trim() || status === "sending"}
              className="text-neutral-500 hover:text-neutral-900 disabled:opacity-40"
              aria-label="Send reply"
            >
              {status === "sending" ? <Loader2 size={13} className="animate-spin"/> : <Send size={13}/>}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-3 flex items-center gap-1 border-t border-neutral-100 pt-3 text-[11px] font-bold text-neutral-500">
          <MessageCircle size={11}/> Replies are closed for this invitation.
        </p>
      )}
      {status === "sent" && (
        <p className="mt-2 text-[11px] font-bold text-green-800" style={{ color: BRAND_GREEN }}>
          ✓ Reply sent — the owner sees it now.
        </p>
      )}
      {status === "error" && error && (
        <p className="mt-2 text-[11px] font-bold text-red-800">{error}</p>
      )}
    </article>
  );
}
