"use client";

// Xrated Shop Mode — cart page client body.
//
// Reads the cart from localStorage scoped per-tradesperson. Renders the
// line items, country picker, air/sea shipping toggle, and the WhatsApp
// composer. No card payments — the "Checkout" button composes a
// WhatsApp message; the tradesperson confirms the final price.

import { useEffect, useMemo, useState } from "react";
import type {
  HammerexTradeOffListing,
  HammerexXratedShippingZone
} from "@/lib/supabase";
import {
  cartItemCount,
  cartTotalPence,
  clearCart,
  formatGbp,
  readCart,
  removeItem,
  setQty,
  type CartState
} from "@/lib/xratedCart";
import { whatsappDigits } from "@/lib/tradeOff";

type ShippingMode = "air" | "sea";

export function CartPageBody({
  listing,
  zones
}: {
  listing: HammerexTradeOffListing;
  zones: HammerexXratedShippingZone[];
}) {
  const slug = listing.slug;
  const firstName = listing.display_name.split(/\s+/)[0] ?? listing.display_name;

  const [state, setState] = useState<CartState | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [mode, setMode] = useState<ShippingMode>("air");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(readCart(slug));
    setHydrated(true);
    function refresh() {
      setState(readCart(slug));
    }
    window.addEventListener("xrated-cart-change", refresh as EventListener);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("xrated-cart-change", refresh as EventListener);
      window.removeEventListener("storage", refresh);
    };
  }, [slug]);

  // Pick a sensible default country: UK if present, else first by name.
  useEffect(() => {
    if (selectedCountry || zones.length === 0) return;
    const uk = zones.find(
      (z) =>
        z.country_code.toUpperCase() === "GB" ||
        /united kingdom/i.test(z.country_name)
    );
    setSelectedCountry((uk ?? zones[0]).country_code);
  }, [zones, selectedCountry]);

  const zone = useMemo(
    () => zones.find((z) => z.country_code === selectedCountry) ?? null,
    [zones, selectedCountry]
  );

  // If the picked zone only supports one mode, snap the selected mode to
  // it so the summary line always reflects what we'll quote.
  useEffect(() => {
    if (!zone) return;
    const hasAir = typeof zone.air_price_pence === "number";
    const hasSea = typeof zone.sea_price_pence === "number";
    if (mode === "air" && !hasAir && hasSea) setMode("sea");
    if (mode === "sea" && !hasSea && hasAir) setMode("air");
  }, [zone, mode]);

  const subtotal = state ? cartTotalPence(state) : 0;
  const itemCount = state ? cartItemCount(state) : 0;
  const shippingPence = zone ? pickShippingPence(zone, mode) : null;
  const total = subtotal + (shippingPence ?? 0);
  const etaLine = zone
    ? etaSentence(zone.eta_min_days, zone.eta_max_days)
    : null;

  const whatsappHref = useMemo(
    () =>
      state
        ? buildWhatsappHref({
            listing,
            state,
            zone,
            mode,
            shippingPence,
            subtotal,
            total
          })
        : "#",
    [listing, state, zone, mode, shippingPence, subtotal, total]
  );

  if (!hydrated || !state) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20">
        <p className="text-sm text-neutral-500">Loading cart…</p>
      </div>
    );
  }

  function handleQty(
    productId: string,
    qty: number,
    variantLabel: string | null
  ) {
    setState(setQty(slug, productId, qty, variantLabel));
  }

  function handleRemove(productId: string, variantLabel: string | null) {
    setState(removeItem(slug, productId, variantLabel));
  }

  function handleClear() {
    clearCart(slug);
    setState(readCart(slug));
  }

  return (
    <>
      <section className="w-full px-4 pt-6 sm:px-6 sm:pt-8">
        <div className="mx-auto max-w-6xl">
          <a
            href={`/${slug}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-[13px] font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:text-sm"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to {firstName}&rsquo;s profile
          </a>
          <div className="mt-5">
            <p
              className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: "#FFB300" }}
            >
              {firstName}&rsquo;s shop
            </p>
            <h1 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
              Your cart
            </h1>
            <p className="mt-1 text-[13px] text-neutral-500 sm:text-sm">
              {itemCount === 0
                ? "Nothing here yet."
                : `${itemCount} ${itemCount === 1 ? "item" : "items"} ready for ${firstName} to quote.`}
            </p>
          </div>
        </div>
      </section>

      <section className="w-full px-4 pb-10 pt-6 sm:px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            {state.items.length === 0 ? (
              <EmptyCart slug={slug} firstName={firstName} />
            ) : (
              <ul className="flex flex-col gap-3">
                {state.items.map((item) => {
                  // Composite key — product_id alone collides when the
                  // customer added two variants of the same product (two
                  // sizes of one item are distinct cart lines).
                  const lineKey = `${item.product_id}::${item.variant_label ?? ""}`;
                  return (
                    <li
                      key={lineKey}
                      className="flex items-stretch gap-3 rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4"
                    >
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-100 sm:h-24 sm:w-24">
                        {item.cover_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={item.cover_url}
                            alt={item.name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[13px] text-neutral-400">
                            —
                          </div>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <p className="line-clamp-2 text-[13px] font-extrabold leading-tight text-neutral-900 sm:text-sm">
                          {item.name}
                        </p>
                        {/* Variant subline — when the customer picked a
                            size/colour in the modal we mirror the chip
                            label here so it's obvious which variant the
                            line refers to (mirrors how `unit` is shown
                            below). Axis prefix uses the same "Size/
                            Colour" convention as the modal heading. */}
                        {item.variant_label && (
                          <p className="mt-0.5 text-[13px] font-bold text-neutral-600">
                            {item.variant_label}
                          </p>
                        )}
                        {/* Service rows surface their unit ("per tree",
                            "per hour") alongside the per-unit price so the
                            line reads "£23.00 per tree × qty 2 = £46.00".
                            Physical-product rows leave unit null and
                            continue to read "£X.XX each". */}
                        <p className="mt-1 text-[13px] text-neutral-500">
                          {formatGbp(item.price_pence)}{" "}
                          {item.unit ? item.unit : "each"}
                        </p>
                        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                          <QtyStepper
                            value={item.qty}
                            onChange={(n) =>
                              handleQty(item.product_id, n, item.variant_label ?? null)
                            }
                          />
                          <p className="text-sm font-extrabold text-neutral-900">
                            {formatGbp(item.price_pence * item.qty)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleRemove(item.product_id, item.variant_label ?? null)
                        }
                        aria-label={`Remove ${item.name}${item.variant_label ? ` (${item.variant_label})` : ""} from cart`}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {state.items.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px]">
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 font-bold text-neutral-600 transition hover:border-red-300 hover:text-red-600"
                >
                  Clear cart
                </button>
                <a
                  href={`/${slug}`}
                  className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300]"
                >
                  Keep browsing
                </a>
              </div>
            )}
          </div>

          {state.items.length > 0 && (
            <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
                <p
                  className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
                  style={{ color: "#FFB300" }}
                >
                  Summary
                </p>
                <dl className="mt-3 flex flex-col gap-2 text-[13px] sm:text-sm">
                  <Row label="Subtotal" value={formatGbp(subtotal)} />
                  <CountryPicker
                    zones={zones}
                    value={selectedCountry}
                    onChange={setSelectedCountry}
                  />
                  {zone && (
                    <ShippingPickerRow
                      zone={zone}
                      mode={mode}
                      onChange={setMode}
                    />
                  )}
                  {zone && shippingPence !== null && (
                    <Row
                      label={`${mode === "air" ? "Air" : "Sea"} shipping`}
                      value={formatGbp(shippingPence)}
                    />
                  )}
                  {zone && shippingPence === null && (
                    <p className="text-[13px] text-neutral-500">
                      Shipping quoted by {firstName} after enquiry.
                    </p>
                  )}
                  {zones.length === 0 && (
                    <p className="text-[13px] text-neutral-500">
                      Shipping quoted by {firstName} after enquiry — no
                      preset zones for this shop.
                    </p>
                  )}
                  {etaLine && (
                    <p className="text-[13px] text-neutral-500">{etaLine}</p>
                  )}
                  <div className="mt-1 flex items-baseline justify-between border-t border-neutral-200 pt-3">
                    <dt className="text-sm font-extrabold text-neutral-900">
                      Total
                    </dt>
                    <dd className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
                      {formatGbp(total)}
                    </dd>
                  </div>
                </dl>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold uppercase tracking-wider text-white shadow-lg transition active:scale-[0.98]"
                  style={{ background: "#0F7A3F", boxShadow: "0 10px 26px rgba(15,122,63,0.5)" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Z" />
                  </svg>
                  Send enquiry on WhatsApp
                </a>
                <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">
                  {firstName} will confirm the final price by message before
                  any payment. No card details are stored on Xrated.
                </p>
              </div>
            </aside>
          )}
        </div>
      </section>
    </>
  );
}

function QtyStepper({
  value,
  onChange
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  function nudge(delta: number) {
    onChange(Math.max(1, Math.min(99, value + delta)));
  }
  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-neutral-200">
      <button
        type="button"
        onClick={() => nudge(-1)}
        aria-label="Decrease quantity"
        className="inline-flex h-11 w-11 items-center justify-center text-base font-extrabold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40"
        disabled={value <= 1}
      >
        −
      </button>
      <span className="inline-flex h-11 min-w-[2.25rem] items-center justify-center bg-white px-2 text-sm font-extrabold text-neutral-900">
        {value}
      </span>
      <button
        type="button"
        onClick={() => nudge(1)}
        aria-label="Increase quantity"
        className="inline-flex h-11 w-11 items-center justify-center text-base font-extrabold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40"
        disabled={value >= 99}
      >
        +
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[13px] text-neutral-600 sm:text-sm">{label}</dt>
      <dd className="text-[13px] font-extrabold text-neutral-900 sm:text-sm">
        {value}
      </dd>
    </div>
  );
}

function CountryPicker({
  zones,
  value,
  onChange
}: {
  zones: HammerexXratedShippingZone[];
  value: string;
  onChange: (code: string) => void;
}) {
  if (zones.length === 0) return null;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
        Ship to
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-bold text-neutral-900 sm:text-sm"
      >
        {zones.map((z) => (
          <option key={z.country_code} value={z.country_code}>
            {z.country_name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ShippingPickerRow({
  zone,
  mode,
  onChange
}: {
  zone: HammerexXratedShippingZone;
  mode: ShippingMode;
  onChange: (m: ShippingMode) => void;
}) {
  const hasAir = typeof zone.air_price_pence === "number";
  const hasSea = typeof zone.sea_price_pence === "number";
  if (!hasAir || !hasSea) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
        Shipping mode
      </span>
      <div className="inline-flex h-11 w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
        <ModeButton
          label="Air"
          active={mode === "air"}
          onClick={() => onChange("air")}
        />
        <ModeButton
          label="Sea"
          active={mode === "sea"}
          onClick={() => onChange("sea")}
        />
      </div>
    </div>
  );
}

function ModeButton({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex h-full flex-1 items-center justify-center text-[13px] font-extrabold uppercase tracking-wider transition"
      style={{
        background: active ? "#FFB300" : "transparent",
        color: active ? "#0A0A0A" : "#525252"
      }}
    >
      {label}
    </button>
  );
}

function EmptyCart({ slug, firstName }: { slug: string; firstName: string }) {
  return (
    <div
      className="rounded-2xl p-6 text-center sm:p-8"
      style={{ background: "#FFB300" }}
    >
      <p className="text-base font-extrabold text-neutral-900">
        Your cart is empty.
      </p>
      <p className="mt-1 text-[13px] text-neutral-900/80 sm:text-sm">
        Pick something from {firstName}&rsquo;s shop and we&rsquo;ll put it
        together as an enquiry.
      </p>
      <a
        href={`/${slug}`}
        className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-lg bg-neutral-900 px-5 text-[13px] font-extrabold uppercase tracking-wider text-white shadow-md transition active:scale-[0.98] sm:text-sm"
      >
        Back to {firstName}&rsquo;s shop
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </a>
    </div>
  );
}

function pickShippingPence(
  zone: HammerexXratedShippingZone,
  mode: ShippingMode
): number | null {
  const value = mode === "air" ? zone.air_price_pence : zone.sea_price_pence;
  return typeof value === "number" ? value : null;
}

function etaSentence(min: number | null, max: number | null): string | null {
  if (typeof min !== "number" && typeof max !== "number") return null;
  if (typeof min === "number" && typeof max === "number") {
    if (min === max) {
      return `Delivered in ${min} ${min === 1 ? "day" : "days"}`;
    }
    return `Delivered in ${min}–${max} days`;
  }
  const only = (min ?? max) as number;
  return `Delivered in ~${only} days`;
}

function buildWhatsappHref({
  listing,
  state,
  zone,
  mode,
  shippingPence,
  subtotal,
  total
}: {
  listing: HammerexTradeOffListing;
  state: CartState;
  zone: HammerexXratedShippingZone | null;
  mode: ShippingMode;
  shippingPence: number | null;
  subtotal: number;
  total: number;
}): string {
  const digits = whatsappDigits(listing.whatsapp);
  const lines: string[] = [];
  lines.push(`Hi ${listing.display_name} — quote enquiry from Xrated.`);
  lines.push("");
  lines.push("Cart:");
  for (const item of state.items) {
    // Append the unit when the item is a service-mode line ("per tree",
    // "per hour"…) so the tradesperson immediately sees the customer is
    // asking about 2 trees at £23/tree rather than two unitless items.
    const unitSuffix = item.unit ? ` ${item.unit}` : "";
    // Variant suffix — "Drywall corner bead — Size: 2.5m — qty 2". The
    // axis is implicit from the variant label so we keep the line tight
    // by leading with the label only.
    const variantSuffix = item.variant_label ? ` — ${item.variant_label}` : "";
    lines.push(
      `• ${item.name}${variantSuffix} — ${formatGbp(item.price_pence)}${unitSuffix} × qty ${item.qty} — ${formatGbp(item.price_pence * item.qty)}`
    );
  }
  lines.push("");
  lines.push(`Subtotal: ${formatGbp(subtotal)}`);
  if (zone && shippingPence !== null) {
    lines.push(
      `Shipping to ${zone.country_name} (${mode === "air" ? "Air" : "Sea"}): ${formatGbp(shippingPence)}`
    );
  } else if (zone) {
    lines.push(`Shipping to ${zone.country_name}: to be quoted`);
  } else {
    lines.push("Shipping: to be quoted");
  }
  lines.push(`Total: ${formatGbp(total)}`);
  lines.push("");
  lines.push("My WhatsApp:  (let me reply with my number)");
  lines.push("My address:  (let me reply)");
  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join("\n"))}`;
}
