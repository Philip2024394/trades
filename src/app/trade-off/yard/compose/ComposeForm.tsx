"use client";

// The Yard composer form.
//
// Renders the right sub-fields per kind (rate for job posts, price for
// tools, target audience for promo). Uploads photos to the trade-off
// photo bucket via the existing endpoint, then POSTs to
// /api/trade-off/yard/compose which handles rate limits + queue +
// targeted delivery.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  HardHat,
  Hammer,
  Handshake,
  Wrench,
  Search,
  Truck,
  Package,
  Globe,
  Megaphone,
  Upload,
  Loader2,
  CheckCircle2,
  X
} from "lucide-react";

type Kind =
  | "job-seek"
  | "job-offer"
  | "collab-help"
  | "tools-sell"
  | "tools-buy"
  | "tools-rent"
  | "materials-surplus"
  | "abroad-job"
  | "promo";

const KIND_META: Record<
  Kind,
  {
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
    needsRate?: boolean;
    needsPrice?: boolean;
    needsAudience?: boolean;
    isMarketplace?: boolean;
  }
> = {
  "job-seek": {
    label: "Available now",
    sublabel: "Get hired",
    icon: HardHat
  },
  "job-offer": {
    label: "Need crew",
    sublabel: "Hire trades",
    icon: Hammer,
    needsRate: true
  },
  "collab-help": {
    label: "Need a hand",
    sublabel: "Collab / help wanted",
    icon: Handshake
  },
  "tools-sell": {
    label: "Tools for sale",
    sublabel: "Trade Center",
    icon: Wrench,
    needsPrice: true,
    isMarketplace: true
  },
  "tools-buy": {
    label: "Tools wanted",
    sublabel: "Looking to buy",
    icon: Search,
    isMarketplace: true
  },
  "tools-rent": {
    label: "Day-hire",
    sublabel: "Rent out plant / tools",
    icon: Truck,
    needsRate: true,
    isMarketplace: true
  },
  "materials-surplus": {
    label: "Materials surplus",
    sublabel: "Sell / give away",
    icon: Package,
    needsPrice: true,
    isMarketplace: true
  },
  "abroad-job": {
    label: "Work abroad",
    sublabel: "International crews",
    icon: Globe,
    needsRate: true
  },
  promo: {
    label: "Promo",
    sublabel: "Targeted to one trade",
    icon: Megaphone,
    needsAudience: true
  }
};

// UK trade slugs available for audience targeting (subset — expand as needed).
const AUDIENCE_TRADES = [
  "carpenter",
  "plumber",
  "electrician",
  "plasterer",
  "bricklayer",
  "roofer",
  "landscaper",
  "tiler",
  "painter",
  "scaffolder",
  "drywaller",
  "joiner",
  "kitchen-fitter",
  "bathroom-fitter"
];

const PAID_TIERS = new Set(["app_trial", "app_paid", "verified"]);

export function ComposeForm({
  slug,
  editToken,
  displayName,
  primaryTrade,
  initialCity,
  initialCountry,
  initialKind,
  tier,
  initialTitle = "",
  initialBody = ""
}: {
  slug: string;
  editToken: string;
  displayName: string;
  primaryTrade: string;
  initialCity: string;
  initialCountry: string;
  initialKind: string;
  tier: string;
  initialTitle?: string;
  initialBody?: string;
}) {
  const isPaidTier = PAID_TIERS.has(tier);
  const maxAudiences = isPaidTier ? 3 : 1;
  const router = useRouter();

  const validKind =
    initialKind && initialKind in KIND_META
      ? (initialKind as Kind)
      : ("job-seek" as Kind);

  const [kind, setKind] = useState<Kind>(validKind);
  const meta = KIND_META[kind];

  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [region, setRegion] = useState(initialCity);
  const [country, setCountry] = useState(initialCountry);
  const [dayRate, setDayRate] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [priceCurrency, setPriceCurrency] = useState<"GBP" | "USD" | "EUR">(
    "GBP"
  );
  const [condition, setCondition] = useState<string>("");
  const [warrantyStatus, setWarrantyStatus] = useState<string>("");
  const [stockQty, setStockQty] = useState<string>("1");
  const [deliveryOptions, setDeliveryOptions] = useState<string[]>([]);
  const [deliveryFreeOver, setDeliveryFreeOver] = useState<string>("");
  const [audienceSlugs, setAudienceSlugs] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoUploadError, setVideoUploadError] = useState<string | null>(
    null
  );
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; delivery: string; scheduledFor: string | null }
    | { ok: false; error: string }
    | null
  >(null);

  const kindOptions = useMemo(() => Object.entries(KIND_META), []);

  async function handleVideoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    if (!isPaidTier) {
      setVideoUploadError(
        "Video is a paid-tier feature — upgrade to include a clip."
      );
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setVideoUploadError("Video is over 30 MB — trim or lower quality.");
      return;
    }
    setVideoUploadError(null);
    setUploadingVideo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", slug);
      fd.append("edit_token", editToken);
      const res = await fetch("/api/trade-off/upload-video", {
        method: "POST",
        body: fd
      });
      const data = (await res.json()) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.url) {
        setVideoUploadError(
          data.error === "video_requires_paid"
            ? "Video is a paid-tier feature — upgrade to unlock."
            : "Upload failed — try a smaller MP4."
        );
        return;
      }
      setVideoUrl(data.url);
    } finally {
      setUploadingVideo(false);
    }
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < Math.min(files.length, 6 - images.length); i++) {
        const fd = new FormData();
        fd.append("file", files[i]);
        fd.append("slug", slug);
        fd.append("edit_token", editToken);
        const res = await fetch("/api/trade-off/upload-photo", {
          method: "POST",
          body: fd
        });
        if (res.ok) {
          const data = (await res.json()) as { url?: string };
          if (data.url) setImages((prev) => [...prev, data.url!]);
        }
      }
    } finally {
      setUploading(false);
      e.currentTarget.value = "";
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setResult(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/trade-off/yard/compose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          kind,
          trade_slug: primaryTrade,
          title,
          body,
          region,
          country,
          image_urls: images,
          video_urls: videoUrl ? [videoUrl] : [],
          day_rate_pounds: dayRate || undefined,
          product_price_pounds: productPrice || undefined,
          price_currency: meta.isMarketplace ? priceCurrency : undefined,
          condition: meta.isMarketplace && condition ? condition : undefined,
          warranty_status:
            meta.isMarketplace && warrantyStatus ? warrantyStatus : undefined,
          stock_qty: meta.isMarketplace ? Number(stockQty) || 1 : undefined,
          delivery_options: meta.isMarketplace ? deliveryOptions : undefined,
          delivery_free_over_pounds:
            meta.isMarketplace && deliveryFreeOver
              ? deliveryFreeOver
              : undefined,
          target_audience_slugs:
            kind === "promo" ? audienceSlugs : undefined
        })
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        delivery?: string;
        scheduledReleaseAt?: string | null;
      };
      if (res.ok && data.ok) {
        setResult({
          ok: true,
          delivery: data.delivery ?? "live",
          scheduledFor: data.scheduledReleaseAt ?? null
        });
        setTimeout(() => router.push("/trade-off/yard"), 3000);
      } else {
        setResult({
          ok: false,
          error:
            data.error === "promo_needs_audience"
              ? "Choose at least one target trade audience for promo posts."
              : data.error === "free_tier_single_audience"
                ? "Free tier can broadcast to one audience — upgrade to reach up to three."
                : data.error === "too_many_audiences"
                  ? "Maximum three audiences per broadcast."
                  : data.error === "video_requires_paid"
                    ? "Video is a paid-tier feature — upgrade to include a clip."
                    : data.error === "unauthorised"
                      ? "Your magic link is invalid — grab a fresh one from your dashboard."
                      : data.error === "listing_not_live"
                        ? "Your listing isn't live yet."
                        : "Something went wrong. Try again."
        });
      }
    } catch {
      setResult({ ok: false, error: "Network error — try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (result?.ok) {
    const isQueued = result.delivery === "queued";
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-black text-emerald-900">
              {isQueued ? "Queued for release" : "Live on The Yard"}
            </h2>
            <p className="mt-1 text-[14px] leading-[1.55] text-emerald-900/80">
              {isQueued && result.scheduledFor
                ? `Your post publishes at ${new Date(result.scheduledFor).toLocaleTimeString(
                    "en-GB",
                    { hour: "2-digit", minute: "2-digit" }
                  )}. This keeps the feed high-signal so your posts stay visible.`
                : result.delivery === "targeted"
                  ? "Your promo has been delivered directly to the target trade's notification inbox — no feed noise."
                  : "Your post is on the feed. Redirecting…"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Kind picker */}
      <section>
        <label className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#1B1A17]/60">
          What are you posting?
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {kindOptions.map(([k, m]) => {
            const Icon = m.icon;
            const active = kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k as Kind)}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left transition ${
                  active
                    ? "border-amber-400 bg-amber-50"
                    : "border-[#1B1A17]/10 bg-white hover:border-amber-200"
                }`}
              >
                <span
                  aria-hidden
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    active
                      ? "bg-amber-100 text-amber-800"
                      : "bg-[#1B1A17]/5 text-[#1B1A17]/60"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-extrabold text-[#1B1A17]">
                    {m.label}
                  </span>
                  <span className="block text-[10px] text-[#1B1A17]/55">
                    {m.sublabel}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Title */}
      <section>
        <label
          htmlFor="title"
          className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#1B1A17]/60"
        >
          Title
        </label>
        <input
          id="title"
          required
          maxLength={140}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            meta.isMarketplace
              ? "e.g. Bosch GSB 18V drill · barely used"
              : "e.g. Available for 2nd fix next Mon–Wed, Manchester"
          }
          className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-white px-4 py-2.5 text-[14px] text-[#1B1A17] placeholder:text-[#1B1A17]/40 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        />
      </section>

      {/* Body */}
      <section>
        <label
          htmlFor="body"
          className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#1B1A17]/60"
        >
          Details
        </label>
        <textarea
          id="body"
          required
          rows={5}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What are you offering / needing? Include tools, dates, day rate, materials."
          className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-white px-4 py-3 text-[13px] leading-[1.5] text-[#1B1A17] placeholder:text-[#1B1A17]/40 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        />
      </section>

      {/* Rate / Price / Audience — kind-specific */}
      <div className="grid gap-4 sm:grid-cols-2">
        {meta.needsRate && (
          <div>
            <label
              htmlFor="day_rate"
              className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#1B1A17]/60"
            >
              Day rate (£)
            </label>
            <input
              id="day_rate"
              type="number"
              step="0.01"
              min="0"
              value={dayRate}
              onChange={(e) => setDayRate(e.target.value)}
              placeholder="220"
              className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-white px-4 py-2.5 text-[14px] text-[#1B1A17] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            />
          </div>
        )}
        {meta.needsPrice && (
          <div>
            <label
              htmlFor="product_price"
              className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#1B1A17]/60"
            >
              Price (£)
            </label>
            <input
              id="product_price"
              type="number"
              step="0.01"
              min="0"
              value={productPrice}
              onChange={(e) => setProductPrice(e.target.value)}
              placeholder="150"
              className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-white px-4 py-2.5 text-[14px] text-[#1B1A17] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            />
          </div>
        )}
        <div>
          <label
            htmlFor="region"
            className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#1B1A17]/60"
          >
            Town / region
          </label>
          <input
            id="region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Manchester"
            className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-white px-4 py-2.5 text-[14px] text-[#1B1A17] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
        {kind === "abroad-job" && (
          <div>
            <label
              htmlFor="country"
              className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#1B1A17]/60"
            >
              Country
            </label>
            <input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Ireland"
              className="mt-2 w-full rounded-xl border border-[#1B1A17]/12 bg-white px-4 py-2.5 text-[14px] text-[#1B1A17] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            />
          </div>
        )}
      </div>

      {/* Target audience (promo only) */}
      {meta.needsAudience && (
        <section>
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-amber-700">
              Target trade audience{isPaidTier ? "s" : ""} *
            </label>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#1B1A17]/50">
              {audienceSlugs.length}/{maxAudiences}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-[1.45] text-[#1B1A17]/55">
            {isPaidTier ? (
              <>
                Broadcast to up to <b>3 trade audiences</b>. Delivered
                straight to their notification inbox — never the public
                feed. Paid tier perk.
              </>
            ) : (
              <>
                Free tier: pick <b>1 audience</b> per promo. Upgrade to
                broadcast to up to 3 trades at once.
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {AUDIENCE_TRADES.map((t) => {
              const active = audienceSlugs.includes(t);
              const disabled =
                !active && audienceSlugs.length >= maxAudiences;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setAudienceSlugs((prev) => {
                      if (prev.includes(t)) return prev.filter((x) => x !== t);
                      if (prev.length >= maxAudiences) {
                        // Free tier: swap the single audience.
                        return maxAudiences === 1 ? [t] : prev;
                      }
                      return [...prev, t];
                    });
                  }}
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-bold capitalize transition ${
                    active
                      ? "border-amber-500 bg-amber-400 text-neutral-900 shadow-sm"
                      : disabled
                        ? "border-[#1B1A17]/10 bg-white text-[#1B1A17]/35"
                        : "border-[#1B1A17]/15 bg-white text-[#1B1A17]/80 hover:border-amber-300"
                  }`}
                >
                  {t.replace(/-/g, " ")}
                </button>
              );
            })}
          </div>
          {!isPaidTier && (
            <a
              href={`/trade-off/edit/${slug}/upgrade?token=${encodeURIComponent(editToken)}`}
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-extrabold text-amber-700 hover:text-amber-800"
            >
              Upgrade to broadcast to 3 trades →
            </a>
          )}
        </section>
      )}

      {/* Photos */}
      <section>
        <label className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#1B1A17]/60">
          Photos ({images.length}/6)
        </label>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {images.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="relative aspect-square overflow-hidden rounded-lg border border-[#1B1A17]/10 bg-[#FBF6EC]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() =>
                  setImages((prev) => prev.filter((_, idx) => idx !== i))
                }
                aria-label="Remove photo"
                className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow-md"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </div>
          ))}
          {images.length < 6 && (
            <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[#1B1A17]/20 bg-white text-[#1B1A17]/50 hover:border-amber-400 hover:text-amber-700">
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-5 w-5" aria-hidden />
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImagePick}
                disabled={uploading}
              />
            </label>
          )}
        </div>
      </section>

      {/* Video — paid tier only. Free tier sees an upgrade card in
          place of the upload chip. */}
      <section>
        <div className="flex items-center justify-between">
          <label className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#1B1A17]/60">
            Video ({videoUrl ? "1" : "0"}/1)
          </label>
          {!isPaidTier && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-800">
              Paid tier
            </span>
          )}
        </div>
        {isPaidTier ? (
          videoUrl ? (
            <div className="mt-3 relative overflow-hidden rounded-xl border border-[#1B1A17]/10 bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src={videoUrl}
                controls
                preload="metadata"
                className="h-auto max-h-64 w-full object-contain"
              />
              <button
                type="button"
                onClick={() => setVideoUrl("")}
                aria-label="Remove video"
                className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow-md"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </div>
          ) : (
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-300 bg-white p-6 text-[#1B1A17]/60 hover:border-amber-400 hover:text-amber-700">
              {uploadingVideo ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-5 w-5" aria-hidden />
              )}
              <span className="text-[13px] font-bold">
                {uploadingVideo ? "Uploading…" : "Upload video (MP4, max 30 MB)"}
              </span>
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={handleVideoPick}
                disabled={uploadingVideo}
              />
            </label>
          )
        ) : (
          <a
            href={`/trade-off/edit/${slug}/upgrade?token=${encodeURIComponent(editToken)}`}
            className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-50 p-4 hover:bg-amber-100/60"
          >
            <div>
              <p className="text-[13px] font-black text-[#1B1A17]">
                Add video to your posts
              </p>
              <p className="mt-0.5 text-[12px] leading-[1.45] text-[#1B1A17]/60">
                A 10-second walkaround beats 6 photos. Upgrade to unlock.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-400 px-3 py-1.5 text-[12px] font-extrabold text-neutral-900">
              Upgrade
            </span>
          </a>
        )}
        {videoUploadError && (
          <p className="mt-2 text-[12px] text-red-700">{videoUploadError}</p>
        )}
      </section>

      {/* Marketplace commerce fields — only for tools-sell / tools-buy
          / tools-rent / materials-surplus. Currency, condition,
          warranty, stock, delivery options — the fields buyers actually
          filter and compare on. */}
      {meta.isMarketplace && (
        <section className="rounded-2xl border border-[#1B1A17]/10 bg-white p-4">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#1B1A17]/60">
            Item details
          </p>

          {/* Currency + condition side by side */}
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="price_currency"
                className="text-[11px] font-bold uppercase tracking-wider text-[#1B1A17]/55"
              >
                Currency
              </label>
              <select
                id="price_currency"
                value={priceCurrency}
                onChange={(e) =>
                  setPriceCurrency(e.target.value as "GBP" | "USD" | "EUR")
                }
                className="mt-1.5 w-full appearance-none rounded-xl border border-[#1B1A17]/12 bg-white px-3 py-2.5 text-[13px] text-[#1B1A17] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              >
                <option value="GBP" className="text-black">
                  £ GBP
                </option>
                <option value="USD" className="text-black">
                  $ USD
                </option>
                <option value="EUR" className="text-black">
                  € EUR
                </option>
              </select>
            </div>
            <div>
              <label
                htmlFor="condition"
                className="text-[11px] font-bold uppercase tracking-wider text-[#1B1A17]/55"
              >
                Condition
              </label>
              <select
                id="condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="mt-1.5 w-full appearance-none rounded-xl border border-[#1B1A17]/12 bg-white px-3 py-2.5 text-[13px] text-[#1B1A17] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              >
                <option value="" className="text-black">
                  Select…
                </option>
                <option value="new" className="text-black">
                  New
                </option>
                <option value="used-like-new" className="text-black">
                  Used — like new
                </option>
                <option value="used-good" className="text-black">
                  Used — good
                </option>
                <option value="used-fair" className="text-black">
                  Used — fair
                </option>
                <option value="for-parts" className="text-black">
                  For parts / not working
                </option>
              </select>
            </div>
          </div>

          {/* Warranty + stock */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="warranty_status"
                className="text-[11px] font-bold uppercase tracking-wider text-[#1B1A17]/55"
              >
                Warranty
              </label>
              <select
                id="warranty_status"
                value={warrantyStatus}
                onChange={(e) => setWarrantyStatus(e.target.value)}
                className="mt-1.5 w-full appearance-none rounded-xl border border-[#1B1A17]/12 bg-white px-3 py-2.5 text-[13px] text-[#1B1A17] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              >
                <option value="" className="text-black">
                  Select…
                </option>
                <option value="manufacturer" className="text-black">
                  Manufacturer warranty active
                </option>
                <option value="seller-warranty" className="text-black">
                  Seller warranty
                </option>
                <option value="sold-as-seen" className="text-black">
                  Sold as seen
                </option>
              </select>
            </div>
            <div>
              <label
                htmlFor="stock_qty"
                className="text-[11px] font-bold uppercase tracking-wider text-[#1B1A17]/55"
              >
                In stock (qty)
              </label>
              <input
                id="stock_qty"
                type="number"
                min="0"
                step="1"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#1B1A17]/12 bg-white px-3 py-2.5 text-[13px] text-[#1B1A17] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              />
            </div>
          </div>

          {/* Delivery options — chips */}
          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#1B1A17]/55">
              Delivery options
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[
                { v: "collection", l: "Collection" },
                { v: "local-delivery", l: "Free local delivery" },
                { v: "uk-shipping", l: "UK shipping" },
                { v: "international", l: "International" }
              ].map(({ v, l }) => {
                const active = deliveryOptions.includes(v);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() =>
                      setDeliveryOptions((prev) =>
                        prev.includes(v)
                          ? prev.filter((x) => x !== v)
                          : [...prev, v]
                      )
                    }
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-bold transition ${
                      active
                        ? "border-amber-500 bg-amber-400 text-neutral-900 shadow-sm"
                        : "border-[#1B1A17]/15 bg-white text-[#1B1A17]/80 hover:border-amber-300"
                    }`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Free-delivery threshold — optional */}
          {(deliveryOptions.includes("uk-shipping") ||
            deliveryOptions.includes("international")) && (
            <div className="mt-4">
              <label
                htmlFor="delivery_free_over"
                className="text-[11px] font-bold uppercase tracking-wider text-[#1B1A17]/55"
              >
                Free delivery over{" "}
                {priceCurrency === "GBP"
                  ? "£"
                  : priceCurrency === "USD"
                    ? "$"
                    : "€"}
                (optional)
              </label>
              <input
                id="delivery_free_over"
                type="number"
                step="0.01"
                min="0"
                value={deliveryFreeOver}
                onChange={(e) => setDeliveryFreeOver(e.target.value)}
                placeholder="50.00"
                className="mt-1.5 w-full rounded-xl border border-[#1B1A17]/12 bg-white px-3 py-2.5 text-[13px] text-[#1B1A17] placeholder:text-[#1B1A17]/40 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              />
            </div>
          )}
        </section>
      )}

      {/* Submit */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-[14px] font-black text-neutral-900 shadow-md transition active:scale-[0.98] disabled:opacity-60 sm:w-auto sm:px-8"
          style={{ background: "#FFB300" }}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Posting…
            </>
          ) : (
            <>Post to The Yard</>
          )}
        </button>
        {result && !result.ok && (
          <p className="mt-3 text-[13px] text-red-700">{result.error}</p>
        )}
        <p className="mt-3 text-[11px] text-[#1B1A17]/50">
          Posting as <b className="text-[#1B1A17]/70">{displayName}</b>. Auto-
          expires in 14 days. Marketplace listings publish immediately; feed
          posts may be queued to keep signal high.
        </p>
      </div>
    </form>
  );
}
