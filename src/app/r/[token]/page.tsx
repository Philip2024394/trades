// /r/[token] — public reply page for SiteBook WhatsApp threads.
//
// A trade taps the nw.app/r/{token} link from their WhatsApp message
// footer → this page renders → they type a reply → it lands as an
// 'inbound' message on the same thread, mirrored to the parent post
// so it appears in the homeowner's SiteBook feed under the original.
//
// No auth required — the token itself is the credential. Tokens are
// crypto-random 12-char strings tied to (post, trade) pairs and
// revocable by the homeowner.
//
// See lib/homeowners/waMessages.ts + migration 20260718150000.

import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { supabaseAdmin }     from "@/lib/supabaseAdmin";
import { loadThreadByToken } from "@/lib/homeowners/waMessages";
import { ReplyForm }         from "./ReplyForm";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

const BRAND_YELLOW = "#FFB300";
const OFF_WHITE    = "#FBF6EC";

export default async function ReplyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const res = await loadThreadByToken(token);
  if (!res.ok) {
    // Both 'not-found' and 'revoked' render as a friendly explainer
    return <RevokedOrMissing kind={res.error}/>;
  }

  // Load post + homeowner context so the trade sees what they're replying about
  const [postRes, homeownerRes] = await Promise.all([
    supabaseAdmin
      .from("hammerex_sitebook_posts")
      .select("id, title, body, kind, created_at")
      .eq("id", res.thread.post_id)
      .maybeSingle(),
    supabaseAdmin
      .from("hammerex_homeowners")
      .select("first_name, house_nickname, city")
      .eq("id", res.thread.homeowner_id)
      .maybeSingle()
  ]);

  if (!postRes.data) return notFound();
  const post      = postRes.data as { id: string; title: string | null; body: string; kind: string; created_at: string };
  const homeowner = homeownerRes.data as { first_name: string | null; house_nickname: string; city: string | null } | null;

  const homeownerName = homeowner?.first_name || "the homeowner";
  const siteBookName  = homeowner?.house_nickname || "SiteBook";

  return (
    <div className="min-h-screen" style={{ backgroundColor: OFF_WHITE }}>
      <header className="border-b border-neutral-200 backdrop-blur" style={{ backgroundColor: OFF_WHITE }}>
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-neutral-900 shadow-sm" style={{ backgroundColor: BRAND_YELLOW }}>
            <BookOpen size={14} strokeWidth={2.4}/>
          </span>
          <span className="font-black text-neutral-900">SiteBook Reply</span>
          <span className="ml-auto text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
            {res.thread.trade_merchant_name || "Trade"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Reply to {homeownerName} · {siteBookName}
          </p>
          <h1 className="mt-1 text-[19px] font-black leading-tight text-neutral-900">
            Re: {post.title || post.body.slice(0, 60)}
          </h1>

          {/* Original outgoing message */}
          <div className="mt-4 rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
              {homeownerName} wrote · {formatDate(post.created_at)}
            </p>
            <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-neutral-800">
              {post.body}
            </p>
          </div>

          {/* Prior messages (both outgoing and any past inbound) */}
          {res.messages.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                Message history
              </p>
              {res.messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl p-3 text-[13.5px] leading-relaxed ${
                    m.direction === "outgoing"
                      ? "bg-white ring-1 ring-neutral-200"
                      : "ml-6 ring-1 ring-amber-200"
                  }`}
                  style={m.direction === "inbound" ? { backgroundColor: "#FFFBEB" } : undefined}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
                    {m.direction === "outgoing" ? homeownerName : (res.thread.trade_merchant_name || "You")} · {formatDate(m.created_at)}
                    {m.sent_via === "reply-link" && <span className="ml-1 text-amber-700">· via reply link</span>}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-neutral-800">{m.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* The reply form */}
        <div className="mt-4 rounded-2xl border-2 border-neutral-200 bg-white p-5 shadow-sm">
          <ReplyForm token={token} tradeName={res.thread.trade_merchant_name || "Trade"}/>
        </div>

        <p className="mt-4 text-center text-[11.5px] text-neutral-500">
          Also replied on WhatsApp? Ignore this page — {homeownerName} can paste your reply into their SiteBook.
        </p>
        <p className="mt-1 text-center text-[10.5px] text-neutral-400">
          Powered by <span className="font-black">The Network</span>
        </p>
      </main>
    </div>
  );
}

function formatDate(iso: string): string {
  const d    = new Date(iso);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (same) return `Today ${time}`;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
}

function RevokedOrMissing({ kind }: { kind: "not-found" | "revoked" }) {
  const title    = kind === "revoked" ? "This conversation was closed" : "Link not found";
  const subtitle = kind === "revoked"
    ? "The homeowner has closed this thread. Reach out via WhatsApp directly if you have their number."
    : "This reply link isn't valid. It may have been mistyped, or the SiteBook post it linked to was deleted.";

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: OFF_WHITE }}>
      <div className="max-w-md rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-neutral-900 shadow-sm" style={{ backgroundColor: BRAND_YELLOW }}>
          <BookOpen size={18} strokeWidth={2.4}/>
        </span>
        <h1 className="mt-3 text-[17px] font-black text-neutral-900">{title}</h1>
        <p className="mt-1.5 text-[13px] text-neutral-600">{subtitle}</p>
        <p className="mt-4 text-[11px] font-black uppercase tracking-wider text-neutral-500">
          The Network · SiteBook
        </p>
      </div>
    </div>
  );
}
