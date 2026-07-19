"use client";

// SitebookCardActions — mock/showcase footer for a SiteBook feed card.
// Mirrors the Yard/Canteen pattern:
//   • Small reactions bar (Like · Love · Applaud) with mocked counts
//   • Collapsible comments panel with a count badge (default closed)
//   • Reply composer at the bottom of the panel
//   • Per-reply Reply button → inline mini composer → nested reply
//     appears indented under the parent (owner + trades can reply
//     to each other's comments — one level of nesting)
//
// Deliberately omits the WhatsApp CTA — SiteBook is a private feed
// where invited trades already have direct access.

import { useState } from "react";
import { ThumbsUp, MessageCircle, ChevronDown, ChevronUp, Send, CornerDownRight } from "lucide-react";

const BRAND_YELLOW = "#FFB300";

export type SitebookReply = {
  author:      string;
  authorType:  "homeowner" | "trade";
  when:        string;
  body:        string;
  /** Optional nested replies — trades + owner can reply to any
   *  comment, not just the top-level post. One level of nesting
   *  keeps threads readable. */
  children?:   SitebookReply[];
};

// Only Like on SiteBook cards — Love / Applaud removed per Philip.
const REACTIONS = [
  { key: "like", icon: ThumbsUp, label: "Like" }
] as const;

type ReactionKey = typeof REACTIONS[number]["key"];

export function SitebookCardActions({
  replies         = [],
  initialCounts   = { like: 0, love: 0, applaud: 0 },
  viewerName      = "Sarah",
  viewerInitial   = "S"
}: {
  replies?:       SitebookReply[];
  initialCounts?: Partial<Record<ReactionKey, number>>;
  viewerName?:    string;
  viewerInitial?: string;
}) {
  const [expanded,   setExpanded]  = useState<boolean>(false);
  const [reacted,    setReacted]   = useState<Set<ReactionKey>>(new Set());
  const [counts,     setCounts]    = useState<Record<ReactionKey, number>>({
    like: initialCounts.like ?? 0
  });

  // Local state so mock previews can post + nest without an API
  const [localReplies, setLocalReplies] = useState<SitebookReply[]>(replies);

  function toggleReaction(k: ReactionKey) {
    setReacted((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
    setCounts((cur) => ({
      ...cur,
      [k]: cur[k] + (reacted.has(k) ? -1 : 1)
    }));
  }

  // Count total (top-level + nested)
  const commentCount = localReplies.reduce(
    (sum, r) => sum + 1 + (r.children?.length ?? 0),
    0
  );
  const totalReacts  = counts.like;

  function addTopLevel(body: string) {
    setLocalReplies((cur) => [
      ...cur,
      { author: `${viewerName} (you)`, authorType: "homeowner", when: "just now", body }
    ]);
  }

  function addNested(parentIndex: number, body: string) {
    setLocalReplies((cur) => cur.map((r, i) =>
      i === parentIndex
        ? {
            ...r,
            children: [
              ...(r.children ?? []),
              { author: `${viewerName} (you)`, authorType: "homeowner", when: "just now", body }
            ]
          }
        : r
    ));
  }

  return (
    <>
      {/* Footer row — reactions on left, comments toggle on right */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2.5">
        <div className="flex items-center gap-1">
          {REACTIONS.map(({ key, icon: Icon, label }) => {
            const on = reacted.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleReaction(key)}
                className="inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[10.5px] font-black uppercase tracking-wider transition"
                style={{
                  borderColor:     on ? BRAND_YELLOW : "rgba(0,0,0,0.10)",
                  backgroundColor: on ? "rgba(255,179,0,0.15)" : "white",
                  color:           on ? "#7A4E00" : "#525252"
                }}
                aria-pressed={on}
                title={label}
              >
                <Icon size={11} strokeWidth={2.5} fill={on ? "currentColor" : "none"}/>
                <span className="tabular-nums">{counts[key]}</span>
              </button>
            );
          })}
          {totalReacts === 0 && (
            <span className="ml-1 text-[10px] text-neutral-400">Be the first</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex h-7 items-center gap-1 rounded-full bg-neutral-100 px-2.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-200"
          aria-expanded={expanded}
        >
          <MessageCircle size={11} strokeWidth={2.5}/>
          <span className="tabular-nums">{commentCount}</span>
          {commentCount === 1 ? "comment" : "comments"}
          {expanded ? <ChevronUp size={10} strokeWidth={2.5}/> : <ChevronDown size={10} strokeWidth={2.5}/>}
        </button>
      </div>

      {/* Comments panel — replies + composer */}
      {expanded && (
        <div className="mt-2 space-y-2 border-t border-neutral-100 pt-2.5">
          {localReplies.map((r, i) => (
            <ReplyRow
              key={i}
              reply={r}
              onReply={(body) => addNested(i, body)}
              viewerInitial={viewerInitial}
              viewerName={viewerName}
            />
          ))}

          {/* Top-level reply composer */}
          <TopLevelComposer
            viewerName={viewerName}
            viewerInitial={viewerInitial}
            onSubmit={addTopLevel}
          />
        </div>
      )}
    </>
  );
}

// ─── One reply row (with optional Reply button + inline composer) ─

function ReplyRow({
  reply, onReply, viewerName, viewerInitial
}: {
  reply:          SitebookReply;
  onReply:        (body: string) => void;
  viewerName:     string;
  viewerInitial:  string;
}) {
  const [replyOpen, setReplyOpen] = useState<boolean>(false);
  const [draft,     setDraft]     = useState<string>("");

  function submit() {
    const body = draft.trim();
    if (!body) return;
    onReply(body);
    setDraft("");
    setReplyOpen(false);
  }

  return (
    <div>
      <div className="flex items-start gap-2 rounded-lg bg-neutral-50 p-2.5">
        <ReplyAvatar name={reply.author} type={reply.authorType}/>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-black text-neutral-900">
            {reply.author}
            <span className="ml-1 text-[10px] font-normal text-neutral-500">· {reply.when}</span>
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-neutral-700">{reply.body}</p>
          <button
            type="button"
            onClick={() => setReplyOpen((v) => !v)}
            className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wider text-neutral-500 transition hover:text-neutral-900"
          >
            <CornerDownRight size={9} strokeWidth={2.6}/>
            {replyOpen ? "Cancel" : "Reply"}
          </button>
        </div>
      </div>

      {/* Nested children — indented one step */}
      {reply.children && reply.children.length > 0 && (
        <div className="ml-6 mt-1.5 space-y-1.5 border-l-2 pl-3" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          {reply.children.map((c, j) => (
            <div key={j} className="flex items-start gap-2 rounded-lg bg-neutral-50 p-2">
              <ReplyAvatar name={c.author} type={c.authorType} small/>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black text-neutral-900">
                  {c.author}
                  <span className="ml-1 text-[9.5px] font-normal text-neutral-500">· {c.when}</span>
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-neutral-700">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline nested-reply composer */}
      {replyOpen && (
        <div className="ml-6 mt-1.5 flex items-start gap-2">
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-neutral-900"
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            {viewerInitial}
          </span>
          <div className="flex flex-1 items-center gap-2 rounded-full border border-neutral-300 bg-white px-2.5 py-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
              placeholder={`Reply to ${reply.author.replace(/\s*\(you\)$/, "")}…`}
              className="flex-1 bg-transparent text-[11.5px] outline-none placeholder:text-neutral-400"
              autoFocus
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim()}
              className="text-neutral-500 hover:text-neutral-900 disabled:opacity-40"
              aria-label="Send reply"
              title={`Send reply as ${viewerName}`}
            >
              <Send size={11}/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Top-level composer ────────────────────────────────────────────

function TopLevelComposer({
  viewerName, viewerInitial, onSubmit
}: {
  viewerName:     string;
  viewerInitial:  string;
  onSubmit:       (body: string) => void;
}) {
  const [draft, setDraft] = useState<string>("");
  function submit() {
    const body = draft.trim();
    if (!body) return;
    onSubmit(body);
    setDraft("");
  }
  return (
    <div className="flex items-start gap-2 pt-1">
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-neutral-900" style={{ backgroundColor: BRAND_YELLOW }}>
        {viewerInitial}
      </span>
      <div className="flex flex-1 items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={`Add a comment as ${viewerName}…`}
          className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-neutral-400"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim()}
          className="text-neutral-500 hover:text-neutral-900 disabled:opacity-40"
          aria-label="Send comment"
        >
          <Send size={12}/>
        </button>
      </div>
    </div>
  );
}

function ReplyAvatar({
  name, type, small = false
}: {
  name:   string;
  type:   "homeowner" | "trade";
  small?: boolean;
}) {
  const sz = small ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-black ${sz} ${
        type === "homeowner" ? "text-neutral-900" : "bg-blue-100 text-blue-900"
      }`}
      style={type === "homeowner" ? { backgroundColor: BRAND_YELLOW } : {}}
    >
      {name.substring(0, 1)}
    </span>
  );
}
