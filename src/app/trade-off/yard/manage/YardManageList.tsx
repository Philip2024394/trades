"use client";

// Client-side manager for the trade's own Yard posts. Handles delete,
// archive/unarchive, and links to boost + public detail.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trash2,
  Archive,
  RotateCcw,
  Rocket,
  ExternalLink,
  MessageCircle,
  Phone,
  Loader2,
  Check,
  AlertTriangle
} from "lucide-react";
import { YARD_KIND_LABELS, formatPostPriceCurrency } from "@/lib/yardPosts";

export type ManagedPost = {
  id: string;
  kind: string;
  title: string;
  body: string;
  region: string | null;
  imageUrl: string | null;
  pricePence: number | null;
  currency: string | null;
  condition: string | null;
  stockQty: number;
  status: string;
  contactCount: number;
  commentCount: number;
  boostCount: number;
  isBoostedUntil: string | null;
  createdAt: string;
  expiresAt: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function daysLeft(iso: string): number {
  const ms = Date.parse(iso) - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function YardManageList({
  slug,
  token,
  initialPosts
}: {
  slug: string;
  token: string;
  initialPosts: ManagedPost[];
}) {
  const router = useRouter();
  const [posts, setPosts] = useState<ManagedPost[]>(initialPosts);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(postId: string, next: "live" | "archived") {
    setBusy(postId);
    setError(null);
    try {
      const res = await fetch(
        `/api/trade-off/yard/posts/${encodeURIComponent(postId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, token, status: next })
        }
      );
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Update failed.");
        return;
      }
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, status: next } : p))
      );
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function deletePost(postId: string) {
    setBusy(postId);
    setError(null);
    try {
      const res = await fetch(
        `/api/trade-off/yard/posts/${encodeURIComponent(postId)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, token })
        }
      );
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Delete failed.");
        return;
      }
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setConfirmingDelete(null);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#1B1A17]/15 bg-white p-6 text-center">
        <p className="text-[14px] font-black text-[#1B1A17]">
          You haven&apos;t posted to The Yard yet.
        </p>
        <p className="mt-1 text-[12.5px] text-[#1B1A17]/60">
          Create your first listing from the Sell hub or the Yard.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div
          className="flex items-start gap-2 rounded-xl border border-red-400/40 bg-red-50 p-3 text-[12.5px] font-semibold text-red-800"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {posts.map((p) => {
        const isArchived = p.status === "archived";
        const isBoosted = Boolean(
          p.isBoostedUntil && Date.parse(p.isBoostedUntil) > Date.now()
        );
        const priceText =
          p.pricePence !== null
            ? formatPostPriceCurrency(p.pricePence, p.currency)
            : null;
        const kindLabel =
          YARD_KIND_LABELS[p.kind as keyof typeof YARD_KIND_LABELS] ?? p.kind;
        const isBusy = busy === p.id;

        return (
          <article
            key={p.id}
            className={`rounded-2xl border bg-white p-3 shadow-sm sm:p-4 ${
              isArchived
                ? "border-[#1B1A17]/8 opacity-60"
                : "border-[#1B1A17]/10"
            }`}
          >
            <div className="flex gap-3">
              {p.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={p.imageUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-lg border border-[#1B1A17]/10 object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-neutral-900"
                  style={{ background: "#FFB300" }}
                >
                  {kindLabel
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded-full bg-[#1B1A17] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white">
                    {kindLabel}
                  </span>
                  {priceText && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums"
                      style={{ background: "#FFB300", color: "#0A0A0A" }}
                    >
                      {priceText}
                    </span>
                  )}
                  {isBoosted && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white"
                      style={{ background: "#0F7A3D" }}
                    >
                      Boosted
                    </span>
                  )}
                  {isArchived && (
                    <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-neutral-700">
                      Archived
                    </span>
                  )}
                </div>
                <h3 className="mt-1 truncate text-[13.5px] font-black text-[#1B1A17]">
                  {p.title}
                </h3>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-semibold text-[#1B1A17]/55">
                  <span>{timeAgo(p.createdAt)}</span>
                  {p.region && <span>· {p.region}</span>}
                  {!isArchived && p.status === "live" && (
                    <span>· {daysLeft(p.expiresAt)}d left</span>
                  )}
                  <span className="inline-flex items-center gap-0.5">
                    <Phone className="h-2.5 w-2.5" aria-hidden />
                    {p.contactCount}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <MessageCircle className="h-2.5 w-2.5" aria-hidden />
                    {p.commentCount}
                  </span>
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#1B1A17]/8 pt-3">
              <Link
                href={`/trade-off/yard/${p.id}`}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-[#1B1A17]/15 bg-white px-3 text-[11px] font-bold text-[#1B1A17]/80 hover:border-amber-400"
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
                View
              </Link>

              {!isArchived && (
                <Link
                  href={`/trade-off/yard?boost=${encodeURIComponent(p.id)}&slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`}
                  className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[11px] font-black text-neutral-900 shadow-sm"
                  style={{ background: "#FFB300" }}
                >
                  <Rocket className="h-3 w-3" aria-hidden />
                  Boost
                </Link>
              )}

              {isArchived ? (
                <button
                  type="button"
                  onClick={() => updateStatus(p.id, "live")}
                  disabled={isBusy}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-[#1B1A17]/15 bg-white px-3 text-[11px] font-bold text-[#1B1A17]/80 hover:border-amber-400 disabled:opacity-60"
                >
                  {isBusy ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  ) : (
                    <RotateCcw className="h-3 w-3" aria-hidden />
                  )}
                  Restore
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => updateStatus(p.id, "archived")}
                  disabled={isBusy}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-[#1B1A17]/15 bg-white px-3 text-[11px] font-bold text-[#1B1A17]/80 hover:border-amber-400 disabled:opacity-60"
                >
                  {isBusy ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  ) : (
                    <Archive className="h-3 w-3" aria-hidden />
                  )}
                  Archive
                </button>
              )}

              <span className="ml-auto">
                {confirmingDelete === p.id ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-800">
                    Sure?
                    <button
                      type="button"
                      onClick={() => deletePost(p.id)}
                      disabled={isBusy}
                      className="inline-flex h-6 items-center gap-0.5 rounded-full bg-red-600 px-2 text-[10px] font-black text-white disabled:opacity-60"
                    >
                      {isBusy ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      ) : (
                        <Check className="h-3 w-3" aria-hidden />
                      )}
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(null)}
                      className="text-[10px] font-bold text-red-800/70 hover:text-red-900"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(p.id)}
                    disabled={isBusy}
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-red-300 bg-white px-3 text-[11px] font-bold text-red-800 hover:bg-red-50 disabled:opacity-60"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                    Delete
                  </button>
                )}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
