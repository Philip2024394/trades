// QuotationList — replaces the browse grid when the trade opens their
// pending quote basket via the notebook icon.
//
// Shows: line items (qty + unit price + line total), running total,
// project selector (site projects OR create new), delivery address,
// delivery timing pills, and a Send-for-quote CTA.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  MapPin,
  ChevronDown,
  Send,
  Truck,
  Package,
  Navigation,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { useQuoteBasket } from "../lib/quoteBasket";

type DeliveryTiming = "same-day" | "tomorrow" | "3-days" | "5-days" | "1-week";

const TIMING_OPTIONS: Array<{ key: DeliveryTiming; label: string }> = [
  { key: "same-day", label: "Same day" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "3-days",   label: "3 days" },
  { key: "5-days",   label: "5 days" },
  { key: "1-week",   label: "1 week" }
];

type SiteProjectLite = { id: string; siteName: string };
const LOCATION_KEY = "tc.notebook.location";
const SITE_PROJECTS_API = "/api/apps/notebook/site-projects";
const QUOTE_REQUESTS_API = "/api/apps/notebook/quote-requests";

async function fetchProjects(): Promise<SiteProjectLite[]> {
  try {
    const res = await fetch(SITE_PROJECTS_API, { cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { projects?: Array<{ id: string; site_name: string }> };
    return (json.projects ?? []).map((p) => ({ id: p.id, siteName: p.site_name }));
  } catch {
    return [];
  }
}

type Props = {
  onBackToBrowse: () => void;
};

export function QuotationList({ onBackToBrowse }: Props) {
  const { items, totalGbp, setQty, remove } = useQuoteBasket();
  const [projectId, setProjectId] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  // Delivery address — structured entry with a live-location shortcut
  const [addressLine, setAddressLine] = useState("");
  const [addressPostcode, setAddressPostcode] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [liveLat, setLiveLat] = useState<number | null>(null);
  const [liveLng, setLiveLng] = useState<number | null>(null);
  const [liveLabel, setLiveLabel] = useState<string | null>(null);
  const [locatingLive, setLocatingLive] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const [timing, setTiming] = useState<DeliveryTiming>("tomorrow");
  const [merchantBrief, setMerchantBrief] = useState("");
  const [sent, setSent] = useState(false);
  const [projects, setProjects] = useState<SiteProjectLite[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProjects().then((list) => {
      if (!cancelled) setProjects(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Seed the address line + postcode from whatever the trade set in the
  // location onboarding modal or their profile settings.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(LOCATION_KEY) ?? "";
    if (!saved) return;
    // Try to split off the outward postcode token from the end.
    const m = saved.match(/([A-Z]{1,2}\d[A-Z\d]?)\s*$/i);
    if (m) {
      setAddressPostcode(m[1].toUpperCase());
      setAddressLine(saved.slice(0, m.index).trim());
    } else {
      setAddressLine(saved);
    }
  }, []);

  function useLiveLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocateError("Your browser doesn't support device location.");
      return;
    }
    setLocatingLive(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLiveLat(lat);
        setLiveLng(lng);
        setLiveLabel(`Live: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        setLocatingLive(false);
      },
      (err) => {
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Switch to Enter address."
            : "Couldn't get your location. Switch to Enter address."
        );
        setLocatingLive(false);
      }
    );
  }

  const hasLive = liveLat !== null && liveLng !== null;
  const hasManual = Boolean(addressLine.trim() && addressPostcode.trim());
  const composedAddress = (() => {
    const parts: string[] = [];
    if (hasLive && liveLabel) parts.push(liveLabel);
    if (hasManual) parts.push([addressLine, addressPostcode].filter(Boolean).join(", "));
    const base = parts.join(" · ");
    return receiverName ? `${base} · c/o ${receiverName}` : base;
  })();
  const addressReady = hasLive || hasManual;

  async function handleSend() {
    if (!addressReady) {
      setSendError("delivery_address_incomplete");
      return;
    }
    setSendError(null);
    setSending(true);
    try {
      const res = await fetch(QUOTE_REQUESTS_API, {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({
          projectId:              projectId || undefined,
          newProjectName:         creatingProject ? newProjectName : undefined,
          deliveryAddress:        composedAddress,
          deliveryReceiverName:   receiverName || undefined,
          deliveryNotes:          deliveryNotes || undefined,
          deliveryPostcode:       addressPostcode || undefined,
          deliveryLat:            liveLat ?? undefined,
          deliveryLng:            liveLng ?? undefined,
          deliveryTiming:         timing,
          merchantBrief:          merchantBrief.trim() || undefined
        })
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? String(res.status));
      }
      setSent(true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "send_failed");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div
        className="rounded-2xl border bg-white p-6 text-center shadow-sm"
        style={{ borderColor: "rgba(22,101,52,0.35)" }}
      >
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: "#166534" }}
        >
          <Send size={22} className="text-white"/>
        </div>
        <h2 className="mt-4 text-[18px] font-black text-neutral-900">Quote sent</h2>
        <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-neutral-600">
          Your quote request went to the nearest verified merchants. Replies land in Notebook → Quote Me.
        </p>
        <button
          type="button"
          onClick={onBackToBrowse}
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[12px] font-black uppercase tracking-wider shadow-sm"
          style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
        >
          Back to Notebook
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Back to products */}
      <div>
        <button
          type="button"
          onClick={onBackToBrowse}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider shadow-sm hover:brightness-105"
          style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
        >
          <ArrowLeft size={12}/>
          Back to products page
        </button>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <section
          className="rounded-2xl border-2 border-dashed p-8 text-center"
          style={{ borderColor: "rgba(139,69,19,0.20)" }}
        >
          <Package size={28} strokeWidth={1.4} className="mx-auto text-neutral-400"/>
          <p className="mt-3 text-[13px] font-black text-neutral-900">Your quote is empty</p>
          <p className="mx-auto mt-1 max-w-sm text-[11px] text-neutral-500">
            Go back to Notebook and tap <strong>Add to quote</strong> on any item.
          </p>
        </section>
      )}

      {/* Line items */}
      {items.length > 0 && (
        <section
          className="rounded-2xl border bg-white shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.12)" }}
        >
          <ul className="divide-y" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
            {items.map((i) => (
              <li key={i.itemId} className="flex items-center gap-3 p-3">
                <div
                  className="relative aspect-square h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg"
                  style={{ backgroundColor: "#F5F0E4" }}
                >
                  {i.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.imageUrl} alt="" className="h-full w-full object-contain p-1"/>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Package size={16} className="text-neutral-400"/>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-[12.5px] font-black text-neutral-900">{i.productName}</div>
                  <div className="line-clamp-1 text-[10.5px] text-neutral-500">
                    {i.merchantName} · £{i.unitPriceGbp.toFixed(2)}/{i.unit}
                  </div>
                </div>
                {/* Compact stepper */}
                <div
                  className="inline-flex h-7 flex-shrink-0 items-center overflow-hidden rounded-full border bg-white"
                  style={{ borderColor: "rgba(139,69,19,0.18)" }}
                >
                  <button
                    type="button"
                    onClick={() => setQty(i.itemId, i.qty - 1)}
                    disabled={i.qty <= 1}
                    aria-label="Decrease"
                    className="flex h-full w-7 items-center justify-center text-neutral-700 hover:bg-neutral-50 disabled:opacity-30"
                  >
                    <Minus size={11}/>
                  </button>
                  <span
                    className="border-x px-2 text-[11px] font-black text-neutral-900"
                    style={{ borderColor: "rgba(139,69,19,0.10)" }}
                  >
                    {i.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(i.itemId, i.qty + 1)}
                    aria-label="Increase"
                    className="flex h-full w-7 items-center justify-center text-neutral-700 hover:bg-neutral-50"
                  >
                    <Plus size={11}/>
                  </button>
                </div>
                <div className="w-16 flex-shrink-0 text-right text-[13px] font-black text-neutral-900">
                  £{(i.qty * i.unitPriceGbp).toFixed(2)}
                </div>
                <button
                  type="button"
                  onClick={() => remove(i.itemId)}
                  aria-label={`Remove ${i.productName}`}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white shadow-sm hover:brightness-105"
                  style={{ backgroundColor: "#B91C1C" }}
                >
                  <Trash2 size={13}/>
                </button>
              </li>
            ))}
          </ul>
          {/* Total */}
          <div className="border-t p-3" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                Estimated total
              </span>
              <span className="text-[18px] font-black text-neutral-900">£{totalGbp.toFixed(2)}</span>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-snug text-neutral-500">
              Submit to lock in confirmed delivery time and possibly a lower price than listed —
              merchants compete on the whole basket.
            </p>
          </div>
        </section>
      )}

      {/* Options — collapsed until quote has items */}
      {items.length > 0 && (
        <>
          {/* Add to project */}
          <section
            className="rounded-2xl border bg-white p-4 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.12)" }}
          >
            <div>
              <h3 className="text-[15px] font-black leading-tight text-neutral-900 md:text-[16px]">
                Add this quote to a project
              </h3>
              <p className="mt-1 text-[11.5px] leading-snug text-neutral-500">
                Optional — attach this quote to one of your existing Site Projects,
                or create a new project on the fly. Once linked, all materials, quotes,
                and orders for the job live under that project so nothing goes missing.
              </p>
            </div>
            <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative flex-1">
                <select
                  value={creatingProject ? "__new__" : projectId}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      setCreatingProject(true);
                      setProjectId("");
                    } else {
                      setCreatingProject(false);
                      setProjectId(e.target.value);
                    }
                  }}
                  className="w-full appearance-none rounded-md border bg-white px-3 py-2.5 pr-9 text-[12.5px] text-neutral-900 outline-none"
                  style={{ borderColor: "rgba(139,69,19,0.18)" }}
                >
                  <option value="">— No project —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.siteName}</option>
                  ))}
                  <option value="__new__">+ Create new project…</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500"/>
              </div>
              {creatingProject && (
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="New project name — e.g. Watson kitchen"
                  className="flex-1 rounded-md border bg-white px-3 py-2.5 text-[12.5px] text-neutral-900 outline-none placeholder:text-neutral-400"
                  style={{ borderColor: "rgba(139,69,19,0.18)" }}
                />
              )}
            </div>
          </section>

          {/* Delivery address */}
          <section
            className="rounded-2xl border bg-white p-4 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.12)" }}
          >
            <div>
              <h3 className="text-[15px] font-black leading-tight text-neutral-900 md:text-[16px]">
                Where should the delivery land?
              </h3>
              <p className="mt-1 text-[11.5px] leading-snug text-neutral-500">
                Use your live location for on-site drop-offs, or enter a full address with postcode
                for home / yard delivery. Add a receiver name and any site notes so the driver knows
                exactly where to go.
              </p>
            </div>

            {/* Set-my-location shortcut — yellow before pressed, green after */}
            <div className="mt-3">
              <button
                type="button"
                onClick={useLiveLocation}
                disabled={locatingLive}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-4 text-[11px] font-black uppercase tracking-wider shadow-sm disabled:opacity-40"
                style={{
                  backgroundColor: liveLat !== null ? "#166534" : "#FFB300",
                  color:           liveLat !== null ? "#FFFFFF" : "#0A0A0A"
                }}
              >
                {locatingLive ? (
                  <Loader2 size={12} className="animate-spin"/>
                ) : liveLat !== null ? (
                  <CheckCircle2 size={12}/>
                ) : (
                  <Navigation size={12}/>
                )}
                {locatingLive
                  ? "Locating…"
                  : liveLat !== null
                    ? `Location set${liveLabel ? ` · ${liveLabel.replace(/^Live:\s*/, "")}` : ""}`
                    : "Set my location"}
              </button>
              {locateError && (
                <div className="mt-2 rounded-md bg-red-50 p-2 text-[10.5px] text-red-700">{locateError}</div>
              )}
            </div>

            {/* Manual address — always available underneath the GPS shortcut */}
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Address line</span>
                <input
                  type="text"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  placeholder="Building no + street, town"
                  className="min-h-[44px] rounded-md border bg-white px-3 text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400"
                  style={{ borderColor: "rgba(139,69,19,0.18)" }}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Postcode</span>
                <input
                  type="text"
                  value={addressPostcode}
                  onChange={(e) => setAddressPostcode(e.target.value.toUpperCase())}
                  placeholder="M20 2AB"
                  className="min-h-[44px] rounded-md border bg-white px-3 text-[13px] uppercase tracking-wider text-neutral-900 outline-none placeholder:text-neutral-400"
                  style={{ borderColor: "rgba(139,69,19,0.18)" }}
                  maxLength={8}
                  autoComplete="postal-code"
                />
              </label>
            </div>

            {/* Receiver + notes — always shown */}
            <div className="mt-3 grid grid-cols-1 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                  Receiver name
                </span>
                <input
                  type="text"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="Who signs for the delivery?"
                  className="min-h-[44px] rounded-md border bg-white px-3 text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400"
                  style={{ borderColor: "rgba(139,69,19,0.18)" }}
                />
                <span className="text-[10px] leading-snug text-neutral-500">
                  Optional — helps the driver ask for the right person on site.
                </span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                  Delivery notes
                </span>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  rows={2}
                  placeholder="Second gate on left · leave with site manager · call on arrival"
                  className="rounded-md border bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400"
                  style={{ borderColor: "rgba(139,69,19,0.18)" }}
                />
                <span className="text-[10px] leading-snug text-neutral-500">
                  Optional — anything a sat-nav gets wrong or a driver needs to know.
                </span>
              </label>
            </div>
          </section>

          {/* Merchant brief — freeform notes for the trade */}
          <section
            className="rounded-2xl border bg-white p-4 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.12)" }}
          >
            <div>
              <h3 className="text-[15px] font-black leading-tight text-neutral-900 md:text-[16px]">
                Additional notes for the merchant
              </h3>
              <p className="mt-1 text-[11.5px] leading-snug text-neutral-500">
                Add anything extra you need on the delivery — including items you don&apos;t know the
                exact product name for. Describe them in your own words. Merchants know their catalog
                and will match the closest product.
              </p>
            </div>
            <textarea
              value={merchantBrief}
              onChange={(e) => setMerchantBrief(e.target.value)}
              rows={4}
              placeholder={"e.g.\n• 2 × the fat plastic buckets you had last time\n• A roll of the black damp course, wide one\n• Anything else you'd normally throw in for a small skim job"}
              className="mt-3 w-full rounded-md border bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400"
              style={{ borderColor: "rgba(139,69,19,0.18)" }}
            />
          </section>

          {/* Delivery timing */}
          <section
            className="rounded-2xl border bg-white p-4 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.12)" }}
          >
            <div>
              <h3 className="flex items-center gap-2 text-[13.5px] font-black leading-tight text-neutral-900">
                <Truck size={14}/>
                Estimated delivery times
              </h3>
              <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                Pick when you&apos;d like it on site. Each merchant confirms their own delivery
                time when they return the quote.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {TIMING_OPTIONS.map((t) => {
                const active = timing === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTiming(t.key)}
                    aria-pressed={active}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-full border px-3 text-[10.5px] font-black uppercase tracking-wider shadow-sm transition"
                    style={{
                      backgroundColor: active ? "#0A0A0A" : "#FFFFFF",
                      color: active ? "#FFB300" : "#0A0A0A",
                      borderColor: active ? "#0A0A0A" : "rgba(139,69,19,0.18)"
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Send for quote */}
          <div className="flex flex-col items-end gap-2">
            {sendError && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-[10.5px] text-red-700">
                {sendError === "delivery_address_incomplete"
                  ? "Add a delivery address before sending — postcode is required."
                  : `Couldn't send: ${sendError}. Try again.`}
              </div>
            )}
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="inline-flex min-h-[52px] items-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider shadow-sm disabled:opacity-60"
              style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
            >
              <Send size={14}/>
              {sending ? "Sending…" : "Send for quote"}
            </button>
          </div>
        </>
      )}

      <p className="text-[10px] leading-snug text-neutral-500">
        Trade Center never publishes your quote publicly. Nearest verified merchants only. Zero commission on the winning quote.{" "}
        <Link href="/tc/hub" className="font-black uppercase tracking-wider text-neutral-700 hover:underline">Learn more</Link>
      </p>
    </div>
  );
}
