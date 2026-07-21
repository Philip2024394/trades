"use client";

// CanteenMembersInboxRail — left column on canteen pages.
//
// Same visual language as YardInboxShell's ConversationList: rounded
// white card, tabs on top (All / Chat / Showcase / Announcements),
// vertical list of member × latest-post rows. Owner-only [+ Add member]
// button opens the invite modal (mirrors SiteBook invite pattern).
//
// Each row = one canteen member. Preview snippet = that member's most
// recent post body, timestamp on the right. Tap → jumps to the member's
// canteen page. Tab filter restricts rows to members whose latest
// matching-kind post is present (Chat / Showcase / Announcement).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, Users, UserPlus, Check, X, Loader2 } from "lucide-react";
import type { CanteenMember } from "@/lib/canteens";

/** Minimal shape used by the rail. Kept local so this client
 *  component doesn't reach into any `server-only` types.
 *  `kind` mirrors the canteen post kind enum on
 *  hammerex_canteen_posts.kind. */
type RailPost = {
  id: string;
  authorSlug: string;
  authorDisplayName: string;
  body: string;
  createdAt: string;
  kind?: string;
};

const CARD_BORDER = "rgba(139,69,19,0.15)";
const BRAND       = "#FFB300";

// Two views: the default member list (`all`) and the host-only join
// requests review panel (`requests`). Per-kind filter pills (Chat /
// Showcase / Notices) were removed 2026-07-20 (Philip) — they added
// visual noise without earning their space; the member list is the
// primary object and the search bar handles narrowing.
type Tab = "all" | "requests";

type JoinRequest = {
  id:                 string;
  requesterSlug:      string;
  requesterName:      string;
  requesterTrade:     string | null;
  requesterAvatarUrl: string | null;
  requesterCity:      string | null;
  message:            string | null;
  requestedAt:        string;
};

export function CanteenMembersInboxRail({
  members,
  posts,
  isHost,
  canteenSlug,
  onInvite
}: {
  members:      CanteenMember[];
  posts:        RailPost[];
  isHost:       boolean;
  canteenSlug:  string;
  onInvite:     () => void;
}) {
  const router = useRouter();
  const [tab, setTab]     = useState<Tab>("all");
  const [searchQ, setSearchQ] = useState("");

  // Latest post per member — powers the snippet + timestamp on each
  // member row. Newest-first fold so the map value is always the most
  // recent post by that author.
  const postsDesc = useMemo(
    () => [...posts].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [posts]
  );
  const latestByMember = useMemo(() => {
    const map = new Map<string, RailPost>();
    for (const p of postsDesc) {
      if (!map.has(p.authorSlug)) map.set(p.authorSlug, p);
    }
    return map;
  }, [postsDesc]);

  // Host-only: poll pending join requests every 30s. Feeds the red
  // badge count + the requests review panel. Skipped for visitors.
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  useEffect(() => {
    if (!isHost || !canteenSlug) return;
    let cancelled = false;
    async function fetchRequests() {
      try {
        const res = await fetch(`/api/canteens/${encodeURIComponent(canteenSlug)}/join-request`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setRequests((data.requests ?? []) as JoinRequest[]);
      } catch { /* transient — try next tick */ }
    }
    fetchRequests();
    const id = setInterval(fetchRequests, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [isHost, canteenSlug]);
  const pendingCount = requests.length;

  // Rows shown when the default "all" view is active. Search narrows
  // by displayName + trade label. Every member gets rendered — no
  // per-kind filter (removed 2026-07-20). `requests` tab swaps the
  // list for the review panel entirely (see the render below).
  const rows = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return members
      .filter((m) => !q || m.displayName.toLowerCase().includes(q) || (m.tradeLabel ?? "").toLowerCase().includes(q))
      .map((m) => ({ member: m, latest: latestByMember.get(m.slug) ?? null }));
  }, [members, latestByMember, searchQ]);

  const total = members.length;
  // router preserved for future in-rail actions (remove-member,
  // pending-invitation resolution). No-op today keeps ESLint quiet.
  void router;

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: CARD_BORDER, maxHeight: "calc(100vh - 8rem)" }}
    >
      {/* Header */}
      <div className="border-b p-3" style={{ borderColor: CARD_BORDER }}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5">
            <Users size={13} className="text-neutral-500" strokeWidth={2.4}/>
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
              Trade members
            </span>
            <span className="text-[10.5px] font-black tabular-nums text-neutral-900">{total}</span>
          </div>
          {isHost && (
            <button
              type="button"
              onClick={onInvite}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[10px] font-black uppercase tracking-wider shadow-sm transition active:scale-[0.97]"
              style={{ backgroundColor: BRAND, color: "#0A0A0A" }}
              title="Invite trades to your canteen"
            >
              <Plus size={11} strokeWidth={2.6}/>
              Add
            </button>
          )}
        </div>

        {/* Search */}
        <div className="mb-3 relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"/>
          <input
            type="search"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search members…"
            className="h-8 w-full rounded-lg border bg-neutral-50 pl-7 pr-2 text-[12px] outline-none focus:bg-white"
            style={{ borderColor: CARD_BORDER }}
          />
        </div>

        {/* Requests toggle — host only, silent unless pending > 0.
            When active, shows the tab strip with just Members ↔ Requests
            so the host can flip back to the member list. When there
            are no pending requests, no tabs render at all. */}
        {isHost && pendingCount > 0 && (
          <div className="flex items-center gap-2 text-[10.5px] font-bold">
            <button
              type="button"
              onClick={() => setTab("all")}
              className={
                "relative rounded-md px-2 py-1 uppercase tracking-wide transition " +
                (tab === "all" ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-700")
              }
            >
              Members
              {tab === "all" && (
                <span aria-hidden className="absolute inset-x-1 -bottom-[6px] h-[2px] rounded-full" style={{ background: BRAND }}/>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab("requests")}
              className={
                "relative inline-flex items-center gap-1 rounded-md px-2 py-1 uppercase tracking-wide transition " +
                (tab === "requests" ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-700")
              }
            >
              Requests
              <span
                aria-label={`${pendingCount} pending request${pendingCount === 1 ? "" : "s"}`}
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black tabular-nums text-white"
                style={{ backgroundColor: "#B91C1C" }}
              >
                {pendingCount}
              </span>
              {tab === "requests" && (
                <span aria-hidden className="absolute inset-x-1 -bottom-[6px] h-[2px] rounded-full" style={{ background: BRAND }}/>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Rows (or Requests review panel when that tab is active) */}
      <div className="flex-1 overflow-y-auto">
        {tab === "requests" ? (
          <RequestsReviewPanel
            requests={requests}
            canteenSlug={canteenSlug}
            onResolved={(id) => {
              setRequests((prev) => {
                const next = prev.filter((r) => r.id !== id);
                // Last request resolved → auto-flip back to the Members
                // view so the panel doesn't strand the host on an empty
                // "no requests pending" state with a hidden tab bar
                // (Philip 2026-07-20).
                if (next.length === 0) setTab("all");
                return next;
              });
            }}
          />
        ) : rows.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-[11.5px] text-neutral-500">
              {searchQ ? "No members match your search." : "No members yet."}
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: CARD_BORDER }}>
            {rows.map(({ member, latest }) => (
              <li key={member.slug}>
                <Link
                  href={`/trade-off/yard/canteens/${member.slug}`}
                  className="flex items-start gap-2.5 p-2.5 transition hover:bg-neutral-50"
                >
                  {/* Avatar */}
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-black text-neutral-900"
                    style={{
                      backgroundColor: BRAND,
                      backgroundImage: member.avatarUrl ? `url('${member.avatarUrl}')` : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }}
                  >
                    {!member.avatarUrl && member.displayName.charAt(0)}
                  </span>
                  {/* Body */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-1">
                      <p className="truncate text-[12px] font-black text-neutral-900">
                        {member.displayName}
                      </p>
                      {latest && (
                        <span className="flex-shrink-0 text-[9.5px] text-neutral-400 tabular-nums">
                          {shortAgo(latest.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[10.5px] text-neutral-500">
                      {latest?.body ?? member.tradeLabel ?? "—"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function shortAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60)  return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d`;
  const w = Math.floor(d / 7);
  return `${w}w`;
}

// ─── RequestsReviewPanel ───────────────────────────────────────────
//
// Host-only. Rendered inside the rail when tab='requests'. One card
// per pending request with Accept / Not now buttons. Silent decline —
// requester never learns they were declined (per join-request UX spec).

function RequestsReviewPanel({
  requests,
  canteenSlug,
  onResolved
}: {
  requests:    JoinRequest[];
  canteenSlug: string;
  onResolved:  (id: string) => void;
}) {
  if (requests.length === 0) {
    return (
      <div className="p-6 text-center">
        <UserPlus size={20} className="mx-auto text-neutral-400"/>
        <p className="mt-2 text-[11.5px] text-neutral-500">No requests pending.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y" style={{ borderColor: CARD_BORDER }}>
      {requests.map((r) => (
        <RequestRow key={r.id} req={r} canteenSlug={canteenSlug} onResolved={onResolved}/>
      ))}
    </ul>
  );
}

function RequestRow({
  req,
  canteenSlug,
  onResolved
}: {
  req:         JoinRequest;
  canteenSlug: string;
  onResolved:  (id: string) => void;
}) {
  const [busy, setBusy]   = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function resolve(action: "accept" | "decline") {
    setBusy(action); setError(null);
    try {
      const res = await fetch(
        `/api/canteens/${encodeURIComponent(canteenSlug)}/join-request/${encodeURIComponent(req.id)}/${action}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      onResolved(req.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }
  return (
    <li className="p-2.5">
      <div className="flex items-start gap-2.5">
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-black text-neutral-900"
          style={{
            backgroundColor: BRAND,
            backgroundImage: req.requesterAvatarUrl ? `url('${req.requesterAvatarUrl}')` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}
        >
          {!req.requesterAvatarUrl && req.requesterName.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-black text-neutral-900">{req.requesterName}</p>
          <p className="mt-0.5 truncate text-[10.5px] text-neutral-500">
            {[req.requesterTrade, req.requesterCity].filter(Boolean).join(" · ")}
          </p>
          {req.message && (
            <p className="mt-1 rounded-md bg-neutral-50 p-1.5 text-[10.5px] italic text-neutral-700">
              &ldquo;{req.message}&rdquo;
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-1.5">
        <span className="text-[9.5px] text-neutral-400 tabular-nums">
          {shortAgo(req.requestedAt)} ago
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => resolve("decline")}
            disabled={busy !== null}
            className="inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[10px] font-black uppercase tracking-wider text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
            style={{ borderColor: CARD_BORDER }}
          >
            {busy === "decline" ? <Loader2 size={10} className="animate-spin"/> : <X size={10}/>}
            Not now
          </button>
          <button
            type="button"
            onClick={() => resolve("accept")}
            disabled={busy !== null}
            className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm disabled:opacity-50"
            style={{ backgroundColor: "#166534" }}
          >
            {busy === "accept" ? <Loader2 size={10} className="animate-spin"/> : <Check size={10}/>}
            Accept
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-[10px] font-bold text-red-700">{error}</p>}
    </li>
  );
}
