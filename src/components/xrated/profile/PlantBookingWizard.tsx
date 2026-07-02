"use client";

// PlantBookingWizard — /plant-hire/book. Pick a machine + dates + contact
// then WhatsApp the merchant with a full booking request. Availability
// blocked-ranges are shown in the calendar so the customer picks around
// them.
//
// This is a WhatsApp-shell booking flow — no live card charge. The
// deposit is shown as an intention amount (payable on delivery bank-
// transfer or card-on-arrival, per merchant policy). True online
// checkout with card pre-auth is a separate infrastructure ticket.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  PLANT_CATEGORIES,
  formatPounds,
  isDateBlocked,
  type PlantCategoryConfig,
  type PlantCategorySlug,
  type PlantHireConfig
} from "@/lib/plantHire";

type FleetItem = {
  slug: PlantCategorySlug;
  cfg: PlantCategoryConfig;
  label: string;
  emoji: string;
};

type Props = {
  merchantName: string;
  merchantSlug: string;
  waHref: string | null;
  fleet: FleetItem[];
  config: PlantHireConfig;
  presetSlug?: PlantCategorySlug | null;
};

export function PlantBookingWizard({
  merchantName,
  merchantSlug,
  waHref,
  fleet,
  config,
  presetSlug
}: Props) {
  const [step, setStep] = useState(1);
  const [slug, setSlug] = useState<PlantCategorySlug | null>(presetSlug ?? null);
  const [duration, setDuration] = useState<"day" | "week" | "month" | "">("");
  const [quantity, setQuantity] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [wetHire, setWetHire] = useState(false);
  const [attachments, setAttachments] = useState("");
  const [deliveryPostcode, setDeliveryPostcode] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const totalSteps = 3;
  const chosen = slug ? fleet.find((f) => f.slug === slug) ?? null : null;
  const machineMeta = slug ? PLANT_CATEGORIES.find((m) => m.slug === slug) ?? null : null;

  const rate = useMemo(() => {
    if (!chosen || !duration) return null;
    const c = chosen.cfg;
    const dry =
      duration === "day"
        ? c.price_day_pence
        : duration === "week"
          ? c.price_week_pence
          : c.price_month_pence;
    const wet = wetHire && c.wet_price_day_pence ? c.wet_price_day_pence : null;
    const perUnit = wet ?? dry ?? 0;
    return perUnit * quantity;
  }, [chosen, duration, quantity, wetHire]);

  const depositPence = useMemo(() => {
    if (rate === null) return null;
    return Math.round(rate * 0.25);
  }, [rate]);

  const dateFromBlocked = useMemo(() => {
    if (!dateFrom || !chosen) return false;
    return isDateBlocked(dateFrom, chosen.cfg.blocked_ranges);
  }, [dateFrom, chosen]);

  const canStep1 = !!slug && !!duration && quantity > 0;
  const canStep2 =
    dateFrom.length === 10 &&
    !dateFromBlocked &&
    deliveryPostcode.trim().length >= 3;
  const canStep3 = name.trim().length > 1 && phone.trim().length >= 6;

  const submit = async () => {
    if (!chosen || !slug) return;
    let reference = "";
    try {
      const r = await fetch("/api/plant-hire/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_slug: merchantSlug,
          customer_name: name,
          customer_phone: phone,
          customer_email: email,
          machine_slug: slug,
          machine_label: machineMeta?.label ?? chosen.label,
          duration,
          quantity,
          wet_hire: wetHire,
          date_from: dateFrom,
          date_to: dateTo,
          delivery_postcode: deliveryPostcode,
          site_address: siteAddress,
          attachments,
          notes,
          subtotal_pence: rate ?? undefined,
          deposit_pence: depositPence ?? undefined
        })
      });
      const j = (await r.json()) as { ok?: boolean; reference?: string };
      if (r.ok && j.reference) reference = j.reference;
    } catch {
      // Fail open — still fire the WhatsApp handoff even if save failed.
    }

    const parts: string[] = [
      `📅 *BOOKING REQUEST — ${merchantName}*`,
      reference ? `🔖 Ref: ${reference}` : "",
      "",
      `🚜 Machine: ${machineMeta?.label ?? chosen.label}${quantity > 1 ? ` × ${quantity}` : ""}`,
      `⏱ Duration: 1 ${duration}`,
      wetHire ? "👷 Wet-hire (with operator)" : "👷 Dry-hire (self-drive)",
      attachments ? `🪝 Attachments: ${attachments}` : "",
      "",
      `📅 Dates: ${dateFrom}${dateTo ? ` → ${dateTo}` : ""}`,
      `📍 Delivery to: ${deliveryPostcode}${siteAddress ? ` — ${siteAddress}` : ""}`,
      "",
      `💷 Estimated rate: ${formatPounds(rate)}`,
      depositPence !== null ? `💷 Deposit (25% intent): ${formatPounds(depositPence)}` : "",
      "",
      `👤 ${name}`,
      `📞 ${phone}`,
      email ? `📧 ${email}` : "",
      notes ? `📝 Notes: ${notes}` : "",
      "",
      reference
        ? `Pay deposit: ${typeof window !== "undefined" ? window.location.origin : ""}/${merchantSlug}/plant-hire/pay?ref=${reference}`
        : "Please confirm availability + card link for the deposit."
    ];
    const msg = encodeURIComponent(parts.filter((p) => p !== "").join("\n"));
    const url = waHref ? `${waHref}?text=${msg}` : "#";
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
      if (reference) {
        setTimeout(() => {
          window.location.href = `/${merchantSlug}/plant-hire/pay?ref=${reference}`;
        }, 400);
      }
    }
  };

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => step > 1 && setStep(step - 1)}
          disabled={step === 1}
          className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500 transition hover:text-neutral-900 disabled:opacity-30"
        >
          ← Back
        </button>
        <div className="flex items-center gap-1.5" aria-label={`Step ${step} of ${totalSteps}`}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i < step ? "w-6 bg-[#FFB300]" : "w-3 bg-neutral-200"
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
          {step} / {totalSteps}
        </span>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-[18px] font-extrabold text-neutral-900 sm:text-[20px]">
            Pick your machine + duration
          </h2>
          <label className="block">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
              Machine
            </span>
            <select
              value={slug ?? ""}
              onChange={(e) => setSlug((e.target.value || null) as PlantCategorySlug | null)}
              className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] text-neutral-900 outline-none focus:border-[#FFB300] focus:bg-white"
            >
              <option value="">— pick a machine —</option>
              {fleet.map((f) => (
                <option key={f.slug} value={f.slug}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-3 gap-2">
            {(["day", "week", "month"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={`h-12 rounded-xl border text-[13px] font-extrabold uppercase tracking-widest transition ${
                  duration === d
                    ? "border-[#FFB300] bg-[#FFB300] text-neutral-900"
                    : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400"
                }`}
              >
                {d === "day" ? "1 day" : d === "week" ? "1 week" : "1 month+"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                Quantity
              </span>
              <input
                type="number"
                min={1}
                max={20}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
              />
            </label>
            {chosen?.cfg.wet_price_day_pence && (
              <label className="flex items-end gap-2 pb-2">
                <input
                  type="checkbox"
                  checked={wetHire}
                  onChange={(e) => setWetHire(e.target.checked)}
                  className="h-5 w-5 rounded border-neutral-300 accent-[#FFB300]"
                />
                <span className="text-[13px] font-bold text-neutral-900">
                  Wet-hire (with operator)
                </span>
              </label>
            )}
          </div>

          <label className="block">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
              Attachments (optional)
            </span>
            <input
              type="text"
              value={attachments}
              onChange={(e) => setAttachments(e.target.value)}
              placeholder="e.g. breaker + 300mm bucket"
              className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
            />
          </label>

          {rate !== null && rate > 0 && (
            <div className="rounded-2xl bg-neutral-900 p-4 text-white">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#FFB300]">
                Estimated {duration} rate
              </p>
              <p className="mt-1 text-[26px] font-extrabold">{formatPounds(rate)}</p>
              {depositPence !== null && (
                <p className="mt-1 text-[11px] text-white/70">
                  Deposit (25%): <strong>{formatPounds(depositPence)}</strong> · Balance on off-hire.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canStep1}
              className={`inline-flex h-11 items-center rounded-xl px-5 text-[12px] font-extrabold uppercase tracking-widest transition ${
                canStep1
                  ? "bg-neutral-900 text-white hover:bg-black"
                  : "cursor-not-allowed bg-neutral-200 text-neutral-500"
              }`}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-[18px] font-extrabold text-neutral-900 sm:text-[20px]">
            Dates + delivery
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                Start date
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={`mt-1 h-12 w-full rounded-xl border bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white ${
                  dateFromBlocked ? "border-red-400" : "border-neutral-200"
                }`}
              />
              {dateFromBlocked && (
                <p className="mt-1 text-[10px] font-extrabold uppercase tracking-widest text-red-600">
                  ⚠ Machine on hire that day — pick a different date
                </p>
              )}
            </label>
            <label className="block">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                Collection date (optional)
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                Delivery postcode
              </span>
              <input
                type="text"
                value={deliveryPostcode}
                onChange={(e) => setDeliveryPostcode(e.target.value.toUpperCase())}
                placeholder="LS10 1LG"
                className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] font-bold uppercase outline-none focus:border-[#FFB300] focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                Site address (optional)
              </span>
              <input
                type="text"
                value={siteAddress}
                onChange={(e) => setSiteAddress(e.target.value)}
                placeholder="Site name / access gate"
                className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
              />
            </label>
          </div>

          {chosen && (chosen.cfg.blocked_ranges?.length ?? 0) > 0 && (
            <details className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              <summary className="cursor-pointer text-[11px] font-extrabold uppercase tracking-widest text-neutral-700">
                Upcoming on-hire windows ({chosen.cfg.blocked_ranges?.length ?? 0})
              </summary>
              <ul className="mt-2 space-y-1 text-[12px] text-neutral-600">
                {chosen.cfg.blocked_ranges
                  ?.slice(0, 8)
                  .map((r, i) => (
                    <li key={i} className="flex justify-between">
                      <span>
                        {r.from} → {r.to}
                      </span>
                      {r.note && <span className="text-neutral-500">· {r.note}</span>}
                    </li>
                  ))}
              </ul>
            </details>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!canStep2}
              className={`inline-flex h-11 items-center rounded-xl px-5 text-[12px] font-extrabold uppercase tracking-widest transition ${
                canStep2
                  ? "bg-neutral-900 text-white hover:bg-black"
                  : "cursor-not-allowed bg-neutral-200 text-neutral-500"
              }`}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-[18px] font-extrabold text-neutral-900 sm:text-[20px]">
            Your details
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                Name
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                WhatsApp / phone
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                Email (optional)
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
              Anything else? (optional)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
            />
          </label>

          <p className="text-[11px] text-neutral-500">
            After you send, we&rsquo;ll reply on WhatsApp inside 30 minutes with a card link
            for the deposit + confirmed hire agreement.
          </p>

          <div className="flex justify-between gap-2">
            <Link
              href={`/${merchantSlug}/plant-hire`}
              className="inline-flex h-11 items-center rounded-xl border border-neutral-200 bg-white px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-500 transition hover:bg-neutral-50"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={submit}
              disabled={!canStep3}
              className={`inline-flex h-12 items-center rounded-xl px-5 text-[12px] font-extrabold uppercase tracking-widest transition ${
                canStep3
                  ? "bg-[#25D366] text-white hover:brightness-95"
                  : "cursor-not-allowed bg-neutral-200 text-neutral-500"
              }`}
            >
              Send on WhatsApp →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
