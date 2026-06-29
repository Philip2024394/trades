"use client";

// Shared single-screen Trade Off form used by both /trade-off/signup and
// /trade-off/edit/[slug]. Vertical sections, real-time completeness banner,
// per-photo upload as you go. Submits to /api/trade-off/create (signup) or
// /api/trade-off/update (edit) depending on `mode`.
//
// Why single-screen instead of stepper: easier to debug, no state to lose
// between steps, and tradies on phones can scroll past sections they don't
// care about. The completeness banner at the top tells them what's still
// missing.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TRADE_OFF_REQUIRED_FIELDS,
  TRADE_OFF_TRADES,
  tradeLabel
} from "@/lib/tradeOff";
import { TRADE_SOCIAL_FIELDS } from "@/lib/tradeOffSocial";
import { socialIconFor } from "@/components/trade-off/TradeSocialIcons";
import { tradeHeroFor } from "@/lib/tradeOffHeroes";
import { PhoneCountryInput } from "@/components/trade-off/PhoneCountryInput";
import { COUNTRY_DIAL_CODES, countryByIso2 } from "@/lib/countryDialCodes";
import { VideoUploadInput } from "@/components/trade-off/VideoUploadInput";
import { tradeBusinessExample } from "@/lib/tradePlaceholders";
import { isMerchantGradeTrade } from "@/lib/tradeOff";
import { SlugAvailabilityField } from "@/components/trade-off/SlugAvailabilityField";

type Mode =
  | { kind: "create" }
  | { kind: "edit"; slug: string; editToken: string; listingId: string };

export type TradeOffFormInitial = {
  display_name: string;
  trading_name: string;
  slug?: string;
  primary_trade: string;
  secondary_trades: string[];
  city: string;
  country: string;
  postcode_prefix: string;
  service_postcodes: string;
  /** Service radius in km the tradesperson is willing to travel.
   *  Empty string = "all areas" (sends null on save). */
  service_radius_km: string;
  whatsapp: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  youtube: string;
  twitter: string;
  snapchat: string;
  reddit: string;
  google: string;
  bio: string;
  years_in_trade: string;
  start_year: string;
  avatar_url: string;
  custom_app_hero_url: string;
  /** YouTube / Vimeo / direct mp4 URL for the optional intro video.
   *  Preview iframe / <video> renders below the input when set so the
   *  tradesperson sees what their visitors will see. */
  video_url: string;
  /** Four starter products for merchant-grade trades. Collected inline
   *  on the signup / edit form so the tradesperson can launch with a
   *  populated catalogue in a single step. Each row carries the
   *  minimum a buyer needs to evaluate: name, image, price (in pounds
   *  for the input — converted to pence on save), short description.
   *  After the listing saves we POST each non-empty row to the products
   *  upsert API so they end up in `hammerex_xrated_products`. */
  starter_products: Array<{
    name: string;
    image_url: string;
    /** Up to 3 extra product images. Saves to gallery_urls on the
     *  product row (1 cover + 3 gallery = 4 total — matches the
     *  HammerexXratedProduct schema cap). */
    gallery_urls: string[];
    price_pounds: string;
    description: string;
    /** Up to 2 multi-buy tiers per product. Each tier reads as
     *  "Buy <min_qty> for £<price_pounds> each" on the live PDP. On
     *  save we transform to bulk_tiers ({ min_qty, max_qty:null,
     *  price_pence }) and pipe through the existing products/upsert. */
    multi_buy: Array<{ min_qty: string; price_pounds: string }>;
    /** Single-axis variants (size / colour / model / material / custom).
     *  Up to 5 rows per product. Each row: label + optional stock +
     *  optional price delta in £ (positive or negative vs base). On
     *  save we transform to the products/upsert variants shape. */
    variants_axis: "" | "size" | "colour" | "model" | "material" | "custom";
    /** Custom axis name when axis === 'custom' (e.g. "Capacity"). */
    variants_axis_label: string;
    variants_rows: Array<{
      label: string;
      stock_count: string;
      price_delta_pounds: string;
    }>;
    /** Per-product FAQ — max 3 q/a pairs. Empty rows are dropped on
     *  save. Renders on the live PDP as a collapsible Q&A accordion
     *  under the cover image. */
    faq: Array<{ q: string; a: string }>;
  }>;
  /** Shop-level retail delivery mode for merchant trades. Applies to
   *  every product by default; per-product overrides happen on the
   *  Shop Mode editor. Empty string = not configured (PDP falls back
   *  to "Delivery confirmed by WhatsApp"). */
  retail_shipping_mode:
    | ""
    | "pickup"
    | "free"
    | "uk_flat"
    | "uk_over_threshold";
  /** Either the flat UK fee (mode = uk_flat) or the free-over
   *  threshold (mode = uk_over_threshold), in £ as a string for the
   *  number input. Stored to retail_shipping_uk_pence on save. */
  retail_shipping_uk_pounds: string;
  /** International delivery — collapsed section. One row per country
   *  the merchant ships to. Empty array = UK-only. */
  retail_shipping_international: Array<{
    country_code: string;
    country_name: string;
    price_pounds: string;
    dispatch_days: string;
    delivery_days: string;
  }>;
  photos: string[];
  /** Signup-only — password the tradesperson picks at create-time. Used
   *  for the new phone+password login flow. Never round-trips on edit:
   *  the edit dashboard pre-loads this empty. Min 6 chars enforced
   *  client-side; the create API enforces it server-side too. */
  password: string;
};

const EMPTY_INITIAL: TradeOffFormInitial = {
  display_name: "",
  trading_name: "",
  slug: "",
  primary_trade: "",
  secondary_trades: [],
  city: "",
  country: "United Kingdom",
  postcode_prefix: "",
  service_postcodes: "",
  service_radius_km: "",
  whatsapp: "",
  phone: "",
  email: "",
  website: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  youtube: "",
  twitter: "",
  snapchat: "",
  reddit: "",
  google: "",
  bio: "",
  years_in_trade: "",
  start_year: "",
  avatar_url: "",
  custom_app_hero_url: "",
  video_url: "",
  starter_products: [
    { name: "", image_url: "", gallery_urls: [], price_pounds: "", description: "", multi_buy: [], variants_axis: "", variants_axis_label: "", variants_rows: [], faq: [] },
    { name: "", image_url: "", gallery_urls: [], price_pounds: "", description: "", multi_buy: [], variants_axis: "", variants_axis_label: "", variants_rows: [], faq: [] },
    { name: "", image_url: "", gallery_urls: [], price_pounds: "", description: "", multi_buy: [], variants_axis: "", variants_axis_label: "", variants_rows: [], faq: [] },
    { name: "", image_url: "", gallery_urls: [], price_pounds: "", description: "", multi_buy: [], variants_axis: "", variants_axis_label: "", variants_rows: [], faq: [] }
  ],
  retail_shipping_mode: "",
  retail_shipping_uk_pounds: "",
  retail_shipping_international: [],
  photos: [],
  password: ""
};

const FIELD_LABELS: Record<string, string> = {
  display_name: "Your name",
  primary_trade: "Primary trade",
  city: "City / town",
  whatsapp: "WhatsApp number",
  email: "Email",
  bio: "About you",
  photos: "At least one photo of your work"
};

export function TradeOffForm({
  mode,
  initial
}: {
  mode: Mode;
  initial?: Partial<TradeOffFormInitial>;
}) {
  const router = useRouter();
  const [state, setState] = useState<TradeOffFormInitial>({
    ...EMPTY_INITIAL,
    ...initial
  });
  const [uploading, setUploading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const isEmailValid = useMemo(
    () => /.+@.+\..+/.test(state.email.trim()),
    [state.email]
  );
  const waDigitCount = useMemo(
    () => state.whatsapp.replace(/\D/g, "").length,
    [state.whatsapp]
  );
  const bioLen = state.bio.trim().length;

  const missing = useMemo(() => {
    const list: string[] = [];
    for (const f of TRADE_OFF_REQUIRED_FIELDS) {
      const v = (state as Record<string, unknown>)[f];
      if (typeof v !== "string" || v.trim().length === 0) list.push(f);
    }
    if (state.photos.length < 1) list.push("photos");
    if (state.email && !isEmailValid && !list.includes("email")) list.push("email");
    if (state.whatsapp && waDigitCount < 7 && !list.includes("whatsapp")) list.push("whatsapp");
    if (state.bio && bioLen < 60 && !list.includes("bio")) list.push("bio");
    return list;
  }, [state, isEmailValid, waDigitCount, bioLen]);

  const wouldBeLive = missing.length === 0;

  function update<K extends keyof TradeOffFormInitial>(key: K, value: TradeOffFormInitial[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function toggleSecondary(slug: string) {
    setState((s) => {
      const has = s.secondary_trades.includes(slug);
      if (has) return { ...s, secondary_trades: s.secondary_trades.filter((x) => x !== slug) };
      if (s.secondary_trades.length >= 3) return s;
      return { ...s, secondary_trades: [...s.secondary_trades, slug] };
    });
  }

  async function handleAvatarFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null);
    setUploadingAvatar(true);
    try {
      const file = files[0];
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/trade-off/upload-photo", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (!body.ok || !body.url) {
        setErr(body.error || "Could not upload your profile photo.");
        return;
      }
      setState((s) => ({ ...s, avatar_url: body.url as string }));
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleBannerFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null);
    setUploadingBanner(true);
    try {
      const file = files[0];
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/trade-off/upload-photo", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (!body.ok || !body.url) {
        setErr(body.error || "Could not upload your banner image.");
        return;
      }
      setState((s) => ({ ...s, custom_app_hero_url: body.url as string }));
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null);
    setUploading(true);
    try {
      const remaining = 6 - state.photos.length;
      const toUpload = Array.from(files).slice(0, remaining);
      for (const file of toUpload) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/trade-off/upload-photo", { method: "POST", body: fd });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
        if (!body.ok || !body.url) {
          setErr(body.error || `Could not upload "${file.name}".`);
          break;
        }
        setState((s) => ({ ...s, photos: [...s.photos, body.url as string] }));
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function movePhoto(idx: number, dir: -1 | 1) {
    setState((s) => {
      const arr = [...s.photos];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return s;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...s, photos: arr };
    });
  }

  function removePhoto(idx: number) {
    setState((s) => ({ ...s, photos: s.photos.filter((_, i) => i !== idx) }));
  }

  // Promote a gallery photo to the cover banner. The current cover (if
  // any) drops back into the gallery in the slot the promoted photo
  // just left, so the tradesperson never loses an image they've already
  // uploaded.
  function promoteToCover(galleryIdx: number) {
    const photosIdx = galleryIdx + 1;
    setState((s) => {
      if (photosIdx <= 0 || photosIdx >= s.photos.length) return s;
      const arr = [...s.photos];
      [arr[0], arr[photosIdx]] = [arr[photosIdx], arr[0]];
      return { ...s, photos: arr };
    });
  }

  // Upload one file into the cover slot. If a cover already exists we
  // push it down into the gallery so it isn't lost. Re-uses the same
  // upload endpoint as the gallery.
  async function handleCoverFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/trade-off/upload-photo", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (!body.ok || !body.url) {
        setErr(body.error || `Could not upload "${file.name}".`);
        return;
      }
      const url = body.url;
      setState((s) => {
        const arr = [...s.photos];
        if (arr.length === 0) return { ...s, photos: [url] };
        // Cap at 6 — bump the oldest gallery photo out when adding a
        // new cover would otherwise exceed the limit.
        const next = [url, ...arr];
        return { ...s, photos: next.slice(0, 6) };
      });
    } finally {
      setUploading(false);
    }
  }

  function buildPayload() {
    // Single business / app name — typed once, mirrored to both
    // display_name (used by PremiumHero) and trading_name (used by
    // the Business Card + share image + footer) so every surface
    // shows the same string without the user needing two fields.
    const businessName = state.display_name.trim();
    return {
      display_name: businessName,
      trading_name: businessName,
      slug: (state.slug ?? "").trim(),
      primary_trade: state.primary_trade.trim(),
      // Secondary trades field removed from the form per design — a
      // tradesperson has one primary trade; the work they offer
      // appears on individual service / product cards. We send an
      // empty array to clear any legacy values on edit.
      secondary_trades: [],
      city: state.city.trim(),
      country: state.country.trim(),
      postcode_prefix: state.postcode_prefix.trim(),
      // Empty / "All areas" sends null; positive int otherwise.
      service_radius_km: (() => {
        const v = state.service_radius_km.trim();
        if (!v) return null;
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
      })(),
      service_postcodes: state.service_postcodes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      whatsapp: state.whatsapp.trim(),
      phone: state.phone.trim(),
      email: state.email.trim(),
      website: state.website.trim(),
      instagram: state.instagram.trim(),
      facebook: state.facebook.trim(),
      tiktok: state.tiktok.trim(),
      youtube: state.youtube.trim(),
      twitter: state.twitter.trim(),
      snapchat: state.snapchat.trim(),
      reddit: state.reddit.trim(),
      google: state.google.trim(),
      bio: state.bio.trim(),
      years_in_trade: state.years_in_trade.trim() || null,
      start_year: state.start_year.trim() || null,
      avatar_url: state.avatar_url.trim(),
      custom_app_hero_url: state.custom_app_hero_url.trim(),
      video_url: state.video_url.trim(),
      photos: state.photos
    };
  }

  // Post the merchant Shop Delivery picks (mode + UK amount +
  // international list) to the existing retail-shipping endpoint.
  // Mode "" is a no-op; everything else triggers a full-replace save.
  async function postShopDelivery(slug: string, editToken: string) {
    const mode = state.retail_shipping_mode;
    if (mode === "") return;
    const uk_pence = (() => {
      const n = Number(state.retail_shipping_uk_pounds);
      if (!Number.isFinite(n) || n <= 0) return 0;
      return Math.round(n * 100);
    })();
    const intl = state.retail_shipping_international
      .map((r) => {
        const price = Number(r.price_pounds);
        return {
          country_code: r.country_code.trim().toUpperCase(),
          country_name: r.country_name.trim(),
          price_pence:
            Number.isFinite(price) && price >= 0 ? Math.round(price * 100) : 0,
          dispatch_days: Math.max(0, Math.round(Number(r.dispatch_days) || 1)),
          delivery_days: Math.max(0, Math.round(Number(r.delivery_days) || 5))
        };
      })
      .filter((r) => /^[A-Z]{2}$/.test(r.country_code) && r.country_name.length > 0);
    await fetch("/api/trade-off/listings/retail-shipping", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        edit_token: editToken,
        mode,
        uk_pence,
        uk_areas: [],
        international: intl
      })
    });
  }

  // Post the 4 starter products into hammerex_xrated_products via the
  // existing upsert endpoint. Best-effort — a single product failure
  // won't block the listing save. Only sends rows with a name AND a
  // price > 0; everything else is treated as an empty starter slot.
  async function postStarterProducts(slug: string, editToken: string) {
    const rows = state.starter_products
      .map((p) => {
        // Multi-buy tiers → bulk_tiers. Ascending min_qty, only the
        // top tier may have max_qty = null. We sort + take the top 2
        // populated tiers to honour the editor's 2-tier cap.
        const tiers = p.multi_buy
          .map((t) => ({
            min_qty: Math.max(0, Math.round(Number(t.min_qty) || 0)),
            price_pence: Math.round((Number(t.price_pounds) || 0) * 100)
          }))
          .filter((t) => t.min_qty > 1 && t.price_pence > 0)
          .sort((a, b) => a.min_qty - b.min_qty)
          .slice(0, 2);
        const bulk_tiers = tiers.map((t, i, arr) => ({
          min_qty: t.min_qty,
          max_qty: i === arr.length - 1 ? null : arr[i + 1].min_qty - 1,
          price_pence: t.price_pence
        }));
        // Variants — only sent when an axis is picked AND at least one
        // row has a label. Rows without labels are dropped. Each row's
        // £ delta converts to pence; blank delta → null.
        const variants: Array<{
          axis: "size" | "colour" | "model" | "material" | "custom";
          axis_label: string | null;
          label: string;
          stock_count: number | null;
          price_delta_pence: number | null;
        }> = [];
        if (p.variants_axis !== "") {
          const axisLabel =
            p.variants_axis === "custom" ? p.variants_axis_label.trim() : null;
          for (const r of p.variants_rows) {
            const label = r.label.trim();
            if (label.length === 0) continue;
            const stockRaw = r.stock_count.trim();
            const stock_count = stockRaw.length > 0
              ? Math.max(0, Math.round(Number(stockRaw) || 0))
              : null;
            const deltaRaw = r.price_delta_pounds.trim();
            const price_delta_pence = deltaRaw.length > 0
              ? Math.round(Number(deltaRaw) * 100)
              : null;
            variants.push({
              axis: p.variants_axis,
              axis_label: axisLabel,
              label,
              stock_count,
              price_delta_pence
            });
            if (variants.length >= 5) break;
          }
        }
        // Per-product FAQ — max 3 entries, both q AND a required.
        const faq = (p.faq ?? [])
          .map((row) => ({ q: row.q.trim(), a: row.a.trim() }))
          .filter((row) => row.q.length > 0 && row.a.length > 0)
          .slice(0, 3);
        return {
          name: p.name.trim(),
          cover_url: p.image_url.trim() || null,
          // Up to 3 extra gallery images per product. Empty strings
          // and duplicates of the cover are filtered so the saved
          // gallery_urls only contains real uploads.
          gallery_urls: (p.gallery_urls ?? [])
            .map((u) => u.trim())
            .filter((u) => u.length > 0 && u !== p.image_url.trim())
            .slice(0, 3),
          description: p.description.trim() || null,
          price_pence: Math.round((Number(p.price_pounds) || 0) * 100),
          bulk_tiers,
          variants,
          faq: faq.length > 0 ? faq : null
        };
      })
      .filter((p) => p.name.length > 0 && p.price_pence > 0);
    if (rows.length === 0) return;
    await Promise.allSettled(
      rows.map((product) =>
        fetch("/api/trade-off/products/upsert", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, edit_token: editToken, product })
        })
      )
    );
  }

  async function submit(forceDraft: boolean) {
    setErr(null);
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (mode.kind === "create") {
        // Password is only sent at create-time; the edit dashboard
        // doesn't touch the existing hash. Client-side guard mirrors
        // the server-side rule (min 6 chars).
        if (!state.password || state.password.length < 6) {
          setErr("Pick a password (at least 6 characters) so you can log back in.");
          return;
        }
        const res = await fetch("/api/trade-off/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, password: state.password })
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          slug?: string;
          edit_token?: string;
          status?: string;
          voucher_code?: string | null;
          error?: string;
        };
        if (!body.ok || !body.slug || !body.edit_token) {
          setErr(body.error || "Could not save. Please try again.");
          return;
        }
        if (isMerchantGradeTrade(state.primary_trade)) {
          await postShopDelivery(body.slug, body.edit_token);
          await postStarterProducts(body.slug, body.edit_token);
        }
        const voucherSuffix = body.voucher_code
          ? `&voucher=${encodeURIComponent(body.voucher_code)}`
          : "";
        router.push(
          `/trade-off/signup/done?slug=${encodeURIComponent(body.slug)}&token=${encodeURIComponent(body.edit_token)}&status=${encodeURIComponent(body.status ?? "draft")}${voucherSuffix}`
        );
      } else {
        const res = await fetch("/api/trade-off/update", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug: mode.slug,
            edit_token: mode.editToken,
            fields: payload
          })
        });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: string; slug?: string; error?: string };
        if (!body.ok) {
          setErr(body.error || "Could not save changes.");
          return;
        }
        const finalSlug = body.slug || mode.slug;
        if (isMerchantGradeTrade(state.primary_trade)) {
          await postShopDelivery(finalSlug, mode.editToken);
          await postStarterProducts(finalSlug, mode.editToken);
        }
        router.push(
          `/trade-off/signup/done?slug=${encodeURIComponent(finalSlug)}&token=${encodeURIComponent(mode.editToken)}&status=${encodeURIComponent(body.status ?? "draft")}&edit=1`
        );
      }
      // suppress unused-var lint on forceDraft — we use the same endpoint, status
      // is derived server-side. forceDraft is just a UX label.
      void forceDraft;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Live / Draft banner — only renders when the form is INCOMPLETE.
          Once every required field is in, the "Ready to go live" copy
          was just visual noise at the top of the page; we let the
          submit button signal readiness instead. */}
      {!wouldBeLive && (
        <div className="rounded-xl border border-brand-line bg-brand-surface px-4 py-3 text-[13px] text-brand-muted">
          <span className="font-semibold text-brand-text">
            Almost there — {missing.length} field{missing.length === 1 ? "" : "s"} left.
          </span>
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            {missing.map((m) => (
              <li key={m}>
                <span className="text-brand-text">{FIELD_LABELS[m] ?? m}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-brand-muted">
            You can save as a draft now and finish later using your edit link.
          </p>
        </div>
      )}

      {/* Trade + URL — the very first thing a tradesperson sets, so it
          sits in its own dedicated card at the top of the form. The
          chosen trade drives every downstream conditional (merchant vs
          service template, sections that show, helper copy). The URL
          sits with it because the two together create the live app:
          "I'm a Building Supplies seller at xratedtrade.com/holt". */}
      <Section title="Your trade & app URL">
        <Field label="What trade are you? *">
          <select
            value={state.primary_trade}
            onChange={(e) => update("primary_trade", e.target.value)}
            className="h-11 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] font-bold text-brand-text focus:border-[#FFB300] focus:outline-none"
          >
            <option value="">— Select a trade —</option>
            {TRADE_OFF_TRADES.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.label}
              </option>
            ))}
          </select>
          {state.primary_trade && (
            <p
              className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-extrabold uppercase tracking-wider text-neutral-900"
              style={{ background: "var(--trade-accent, #FFB300)" }}
            >
              {TRADE_OFF_TRADES.find((t) => t.slug === state.primary_trade)?.label ?? state.primary_trade}
            </p>
          )}
        </Field>
        <Field label="Your app URL">
          <SlugAvailabilityField
            value={state.slug ?? ""}
            onChange={(v) => update("slug", v)}
            selfSlug={mode.kind === "edit" ? mode.slug : undefined}
            placeholder="your-trade-name"
          />
          <p className="mt-1 text-[12px] leading-snug text-brand-muted">
            The address customers will type — pick once and keep it. If
            you picked one on the home page, it&rsquo;s already saved
            here.
          </p>
          {mode.kind === "edit" && state.slug && state.slug !== mode.slug && (
            <p className="mt-1 text-xs text-[#FFB300]">
              Heads up — changing your URL will break any links or QR codes you've already shared.
            </p>
          )}
        </Field>
      </Section>

      {/* Identity */}
      <Section title="Identity">
        <Field label="Business / app name *">
          <Input
            value={state.display_name}
            onChange={(v) => update("display_name", v)}
            placeholder={`e.g. ${tradeBusinessExample(state.primary_trade)}`}
            maxLength={160}
          />
          <p className="mt-1 text-[12px] leading-snug text-brand-muted">
            What buyers see at the top of your app. Use your trading
            name — it&rsquo;s the one customers will remember.
          </p>
        </Field>
        {/* Personal name field removed per design — only the business /
            trading name is shown on the app. Old listings still have a
            display_name column; on save we mirror the typed value into
            both display_name and trading_name so downstream surfaces
            (Business Card, share image, footer) keep working. */}
        <Field label="Logo & banner">
          <p className="mb-3 text-[12px] leading-snug text-brand-muted">
            The two images that brand your live app — the round logo
            sits on the hero, the wide banner is the background
            customers see first.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Round logo / profile photo — large preview top, action
                buttons stacked underneath. */}
            <div className="flex flex-col items-stretch rounded-xl border border-brand-line bg-brand-surface p-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                Logo
              </p>
              {/* Mirror of the live PremiumHero avatar: yellow Trust
                  Score ring around the photo + score badge bottom-right.
                  Static score "85" here is sample — keeps the preview
                  looking exactly like a real profile so the tradesperson
                  knows what they&rsquo;re building. */}
              <div className="relative mx-auto mt-3 h-36 w-36 shrink-0 sm:h-40 sm:w-40">
                <svg
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full -rotate-90"
                  viewBox="0 0 100 100"
                >
                  <circle cx="50" cy="50" r="46" fill="none" stroke="#E5E7EB" strokeWidth="5" />
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="none"
                    stroke="var(--trade-accent, #FFB300)"
                    strokeWidth="5"
                    strokeDasharray="289"
                    strokeDashoffset="43"
                    strokeLinecap="round"
                  />
                </svg>
                <div
                  className="absolute inset-[7px] overflow-hidden rounded-full bg-brand-bg sm:inset-[8px]"
                  style={{ boxShadow: "0 6px 16px rgba(0,0,0,0.18)" }}
                >
                  {state.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={state.avatar_url} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center bg-neutral-900 text-5xl font-extrabold"
                      style={{ color: "var(--trade-accent, #FFB300)" }}
                    >
                      {(state.display_name.trim().charAt(0) || "?").toUpperCase()}
                    </div>
                  )}
                </div>
                {/* Trust Score badge — bottom-right. Below 100% it's
                    yellow with the number; at 100% it flips to a green
                    tick so the tradesperson sees the milestone they're
                    aiming for. Sample value 85 here for preview; on the
                    live profile the real score drives it. */}
                {(() => {
                  const sample = 85;
                  const complete = sample >= 100;
                  return (
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-1 -right-1 inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-full px-2 text-sm font-extrabold ring-2 ring-white"
                      style={{
                        background: complete
                          ? "#0F7A3F"
                          : "var(--trade-accent, #FFB300)",
                        color: complete ? "#FFFFFF" : "#0A0A0A"
                      }}
                      title={complete ? "Profile 100% complete" : `Trust Score ${sample}/100`}
                    >
                      {complete ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : (
                        sample
                      )}
                    </span>
                  );
                })()}
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <label
                  className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center rounded-xl px-3 text-[12px] font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.97]"
                  style={{ background: "var(--trade-accent, #FFB300)" }}
                >
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => handleAvatarFile(e.target.files)}
                    disabled={uploadingAvatar}
                  />
                  {uploadingAvatar ? "Uploading…" : state.avatar_url ? "Replace" : "Upload"}
                </label>
                {state.avatar_url && (
                  <button
                    type="button"
                    onClick={() => update("avatar_url", "")}
                    className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-[12px] font-extrabold text-white shadow-sm transition active:scale-[0.97]"
                    style={{ background: "#8B0000" }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-brand-muted">
                Round portrait or a clean logo works best.
              </p>
            </div>

            {/* Wide banner / hero */}
            <div className="rounded-xl border border-brand-line bg-brand-surface p-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                Banner
              </p>
              <div className="relative mt-2 aspect-[16/9] overflow-hidden rounded-lg border border-brand-line bg-brand-bg">
                {state.custom_app_hero_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={state.custom_app_hero_url} alt="Banner" className="h-full w-full object-cover" />
                ) : (
                  <>
                    {/* Sample preview — shows what a banner LOOKS like
                        using the trade-default art so a first-timer isn't
                        staring at a blank rectangle. Watermarked so they
                        know it's not their image. */}
                    {(() => {
                      const sample = state.primary_trade
                        ? tradeHeroFor(state.primary_trade)
                        : null;
                      return sample ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={sample}
                          alt="Sample banner"
                          className="h-full w-full object-cover opacity-80"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-brand-bg text-[11px] leading-snug text-brand-muted">
                          Pick a trade above to see a sample banner.
                        </div>
                      );
                    })()}
                    {/* Diagonal "SAMPLE IMAGE" watermark across the
                        whole thumbnail so it's unmistakably a preview. */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    >
                      <span
                        className="rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white"
                        style={{ background: "rgba(0,0,0,0.55)", letterSpacing: "0.22em" }}
                      >
                        Sample image
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <label
                  className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center rounded-xl px-3 text-[12px] font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.97]"
                  style={{ background: "var(--trade-accent, #FFB300)" }}
                >
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => handleBannerFile(e.target.files)}
                    disabled={uploadingBanner}
                  />
                  {uploadingBanner ? "Uploading…" : state.custom_app_hero_url ? "Replace" : "Upload"}
                </label>
                {state.custom_app_hero_url && (
                  <button
                    type="button"
                    onClick={() => update("custom_app_hero_url", "")}
                    className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-[12px] font-extrabold text-white shadow-sm transition active:scale-[0.97]"
                    style={{ background: "#8B0000" }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-brand-muted">
                Landscape image — at least 1200×675 reads cleanest.
              </p>
            </div>
          </div>
        </Field>
        {/* Primary trade + Secondary trades both moved out of Identity —
            the primary now lives in the "Your trade & app URL" section
            at the top; secondary trades removed per design (a tradesperson
            has one primary trade; varied work shows on individual service
            / product cards). */}
      </Section>

      {/* Location */}
      <Section title="Location details">
        <Field label="City / town *">
          <Input
            value={state.city}
            onChange={(v) => update("city", v)}
            placeholder="e.g. Manchester"
            maxLength={80}
          />
        </Field>
        <Field label="Country">
          <Input
            value={state.country}
            onChange={(v) => update("country", v)}
            placeholder="United Kingdom"
            maxLength={80}
          />
        </Field>
        <Field label="Postcode prefix (optional, e.g. M14)">
          <Input
            value={state.postcode_prefix}
            onChange={(v) => update("postcode_prefix", v)}
            placeholder="M14"
            maxLength={16}
          />
        </Field>
        <Field label="Area in km radius your business operates">
          <p className="mb-2 text-[13px] leading-snug text-brand-muted">
            How far from your base are you willing to travel? Tap a
            distance, or pick &ldquo;All areas&rdquo; for nationwide work.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[10, 15, 20, 25, 30, 35, 40, 45, 50].map((km) => {
              const selected = state.service_radius_km === String(km);
              return (
                <button
                  key={km}
                  type="button"
                  onClick={() => update("service_radius_km", String(km))}
                  className={`inline-flex h-10 items-center rounded-xl border px-3 text-[13px] font-bold transition ${
                    selected
                      ? "border-[#FFB300] bg-[#FFB300] text-neutral-900"
                      : "border-brand-line bg-brand-surface text-brand-text hover:border-[#FFB300]"
                  }`}
                >
                  {km} km
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => update("service_radius_km", "")}
              className={`inline-flex h-10 items-center rounded-xl border px-3 text-[13px] font-bold transition ${
                state.service_radius_km === ""
                  ? "border-[#FFB300] bg-[#FFB300] text-neutral-900"
                  : "border-brand-line bg-brand-surface text-brand-text hover:border-[#FFB300]"
              }`}
            >
              All areas
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <label className="text-[12px] font-bold uppercase tracking-widest text-brand-muted">
              Or custom
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={
                state.service_radius_km &&
                ![10, 15, 20, 25, 30, 35, 40, 45, 50].includes(
                  Number(state.service_radius_km)
                )
                  ? state.service_radius_km
                  : ""
              }
              onChange={(e) => update("service_radius_km", e.target.value)}
              placeholder="km"
              className="h-10 w-24 rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text placeholder:text-brand-muted focus:border-[#FFB300] focus:outline-none"
            />
          </div>
        </Field>
      </Section>

      {/* Contact */}
      <Section title="Contact">
        <Field label="WhatsApp number *">
          <PhoneCountryInput
            value={state.whatsapp}
            onChange={(v) => update("whatsapp", v)}
            placeholder="7700 900000"
          />
          <p className="mt-1 text-[12px] leading-snug text-brand-muted">
            We auto-pick your country code from your location — tap the
            flag to change. Number must be at least 7 digits.
          </p>
          {state.whatsapp && waDigitCount < 7 && (
            <p className="mt-1 text-xs text-red-600">Looks short — needs at least 7 digits.</p>
          )}
        </Field>
        <Field label="Phone (optional)">
          <PhoneCountryInput
            value={state.phone}
            onChange={(v) => update("phone", v)}
            placeholder="7700 900000"
          />
          <p className="mt-1 text-[12px] leading-snug text-brand-muted">
            Leave blank if you do not want a business card to display
            on your app.
          </p>
        </Field>
        <Field label="Email *">
          <Input
            value={state.email}
            onChange={(v) => update("email", v)}
            placeholder="you@example.co.uk"
            maxLength={160}
            type="email"
          />
          {state.email && !isEmailValid && (
            <p className="mt-1 text-xs text-brand-muted">That email doesn't look right.</p>
          )}
        </Field>
        {/* Password — signup-only. We hide it on edit because the
            dashboard isn't where you change your password (and writing
            an empty value through here would be confusing). Min 6
            chars, no complexity rules — tradespeople just need to be
            able to log back in. */}
        {mode.kind === "create" && (
          <Field label="Pick a password *">
            <Input
              value={state.password}
              onChange={(v) => update("password", v)}
              placeholder="At least 6 characters"
              maxLength={120}
              type="password"
            />
            <p className="mt-1 text-[12px] leading-snug text-brand-muted">
              You'll use this with your WhatsApp number to log back in.
              Min 6 characters. No symbols or capitals required.
            </p>
            {state.password && state.password.length < 6 && (
              <p className="mt-1 text-xs text-red-600">
                Needs at least 6 characters.
              </p>
            )}
          </Field>
        )}
      </Section>

      {/* Find us online — split from Contact so the colourful chips
          read as one cohesive social block, and so a tradesperson can
          skip the whole section in one scroll if they don't post. */}
      <Section title="Find us online">
        <p className="text-[13px] leading-snug text-brand-muted">
          Every active link adds a trust signal to your profile. Skip
          any you don&rsquo;t use — empty ones simply don&rsquo;t show.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {TRADE_SOCIAL_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <div className="flex items-stretch gap-0 overflow-hidden rounded-xl border border-brand-line bg-brand-bg transition focus-within:border-[#FFB300]">
                <span
                  aria-hidden="true"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center"
                  style={{
                    background: f.chipColor,
                    color: f.chipText ?? "#FFFFFF"
                  }}
                >
                  {socialIconFor(f.key)}
                </span>
                <input
                  type="text"
                  value={state[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  placeholder={`${f.label} — ${f.placeholder}`}
                  maxLength={240}
                  className="h-11 w-full bg-transparent px-3 text-[13px] text-brand-text placeholder:text-brand-muted focus:outline-none"
                />
              </div>
            </label>
          ))}
        </div>
      </Section>

      {/* About */}
      <Section title="About you">
        <Field label={`About your work * (${bioLen} chars — 60 minimum, ~300–500 recommended)`}>
          <textarea
            value={state.bio}
            onChange={(e) => update("bio", e.target.value)}
            placeholder="What you do, who you work for, what you take pride in. Plain words. No salesy fluff."
            maxLength={1200}
            rows={6}
            className="w-full rounded-lg border border-brand-line bg-brand-bg p-3 text-xs leading-relaxed text-brand-text focus:border-[#FFB300] focus:outline-none"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Years in trade (optional)">
            <Input
              value={state.years_in_trade}
              onChange={(v) => update("years_in_trade", v)}
              placeholder="e.g. 12"
              maxLength={3}
              type="number"
            />
          </Field>
          {/* "Year you started" removed per design — years_in_trade
              alone is enough; the start-year duplicate was redundant
              and confused users into thinking it was required. */}
        </div>
      </Section>

      {/* Cover banner already lives in Identity (logo + banner pair).
          This slot was a duplicate — replaced with the optional intro
          video input. URL paste → live iframe preview so the tradie
          sees exactly what visitors see. */}
      <Section title="Intro video (optional)">
        <p className="text-[13px] font-extrabold leading-snug text-brand-text">
          Showcase your business with a 60-second video.
        </p>
        {mode.kind === "edit" ? (
          <>
            <p className="text-[13px] leading-snug text-brand-muted">
              Upload a short MP4 / MOV / WebM straight from your phone
              or laptop — max 30 MB, up to 60 seconds. A 30–60 second
              walk-through of your work is the strongest trust signal a
              profile can carry.
            </p>
            <VideoUploadInput
              listingId={mode.listingId}
              editToken={mode.editToken}
              initialVideoUrl={state.video_url || null}
              initialCaption={null}
              onSaved={(url) => update("video_url", url)}
            />
          </>
        ) : (
          <p className="rounded-xl border border-brand-line bg-brand-surface px-4 py-3 text-[13px] leading-snug text-brand-muted">
            Publish your profile first, then come back here from your
            edit link to upload an MP4 / MOV / WebM video straight from
            your phone or computer.
          </p>
        )}
      </Section>

      {/* Merchant-grade trades swap the Portfolio photos block for a
          clear product-onboarding CTA — "Portfolio" doesn't fit a
          shop, and the real product editor (with name/price/image
          fields) lives on the Shop Mode sub-page. Service trades
          still see the portfolio gallery below. */}
      {isMerchantGradeTrade(state.primary_trade) ? (
        <Section title="Add your first 4 products to go live">
          <p className="text-[13px] leading-snug text-brand-muted">
            Fill in four starter products below — image, name, price,
            short description. Once your app is live you can add more
            any time from the
            <span className="font-extrabold text-brand-text"> Products</span> section
            in your dashboard.
          </p>
          <div className="grid grid-cols-1 gap-3">
            {state.starter_products.map((p, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-brand-line bg-brand-surface"
              >
                {/* Bold yellow "Product N" header bar — sits at the
                    top-left of every container so the tradie always
                    knows which slot they're filling in. */}
                <div
                  className="flex items-center px-4 py-2 text-[18px] font-extrabold uppercase tracking-wider text-neutral-900 sm:text-[20px]"
                  style={{ background: "var(--trade-accent, #FFB300)" }}
                >
                  Product {i + 1}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[220px_minmax(0,1fr)]">
                  {/* Image stack: cover on top (16:9 landscape) + 3
                      gallery thumbnails below. 4 images per product
                      total — matches the gallery_urls cap on the
                      hammerex_xrated_products row. */}
                  <div className="space-y-1.5 p-2">
                    <label className="relative block aspect-[16/9] cursor-pointer overflow-hidden rounded-xl border border-brand-line">
                      {p.image_url ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.image_url}
                            alt={p.name || `Product ${i + 1}`}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                            Cover · Replace
                          </span>
                        </>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src="https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/4f5bd53f15f8-ChatGPT_Image_Jun_28__2026__11_38_11_AM.png"
                          alt="Sample product image"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const fd = new FormData();
                          fd.append("file", file);
                          const res = await fetch("/api/trade-off/upload-photo", {
                            method: "POST",
                            body: fd
                          });
                          const body = (await res.json().catch(() => ({}))) as {
                            ok?: boolean;
                            url?: string;
                            error?: string;
                          };
                          if (!body.ok || !body.url) {
                            setErr(body.error || "Could not upload product image.");
                            return;
                          }
                          setState((s) => {
                            const next = [...s.starter_products];
                            next[i] = { ...next[i], image_url: body.url as string };
                            return { ...s, starter_products: next };
                          });
                          e.target.value = "";
                        }}
                      />
                    </label>

                    {/* Gallery — 3 extra image slots (square 16:9 mini
                        thumbnails). Empty slots show a dashed border;
                        filled slots show the image with a small × to
                        remove. */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {[0, 1, 2].map((gIdx) => {
                        const gUrl = (p.gallery_urls ?? [])[gIdx];
                        return (
                          <label
                            key={gIdx}
                            className={`relative block aspect-[16/9] cursor-pointer overflow-hidden rounded-lg border ${gUrl ? "border-brand-line" : "border-dashed border-brand-line bg-brand-bg"}`}
                          >
                            {gUrl ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={gUrl}
                                  alt={`Product ${i + 1} photo ${gIdx + 2}`}
                                  className="absolute inset-0 h-full w-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setState((s) => {
                                      const next = [...s.starter_products];
                                      const arr = [...(next[i].gallery_urls ?? [])];
                                      arr.splice(gIdx, 1);
                                      next[i] = { ...next[i], gallery_urls: arr };
                                      return { ...s, starter_products: next };
                                    });
                                  }}
                                  aria-label="Remove photo"
                                  className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[12px] font-extrabold text-white shadow"
                                  style={{ background: "#8B0000" }}
                                >
                                  ×
                                </button>
                              </>
                            ) : (
                              <div className="flex h-full w-full flex-col items-center justify-center text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                                <span className="text-base">+</span>
                                <span>Photo {gIdx + 2}</span>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const fd = new FormData();
                                fd.append("file", file);
                                const res = await fetch("/api/trade-off/upload-photo", {
                                  method: "POST",
                                  body: fd
                                });
                                const body = (await res.json().catch(() => ({}))) as {
                                  ok?: boolean;
                                  url?: string;
                                  error?: string;
                                };
                                if (!body.ok || !body.url) {
                                  setErr(body.error || "Could not upload product image.");
                                  return;
                                }
                                setState((s) => {
                                  const next = [...s.starter_products];
                                  const arr = [...(next[i].gallery_urls ?? [])];
                                  arr[gIdx] = body.url as string;
                                  next[i] = { ...next[i], gallery_urls: arr };
                                  return { ...s, starter_products: next };
                                });
                                e.target.value = "";
                              }}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fields on the right */}
                  <div className="space-y-2 p-3 sm:p-4">
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) =>
                        setState((s) => {
                          const next = [...s.starter_products];
                          next[i] = { ...next[i], name: e.target.value.slice(0, 80) };
                          return { ...s, starter_products: next };
                        })
                      }
                      placeholder="Product name (e.g. 25 kg bag of cement)"
                      maxLength={80}
                      className="h-11 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text placeholder:text-brand-muted focus:border-[#FFB300] focus:outline-none"
                    />
                    <div className="flex items-stretch overflow-hidden rounded-xl border border-brand-line bg-brand-bg focus-within:border-[#FFB300]">
                      <span className="inline-flex items-center bg-neutral-100 px-3 text-[13px] font-extrabold text-brand-text">
                        £
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min={0}
                        value={p.price_pounds}
                        onChange={(e) =>
                          setState((s) => {
                            const next = [...s.starter_products];
                            next[i] = { ...next[i], price_pounds: e.target.value };
                            return { ...s, starter_products: next };
                          })
                        }
                        placeholder="0.00"
                        className="h-11 w-full bg-transparent px-3 text-[13px] text-brand-text placeholder:text-brand-muted focus:outline-none"
                      />
                    </div>
                    <textarea
                      rows={2}
                      value={p.description}
                      onChange={(e) =>
                        setState((s) => {
                          const next = [...s.starter_products];
                          next[i] = {
                            ...next[i],
                            description: e.target.value.slice(0, 300)
                          };
                          return { ...s, starter_products: next };
                        })
                      }
                      placeholder="Short description — what's it for, what's it made of."
                      maxLength={300}
                      className="w-full rounded-xl border border-brand-line bg-brand-bg px-3 py-2 text-[13px] text-brand-text placeholder:text-brand-muted focus:border-[#FFB300] focus:outline-none"
                    />
                  </div>
                </div>
                {/* Full delivery block at the bottom of every product
                    container — chips (title + body), conditional £
                    input, and collapsible international. All four
                    instances share the same listing-level state so the
                    merchant only needs to set it once. */}
                <ShopDeliveryBlock
                  mode={state.retail_shipping_mode}
                  onModeChange={(v) => update("retail_shipping_mode", v)}
                  ukPounds={state.retail_shipping_uk_pounds}
                  onUkPoundsChange={(v) => update("retail_shipping_uk_pounds", v)}
                  international={state.retail_shipping_international}
                  onInternationalChange={(next) =>
                    setState((s) => ({ ...s, retail_shipping_international: next }))
                  }
                />

                {/* Multi-buy tiers — per-product, max 2. Saves to
                    bulk_tiers on the product row so the live PDP
                    renders the multi-buy buttons under the cover image
                    on the right (same as Hammerex products). */}
                <MultiBuyBlock
                  tiers={p.multi_buy ?? []}
                  basePounds={p.price_pounds}
                  onChange={(next) =>
                    setState((s) => {
                      const arr = [...s.starter_products];
                      arr[i] = { ...arr[i], multi_buy: next };
                      return { ...s, starter_products: arr };
                    })
                  }
                />

                {/* Variants — single-axis, max 5 rows per product.
                    Axis picker on top + variant rows below. Renders
                    on the live PDP as buttons under the cover image
                    (or a dropdown when 5+ rows). */}
                <VariantsBlock
                  axis={p.variants_axis ?? ""}
                  axisLabel={p.variants_axis_label ?? ""}
                  rows={p.variants_rows ?? []}
                  onAxisChange={(next) =>
                    setState((s) => {
                      const arr = [...s.starter_products];
                      arr[i] = { ...arr[i], variants_axis: next };
                      return { ...s, starter_products: arr };
                    })
                  }
                  onAxisLabelChange={(next) =>
                    setState((s) => {
                      const arr = [...s.starter_products];
                      arr[i] = { ...arr[i], variants_axis_label: next };
                      return { ...s, starter_products: arr };
                    })
                  }
                  onRowsChange={(next) =>
                    setState((s) => {
                      const arr = [...s.starter_products];
                      arr[i] = { ...arr[i], variants_rows: next };
                      return { ...s, starter_products: arr };
                    })
                  }
                />

                {/* Per-product FAQ — optional, up to 3 questions.
                    Renders on the live PDP as a collapsible accordion
                    under the cover image so buyers self-serve their
                    common questions without messaging. */}
                <ProductFaqBlock
                  faq={p.faq ?? []}
                  onChange={(next) =>
                    setState((s) => {
                      const arr = [...s.starter_products];
                      arr[i] = { ...arr[i], faq: next };
                      return { ...s, starter_products: arr };
                    })
                  }
                />
              </div>
            ))}
          </div>
        </Section>
      ) : (
      <Section
        title={`Portfolio photos (${Math.max(0, state.photos.length - 1)}/5)`}
      >
        <p className="text-[13px] leading-snug text-brand-muted">
          Extra photos that appear in your portfolio carousel — past
          jobs, products, your team. Tap &ldquo;Use as cover&rdquo; on
          any one to swap it into the banner above.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {state.photos.slice(1).map((url, gIdx) => {
            const photosIdx = gIdx + 1;
            return (
              <div
                key={url + photosIdx}
                className="relative overflow-hidden rounded-xl border border-brand-line bg-brand-surface"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="aspect-square w-full object-cover" />
                <div className="flex items-center gap-1 border-t border-brand-line bg-neutral-50 p-1">
                  <button
                    type="button"
                    onClick={() => promoteToCover(gIdx)}
                    className="h-9 flex-1 rounded text-[11px] font-bold text-brand-text transition hover:bg-brand-bg"
                    aria-label="Use as cover banner"
                  >
                    Use as cover
                  </button>
                  <button
                    type="button"
                    onClick={() => movePhoto(photosIdx, -1)}
                    disabled={photosIdx === 1}
                    className="h-9 w-9 rounded text-xs text-brand-text transition hover:bg-brand-bg disabled:opacity-30"
                    aria-label="Move left"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => movePhoto(photosIdx, 1)}
                    disabled={photosIdx === state.photos.length - 1}
                    className="h-9 w-9 rounded text-xs text-brand-text transition hover:bg-brand-bg disabled:opacity-30"
                    aria-label="Move right"
                  >
                    →
                  </button>
                  <button
                    type="button"
                    onClick={() => removePhoto(photosIdx)}
                    className="h-9 w-9 rounded text-xs text-red-600 transition hover:bg-red-50"
                    aria-label="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
          {state.photos.length < 6 && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-brand-line bg-brand-surface p-4 text-center text-[13px] text-brand-muted transition hover:border-brand-accent hover:text-brand-text">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => handleFiles(e.target.files)}
                disabled={uploading}
              />
              <span className="text-2xl">+</span>
              <span className="font-bold text-brand-text">
                {uploading ? "Uploading…" : "Add photo"}
              </span>
            </label>
          )}
        </div>
      </Section>
      )}

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {err}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={submitting || !wouldBeLive}
          className="h-11 flex-1 rounded-lg bg-[#FFB300] px-6 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting
            ? "Saving…"
            : mode.kind === "edit"
              ? "Save changes (go live)"
              : "Publish my profile"}
        </button>
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={submitting}
          className="h-11 flex-1 rounded-lg border border-brand-line bg-brand-surface px-6 text-xs font-semibold text-brand-text transition hover:border-[#FFB300] disabled:opacity-40"
        >
          {submitting ? "Saving…" : "Save as draft"}
        </button>
      </div>
      <p className="text-xs text-brand-muted">
        xratedtrade.com is free for life. Customers contact you on WhatsApp — we never take a cut.
      </p>
    </div>
  );
}

// Per-container Shop delivery block. Rendered inside each starter
// product card at the bottom; all four instances bind to the same
// shared listing-level state via the props so the merchant only sets
// the rule once. Keeps the original Shop delivery design (chip cards
// + £ input + collapsible international) — just relocated into every
// container per the user's directive.
function ShopDeliveryBlock({
  mode,
  onModeChange,
  ukPounds,
  onUkPoundsChange,
  international,
  onInternationalChange
}: {
  mode: "" | "pickup" | "free" | "uk_flat" | "uk_over_threshold";
  onModeChange: (
    v: "" | "pickup" | "free" | "uk_flat" | "uk_over_threshold"
  ) => void;
  ukPounds: string;
  onUkPoundsChange: (v: string) => void;
  international: Array<{
    country_code: string;
    country_name: string;
    price_pounds: string;
    dispatch_days: string;
    delivery_days: string;
  }>;
  onInternationalChange: (
    next: Array<{
      country_code: string;
      country_name: string;
      price_pounds: string;
      dispatch_days: string;
      delivery_days: string;
    }>
  ) => void;
}) {
  const options: Array<{
    value: "pickup" | "free" | "uk_flat" | "uk_over_threshold";
    title: string;
    body: string;
    icon: React.ReactNode;
  }> = [
    { value: "pickup", title: "Collect only", body: "Customer comes to the yard.", icon: <StoreIcon /> },
    { value: "free", title: "Free UK delivery", body: "Free on every order.", icon: <TruckIcon /> },
    { value: "uk_flat", title: "UK flat fee", body: "One delivery price per order.", icon: <TagIcon /> },
    { value: "uk_over_threshold", title: "Free over £", body: "Free above your threshold.", icon: <ThresholdIcon /> }
  ];
  return (
    <div className="space-y-3 border-t border-brand-line bg-brand-bg p-3 sm:p-4">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
          Delivery for the product
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-brand-muted">
          Set how buyers get this product — local UK options here, add international
          rates below.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((opt) => {
          const selected = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onModeChange(opt.value)}
              className={`flex h-full min-h-[84px] flex-col items-start justify-between gap-1 rounded-xl border-2 p-3 text-left transition active:scale-[0.98]`}
              style={
                selected
                  ? {
                      background: "var(--trade-accent, #FFB300)",
                      borderColor: "var(--trade-accent, #FFB300)",
                      color: "#0A0A0A"
                    }
                  : {
                      background: "#FFFFFF",
                      borderColor: "rgba(255,179,0,0.4)",
                      color: "#0A0A0A"
                    }
              }
            >
              <span className="inline-flex items-center gap-1.5 text-[13px] font-extrabold">
                {opt.icon}
                {opt.title}
              </span>
              <span className="text-[12px] leading-snug" style={{ color: selected ? "#3F2700" : "#6B7280" }}>
                {opt.body}
              </span>
            </button>
          );
        })}
      </div>

      {(mode === "uk_flat" || mode === "uk_over_threshold") && (
        <div>
          <label className="block text-[12px] font-bold uppercase tracking-widest text-brand-muted">
            {mode === "uk_flat" ? "Flat fee per order (£)" : "Free over (£)"}
          </label>
          <div className="mt-1.5 flex items-stretch overflow-hidden rounded-xl border border-brand-line bg-brand-bg focus-within:border-[#FFB300]">
            <span className="inline-flex items-center bg-neutral-100 px-3 text-[13px] font-extrabold text-brand-text">
              £
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={ukPounds}
              onChange={(e) => onUkPoundsChange(e.target.value)}
              placeholder={mode === "uk_flat" ? "25.00" : "150.00"}
              className="h-11 w-full bg-transparent px-3 text-[13px] text-brand-text placeholder:text-brand-muted focus:outline-none"
            />
          </div>
        </div>
      )}

      <details className="rounded-xl border border-brand-line bg-brand-surface">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-[12px] font-extrabold text-brand-text">
          <span>
            Ship to other countries{international.length > 0 && ` (${international.length})`}
          </span>
          <span className="text-[11px] font-bold text-brand-muted">Optional</span>
        </summary>
        <div className="space-y-2 border-t border-brand-line p-3">
          {international.length === 0 && (
            <p className="text-[12px] leading-snug text-brand-muted">
              Add a country, set a flat fee in £, and how many days
              dispatch + delivery typically take.
            </p>
          )}
          {international.map((row, i) => {
            const flag = countryByIso2(row.country_code)?.flag ?? "🌐";
            // Countries already picked in other rows can't be picked
            // again — keeps the list clean and avoids duplicate-key
            // shipping rules. The CURRENT row's pick still shows.
            const takenInOtherRows = new Set(
              international
                .filter((_, idx) => idx !== i)
                .map((r) => r.country_code.toUpperCase())
                .filter((c) => /^[A-Z]{2}$/.test(c))
            );
            return (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 rounded-lg border border-brand-line bg-white p-2 sm:grid-cols-[minmax(0,1fr)_84px_64px_64px_32px]"
            >
              <div className="flex items-stretch overflow-hidden rounded-lg border border-brand-line bg-brand-bg focus-within:border-[#FFB300]">
                <span className="inline-flex w-10 shrink-0 items-center justify-center bg-neutral-100 text-base" aria-hidden="true">
                  {flag}
                </span>
                <select
                  value={row.country_code}
                  onChange={(e) => {
                    const iso2 = e.target.value.toUpperCase();
                    const match = countryByIso2(iso2);
                    const next = [...international];
                    next[i] = {
                      ...next[i],
                      country_code: iso2,
                      country_name: match?.name ?? next[i].country_name
                    };
                    onInternationalChange(next);
                  }}
                  className="h-9 min-w-0 flex-1 bg-transparent px-2 text-[12px] text-brand-text focus:outline-none"
                >
                  <option value="">— Pick a country —</option>
                  {COUNTRY_DIAL_CODES.filter(
                    (c) =>
                      !takenInOtherRows.has(c.iso2.toUpperCase()) &&
                      c.iso2 !== "GB" /* UK is the default home market — handled by the UK options above. */
                  ).map((c) => (
                    <option key={c.iso2} value={c.iso2}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                value={row.price_pounds}
                onChange={(e) => {
                  const next = [...international];
                  next[i] = { ...next[i], price_pounds: e.target.value };
                  onInternationalChange(next);
                }}
                placeholder="£ fee"
                className="h-9 rounded-lg border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text focus:border-[#FFB300] focus:outline-none"
              />
              <input
                type="number"
                min={0}
                value={row.dispatch_days}
                onChange={(e) => {
                  const next = [...international];
                  next[i] = { ...next[i], dispatch_days: e.target.value };
                  onInternationalChange(next);
                }}
                placeholder="Disp."
                className="h-9 rounded-lg border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text focus:border-[#FFB300] focus:outline-none"
              />
              <input
                type="number"
                min={0}
                value={row.delivery_days}
                onChange={(e) => {
                  const next = [...international];
                  next[i] = { ...next[i], delivery_days: e.target.value };
                  onInternationalChange(next);
                }}
                placeholder="Days"
                className="h-9 rounded-lg border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text focus:border-[#FFB300] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  onInternationalChange(international.filter((_, idx) => idx !== i));
                }}
                aria-label={`Remove ${row.country_name || "country"}`}
                className="inline-flex h-9 items-center justify-center rounded-lg text-[14px] font-extrabold text-white"
                style={{ background: "#8B0000" }}
              >
                ×
              </button>
            </div>
            );
          })}
          <button
            type="button"
            onClick={() =>
              onInternationalChange(
                [
                  ...international,
                  {
                    country_code: "",
                    country_name: "",
                    price_pounds: "",
                    dispatch_days: "1",
                    delivery_days: "5"
                  }
                ].slice(0, 50)
              )
            }
            className="inline-flex h-9 items-center rounded-xl border-2 border-brand-line bg-white px-3 text-[12px] font-extrabold text-brand-text transition hover:border-[#FFB300]"
          >
            + Add country
          </button>
        </div>
      </details>
    </div>
  );
}

// Per-product FAQ editor. Up to 3 Q/A pairs. Empty rows are dropped
// at save time. On the live PDP this saves to the product's `faq`
// column and renders as a collapsible accordion under the cover
// image so buyers can self-serve common questions ("Does this come
// in 50 kg?", "Is it BS EN 14647 certified?") without messaging.
function ProductFaqBlock({
  faq,
  onChange
}: {
  faq: Array<{ q: string; a: string }>;
  onChange: (next: Array<{ q: string; a: string }>) => void;
}) {
  return (
    <div className="space-y-3 border-t border-brand-line bg-brand-bg p-3 sm:p-4">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
          Frequently asked questions (optional)
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-brand-muted">
          Pre-answer up to 3 common questions about this product —
          renders on the product page as a tap-to-expand accordion under
          the cover image. Cuts back-and-forth WhatsApp messages.
        </p>
      </div>
      <div className="space-y-2">
        {faq.map((row, idx) => (
          <div
            key={idx}
            className="space-y-1.5 rounded-lg border border-brand-line bg-white p-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
                Q{idx + 1}
              </span>
              <button
                type="button"
                onClick={() => onChange(faq.filter((_, i) => i !== idx))}
                aria-label="Remove question"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-extrabold text-white"
                style={{ background: "#8B0000" }}
              >
                ×
              </button>
            </div>
            <input
              type="text"
              value={row.q}
              onChange={(e) => {
                const next = [...faq];
                next[idx] = { ...next[idx], q: e.target.value.slice(0, 140) };
                onChange(next);
              }}
              placeholder="Question — e.g. Does this come in 50 kg?"
              maxLength={140}
              className="h-10 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text placeholder:text-brand-muted focus:border-[#FFB300] focus:outline-none"
            />
            <textarea
              rows={2}
              value={row.a}
              onChange={(e) => {
                const next = [...faq];
                next[idx] = { ...next[idx], a: e.target.value.slice(0, 500) };
                onChange(next);
              }}
              placeholder="Answer"
              maxLength={500}
              className="w-full rounded-xl border border-brand-line bg-brand-bg px-3 py-2 text-[13px] text-brand-text placeholder:text-brand-muted focus:border-[#FFB300] focus:outline-none"
            />
          </div>
        ))}
        {faq.length < 3 && (
          <button
            type="button"
            onClick={() => onChange([...faq, { q: "", a: "" }].slice(0, 3))}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.97]"
            style={{ background: "var(--trade-accent, #FFB300)" }}
          >
            + Add a question
          </button>
        )}
      </div>
    </div>
  );
}

// Per-product variants editor. Single-axis, up to 5 rows. Axis picker
// chips on top + variant rows below (label + stock + £ delta). Renders
// on the live PDP as a button row under the cover image, or a dropdown
// when 5+ rows exist.
function VariantsBlock({
  axis,
  axisLabel,
  rows,
  onAxisChange,
  onAxisLabelChange,
  onRowsChange
}: {
  axis: "" | "size" | "colour" | "model" | "material" | "custom";
  axisLabel: string;
  rows: Array<{ label: string; stock_count: string; price_delta_pounds: string }>;
  onAxisChange: (
    next: "" | "size" | "colour" | "model" | "material" | "custom"
  ) => void;
  onAxisLabelChange: (next: string) => void;
  onRowsChange: (
    next: Array<{ label: string; stock_count: string; price_delta_pounds: string }>
  ) => void;
}) {
  const axisChips: Array<{
    value: "size" | "colour" | "model" | "material" | "custom";
    label: string;
  }> = [
    { value: "size", label: "Size" },
    { value: "colour", label: "Colour" },
    { value: "model", label: "Model" },
    { value: "material", label: "Material" },
    { value: "custom", label: "Custom" }
  ];
  const isOff = axis === "";
  return (
    <div className="space-y-3 border-t border-brand-line bg-brand-bg p-3 sm:p-4">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
          Variants (optional)
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-brand-muted">
          Offer the same product in a few options — size, colour, model,
          material, or your own custom axis. Each variant shows as a
          button under the cover image.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onAxisChange("")}
          className="inline-flex h-9 items-center rounded-xl border-2 px-3 text-[12px] font-extrabold transition active:scale-[0.97]"
          style={
            isOff
              ? {
                  background: "var(--trade-accent, #FFB300)",
                  borderColor: "var(--trade-accent, #FFB300)",
                  color: "#0A0A0A"
                }
              : {
                  background: "#FFFFFF",
                  borderColor: "rgba(255,179,0,0.4)",
                  color: "#0A0A0A"
                }
          }
        >
          Off
        </button>
        {axisChips.map((chip) => {
          const selected = axis === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => onAxisChange(chip.value)}
              className="inline-flex h-9 items-center rounded-xl border-2 px-3 text-[12px] font-extrabold transition active:scale-[0.97]"
              style={
                selected
                  ? {
                      background: "var(--trade-accent, #FFB300)",
                      borderColor: "var(--trade-accent, #FFB300)",
                      color: "#0A0A0A"
                    }
                  : {
                      background: "#FFFFFF",
                      borderColor: "rgba(255,179,0,0.4)",
                      color: "#0A0A0A"
                    }
              }
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {axis === "custom" && (
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
            Custom axis name
          </label>
          <input
            type="text"
            value={axisLabel}
            onChange={(e) => onAxisLabelChange(e.target.value.slice(0, 30))}
            placeholder="e.g. Capacity, Length, Voltage"
            maxLength={30}
            className="mt-1.5 h-10 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text placeholder:text-brand-muted focus:border-[#FFB300] focus:outline-none"
          />
        </div>
      )}

      {!isOff && (
        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[minmax(0,1fr)_72px_96px_36px] items-center gap-2 rounded-lg border border-brand-line bg-white p-2"
            >
              <input
                type="text"
                value={r.label}
                onChange={(e) => {
                  const next = [...rows];
                  next[idx] = { ...next[idx], label: e.target.value.slice(0, 32) };
                  onRowsChange(next);
                }}
                placeholder={
                  axis === "size"
                    ? "e.g. 25 kg"
                    : axis === "colour"
                      ? "e.g. Anthracite"
                      : axis === "model"
                        ? "e.g. Bosch 18V"
                        : axis === "material"
                          ? "e.g. Oak"
                          : "e.g. 5 L"
                }
                maxLength={32}
                className="h-9 rounded-lg border border-brand-line bg-brand-bg px-2 text-[13px] text-brand-text focus:border-[#FFB300] focus:outline-none"
              />
              <input
                type="number"
                min={0}
                value={r.stock_count}
                onChange={(e) => {
                  const next = [...rows];
                  next[idx] = { ...next[idx], stock_count: e.target.value };
                  onRowsChange(next);
                }}
                placeholder="Stock"
                className="h-9 rounded-lg border border-brand-line bg-brand-bg px-2 text-center text-[13px] text-brand-text focus:border-[#FFB300] focus:outline-none"
              />
              <div className="flex items-stretch overflow-hidden rounded-lg border border-brand-line bg-brand-bg focus-within:border-[#FFB300]">
                <span className="inline-flex items-center bg-neutral-100 px-2 text-[11px] font-bold text-brand-text">
                  +/− £
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={r.price_delta_pounds}
                  onChange={(e) => {
                    const next = [...rows];
                    next[idx] = { ...next[idx], price_delta_pounds: e.target.value };
                    onRowsChange(next);
                  }}
                  placeholder="0.00"
                  className="h-9 w-full bg-transparent px-2 text-[13px] text-brand-text placeholder:text-brand-muted focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => onRowsChange(rows.filter((_, i) => i !== idx))}
                aria-label="Remove variant"
                className="inline-flex h-9 items-center justify-center rounded-lg text-[14px] font-extrabold text-white"
                style={{ background: "#8B0000" }}
              >
                ×
              </button>
            </div>
          ))}
          {rows.length < 5 && (
            <button
              type="button"
              onClick={() =>
                onRowsChange(
                  [
                    ...rows,
                    { label: "", stock_count: "", price_delta_pounds: "" }
                  ].slice(0, 5)
                )
              }
              className="inline-flex h-10 items-center rounded-xl border-2 border-brand-line bg-white px-3 text-[12px] font-extrabold text-brand-text transition hover:border-[#FFB300]"
            >
              + Add variant
            </button>
          )}
          {rows.length > 0 && (
            <p className="text-[11px] leading-snug text-brand-muted">
              Stock blank = unlimited. £ delta is added to (or subtracted
              from) the base price for that variant.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Per-product multi-buy editor. Up to 2 tiers per product. Each tier
// reads on the live PDP as a multi-buy button under the cover image
// — e.g. "Buy 2 for £18 each" — mirroring the Hammerex products UX.
// Saves into bulk_tiers when the form submits.
function MultiBuyBlock({
  tiers,
  basePounds,
  onChange
}: {
  tiers: Array<{ min_qty: string; price_pounds: string }>;
  /** The single-unit price entered above. Surfaces a "save £X" hint
   *  next to each tier when the tier price drops below it. */
  basePounds: string;
  onChange: (next: Array<{ min_qty: string; price_pounds: string }>) => void;
}) {
  const base = Number(basePounds);
  return (
    <div className="space-y-2 border-t border-brand-line bg-brand-bg p-3 sm:p-4">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
          Multi-buy pricing
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-brand-muted">
          Reward bulk orders — up to 2 tiers, each shown as a button
          under the product image (e.g. &ldquo;Buy 2 for £18 each&rdquo;).
        </p>
      </div>
      <div className="space-y-2">
        {tiers.map((t, idx) => {
          const tierPrice = Number(t.price_pounds);
          const tierQty = Number(t.min_qty);
          const savesPer =
            Number.isFinite(base) && base > 0 && Number.isFinite(tierPrice) && tierPrice > 0 && tierPrice < base
              ? base - tierPrice
              : 0;
          return (
            <div
              key={idx}
              className="grid grid-cols-[40px_56px_minmax(0,1fr)_96px_36px] items-center gap-2 rounded-lg border border-brand-line bg-white p-2"
            >
              <span className="text-center text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
                Buy
              </span>
              <input
                type="number"
                min={2}
                step={1}
                value={t.min_qty}
                onChange={(e) => {
                  const next = [...tiers];
                  next[idx] = { ...next[idx], min_qty: e.target.value };
                  onChange(next);
                }}
                placeholder="2"
                className="h-9 rounded-lg border border-brand-line bg-brand-bg px-2 text-center text-[13px] font-extrabold text-brand-text focus:border-[#FFB300] focus:outline-none"
              />
              <div className="flex items-stretch overflow-hidden rounded-lg border border-brand-line bg-brand-bg focus-within:border-[#FFB300]">
                <span className="inline-flex items-center bg-neutral-100 px-2 text-[12px] font-extrabold text-brand-text">
                  £
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  value={t.price_pounds}
                  onChange={(e) => {
                    const next = [...tiers];
                    next[idx] = { ...next[idx], price_pounds: e.target.value };
                    onChange(next);
                  }}
                  placeholder="each"
                  className="h-9 w-full bg-transparent px-2 text-[13px] text-brand-text placeholder:text-brand-muted focus:outline-none"
                />
                <span className="inline-flex items-center bg-neutral-100 px-2 text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                  each
                </span>
              </div>
              <span
                className="text-[11px] font-extrabold uppercase tracking-widest"
                style={{ color: savesPer > 0 ? "#0F7A3F" : "#9CA3AF" }}
                title={
                  savesPer > 0
                    ? `Saves £${savesPer.toFixed(2)} per unit vs single`
                    : "Tier price must be below single price to save."
                }
              >
                {savesPer > 0 && `–£${savesPer.toFixed(2)}`}
              </span>
              <button
                type="button"
                onClick={() => onChange(tiers.filter((_, i) => i !== idx))}
                aria-label="Remove tier"
                className="inline-flex h-9 items-center justify-center rounded-lg text-[14px] font-extrabold text-white"
                style={{ background: "#8B0000" }}
              >
                ×
              </button>
            </div>
          );
        })}
        {tiers.length < 2 && (
          <button
            type="button"
            onClick={() =>
              onChange(
                [
                  ...tiers,
                  {
                    min_qty: tiers.length === 0 ? "2" : "3",
                    price_pounds: ""
                  }
                ].slice(0, 2)
              )
            }
            className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.97]"
            style={{ background: "var(--trade-accent, #FFB300)" }}
          >
            + Add multi-buy tier
          </button>
        )}
      </div>
    </div>
  );
}

function StoreIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9h18l-1.5 11A2 2 0 0 1 17.5 22h-11A2 2 0 0 1 4.5 20Z" />
      <path d="M7 9V6a5 5 0 0 1 10 0v3" />
    </svg>
  );
}
function TruckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="6" width="13" height="11" rx="1" />
      <polygon points="14 9 19 9 22 12 22 17 14 17 14 9" />
      <circle cx="6" cy="20" r="2" />
      <circle cx="18" cy="20" r="2" />
    </svg>
  );
}
function TagIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41 12 22l-9-9V3h10z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}
function ThresholdIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="7" cy="7" r="3" />
      <circle cx="17" cy="17" r="3" />
    </svg>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-brand-line bg-brand-surface/40 p-5">
      <h2 className="text-xs font-bold uppercase tracking-widest text-[#FFB300]">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-brand-text">{label}</span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  maxLength,
  type
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: string;
}) {
  return (
    <input
      type={type ?? "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="h-11 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-xs text-brand-text placeholder:text-brand-muted focus:border-[#FFB300] focus:outline-none"
    />
  );
}
