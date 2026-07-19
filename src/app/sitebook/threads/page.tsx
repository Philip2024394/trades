// /sitebook/threads — homeowner's active WhatsApp conversations.
// Lists every WA thread (open + closed) with a "Close conversation"
// button per active row. Closed threads: the /r/{token} reply page
// returns a friendly "conversation closed" screen and no more inbound
// replies land on them.

import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle, ArrowLeft, ExternalLink } from "lucide-react";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { RevokeButton } from "./RevokeButton";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";

type ThreadRow = {
  id:                    string;
  post_id:               string;
  trade_merchant_name:   string | null;
  trade_merchant_slug:   string | null;
  message_count:         number;
  last_activity_at:      string;
  revoked_at:            string | null;
  created_at:            string;
};

async function loadThreads(homeownerId: string): Promise<ThreadRow[]> {
  const res = await supabaseAdmin
    .from("hammerex_sitebook_wa_threads")
    .select("id, post_id, trade_merchant_name, trade_merchant_slug, message_count, last_activity_at, revoked_at, created_at")
    .eq("homeowner_id", homeownerId)
    .order("last_activity_at", { ascending: false });
  return (res.data as ThreadRow[]) ?? [];
}

async function loadPostTitles(postIds: string[]): Promise<Map<string, string>> {
  if (!postIds.length) return new Map();
  const res = await supabaseAdmin
    .from("hammerex_sitebook_posts")
    .select("id, title, body")
    .in("id", postIds);
  const map = new Map<string, string>();
  for (const r of (res.data as { id: string; title: string | null; body: string }[]) ?? []) {
    map.set(r.id, r.title || r.body.slice(0, 60));
  }
  return map;
}

export default async function ThreadsPage() {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) redirect("/homeowners");

  const threads    = await loadThreads(homeowner.id);
  const postTitles = await loadPostTitles(threads.map((t) => t.post_id));

  const active = threads.filter((t) => !t.revoked_at);
  const closed = threads.filter((t) =>  t.revoked_at);

  return (
    <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link href="/sitebook" className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
        <ArrowLeft size={11}/> Back to feed
      </Link>

      <p className="mt-3 text-xs font-black uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
        WhatsApp conversations
      </p>
      <h1 className="mt-1 text-2xl font-black text-neutral-900 sm:text-3xl">
        Your live threads
      </h1>
      <p className="mt-1 text-[13px] text-neutral-600">
        Every WhatsApp conversation started from a SiteBook post. Close a thread to stop the trade from replying via their SiteBook reply link.
      </p>

      {/* Active */}
      <div className="mt-6">
        <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
          Active · {active.length}
        </p>
        <div className="mt-2 space-y-2">
          {active.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed bg-white p-6 text-center" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
              <p className="text-[13px] font-black text-neutral-900">No active conversations.</p>
              <p className="mt-1 text-[12px] text-neutral-600">
                Send a WhatsApp message from a post to start one.
              </p>
            </div>
          ) : (
            active.map((t) => (
              <ThreadRowCard
                key={t.id}
                thread={t}
                postTitle={postTitles.get(t.post_id) || "Post"}
                canRevoke
              />
            ))
          )}
        </div>
      </div>

      {/* Closed */}
      {closed.length > 0 && (
        <div className="mt-8">
          <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Closed · {closed.length}
          </p>
          <div className="mt-2 space-y-2">
            {closed.map((t) => (
              <ThreadRowCard
                key={t.id}
                thread={t}
                postTitle={postTitles.get(t.post_id) || "Post"}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ThreadRowCard({
  thread,
  postTitle,
  canRevoke = false
}: {
  thread:    ThreadRow;
  postTitle: string;
  canRevoke?: boolean;
}) {
  const isClosed = !!thread.revoked_at;
  const activity = new Date(thread.last_activity_at).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
  });

  return (
    <article
      className="rounded-2xl border-2 bg-white p-4 shadow-sm"
      style={{ borderColor: isClosed ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.08)", opacity: isClosed ? 0.7 : 1 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <MessageCircle size={12} strokeWidth={2.5} style={{ color: "#166534" }}/>
            <p className="truncate text-[13px] font-black text-neutral-900">
              {thread.trade_merchant_name || thread.trade_merchant_slug || "Trade"}
            </p>
            {isClosed && (
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-neutral-500">
                closed
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11.5px] text-neutral-600">Re: {postTitle}</p>
          <p className="mt-1 text-[10.5px] font-bold text-neutral-500">
            {thread.message_count} message{thread.message_count === 1 ? "" : "s"} · Last active {activity}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/sitebook?post=${thread.post_id}`}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
          >
            View <ExternalLink size={10}/>
          </Link>
          {canRevoke && <RevokeButton threadId={thread.id} tradeName={thread.trade_merchant_name || "the trade"}/>}
        </div>
      </div>
    </article>
  );
}
