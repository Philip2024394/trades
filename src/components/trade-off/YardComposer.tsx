"use client";

// Yard composer — single client component for /trade-off/edit/<slug>/yard.
// Renders the kind picker, the main form (title / body / region / kind-
// specific fields / images / link / file URL), the "My current posts"
// list with delete buttons, and the left-sliding drawer that pulls
// from the merchant's Shop Mode catalogue when kind === "product".
//
// Submission posts to /api/trade-off/yard/posts. On success we reload
// the page so the My-posts list reflects the new row.

import { useEffect, useMemo, useState } from "react";
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";
import {
  YARD_TITLE_MAX,
  YARD_TITLE_MIN,
  YARD_BODY_MAX,
  YARD_BODY_MIN,
  formatPostPrice,
  YARD_KIND_LABELS
} from "@/lib/yardPosts";
import type { HammerexTradeOffYardPost } from "@/lib/supabase";

type Kind = HammerexTradeOffYardPost["kind"];

type Product = {
  id: string;
  name: string;
  description: string | null;
  price_pence: number | null;
  cover_url: string | null;
  gallery_urls: string[] | null;
};

const KIND_GROUPS: { label: string; kinds: Kind[] }[] = [
  { label: "Looking for work", kinds: ["available", "needed"] },
  { label: "Other", kinds: ["product", "chat"] }
];

export function YardComposer({
  slug,
  editToken,
  initialTrade,
  initialRegion,
  myPosts,
  canSellProducts
}: {
  slug: string;
  editToken: string;
  initialTrade: string;
  initialRegion: string;
  myPosts: HammerexTradeOffYardPost[];
  /** Show the "Pick from my shop" button + drawer only when the member
   *  actually has a Shop Mode catalogue to draw from. */
  canSellProducts: boolean;
}) {
  const [kind, setKind] = useState<Kind>("available");
  const [tradeSlug, setTradeSlug] = useState(initialTrade);
  const [region, setRegion] = useState(initialRegion);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [crewSize, setCrewSize] = useState("");
  const [dayRate, setDayRate] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [sourceProductId, setSourceProductId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>(["", "", ""]);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const titleLen = title.length;
  const bodyLen = body.length;
  const titleOk = titleLen >= YARD_TITLE_MIN && titleLen <= YARD_TITLE_MAX;
  const bodyOk = bodyLen >= YARD_BODY_MIN && bodyLen <= YARD_BODY_MAX;
  const canSubmit = !busy && titleOk && bodyOk && tradeSlug.length > 0;

  function setImageAt(i: number, v: string) {
    setImageUrls((arr) => {
      const next = [...arr];
      next[i] = v;
      return next;
    });
  }

  function pickFromShop(p: Product) {
    setKind("product");
    setSourceProductId(p.id);
    if (!title) setTitle(p.name.slice(0, YARD_TITLE_MAX));
    if (!body && p.description) setBody(p.description.slice(0, YARD_BODY_MAX));
    if (!productPrice && p.price_pence !== null) {
      setProductPrice(String((p.price_pence / 100).toFixed(2)));
    }
    // Pre-fill image slots — cover_url first, then up to 2 gallery
    // entries. Don't overwrite slots the user has already typed into.
    setImageUrls((arr) => {
      const candidate = [
        p.cover_url ?? "",
        ...(p.gallery_urls ?? []).slice(0, 2)
      ];
      const next = [...arr];
      for (let i = 0; i < 3; i++) {
        if (!next[i] && candidate[i]) next[i] = candidate[i];
      }
      return next;
    });
    setDrawerOpen(false);
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        slug,
        token: editToken,
        kind,
        trade_slug: tradeSlug,
        title: title.trim(),
        body: body.trim(),
        country: "UK",
        region: region.trim() || null,
        image_urls: imageUrls.filter((u) => u.trim().length > 0)
      };
      if (kind === "available" || kind === "needed") {
        payload.start_date = startDate || null;
        payload.end_date = endDate || null;
        if (dayRate) payload.day_rate_pence = Math.round(Number(dayRate) * 100);
      }
      if (kind === "needed" && crewSize) {
        payload.crew_size_needed = Math.round(Number(crewSize));
      }
      if (kind === "product") {
        if (productPrice) {
          payload.product_price_pence = Math.round(Number(productPrice) * 100);
        }
        if (sourceProductId) payload.source_product_id = sourceProductId;
      }
      if (linkUrl) {
        payload.link_url = linkUrl;
        payload.link_title = linkTitle || null;
      }
      if (attachmentUrl) {
        payload.attachment_url = attachmentUrl;
        payload.attachment_name = attachmentName || null;
      }

      const res = await fetch("/api/trade-off/yard/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(
          (data as { error?: string }).error ??
            `Couldn't post (${res.status})`
        );
        return;
      }
      // Reload so the My-posts list shows the new row.
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function deletePost(id: string) {
    if (!confirm("Delete this Yard post? This can't be undone.")) return;
    try {
      const res = await fetch(
        `/api/trade-off/yard/posts/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, token: editToken })
        }
      );
      if (res.ok) window.location.reload();
      else {
        const data = await res.json().catch(() => ({}));
        alert(
          (data as { error?: string }).error ??
            `Couldn't delete (${res.status})`
        );
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Network error");
    }
  }

  return (
    <div className="space-y-8">
      {/* My current posts */}
      <section className="space-y-3">
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
          My current posts
        </h2>
        {myPosts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-brand-line bg-brand-surface p-4 text-[13px] text-brand-muted">
            No live posts yet. Compose one below.
          </p>
        ) : (
          <ul className="space-y-2">
            {myPosts.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-brand-line bg-brand-surface p-4"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13px] font-extrabold text-brand-text sm:text-sm">
                    <span
                      className="inline-flex h-2 w-2 rounded-full"
                      aria-hidden="true"
                      style={{
                        background:
                          p.kind === "available"
                            ? "#0F7A3F"
                            : p.kind === "needed"
                              ? "#0A0A0A"
                              : "#FFB300"
                      }}
                    />
                    {YARD_KIND_LABELS[p.kind]} &middot;{" "}
                    <span className="truncate">{p.title}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-brand-muted">
                    Expires {new Date(p.expires_at).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deletePost(p.id)}
                  className="inline-flex h-9 shrink-0 items-center rounded-lg border border-brand-line bg-brand-bg px-3 text-[11px] font-extrabold text-red-600 transition hover:border-red-300 hover:bg-red-50"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Composer */}
      <section className="space-y-5">
        <div>
          <h2 className="text-[13px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
            New post
          </h2>
          <p className="mt-1 text-[13px] text-brand-muted">
            14-day auto-vanish &middot; only paying members + builder
            trades can read it.
          </p>
        </div>

        {/* Kind picker — grouped */}
        <div className="space-y-3">
          {KIND_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                {g.label}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {g.kinds.map((k) => {
                  const active = kind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className="inline-flex h-10 items-center rounded-xl border-2 px-3 text-[13px] font-extrabold transition active:scale-[0.97]"
                      style={
                        active
                          ? { background: "#FFB300", color: "#0A0A0A", borderColor: "#FFB300" }
                          : { background: "transparent", color: "var(--brand-text)", borderColor: "var(--brand-line)" }
                      }
                    >
                      {YARD_KIND_LABELS[k]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* "Pick from my shop" — only for product kind on merchants
            with a published catalogue. */}
        {kind === "product" && canSellProducts && (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-11 items-center rounded-xl border-2 border-brand-accent bg-brand-accent/10 px-4 text-[13px] font-extrabold text-brand-accent transition hover:bg-brand-accent/20"
          >
            ⟵ Pick from my shop
          </button>
        )}

        {/* Trade + region */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
              Trade
            </span>
            <select
              value={tradeSlug}
              onChange={(e) => setTradeSlug(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-brand-line bg-brand-surface px-3 text-[13px] font-extrabold text-brand-text focus:border-brand-accent focus:outline-none"
            >
              {TRADE_OFF_TRADES.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
              Area
            </span>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Birmingham, West Midlands"
              className="mt-1 h-11 w-full rounded-xl border border-brand-line bg-brand-surface px-3 text-[13px] font-extrabold text-brand-text placeholder:font-bold placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
            />
          </label>
        </div>

        {/* Title */}
        <label className="block">
          <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-brand-muted">
            <span>Title</span>
            <span className={titleOk ? "text-brand-muted" : "text-red-600"}>
              {titleLen} / {YARD_TITLE_MAX}
            </span>
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, YARD_TITLE_MAX + 5))}
            placeholder={
              kind === "needed"
                ? "Need 3 sparks Monday for a commercial fit-out"
                : kind === "available"
                  ? "Plasterer free week of 6 July, Birmingham"
                  : kind === "product"
                    ? "Festool DOMINO DF500 — barely used, full kit"
                    : "Best plasterboard supplier in NW right now?"
            }
            className="mt-1 h-11 w-full rounded-xl border border-brand-line bg-brand-surface px-3 text-[13px] font-extrabold text-brand-text placeholder:font-bold placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
          />
        </label>

        {/* Body */}
        <label className="block">
          <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-brand-muted">
            <span>Body</span>
            <span className={bodyOk ? "text-brand-muted" : "text-red-600"}>
              {bodyLen} / {YARD_BODY_MAX}
            </span>
          </span>
          <textarea
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, YARD_BODY_MAX + 20))}
            placeholder="Add the details — area, dates, day rate, what you need or what you're offering."
            className="mt-1 w-full rounded-xl border border-brand-line bg-brand-surface p-3 text-[13px] text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
          />
        </label>

        {/* Kind-specific extras */}
        {(kind === "available" || kind === "needed") && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                Start date
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-brand-line bg-brand-surface px-3 text-[13px] font-extrabold text-brand-text focus:border-brand-accent focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                End date (optional)
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-brand-line bg-brand-surface px-3 text-[13px] font-extrabold text-brand-text focus:border-brand-accent focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                Day rate £ (optional)
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={dayRate}
                onChange={(e) => setDayRate(e.target.value)}
                placeholder="280"
                className="mt-1 h-11 w-full rounded-xl border border-brand-line bg-brand-surface px-3 text-[13px] font-extrabold text-brand-text placeholder:font-bold placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
              />
            </label>
          </div>
        )}
        {kind === "needed" && (
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
              Crew size needed
            </span>
            <input
              type="number"
              min="1"
              step="1"
              value={crewSize}
              onChange={(e) => setCrewSize(e.target.value)}
              placeholder="3"
              className="mt-1 h-11 w-full rounded-xl border border-brand-line bg-brand-surface px-3 text-[13px] font-extrabold text-brand-text placeholder:font-bold placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
            />
          </label>
        )}
        {kind === "product" && (
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
              Price £
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={productPrice}
              onChange={(e) => setProductPrice(e.target.value)}
              placeholder="795"
              className="mt-1 h-11 w-full rounded-xl border border-brand-line bg-brand-surface px-3 text-[13px] font-extrabold text-brand-text placeholder:font-bold placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
            />
          </label>
        )}

        {/* Image URLs */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-brand-muted">
            Image URLs (up to 3) &middot; project, drawing, or product
          </p>
          <div className="mt-1 grid gap-2 sm:grid-cols-3">
            {imageUrls.map((u, i) => (
              <input
                key={i}
                type="url"
                value={u}
                onChange={(e) => setImageAt(i, e.target.value)}
                placeholder={`https://… image ${i + 1}`}
                className="h-11 w-full rounded-xl border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
              />
            ))}
          </div>
        </div>

        {/* Link + attachment */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-brand-muted">
              External link (optional)
            </p>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://…"
              className="mt-1 h-11 w-full rounded-xl border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
            />
            <input
              type="text"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="Link title"
              className="mt-2 h-11 w-full rounded-xl border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
            />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-brand-muted">
              File URL (PDF / drawing) (optional)
            </p>
            <input
              type="url"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              placeholder="https://….pdf"
              className="mt-1 h-11 w-full rounded-xl border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
            />
            <input
              type="text"
              value={attachmentName}
              onChange={(e) => setAttachmentName(e.target.value)}
              placeholder="File name shown on the post"
              className="mt-2 h-11 w-full rounded-xl border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex h-12 items-center rounded-xl px-6 text-[13px] font-extrabold text-neutral-900 shadow-lg transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "#FFB300",
              boxShadow: "0 8px 22px rgba(255,179,0,0.5)"
            }}
          >
            {busy ? "Posting…" : "Post to The Yard"}
          </button>
          {error && (
            <span className="text-[13px] font-bold text-red-600">{error}</span>
          )}
        </div>
      </section>

      {/* Side drawer — left-sliding catalogue picker */}
      <ShopDrawer
        open={drawerOpen}
        slug={slug}
        editToken={editToken}
        onClose={() => setDrawerOpen(false)}
        onPick={pickFromShop}
      />
    </div>
  );
}

function ShopDrawer({
  open,
  slug,
  editToken,
  onClose,
  onPick
}: {
  open: boolean;
  slug: string;
  editToken: string;
  onClose: () => void;
  onPick: (p: Product) => void;
}) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || products !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/trade-off/yard/my-products?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(editToken)}`
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setError((data as { error?: string }).error ?? `HTTP ${res.status}`);
          return;
        }
        setProducts((data as { products: Product[] }).products);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Network error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, products, slug, editToken]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick a product from your shop"
      className="fixed inset-0 z-[180]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside
        className="absolute left-0 top-0 flex h-full w-[88%] max-w-md flex-col overflow-hidden bg-white shadow-2xl sm:w-96"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-neutral-200 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p
              className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: "#FFB300" }}
            >
              My shop
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition hover:bg-neutral-100"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <h2 className="mt-1 text-lg font-extrabold text-neutral-900">
            Pick a product
          </h2>
          <p className="mt-1 text-[12px] text-neutral-500">
            Tap a product to pre-fill the composer. You can still edit
            the price or copy after.
          </p>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            className="mt-3 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
          />
        </header>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-[13px] font-bold text-red-700">
              {error}
            </p>
          )}
          {!error && products === null && (
            <p className="p-3 text-[13px] text-neutral-500">Loading…</p>
          )}
          {!error && products !== null && filtered.length === 0 && (
            <p className="p-3 text-[13px] text-neutral-500">
              {products.length === 0
                ? "No published shop products yet. Add one in Shop Mode first."
                : "No matches for that search."}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPick(p)}
                  className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white p-2 text-left transition hover:border-[#FFB300] hover:shadow-sm"
                >
                  <span className="block h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                    {p.cover_url && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={p.cover_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-extrabold text-neutral-900">
                      {p.name}
                    </span>
                    {p.price_pence !== null && (
                      <span className="block text-[12px] font-bold text-neutral-600">
                        {formatPostPrice(p.price_pence)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

export default YardComposer;
