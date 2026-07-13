"use client";

// Beacon card — the display for a live "need this now" post.
//
// Distinct red-rim styling so it never gets mistaken for a regular
// Yard post. Live countdown (client tick) so trades see the urgency
// in real time. Response thread expands inline; any authed trade can
// reply with price + availability + short message.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Radio,
  MapPin,
  Clock,
  Send,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import type { HammerexTradeOffYardPost } from "@/lib/supabase";
import { tradeLabel } from "@/lib/tradeOff";
import type { YardPoster } from "./YardPostCard";

const BEACON_RED = "#8B0F0F";
const BEACON_YELLOW = "#FFB300";

type Responder = {
  slug: string;
  display_name: string;
  trading_name: string | null;
  primary_trade: string;
  city: string | null;
  avatar_url: string | null;
};

type BeaconResponse = {
  id: string;
  message: string;
  availability: string | null;
  pricePence: number | null;
  isAccepted: boolean;
  createdAt: string;
  responder: Responder | null;
};

function fmtLeft(iso: string | null): string {
  if (!iso) return "expired";
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return "expired";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 1) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

function fmtPrice(pence: number | null): string {
  if (pence === null || pence === undefined) return "";
  const gbp = pence / 100;
  return `£${gbp.toLocaleString("en-GB", {
    minimumFractionDigits: gbp % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

export function YardBeaconCard({
  post,
  poster
}: {
  post: HammerexTradeOffYardPost;
  poster: YardPoster | null;
}) {
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [openThread, setOpenThread] = useState(false);
  const [responses, setResponses] = useState<BeaconResponse[] | null>(null);
  const [loading, setLoading] = useState(false);

  const [auth, setAuth] = useState<{ slug: string; token: string } | null>(null);
  const [priceStr, setPriceStr] = useState("");
  const [availability, setAvailability] = useState("");
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live tick — countdown updates every second
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("slug");
    const t = sp.get("token");
    if (s && t) setAuth({ slug: s, token: t });
  }, []);

  const loadResponses = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/trade-off/yard/beacon/${encodeURIComponent(post.id)}/responses`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as {
        ok: boolean;
        responses?: BeaconResponse[];
      };
      if (data.ok && data.responses) setResponses(data.responses);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [post.id, loading]);

  useEffect(() => {
    if (openThread && responses === null) loadResponses();
  }, [openThread, responses, loadResponses]);

  async function respond(e: React.FormEvent) {
    e.preventDefault();
    if (!auth || posting) return;
    const trimmed = message.trim();
    if (!trimmed) return;
    setPosting(true);
    setError(null);
    try {
      const pricePounds = priceStr.trim()
        ? Number.parseFloat(priceStr.trim())
        : undefined;
      const res = await fetch(
        `/api/trade-off/yard/beacon/${encodeURIComponent(post.id)}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: auth.slug,
            edit_token: auth.token,
            message: trimmed,
            availability: availability.trim() || undefined,
            price_pounds: pricePounds
          })
        }
      );
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(
          data.error === "self_response"
            ? "You can't respond to your own beacon."
            : data.error === "beacon_expired"
              ? "Beacon expired."
              : data.error === "beacon_closed"
                ? "Beacon already closed."
                : data.error === "unauthorised"
                  ? "Sign-in expired."
                  : "Response failed. Try again."
        );
        return;
      }
      setMessage("");
      setPriceStr("");
      setAvailability("");
      await loadResponses();
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPosting(false);
    }
  }

  const expiresAt = post.beacon_expires_at ?? null;
  const isExpired =
    !expiresAt || Date.parse(expiresAt) <= Date.now();
  const isClosed = Boolean(post.beacon_closed_at);
  const responseCount = post.beacon_response_count ?? 0;
  const posterName =
    poster?.trading_name?.trim() || poster?.display_name || "Member";

  // Reference tick so React re-renders every second for the countdown.
  void tick;

  const heroImage = post.image_urls?.[0] ?? null;

  return (
    <article
      className="relative overflow-hidden rounded-2xl border-2 bg-white shadow-md"
      style={{ borderColor: BEACON_RED }}
    >
      <header
        className="flex items-center justify-between gap-2 px-3 py-2 text-white"
        style={{ background: BEACON_RED }}
      >
        <div className="flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5" aria-hidden />
          <span className="text-[11px] font-black uppercase tracking-[0.18em]">
            Beacon · Need now
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-black tabular-nums">
          <Clock className="h-3 w-3" aria-hidden />
          {isExpired ? "expired" : fmtLeft(expiresAt)}
        </div>
      </header>

      <div className="p-3 sm:p-4">
        <div className="flex items-start gap-2.5">
          {heroImage && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={heroImage}
              alt=""
              className="h-14 w-14 shrink-0 rounded-lg border border-neutral-200 object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold leading-[1.4] text-neutral-900">
              {post.body}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] font-semibold text-neutral-500">
              <span>{tradeLabel(post.trade_slug)}</span>
              <span aria-hidden>·</span>
              <span>{posterName}</span>
              {(post.region || post.beacon_radius_km) && (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5" aria-hidden />
                    {post.region ?? "nearby"}
                    {post.beacon_radius_km
                      ? ` · ${post.beacon_radius_km} km`
                      : ""}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Responses toggle */}
        <button
          type="button"
          onClick={() => setOpenThread((v) => !v)}
          className="mt-3 inline-flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12px] font-black text-neutral-800 transition hover:bg-neutral-100"
        >
          <span>
            {responseCount} response{responseCount === 1 ? "" : "s"}
          </span>
          {openThread ? (
            <ChevronUp className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden />
          )}
        </button>

        {openThread && (
          <div className="mt-2 rounded-xl bg-neutral-50 p-3">
            {loading && !responses ? (
              <div className="flex items-center gap-2 py-2 text-[12px] text-neutral-500">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                Loading responses…
              </div>
            ) : responses && responses.length === 0 ? (
              <p className="py-1 text-[12px] text-neutral-500">
                Be the first to respond.
              </p>
            ) : (
              <ul className="space-y-2">
                {(responses ?? []).map((r) => (
                  <li
                    key={r.id}
                    className="rounded-xl border bg-white p-2.5"
                    style={{
                      borderColor: r.isAccepted
                        ? "#0F7A3F"
                        : "rgba(27,26,23,0.10)"
                    }}
                  >
                    <div className="flex items-baseline gap-2">
                      {r.responder ? (
                        <a
                          href={`/${r.responder.slug}`}
                          className="truncate text-[12px] font-black text-neutral-900 hover:underline"
                        >
                          {r.responder.trading_name ??
                            r.responder.display_name}
                        </a>
                      ) : (
                        <span className="text-[12px] font-black text-neutral-500">
                          Responder
                        </span>
                      )}
                      {r.pricePence !== null && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums"
                          style={{
                            background: BEACON_YELLOW,
                            color: "#0A0A0A"
                          }}
                        >
                          {fmtPrice(r.pricePence)}
                        </span>
                      )}
                      {r.isAccepted && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-800">
                          <Check className="h-2.5 w-2.5" aria-hidden />
                          Accepted
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-[1.4] text-neutral-800">
                      {r.message}
                    </p>
                    {r.availability && (
                      <p className="mt-0.5 text-[10.5px] font-semibold text-neutral-600">
                        {r.availability}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Respond form — only when authed AND beacon is live */}
            {!isExpired && !isClosed && auth && (
              <form
                onSubmit={respond}
                className="mt-3 space-y-1.5 rounded-xl border border-neutral-200 bg-white p-2.5"
              >
                <div className="flex flex-wrap gap-1.5">
                  <input
                    value={priceStr}
                    onChange={(e) => setPriceStr(e.target.value)}
                    placeholder="Price £"
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-24 rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] font-bold focus:border-amber-400 focus:outline-none"
                  />
                  <input
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                    placeholder="Collection today · Ready 3pm"
                    maxLength={200}
                    className="flex-1 rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] font-bold focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="I have this in stock…"
                    rows={2}
                    maxLength={800}
                    className="flex-1 resize-none rounded-xl border border-neutral-200 p-2 text-[12px] leading-[1.4] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                  />
                  <button
                    type="submit"
                    disabled={posting || !message.trim()}
                    className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-black text-white shadow-sm disabled:opacity-50"
                    style={{ background: BEACON_RED }}
                  >
                    {posting ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                      <Send className="h-3 w-3" aria-hidden />
                    )}
                    Respond
                  </button>
                </div>
                {error && (
                  <p className="text-[11px] font-semibold text-red-700">
                    {error}
                  </p>
                )}
              </form>
            )}
            {(isExpired || isClosed) && (
              <p className="mt-3 rounded-xl bg-white px-3 py-2 text-[11.5px] font-semibold text-neutral-500">
                {isClosed ? "Beacon closed." : "Beacon expired — no new responses."}
              </p>
            )}
            {!auth && !isExpired && !isClosed && (
              <p className="mt-3 rounded-xl bg-white px-3 py-2 text-[11.5px] font-semibold text-neutral-500">
                Sign in from your trade dashboard to respond.
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
