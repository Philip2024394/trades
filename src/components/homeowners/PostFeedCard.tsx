// PostFeedCard — the shared card component used on the homeowner
// feed AND (a variant) on the trade-side inbox. Renders a post +
// its metadata + a reply thread + an inline reply composer.
//
// The reply composer is client-side; the card itself renders
// server-side. When reply POSTs, we router.refresh() to pull
// updated replies.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MessageCircle,
  MoreHorizontal,
  Camera,
  Zap,
  Star,
  Eye,
  Lock,
  Sparkles,
  Send
} from "lucide-react";
import type { SiteBookPost, SiteBookPostReply, SiteBookPostMember } from "@/lib/homeowners/types";
import { WaMessageComposer } from "./WaMessageComposer";
import { AddCostButton } from "./AddCostButton";
import { CostDocumentUpload } from "./CostDocumentUpload";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

export type PostFeedCardProps = {
  post:        SiteBookPost;
  replies:     SiteBookPostReply[];
  members:     SiteBookPostMember[];
  projectName: string;
  viewerType:  "homeowner" | "trade";
  viewerInitial: string;
  replyPostUrl:  string;   // endpoint to POST replies
};

const KIND_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  "update":     { bg: "#FEF9C3", fg: "#854D0E", label: "Update" },
  "new-work":   { bg: "#FEF9C3", fg: "#854D0E", label: "New work" },
  "question":   { bg: "#EFF6FF", fg: "#1D4ED8", label: "Question" },
  "warranty":   { bg: "#F0FDF4", fg: "#166534", label: "Warranty logged" },
  "completion": { bg: "#F0FDF4", fg: "#166534", label: "Completed" },
  "trade-note": { bg: "#EFF6FF", fg: "#1D4ED8", label: "Trade update" }
};

export function PostFeedCard({
  post,
  replies,
  members,
  projectName,
  viewerType,
  viewerInitial,
  replyPostUrl
}: PostFeedCardProps) {
  const router = useRouter();
  const [reply, setReply]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [composeFor, setComposeFor] = useState<SiteBookPostMember | null>(null);

  const tone      = KIND_TONE[post.kind] || KIND_TONE.update;
  const isSystem  = post.author_type === "system";
  const isTrade   = post.author_type === "trade";
  const timestamp = new Date(post.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || busy) return;
    setBusy(true);
    await fetch(replyPostUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ body: reply.trim() })
    });
    setReply("");
    setBusy(false);
    router.refresh();
  }

  return (
    <article className="rounded-2xl border-2 bg-white p-5 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AuthorAvatar authorType={post.author_type} name={post.author_display_name}/>
          <div>
            <div className="flex flex-wrap items-baseline gap-1.5">
              <p className="text-[13.5px] font-black text-neutral-900">{post.author_display_name}</p>
              {isSystem && <span className="inline-flex items-center rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-neutral-500">system</span>}
              {isTrade  && <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-800">trade</span>}
              {post.pinned && <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-800"><Star size={9}/> pinned</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-neutral-500">
              <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `linear-gradient(to right, ${tone.bg}, white)`, color: tone.fg }}>
                {tone.label}
              </span>
              <span>·</span>
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-neutral-800">
                {projectName}
              </span>
              <span>·</span>
              <span>{timestamp}</span>
            </div>
          </div>
        </div>
        <button className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100"><MoreHorizontal size={14}/></button>
      </div>

      {/* Body */}
      {post.title && <p className="mt-3 text-[15px] font-black text-neutral-900">{post.title}</p>}
      <p className={`text-[13px] leading-relaxed text-neutral-700 whitespace-pre-wrap ${post.title ? "mt-1.5" : "mt-3"}`}>
        {post.body}
      </p>

      {/* Cover photo — optional */}
      {post.cover_photo_url && (
        <div className="mt-3 max-w-[240px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.cover_photo_url} alt="" className="aspect-square w-full rounded-lg object-cover shadow-sm"/>
        </div>
      )}

      {/* Visibility strip */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg bg-neutral-50 px-3 py-2 text-[10.5px]">
        {post.visibility === "all-trades" ? (
          <>
            <Eye size={11} className="text-neutral-500"/>
            <span className="font-black uppercase tracking-wider text-neutral-600">All trades on this project</span>
          </>
        ) : (
          <>
            <Lock size={11} className="text-neutral-500"/>
            <span className="font-black uppercase tracking-wider text-neutral-600">Visible to:</span>
            {members.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-800 shadow-sm">
                {m.merchant_name || m.merchant_slug || "Trade"}
              </span>
            ))}
          </>
        )}
      </div>

      {/* Action row */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
        <button type="button" className="inline-flex h-8 items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50">
          <MessageCircle size={11}/> Reply
        </button>
        <button type="button" disabled className="inline-flex h-8 items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-400">
          <Camera size={11}/> Add photo (soon)
        </button>

        {/* WhatsApp composer per invited trade — homeowner-only */}
        {viewerType === "homeowner" && members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setComposeFor(composeFor?.id === m.id ? null : m)}
            className="inline-flex h-8 items-center gap-1 rounded-full border-2 px-3 text-[10.5px] font-black uppercase tracking-wider transition"
            style={{
              borderColor:     BRAND_GREEN,
              color:           composeFor?.id === m.id ? "#fff" : BRAND_GREEN,
              backgroundColor: composeFor?.id === m.id ? BRAND_GREEN : "transparent"
            }}
          >
            <MessageCircle size={11}/>
            WhatsApp {m.merchant_name || m.merchant_slug || "trade"}
            <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-700">
              <Zap size={8}/> 1 washer
            </span>
          </button>
        ))}

        {post.reply_count > 0 && (
          <p className="ml-auto text-[10.5px] font-bold text-neutral-500">
            {post.reply_count} {post.reply_count === 1 ? "reply" : "replies"}
          </p>
        )}
      </div>

      {/* Inline WhatsApp composer — expands under the action row */}
      {composeFor && viewerType === "homeowner" && (
        <div className="mt-3">
          <WaMessageComposer
            postId={post.id}
            tradeListingId={composeFor.listing_id}
            tradeName={composeFor.merchant_name || composeFor.merchant_slug || "Trade"}
            onCancel={() => setComposeFor(null)}
            onSent={() => { setComposeFor(null); router.refresh(); }}
          />
        </div>
      )}

      {/* AddCostButton + document upload — both appear ONLY when the
          homeowner is viewing + a trade has already replied. That's
          the natural moment they have a number to log AND a quote /
          invoice to file. Zero UI noise otherwise. */}
      {viewerType === "homeowner" && replies.some((r) => r.author_type === "trade") && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <AddCostButton
            postId={post.id}
            projectId={post.project_id}
            members={members}
          />
          <CostDocumentUpload
            projectId={post.project_id}
            postId={post.id}
            variant="chip"
            label="Attach quote / invoice"
          />
        </div>
      )}

      {/* Reply thread */}
      {replies.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
          {replies.map((r) => (
            <div key={r.id} className="flex items-start gap-2 rounded-lg bg-neutral-50 p-3">
              <ReplyAvatar authorType={r.author_type} name={r.author_name}/>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-black text-neutral-900">
                  {r.author_name}
                  <span className="ml-1 text-[10px] font-normal text-neutral-500">· {new Date(r.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] text-neutral-700">{r.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline reply composer */}
      <form onSubmit={submitReply} className="mt-3 flex items-start gap-2 border-t border-neutral-100 pt-3">
        <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${viewerType === "homeowner" ? "text-neutral-900" : "bg-blue-100 text-blue-900"}`} style={viewerType === "homeowner" ? { backgroundColor: BRAND_YELLOW } : {}}>
          {viewerInitial}
        </span>
        <div className="flex flex-1 items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-1.5">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write a reply…"
            className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-neutral-400"
          />
          <button type="submit" disabled={!reply.trim() || busy} className="text-neutral-500 hover:text-neutral-900 disabled:opacity-40">
            <Send size={13}/>
          </button>
        </div>
      </form>
    </article>
  );
}

function AuthorAvatar({ authorType, name }: { authorType: string; name: string }) {
  if (authorType === "system") {
    return (
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
        <Sparkles size={16}/>
      </span>
    );
  }
  if (authorType === "trade") {
    return (
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[13px] font-black text-blue-900">
        {name.substring(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-black text-neutral-900" style={{ backgroundColor: BRAND_YELLOW }}>
      {name.substring(0, 1)}
    </span>
  );
}

function ReplyAvatar({ authorType, name }: { authorType: string; name: string }) {
  return (
    <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${authorType === "homeowner" ? "text-neutral-900" : authorType === "trade" ? "bg-blue-100 text-blue-900" : "bg-neutral-100 text-neutral-600"}`} style={authorType === "homeowner" ? { backgroundColor: BRAND_YELLOW } : {}}>
      {name.substring(0, 1)}
    </span>
  );
}
