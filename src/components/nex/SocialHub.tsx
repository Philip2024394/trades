"use client";

// Social Hub — merchant approval + connect + auto-publish surface.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, Send, Calendar, ShieldCheck, ShieldOff, Plug, ArrowLeft } from "lucide-react";
import type { SocialAccount, SocialPost, SocialPlatform } from "@/lib/nex/social";
import { SOCIAL_PLATFORMS, formatInTz } from "@/lib/nex/social";

// Brand icons banned in this codebase (memory rule). Two-letter code
// per platform inside a mono badge instead.
const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  facebook:          "FB",
  instagram:         "IG",
  tiktok:            "TT",
  linkedin:          "LI",
  google_business:   "GBP",
  whatsapp_business: "WA"
};

function PlatformBadge({ platform }: { platform: SocialPlatform }) {
  return <span className="inline-block rounded bg-white/10 px-1 py-0.5 font-mono text-[9px] font-black tracking-widest">{PLATFORM_LABEL[platform]}</span>;
}

export function SocialHub({ merchantName, posts, accounts, timezone, autoPublish }: {
  merchantName: string;
  posts:        SocialPost[];
  accounts:     SocialAccount[];
  timezone:     string;
  autoPublish:  boolean;
}) {
  const awaiting  = posts.filter((p) => p.status === "awaiting_approval");
  const scheduled = posts.filter((p) => p.status === "scheduled");
  const published = posts.filter((p) => p.status === "published");
  const failed    = posts.filter((p) => p.status === "failed" || p.status === "rejected");

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/studio/vault" className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
            <ArrowLeft size={11}/> Back to Vault
          </Link>
          <h1 className="mt-2 text-2xl font-black">Social</h1>
          <p className="mt-1 text-[13px] text-neutral-600">
            {merchantName}. Nex drafts posts. Nothing goes live without your approval.
          </p>
        </div>

        <AccountsCard accounts={accounts}/>
        <AutoPublishCard enabled={autoPublish}/>

        <PostSection title="Waiting for your approval" posts={awaiting} timezone={timezone} highlight/>
        <PostSection title="Scheduled" posts={scheduled} timezone={timezone}/>
        <PostSection title="Published" posts={published} timezone={timezone} collapsed/>
        {failed.length > 0 && <PostSection title="Failed / rejected" posts={failed} timezone={timezone} collapsed/>}
      </div>
    </div>
  );
}

// ─── Accounts + connect ─────────────────────────────────────────

function AccountsCard({ accounts }: { accounts: SocialAccount[] }) {
  const byPlatform = new Map<SocialPlatform, SocialAccount>();
  for (const a of accounts) byPlatform.set(a.platform, a);
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-neutral-500">Connected accounts</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {SOCIAL_PLATFORMS.filter((p) => p !== "whatsapp_business").map((p) => {
          const a = byPlatform.get(p);
          const connected = a?.status === "connected";
          return (
            <div key={p} className={"flex flex-col items-center gap-1 rounded-xl border p-3 " + (connected ? "border-green-300 bg-green-50" : "border-neutral-200 bg-neutral-50")}>
              <div className="flex items-center gap-1">
                <PlatformBadge platform={p}/>
                <span className="text-[11px] font-black capitalize">{p.replace(/_/g, " ")}</span>
              </div>
              {connected ? (
                <span className="text-[10px] font-black text-green-800">Connected</span>
              ) : (
                <ConnectButton platform={p}/>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-neutral-500">
        Real OAuth handshakes ship per-platform. For now, pass a manual token via the connect flow to test.
      </p>
    </div>
  );
}

function ConnectButton({ platform }: { platform: SocialPlatform }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function fakeConnect() {
    // Pass 1: prompt for a token; real OAuth flow lands per-platform.
    const token = window.prompt(`Paste ${platform} access token (dev-only, real OAuth lands soon):`);
    if (!token) return;
    setBusy(true);
    await fetch("/api/studio/social/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        display_name: `${platform} account`,
        access_token: token,
        scopes:       []
      })
    });
    setBusy(false);
    router.refresh();
  }
  return (
    <button onClick={fakeConnect} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-black text-white disabled:opacity-40">
      {busy ? <Loader2 size={9} className="animate-spin"/> : <Plug size={9}/>} Connect
    </button>
  );
}

// ─── Auto-publish toggle ────────────────────────────────────────

function AutoPublishCard({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (!enabled) {
      const ok = window.confirm("Turn ON auto-publish?\n\nApproved posts will publish without a second click. Your FIRST post still needs manual approval. You can turn this off any time.");
      if (!ok) return;
    }
    setBusy(true);
    await fetch("/api/studio/social/auto-publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled })
    });
    setBusy(false);
    router.refresh();
  }
  return (
    <div className={"flex items-center gap-3 rounded-2xl border p-4 " + (enabled ? "border-green-300 bg-green-50" : "border-neutral-200 bg-white")}>
      {enabled ? <ShieldCheck size={18} className="text-green-700"/> : <ShieldOff size={18} className="text-neutral-500"/>}
      <div className="flex-1">
        <p className="text-[13px] font-black">Nex Auto Publish</p>
        <p className="text-[11px] text-neutral-600">
          {enabled
            ? "ON — approved posts go live automatically at their scheduled time."
            : "OFF — every post needs a manual publish click."}
        </p>
      </div>
      <button onClick={toggle} disabled={busy} className={"rounded-full px-4 py-1.5 text-[11px] font-black text-white disabled:opacity-40 " + (enabled ? "bg-neutral-500" : "bg-neutral-900")}>
        {busy ? <Loader2 size={11} className="animate-spin"/> : (enabled ? "Turn off" : "Turn on")}
      </button>
    </div>
  );
}

// ─── Post sections ──────────────────────────────────────────────

function PostSection({ title, posts, timezone, highlight, collapsed }: { title: string; posts: SocialPost[]; timezone: string; highlight?: boolean; collapsed?: boolean }) {
  const [open, setOpen] = useState(!collapsed);
  if (posts.length === 0 && !highlight) return null;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className={"text-[11px] font-black uppercase tracking-wider " + (highlight ? "text-amber-800" : "text-neutral-500")}>
          {title} ({posts.length})
        </p>
        {collapsed !== undefined && <button onClick={() => setOpen(!open)} className="text-[10px] font-black text-neutral-500">{open ? "hide" : "show"}</button>}
      </div>
      {open && posts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center text-[12px] text-neutral-500">
          Nothing here. Ask Nex to create a post from the chat.
        </div>
      )}
      {open && posts.length > 0 && (
        <div className="space-y-2">
          {posts.map((p) => <PostCard key={p.id} post={p} timezone={timezone}/>)}
        </div>
      )}
    </div>
  );
}

function PostCard({ post, timezone }: { post: SocialPost; timezone: string }) {
  const router = useRouter();
  const [busy, setBusy]   = useState<null | "approve" | "reject" | "publish" | "schedule">(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject" | "publish_now", extra?: Record<string, unknown>) {
    const map: Record<string, "approve" | "reject" | "publish"> = { approve: "approve", reject: "reject", publish_now: "publish" };
    setBusy(map[action]); setError(null);
    try {
      const res = await fetch(`/api/studio/social/posts/${post.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra })
      });
      const json = await res.json();
      if (json.ok) router.refresh();
      else setError(json.message ?? json.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "network_error");
    } finally { setBusy(null); }
  }

  async function schedule() {
    const dateStr = window.prompt(`Schedule for (YYYY-MM-DD HH:MM in ${timezone}):`, "2026-08-01 17:00");
    if (!dateStr) return;
    const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec(dateStr.trim());
    if (!m) { alert("Format must be YYYY-MM-DD HH:MM"); return; }
    setBusy("schedule"); setError(null);
    try {
      const res = await fetch(`/api/studio/social/posts/${post.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule",
          schedule: {
            year: Number(m[1]), month: Number(m[2]), day: Number(m[3]),
            hour: Number(m[4]), minute: Number(m[5]),
            timezone
          }
        })
      });
      const json = await res.json();
      if (json.ok) router.refresh();
      else setError(json.error ?? "schedule_failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "network_error");
    } finally { setBusy(null); }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider">
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2 py-0.5 text-white">
          <PlatformBadge platform={post.platform}/> {post.platform}
        </span>
        <span className={"rounded-full px-2 py-0.5 " + statusCls(post.status)}>
          {post.status}
        </span>
        {post.scheduled_for && (
          <span className="ml-auto text-neutral-500">
            <Calendar size={11} className="inline"/> {formatInTz(post.scheduled_for, post.scheduled_tz ?? timezone)}
          </span>
        )}
      </div>
      {post.headline && <p className="mb-1 text-[13px] font-black">{post.headline}</p>}
      <p className="text-[13px] whitespace-pre-wrap text-neutral-800">{post.caption}</p>
      {post.hashtags.length > 0 && (
        <p className="mt-1 text-[11px] text-neutral-500">{post.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}</p>
      )}
      {post.call_to_action && <p className="mt-1 text-[11px] font-black text-neutral-700">CTA: {post.call_to_action}</p>}
      {post.publish_error && <p className="mt-2 text-[11px] text-red-700">{post.publish_error}</p>}
      {post.rejected_reason && <p className="mt-2 text-[11px] text-neutral-500">Reason: {post.rejected_reason}</p>}
      {error && <p className="mt-2 text-[11px] font-black text-red-700">{error}</p>}
      {(post.status === "awaiting_approval" || post.status === "approved" || post.status === "failed") && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.status === "awaiting_approval" && (
            <>
              <button onClick={() => act("approve")} disabled={busy !== null} className="inline-flex items-center gap-1 rounded-full border border-green-600 bg-green-50 px-3 py-1 text-[11px] font-black text-green-800 disabled:opacity-40">
                {busy === "approve" ? <Loader2 size={11} className="animate-spin"/> : <CheckCircle2 size={11}/>} Approve
              </button>
              <button onClick={() => {
                const reason = window.prompt("Reject reason (required)");
                if (reason) act("reject", { reason });
              }} disabled={busy !== null} className="inline-flex items-center gap-1 rounded-full border border-red-500 bg-red-50 px-3 py-1 text-[11px] font-black text-red-800 disabled:opacity-40">
                <XCircle size={11}/> Reject
              </button>
            </>
          )}
          {post.status === "approved" && (
            <>
              <button onClick={() => act("publish_now")} disabled={busy !== null} className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-black text-white disabled:opacity-40">
                {busy === "publish" ? <Loader2 size={11} className="animate-spin"/> : <Send size={11}/>} Publish now
              </button>
              <button onClick={schedule} disabled={busy !== null} className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-black text-neutral-900 disabled:opacity-40">
                <Calendar size={11}/> Schedule
              </button>
            </>
          )}
          {post.status === "failed" && (
            <button onClick={() => act("publish_now")} disabled={busy !== null} className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-black text-white disabled:opacity-40">
              Retry publish
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function statusCls(s: string): string {
  return s === "published"           ? "bg-green-100 text-green-800" :
         s === "awaiting_approval"   ? "bg-amber-100 text-amber-800" :
         s === "approved"            ? "bg-blue-100 text-blue-800" :
         s === "scheduled"           ? "bg-neutral-200 text-neutral-800" :
         s === "failed"              ? "bg-red-100 text-red-800" :
         s === "rejected"            ? "bg-red-100 text-red-800" :
                                       "bg-neutral-100 text-neutral-700";
}
