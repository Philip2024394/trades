"use client";

// Follow / Following toggle for any trade profile. Auth via magic-link
// URL params — no session → shows "Sign in to follow" nudge. Optimistic
// update on click; rollback on server rejection.
//
// Two size variants:
//   • "chip"     — small pill for card backs / feed strips
//   • "primary"  — big button for profile hero

import { useEffect, useState } from "react";
import { Loader2, UserPlus, UserCheck } from "lucide-react";

const BRAND_YELLOW = "#FFB300";
const BRAND_INK = "#0A0A0A";

type Auth = { slug: string; token: string };

export function FollowButton({
  targetSlug,
  initialCount,
  size = "chip"
}: {
  targetSlug: string;
  initialCount: number;
  size?: "chip" | "primary";
}) {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [count, setCount] = useState(initialCount);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selfProfile, setSelfProfile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const slug = sp.get("slug");
    const token = sp.get("token");
    if (slug && token) {
      setAuth({ slug, token });
      setSelfProfile(slug === targetSlug);
      // Hydrate follow state from server (fast path — GET is cached).
      fetch(
        `/api/trade-off/follow/${encodeURIComponent(targetSlug)}?caller_slug=${encodeURIComponent(slug)}&caller_token=${encodeURIComponent(token)}`,
        { cache: "no-store" }
      )
        .then((r) => r.json())
        .then((d: { ok: boolean; isFollowing?: boolean; followerCount?: number }) => {
          if (d.ok) {
            setFollowing(!!d.isFollowing);
            if (typeof d.followerCount === "number") setCount(d.followerCount);
          }
        })
        .catch(() => {});
    }
  }, [targetSlug]);

  async function toggle() {
    if (!auth || busy || selfProfile) return;
    const wasFollowing = following;
    // Optimistic
    setFollowing(!wasFollowing);
    setCount((c) => c + (wasFollowing ? -1 : 1));
    setBusy(true);
    try {
      const res = await fetch(
        `/api/trade-off/follow/${encodeURIComponent(targetSlug)}`,
        {
          method: wasFollowing ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: auth.slug,
            edit_token: auth.token
          })
        }
      );
      const data = (await res.json()) as {
        ok: boolean;
        isFollowing?: boolean;
        followerCount?: number;
      };
      if (!res.ok || !data.ok) {
        // Rollback
        setFollowing(wasFollowing);
        setCount((c) => c + (wasFollowing ? 1 : -1));
        return;
      }
      if (typeof data.isFollowing === "boolean") setFollowing(data.isFollowing);
      if (typeof data.followerCount === "number") setCount(data.followerCount);
    } catch {
      // Rollback
      setFollowing(wasFollowing);
      setCount((c) => c + (wasFollowing ? 1 : -1));
    } finally {
      setBusy(false);
    }
  }

  // Follower count strip (visible to everyone, even un-authed)
  if (selfProfile) {
    return (
      <span
        className={
          size === "primary"
            ? "inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-4 py-2 text-[12px] font-black text-neutral-700"
            : "inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-black text-neutral-700"
        }
      >
        <UserCheck
          className={size === "primary" ? "h-4 w-4" : "h-3 w-3"}
          aria-hidden
        />
        {count} follower{count === 1 ? "" : "s"}
      </span>
    );
  }

  if (!auth) {
    return (
      <span
        className={
          size === "primary"
            ? "inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-4 py-2 text-[12px] font-bold text-neutral-500"
            : "inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold text-neutral-500"
        }
      >
        <UserPlus
          className={size === "primary" ? "h-4 w-4" : "h-3 w-3"}
          aria-hidden
        />
        {count} follower{count === 1 ? "" : "s"}
      </span>
    );
  }

  const style: React.CSSProperties = following
    ? {
        background: "transparent",
        color: BRAND_INK,
        border: "2px solid rgba(27,26,23,0.15)"
      }
    : { background: BRAND_YELLOW, color: BRAND_INK };

  if (size === "primary") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[13px] font-black shadow-sm transition active:scale-[0.97] disabled:opacity-60"
        style={style}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : following ? (
          <UserCheck className="h-4 w-4" aria-hidden />
        ) : (
          <UserPlus className="h-4 w-4" aria-hidden />
        )}
        {following ? "Following" : "Follow"}
        <span className="rounded-full bg-black/[0.08] px-2 py-0.5 text-[10.5px] font-black tabular-nums">
          {count}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black transition active:scale-[0.97] disabled:opacity-60"
      style={style}
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : following ? (
        <UserCheck className="h-3 w-3" aria-hidden />
      ) : (
        <UserPlus className="h-3 w-3" aria-hidden />
      )}
      {following ? "Following" : "Follow"}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}
