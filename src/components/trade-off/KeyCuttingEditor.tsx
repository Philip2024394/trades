"use client";

// KeyCuttingEditor — everything on one page. Toggle each of 8
// categories, set per-category price + optional note, enable/disable
// the 3 fulfilment modes, and fill in machine brand, years, banner,
// restricted-key dealer status, postal address, custom copy.

import { useEffect, useRef, useState } from "react";
import {
  BULK_TIERS_PRESET,
  FAQ_PRESET,
  KEY_BRANDS_PRESET,
  KEY_CATEGORIES,
  TRADE_CUSTOMERS_PRESET,
  TRUST_BENEFITS_PRESET,
  formatPriceFrom,
  type BulkTier,
  type KeyBrand,
  type KeyCategorySlug,
  type KeyCuttingConfig,
  type KeyFaq
} from "@/lib/keyCutting";

const RELATED_CATEGORY_PRESETS: { slug: string; label: string }[] = [
  { slug: "padlocks", label: "Padlocks" },
  { slug: "nuts_bolts_screws", label: "Nuts, bolts & screws" },
  { slug: "hand_tools", label: "Hand tools" },
  { slug: "electrical", label: "Electrical" },
  { slug: "safety_workwear", label: "Safety & workwear" },
  { slug: "gardening", label: "Gardening" },
  { slug: "kitchen_bathroom", label: "Kitchen & bathroom" }
];

export function KeyCuttingEditor({
  slug,
  token,
  initial
}: {
  slug: string;
  token: string;
  initial: KeyCuttingConfig;
}) {
  const [cfg, setCfg] = useState<KeyCuttingConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Snapshot of initial config JSON — used to compare against current
  // state so the Save button + beforeunload warning know if the
  // merchant has unsaved edits.
  const initialSnapshot = useRef(JSON.stringify(initial));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDirty(JSON.stringify(cfg) !== initialSnapshot.current);
  }, [cfg]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function patch(p: Partial<KeyCuttingConfig>) {
    setCfg((prev) => ({ ...prev, ...p }));
  }

  function patchCategory(
    catSlug: KeyCategorySlug,
    p: Partial<{
      enabled: boolean;
      price_from_pence: number | null;
      note: string;
      cart_enabled: boolean;
      sub_types: string[];
      image_url: string;
    }>
  ) {
    setCfg((prev) => {
      const meta = KEY_CATEGORIES.find((m) => m.slug === catSlug);
      const existing = prev.categories[catSlug] ?? {
        enabled: false,
        price_from_pence: meta?.default_price_pence ?? null,
        note: "",
        sub_types: []
      };
      return {
        ...prev,
        categories: { ...prev.categories, [catSlug]: { ...existing, ...p } }
      };
    });
  }

  async function uploadImage(file: File, field: "banner_image_url" | "illustration_image_url") {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/trade-off/upload-photo", { method: "POST", body: form });
      const j = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !j.ok || !j.url) {
        setToast(j.error ?? "Upload failed");
        return;
      }
      patch({ [field]: j.url } as Partial<KeyCuttingConfig>);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setUploading(false);
      window.setTimeout(() => setToast(null), 2500);
    }
  }

  async function save() {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/trade-off/key-cutting/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, token, config: cfg })
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setToast(j.error ?? "Save failed");
      } else {
        setToast("Saved.");
        // Reset dirty snapshot so beforeunload stops warning.
        initialSnapshot.current = JSON.stringify(cfg);
        setDirty(false);
      }
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSaving(false);
      window.setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6 px-4 pb-24">
      {/* Banner + about. */}
      <Card title="Banner + shop-front details">
        <label className="block">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
            Banner image (goes on the top of the public /key-cutting page)
          </span>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="url"
              value={cfg.banner_image_url}
              onChange={(e) => patch({ banner_image_url: e.target.value.trim() })}
              placeholder="Paste image URL"
              className="h-10 min-w-0 flex-1 rounded-md border border-brand-line bg-brand-bg px-3 font-mono text-[12px] text-brand-text outline-none focus:border-brand-accent"
            />
            <label className="inline-flex h-10 shrink-0 cursor-pointer items-center rounded-md border border-brand-line bg-brand-bg px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-muted transition hover:border-brand-accent hover:text-brand-text">
              {uploading ? "…" : "Upload"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage(f, "banner_image_url");
                }}
              />
            </label>
          </div>
          {cfg.banner_image_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={cfg.banner_image_url}
              alt=""
              className="mt-3 h-32 w-full rounded-lg object-cover"
            />
          )}
        </label>

        {/* Illustration next to the title row — separate image from banner. */}
        <label className="mt-4 block">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
            Title-row illustration (small graphic on the right of the intro copy)
          </span>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="url"
              value={cfg.illustration_image_url}
              onChange={(e) => patch({ illustration_image_url: e.target.value.trim() })}
              placeholder="Paste image URL — blank uses platform default"
              className="h-10 min-w-0 flex-1 rounded-md border border-brand-line bg-brand-bg px-3 font-mono text-[12px] text-brand-text outline-none focus:border-brand-accent"
            />
            <label className="inline-flex h-10 shrink-0 cursor-pointer items-center rounded-md border border-brand-line bg-brand-bg px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-muted transition hover:border-brand-accent hover:text-brand-text">
              {uploading ? "…" : "Upload"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage(f, "illustration_image_url");
                }}
              />
            </label>
          </div>
          {cfg.illustration_image_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={cfg.illustration_image_url}
              alt=""
              className="mt-3 h-24 w-auto rounded-lg object-contain"
            />
          )}
        </label>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">Machine brand</span>
            <input
              type="text"
              value={cfg.machine_brand}
              onChange={(e) => patch({ machine_brand: e.target.value })}
              placeholder="e.g. Silca, JMA"
              className="mt-2 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
              maxLength={60}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">Years cutting</span>
            <input
              type="number"
              min={0}
              max={60}
              value={cfg.years_cutting ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                patch({ years_cutting: v === "" ? null : Number(v) });
              }}
              className="mt-2 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
            />
          </label>
        </div>
        <label className="mt-3 block">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
            Turnaround pill (optional)
          </span>
          <input
            type="text"
            value={cfg.turnaround_text}
            onChange={(e) => patch({ turnaround_text: e.target.value })}
            placeholder="e.g. Same day · Ready in 5 minutes · 24h turnaround"
            className="mt-2 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
            maxLength={40}
          />
          <p className="mt-1 text-[10px] text-brand-muted">
            Shows as a pill on your public page next to years + machine.
          </p>
        </label>
      </Card>

      {/* Categories. */}
      <Card title="What we cut">
        <p className="text-[12px] text-brand-muted">
          Toggle a category on to advertise it. Set a &ldquo;from&rdquo; price and add any notes
          (e.g. &ldquo;Bring V5C logbook&rdquo;, &ldquo;Mul-T-Lock only&rdquo;).
        </p>
        <ul className="mt-3 space-y-2">
          {KEY_CATEGORIES.map((meta) => {
            const c = cfg.categories[meta.slug] ?? {
              enabled: false,
              price_from_pence: meta.default_price_pence,
              note: ""
            };
            return (
              <li
                key={meta.slug}
                className="rounded-xl border border-brand-line bg-brand-bg p-3"
                style={{ borderColor: c.enabled ? "#FFB300" : undefined }}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => patchCategory(meta.slug, { enabled: !c.enabled })}
                    aria-pressed={c.enabled}
                    className="inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-brand-line transition"
                    style={{ background: c.enabled ? "#FFB300" : "transparent" }}
                  >
                    <span
                      className="inline-block h-6 w-6 rounded-full bg-white shadow transition"
                      style={{ transform: c.enabled ? "translateX(24px)" : "translateX(2px)" }}
                    />
                  </button>
                  <div className="flex-1">
                    <p className="text-[13px] font-extrabold text-brand-text">
                      <span className="mr-2 text-[16px]">{meta.emoji}</span>
                      {meta.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-brand-muted">{meta.short_desc}</p>
                  </div>
                </div>
                {c.enabled && (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr]">
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                        Price from (pence)
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={c.price_from_pence ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          patchCategory(meta.slug, { price_from_pence: v === "" ? null : Number(v) });
                        }}
                        placeholder={String(meta.default_price_pence)}
                        className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[12px] text-brand-text outline-none focus:border-brand-accent"
                      />
                      <p className="mt-1 text-[10px] text-brand-muted">
                        Shows as &ldquo;{formatPriceFrom(c.price_from_pence)}&rdquo;
                      </p>
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                        Note (optional)
                      </span>
                      <input
                        type="text"
                        value={c.note}
                        onChange={(e) => patchCategory(meta.slug, { note: e.target.value })}
                        placeholder="e.g. Bring V5C logbook"
                        className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
                        maxLength={240}
                      />
                    </label>
                    {/* Per-category tile image — URL paste or upload.
                     *  Renders on the public tile in place of the emoji. */}
                    <label className="col-span-full block">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                        Category tile image (optional)
                      </span>
                      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          type="url"
                          value={c.image_url ?? ""}
                          onChange={(e) =>
                            patchCategory(meta.slug, { image_url: e.target.value.trim() })
                          }
                          placeholder="Paste image URL — blank shows emoji"
                          className="h-9 min-w-0 flex-1 rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[11px] text-brand-text outline-none focus:border-brand-accent"
                        />
                        <label className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-md border border-brand-line bg-brand-bg px-3 text-[10px] font-extrabold uppercase tracking-widest text-brand-muted transition hover:border-brand-accent hover:text-brand-text">
                          {uploading ? "…" : "Upload"}
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              (async () => {
                                const form = new FormData();
                                form.append("file", f);
                                const res = await fetch("/api/trade-off/upload-photo", {
                                  method: "POST",
                                  body: form
                                });
                                const j = (await res.json()) as { ok?: boolean; url?: string };
                                if (j.ok && j.url) {
                                  patchCategory(meta.slug, { image_url: j.url });
                                }
                              })();
                            }}
                          />
                        </label>
                      </div>
                      {c.image_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={c.image_url}
                          alt=""
                          className="mt-2 h-16 w-16 rounded-md object-cover"
                        />
                      )}
                    </label>
                    <label className="col-span-full block">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                        Sub-key types (comma-separated, max 20)
                      </span>
                      <input
                        type="text"
                        value={(c.sub_types ?? []).join(", ")}
                        onChange={(e) => {
                          const arr = e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0)
                            .slice(0, 20);
                          patchCategory(meta.slug, { sub_types: arr });
                        }}
                        placeholder={
                          meta.slug === "cylinder"
                            ? "e.g. Yale front door, Union euro cylinder, UPVC door lock"
                            : meta.slug === "mortice"
                              ? "e.g. 3-lever mortice, 5-lever mortice, Sashlock, Deadlock"
                              : "e.g. add the specific key names customers search for"
                        }
                        className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
                      />
                      <p className="mt-1 text-[10px] text-brand-muted">
                        Renders as chips on this category&rsquo;s tile. Huge SEO win — customers search for specific key names.
                      </p>
                    </label>
                    {/* Per-category cart toggle. Default follows the meta:
                     *  on for standardised categories, off for restricted
                     *  + car-transponder + car-remote which need verify. */}
                    <label className="col-span-full flex items-start gap-2 rounded-md border border-brand-line bg-brand-surface p-2">
                      <input
                        type="checkbox"
                        checked={
                          c.cart_enabled === undefined ? meta.cart_default_on : c.cart_enabled
                        }
                        onChange={(e) =>
                          patchCategory(meta.slug, { cart_enabled: e.target.checked })
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#FFB300]"
                      />
                      <span className="text-[11px] leading-relaxed text-brand-text">
                        <span className="font-extrabold">Allow prepay via cart</span>
                        <span className="text-brand-muted">
                          {" — "}
                          customer can pick a quantity + Add to cart + pay upfront alongside the
                          WhatsApp option. Recommended off for verify-in-person categories.
                        </span>
                      </span>
                    </label>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Fulfilment modes. */}
      <Card title="How customers get keys cut">
        <p className="text-[12px] text-brand-muted">
          Enable any combination. Walk-in is the default; photo-scan and postal are optional differentiators vs Timpson kiosks.
        </p>
        <div className="mt-3 space-y-2">
          <ModeRow
            title="Walk-in"
            body="Customer walks into your yard/counter, keys cut on the spot."
            enabled={cfg.modes.walk_in}
            onChange={(v) => patch({ modes: { ...cfg.modes, walk_in: v } })}
          />
          <ModeRow
            title="Photo-scan via WhatsApp"
            body="Customer WhatsApps a photo of both edges of the key. You confirm blank + book them in."
            enabled={cfg.modes.photo_scan}
            onChange={(v) => patch({ modes: { ...cfg.modes, photo_scan: v } })}
          />
          <ModeRow
            title="Postal service"
            body="Customer posts the key with a prepaid return envelope. You cut + post back within X hours."
            enabled={cfg.modes.postal}
            onChange={(v) => patch({ modes: { ...cfg.modes, postal: v } })}
          />
        </div>
        {cfg.modes.postal && (
          <div className="mt-4 space-y-3 rounded-xl border border-brand-line bg-brand-bg p-3">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                Postal address (customer sends the key here)
              </span>
              <textarea
                value={cfg.postal_address}
                onChange={(e) => patch({ postal_address: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-md border border-brand-line bg-brand-bg px-3 py-2 text-[13px] text-brand-text outline-none focus:border-brand-accent"
                placeholder="Stuart Kingsley Building Merchant&#10;Bilton Way&#10;Hull HU8 8DZ"
                maxLength={400}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                Turnaround (hours)
              </span>
              <input
                type="number"
                min={0}
                max={240}
                value={cfg.postal_turnaround_hours ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  patch({ postal_turnaround_hours: v === "" ? null : Number(v) });
                }}
                className="mt-1 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
              />
            </label>
          </div>
        )}
      </Card>

      {/* Restricted keys. */}
      <Card title="Restricted / high-security dealer">
        <p className="text-[12px] text-brand-muted">
          If you&rsquo;re an authorised dealer for restricted key systems (Mul-T-Lock, EVVA, ASSA Abloy, Ingersoll SC71 …), enter the brands here. They render as trust badges on your /key-cutting page.
        </p>
        <label className="mt-3 block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
            Brands (comma-separated, max 8)
          </span>
          <input
            type="text"
            value={cfg.restricted_brands.join(", ")}
            onChange={(e) => {
              const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8);
              patch({ restricted_brands: arr });
            }}
            placeholder="e.g. Mul-T-Lock, EVVA, ASSA Abloy"
            className="mt-1 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
          />
        </label>
      </Card>

      {/* Trust & Benefits — 8-item checkmark strip. */}
      <Card title="Trust & Benefits (checkmark strip)">
        <p className="text-[12px] text-brand-muted">
          Short bullet points shown as a yellow-tick strip near the top of your page. Tap a preset to add it, or add your own.
        </p>
        <ChipListEditor
          items={cfg.trust_benefits}
          onChange={(next) => patch({ trust_benefits: next })}
          presets={TRUST_BENEFITS_PRESET}
          max={16}
          placeholder="e.g. Fast Service"
        />
      </Card>

      {/* Key brands — logo images with fallback text pill. */}
      <Card title="Brands we work with">
        <p className="text-[12px] text-brand-muted">
          The lock/key brands you cut for. Each brand renders as a logo image on your public page (or a text pill if no logo). Paste a URL or upload a transparent PNG per brand.
        </p>
        <KeyBrandsEditor
          brands={cfg.key_brands}
          onChange={(next) => patch({ key_brands: next })}
          presets={KEY_BRANDS_PRESET}
        />
      </Card>

      {/* Bulk tiers. */}
      <Card title="Bulk key duplication tiers">
        <p className="text-[12px] text-brand-muted">
          Quantity thresholds and the discount at each. Empty = hides the whole Bulk section.
        </p>
        <BulkTiersEditor
          tiers={cfg.bulk_tiers}
          onChange={(next) => patch({ bulk_tiers: next })}
          presets={BULK_TIERS_PRESET}
        />
      </Card>

      {/* Trade customers. */}
      <Card title="Trade & commercial customers we serve">
        <p className="text-[12px] text-brand-muted">
          Who you sell to. Rendered as a pill list on your public page. Speaks directly to trade buyers browsing your app.
        </p>
        <ChipListEditor
          items={cfg.trade_customers}
          onChange={(next) => patch({ trade_customers: next })}
          presets={TRADE_CUSTOMERS_PRESET}
          max={30}
          placeholder="e.g. Landlords"
        />
      </Card>

      {/* FAQ. */}
      <Card title="Frequently asked questions">
        <p className="text-[12px] text-brand-muted">
          Q&amp;A accordion at the bottom of your page. Preset answers below — edit any of them or add your own.
        </p>
        <FaqEditor
          faqs={cfg.faq}
          onChange={(next) => patch({ faq: next })}
          preset={FAQ_PRESET}
        />
      </Card>

      {/* Promotional banner. */}
      <Card title="Promotional banner (optional)">
        <p className="text-[12px] text-brand-muted">
          Yellow banner rendered above the intro row. Great for flash offers &mdash;
          &ldquo;Cut 3 keys, get 4th half price this weekend&rdquo;.
        </p>
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 rounded-md border border-brand-line bg-brand-bg p-2">
            <input
              type="checkbox"
              checked={cfg.promo_banner.enabled}
              onChange={(e) => patch({ promo_banner: { ...cfg.promo_banner, enabled: e.target.checked } })}
              className="h-4 w-4 accent-[#FFB300]"
            />
            <span className="text-[12px] font-extrabold text-brand-text">Show promotional banner</span>
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Banner text</span>
            <input
              type="text"
              value={cfg.promo_banner.text}
              onChange={(e) => patch({ promo_banner: { ...cfg.promo_banner, text: e.target.value } })}
              placeholder="e.g. Cut 3 keys, get 4th half price this weekend"
              maxLength={200}
              className="mt-1 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
            />
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">CTA label (optional)</span>
              <input
                type="text"
                value={cfg.promo_banner.cta_label}
                onChange={(e) => patch({ promo_banner: { ...cfg.promo_banner, cta_label: e.target.value } })}
                placeholder="e.g. Book now"
                maxLength={40}
                className="mt-1 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">CTA link (URL or #anchor)</span>
              <input
                type="text"
                value={cfg.promo_banner.cta_href}
                onChange={(e) => patch({ promo_banner: { ...cfg.promo_banner, cta_href: e.target.value } })}
                placeholder="https://... or #anchor"
                maxLength={400}
                className="mt-1 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 font-mono text-[12px] text-brand-text outline-none focus:border-brand-accent"
              />
            </label>
          </div>
        </div>
      </Card>

      {/* Headline + section headings override. */}
      <Card title="Headline & section titles (optional)">
        <p className="text-[12px] text-brand-muted">
          Blank fields keep the platform-default wording. Override any if you want your own copy.
        </p>
        <div className="mt-3 space-y-3">
          <HeadingField
            label="H1 headline"
            placeholder="Unlock Quality With Each Turn"
            value={cfg.headline_text}
            onChange={(v) => patch({ headline_text: v })}
            max={120}
          />
          <HeadingField
            label="Trust & Benefits heading"
            placeholder="Why customers choose our key cutting"
            value={cfg.section_headings.trust_benefits}
            onChange={(v) => patch({ section_headings: { ...cfg.section_headings, trust_benefits: v } })}
          />
          <HeadingField
            label="Brands heading"
            placeholder="Brands we work with"
            value={cfg.section_headings.brands}
            onChange={(v) => patch({ section_headings: { ...cfg.section_headings, brands: v } })}
          />
          <HeadingField
            label="What we cut heading"
            placeholder="What we cut"
            value={cfg.section_headings.what_we_cut}
            onChange={(v) => patch({ section_headings: { ...cfg.section_headings, what_we_cut: v } })}
          />
          <HeadingField
            label="How to get a key cut heading"
            placeholder="How to get a key cut"
            value={cfg.section_headings.how_to_get}
            onChange={(v) => patch({ section_headings: { ...cfg.section_headings, how_to_get: v } })}
          />
          <HeadingField
            label="Bulk section heading"
            placeholder="Bulk key duplication"
            value={cfg.section_headings.bulk}
            onChange={(v) => patch({ section_headings: { ...cfg.section_headings, bulk: v } })}
          />
          <HeadingField
            label="Trade customers heading"
            placeholder="Trade & commercial customers we serve"
            value={cfg.section_headings.trade_customers}
            onChange={(v) => patch({ section_headings: { ...cfg.section_headings, trade_customers: v } })}
          />
          <HeadingField
            label="Related products heading"
            placeholder="While you&rsquo;re here"
            value={cfg.section_headings.related_products}
            onChange={(v) => patch({ section_headings: { ...cfg.section_headings, related_products: v } })}
          />
          <HeadingField
            label="FAQ heading"
            placeholder="Frequently asked questions"
            value={cfg.section_headings.faq}
            onChange={(v) => patch({ section_headings: { ...cfg.section_headings, faq: v } })}
          />
        </div>
      </Card>

      {/* Mode tile bodies override. */}
      <Card title="Fulfilment mode descriptions (optional)">
        <p className="text-[12px] text-brand-muted">
          Blank uses the platform default. Override to sharpen wording, add branch specifics, or reference your opening hours.
        </p>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Walk-in body copy</span>
            <textarea
              value={cfg.mode_bodies.walk_in}
              onChange={(e) => patch({ mode_bodies: { ...cfg.mode_bodies, walk_in: e.target.value } })}
              rows={2}
              placeholder="Come to us during counter hours..."
              className="mt-1 w-full rounded-md border border-brand-line bg-brand-bg px-3 py-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
              maxLength={400}
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Photo-scan body copy</span>
            <textarea
              value={cfg.mode_bodies.photo_scan}
              onChange={(e) => patch({ mode_bodies: { ...cfg.mode_bodies, photo_scan: e.target.value } })}
              rows={2}
              placeholder="WhatsApp a clear photo of both edges..."
              className="mt-1 w-full rounded-md border border-brand-line bg-brand-bg px-3 py-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
              maxLength={400}
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Postal body copy</span>
            <textarea
              value={cfg.mode_bodies.postal}
              onChange={(e) => patch({ mode_bodies: { ...cfg.mode_bodies, postal: e.target.value } })}
              rows={2}
              placeholder="Post the key in a padded envelope..."
              className="mt-1 w-full rounded-md border border-brand-line bg-brand-bg px-3 py-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
              maxLength={400}
            />
          </label>
        </div>
      </Card>

      {/* Explanatory paragraphs under "What we cut". */}
      <Card title="Explanatory paragraphs under 'What we cut' (optional)">
        <p className="text-[12px] text-brand-muted">
          Blank uses the platform-default 3 paragraphs about categories, car keys, and photo enquiries. Any paragraphs you write here fully replace them.
        </p>
        <ParagraphsEditor
          items={cfg.explanatory_paragraphs}
          onChange={(next) => patch({ explanatory_paragraphs: next })}
        />
      </Card>

      {/* Related product categories picker. */}
      <Card title="Related products cross-sell (optional)">
        <p className="text-[12px] text-brand-muted">
          Which merchant_category slugs drive the &ldquo;While you&rsquo;re here&rdquo; section. Empty = platform defaults (padlocks, nuts_bolts_screws, hand_tools).
        </p>
        <ChipListEditor
          items={cfg.related_product_categories}
          onChange={(next) => patch({ related_product_categories: next })}
          presets={RELATED_CATEGORY_PRESETS.map((p) => p.slug)}
          max={20}
          placeholder="e.g. padlocks"
        />
      </Card>

      {/* Custom copy. */}
      <Card title="Custom copy (optional)">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
            Extra sentence rendered under the hero
          </span>
          <textarea
            value={cfg.custom_note}
            onChange={(e) => patch({ custom_note: e.target.value })}
            rows={3}
            placeholder="e.g. In-store cutting during counter hours (7am–5pm Mon–Fri, 7am–1pm Sat). Trade accounts welcome."
            className="mt-1 w-full rounded-md border border-brand-line bg-brand-bg px-3 py-2 text-[13px] text-brand-text outline-none focus:border-brand-accent"
            maxLength={800}
          />
        </label>
      </Card>

      {/* Save. */}
      <div className="flex items-center gap-3 border-t border-brand-line pt-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-12 items-center rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90 disabled:opacity-60"
          style={{ background: "#FFB300" }}
        >
          {saving ? "Saving…" : "Save key cutting"}
        </button>
        {toast && <p className="text-[12px] font-bold text-brand-muted">{toast}</p>}
      </div>
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-4 sm:p-5">
      <h2 className="text-[15px] font-extrabold text-brand-text">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ModeRow({
  title,
  body,
  enabled,
  onChange
}: {
  title: string;
  body: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-brand-line bg-brand-bg p-3"
      style={{ borderColor: enabled ? "#FFB300" : undefined }}
    >
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        aria-pressed={enabled}
        className="inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-brand-line transition"
        style={{ background: enabled ? "#FFB300" : "transparent" }}
      >
        <span
          className="inline-block h-6 w-6 rounded-full bg-white shadow transition"
          style={{ transform: enabled ? "translateX(24px)" : "translateX(2px)" }}
        />
      </button>
      <div>
        <p className="text-[13px] font-extrabold text-brand-text">{title}</p>
        <p className="text-[11px] text-brand-muted">{body}</p>
      </div>
    </div>
  );
}

/** Chip list editor — chip = one item. Add manually or tap presets. */
function ChipListEditor({
  items,
  onChange,
  presets,
  max,
  placeholder
}: {
  items: string[];
  onChange: (next: string[]) => void;
  presets: string[];
  max: number;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  function add(v: string) {
    const t = v.trim();
    if (!t || items.includes(t)) return;
    if (items.length >= max) return;
    onChange([...items, t]);
    setDraft("");
  }
  function remove(v: string) {
    onChange(items.filter((x) => x !== v));
  }
  const available = presets.filter((p) => !items.includes(p));
  return (
    <div className="mt-2 space-y-3">
      <ul className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <li
            key={it}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold text-black"
            style={{ background: "#FFB300" }}
          >
            {it}
            <button
              type="button"
              onClick={() => remove(it)}
              aria-label={`Remove ${it}`}
              className="text-[13px] leading-none"
            >
              ×
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-[11px] text-brand-muted">No items yet — add one below.</li>
        )}
      </ul>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder={placeholder}
          className="h-9 flex-1 rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
        />
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={items.length >= max || draft.trim().length === 0}
          className="inline-flex h-9 items-center rounded-md border border-brand-line bg-brand-surface px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-text transition hover:border-brand-accent disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {available.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
            Suggestions — tap to add
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {available.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => add(p)}
                  disabled={items.length >= max}
                  className="inline-flex items-center rounded-full border border-brand-line bg-brand-bg px-2.5 py-1 text-[11px] font-bold text-brand-text transition hover:border-brand-accent disabled:opacity-40"
                >
                  + {p}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Bulk tiers editor — qty threshold + label per row. */
function BulkTiersEditor({
  tiers,
  onChange,
  presets
}: {
  tiers: BulkTier[];
  onChange: (next: BulkTier[]) => void;
  presets: BulkTier[];
}) {
  function update(idx: number, patch: Partial<BulkTier>) {
    onChange(tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }
  function remove(idx: number) {
    onChange(tiers.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...tiers, { min_qty: 10, label: "5% off" }]);
  }
  function loadPreset() {
    onChange(presets);
  }
  return (
    <div className="mt-2 space-y-2">
      <ul className="space-y-2">
        {tiers.map((t, i) => (
          <li
            key={i}
            className="grid grid-cols-[80px_1fr_auto] gap-2 rounded-xl border border-brand-line bg-brand-bg p-2"
          >
            <input
              type="number"
              min={1}
              value={t.min_qty}
              onChange={(e) => update(i, { min_qty: Number(e.target.value) || 1 })}
              className="h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
              aria-label="Minimum quantity"
            />
            <input
              type="text"
              value={t.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="e.g. 5% off"
              className="h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
              maxLength={60}
              aria-label="Discount label"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="inline-flex h-9 items-center rounded-md border border-brand-line px-2 text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={add}
          disabled={tiers.length >= 10}
          className="inline-flex h-9 items-center rounded-md border-2 border-dashed border-brand-line px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text disabled:opacity-40"
        >
          + Add tier
        </button>
        {tiers.length === 0 && (
          <button
            type="button"
            onClick={loadPreset}
            className="inline-flex h-9 items-center rounded-md border border-brand-line bg-brand-surface px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-text hover:border-brand-accent"
          >
            Load standard tiers
          </button>
        )}
      </div>
    </div>
  );
}

/** FAQ editor — question + answer rows. */
function FaqEditor({
  faqs,
  onChange,
  preset
}: {
  faqs: KeyFaq[];
  onChange: (next: KeyFaq[]) => void;
  preset: KeyFaq[];
}) {
  function update(idx: number, patch: Partial<KeyFaq>) {
    onChange(faqs.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }
  function remove(idx: number) {
    onChange(faqs.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...faqs, { q: "", a: "" }]);
  }
  function loadPreset() {
    onChange(preset);
  }
  return (
    <div className="mt-2 space-y-3">
      <ul className="space-y-2">
        {faqs.map((f, i) => (
          <li key={i} className="rounded-xl border border-brand-line bg-brand-bg p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={f.q}
                  onChange={(e) => update(i, { q: e.target.value })}
                  placeholder="Question"
                  className="h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[13px] font-extrabold text-brand-text outline-none focus:border-brand-accent"
                  maxLength={200}
                />
                <textarea
                  value={f.a}
                  onChange={(e) => update(i, { a: e.target.value })}
                  placeholder="Answer"
                  rows={3}
                  className="w-full rounded-md border border-brand-line bg-brand-bg px-2 py-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
                  maxLength={1200}
                />
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={add}
          disabled={faqs.length >= 20}
          className="inline-flex h-9 items-center rounded-md border-2 border-dashed border-brand-line px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text disabled:opacity-40"
        >
          + Add FAQ
        </button>
        {faqs.length === 0 && (
          <button
            type="button"
            onClick={loadPreset}
            className="inline-flex h-9 items-center rounded-md border border-brand-line bg-brand-surface px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-text hover:border-brand-accent"
          >
            Load 10 preset questions
          </button>
        )}
      </div>
    </div>
  );
}

/** Brand list editor — name + optional logo image per row. */
function KeyBrandsEditor({
  brands,
  onChange,
  presets
}: {
  brands: KeyBrand[];
  onChange: (next: KeyBrand[]) => void;
  presets: KeyBrand[];
}) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  function update(idx: number, patch: Partial<KeyBrand>) {
    onChange(brands.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }
  function remove(idx: number) {
    onChange(brands.filter((_, i) => i !== idx));
  }
  function add(brand?: KeyBrand) {
    if (brand) {
      // Don't add duplicate names.
      if (brands.some((b) => b.name.toLowerCase() === brand.name.toLowerCase())) return;
      onChange([...brands, brand]);
    } else {
      onChange([...brands, { name: "", logo_url: null }]);
    }
  }
  function loadPreset() {
    onChange(presets);
  }
  async function upload(idx: number, file: File) {
    setUploadingIdx(idx);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/trade-off/upload-photo", { method: "POST", body: form });
      const j = (await res.json()) as { ok?: boolean; url?: string };
      if (j.ok && j.url) update(idx, { logo_url: j.url });
    } finally {
      setUploadingIdx(null);
    }
  }

  const available = presets.filter(
    (p) => !brands.some((b) => b.name.toLowerCase() === p.name.toLowerCase())
  );

  return (
    <div className="mt-2 space-y-3">
      <ul className="space-y-2">
        {brands.map((b, idx) => (
          <li
            key={idx}
            className="grid grid-cols-[64px_1fr_auto] items-center gap-2 rounded-xl border border-brand-line bg-brand-bg p-2"
          >
            <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-lg border border-brand-line bg-white">
              {b.logo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={b.logo_url} alt="" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-brand-muted">
                  {b.name.slice(0, 3) || "?"}
                </span>
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <input
                type="text"
                value={b.name}
                onChange={(e) => update(idx, { name: e.target.value })}
                placeholder="Brand name"
                className="h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] font-extrabold text-brand-text outline-none focus:border-brand-accent"
                maxLength={40}
              />
              <div className="flex gap-1">
                <input
                  type="url"
                  value={b.logo_url ?? ""}
                  onChange={(e) => update(idx, { logo_url: e.target.value.trim() || null })}
                  placeholder="Logo URL"
                  className="h-8 min-w-0 flex-1 rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[10px] text-brand-text outline-none focus:border-brand-accent"
                />
                <label className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-md border border-brand-line bg-brand-surface px-2 text-[9px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text">
                  {uploadingIdx === idx ? "…" : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(idx, f);
                    }}
                  />
                </label>
              </div>
            </div>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
            >
              Delete
            </button>
          </li>
        ))}
        {brands.length === 0 && (
          <li className="text-[11px] text-brand-muted">
            No brands yet — tap &ldquo;Load standard brands&rdquo; below or add your own.
          </li>
        )}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => add()}
          disabled={brands.length >= 20}
          className="inline-flex h-9 items-center rounded-md border-2 border-dashed border-brand-line px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text disabled:opacity-40"
        >
          + Add brand
        </button>
        {brands.length === 0 && (
          <button
            type="button"
            onClick={loadPreset}
            className="inline-flex h-9 items-center rounded-md border border-brand-line bg-brand-surface px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-text hover:border-brand-accent"
          >
            Load standard brands
          </button>
        )}
      </div>

      {available.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
            Suggestions — tap to add
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {available.map((p) => (
              <li key={p.name}>
                <button
                  type="button"
                  onClick={() => add(p)}
                  disabled={brands.length >= 20}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-line bg-brand-bg px-2.5 py-1 text-[11px] font-bold text-brand-text hover:border-brand-accent disabled:opacity-40"
                >
                  {p.logo_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.logo_url} alt="" className="h-4 w-4 object-contain" />
                  )}
                  + {p.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Single-line heading override — placeholder shows the default that
 *  will render if the merchant leaves it blank. */
function HeadingField({
  label,
  placeholder,
  value,
  onChange,
  max = 80
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={max}
        className="mt-1 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
      />
    </label>
  );
}

/** Editable list of paragraphs — reorderable via up/down buttons. */
function ParagraphsEditor({
  items,
  onChange
}: {
  items: string[];
  onChange: (next: string[]) => void;
}) {
  function update(idx: number, v: string) {
    onChange(items.map((p, i) => (i === idx ? v : p)));
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...items, ""]);
  }
  return (
    <div className="mt-3 space-y-2">
      <ul className="space-y-2">
        {items.map((p, i) => (
          <li key={i} className="rounded-xl border border-brand-line bg-brand-bg p-3">
            <textarea
              value={p}
              onChange={(e) => update(i, e.target.value)}
              rows={3}
              placeholder="Paragraph text..."
              className="w-full rounded-md border border-brand-line bg-brand-bg px-2 py-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
              maxLength={800}
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={add}
        disabled={items.length >= 6}
        className="inline-flex h-9 items-center rounded-md border-2 border-dashed border-brand-line px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text disabled:opacity-40"
      >
        + Add paragraph
      </button>
    </div>
  );
}
