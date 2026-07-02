"use client";

// Customer portal — phone-based lookup. No login required; matches by
// customer_phone in hammerex_plant_hire_bookings (scoped to a single
// merchant so cross-merchant privacy holds).

import Link from "next/link";
import { useState } from "react";

type Booking = {
  id: string;
  reference: string;
  machine_slug: string;
  machine_label: string | null;
  duration: string;
  quantity: number;
  wet_hire: boolean;
  date_from: string | null;
  date_to: string | null;
  delivery_postcode: string | null;
  subtotal_pence: number | null;
  deposit_pence: number | null;
  deposit_status: string;
  hire_status: string;
  created_at: string;
};

type Report = {
  id: string;
  booking_id: string | null;
  kind: string;
  hire_reference: string | null;
  machine_label: string | null;
  photo_urls: string[] | null;
  signature_url: string | null;
  created_at: string;
};

export function PlantMyHiresClient({
  merchantSlug,
  merchantName
}: {
  merchantSlug: string;
  merchantName: string;
}) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reports, setReports] = useState<Report[]>([]);

  const lookup = async () => {
    setError(null);
    setBusy(true);
    setLoaded(false);
    try {
      const r = await fetch("/api/plant-hire/bookings/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_slug: merchantSlug, phone })
      });
      const j = (await r.json()) as {
        ok?: boolean;
        error?: string;
        bookings?: Booking[];
        reports?: Report[];
      };
      if (!r.ok || !j.ok) throw new Error(j.error ?? "lookup failed");
      setBookings(j.bookings ?? []);
      setReports(j.reports ?? []);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "lookup error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
          Look up your hires
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">
          Enter the phone number you used at booking. We&rsquo;ll show every booking + delivery
          confirmation + damage report tied to it on {merchantName}&rsquo;s yard.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+44 7700 900 101"
            className="h-12 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
          />
          <button
            type="button"
            onClick={lookup}
            disabled={busy || phone.replace(/[^\d]/g, "").length < 6}
            className={`inline-flex h-12 items-center justify-center rounded-xl px-5 text-[12px] font-extrabold uppercase tracking-widest transition ${
              busy || phone.replace(/[^\d]/g, "").length < 6
                ? "cursor-not-allowed bg-neutral-200 text-neutral-500"
                : "bg-neutral-900 text-white hover:bg-black"
            }`}
          >
            {busy ? "Looking up…" : "Look up"}
          </button>
        </div>
        {error && <p className="mt-2 text-[11px] font-bold text-red-600">{error}</p>}
        <p className="mt-3 text-[11px] text-neutral-500">
          Privacy: matches only within {merchantName}&rsquo;s bookings. No password. To share
          this with a colleague, use their phone number instead.
        </p>
      </div>

      {loaded && bookings.length === 0 && reports.length === 0 && (
        <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-6 text-center">
          <p className="text-[14px] font-extrabold text-neutral-900">Nothing on file yet.</p>
          <p className="mt-1 text-[12px] text-neutral-500">
            If you booked over the phone or WhatsApp, ask {merchantName} to add a portal record.
          </p>
        </div>
      )}

      {bookings.length > 0 && (
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            Bookings · {bookings.length}
          </p>
          <ul className="mt-2 space-y-2">
            {bookings.map((b) => (
              <li
                key={b.id}
                className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                      Ref · {b.reference}
                    </p>
                    <p className="mt-0.5 text-[15px] font-extrabold leading-tight text-neutral-900">
                      {b.machine_label ?? b.machine_slug}
                    </p>
                    <p className="mt-0.5 text-[12px] text-neutral-600">
                      {b.quantity} × 1 {b.duration}
                      {b.wet_hire ? " · wet-hire" : ""}
                      {b.date_from ? ` · ${b.date_from}` : ""}
                      {b.date_to ? ` → ${b.date_to}` : ""}
                      {b.delivery_postcode ? ` · ${b.delivery_postcode}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusPill status={b.hire_status} />
                    {b.subtotal_pence !== null && (
                      <p className="mt-1 text-[14px] font-extrabold text-neutral-900">
                        £{(b.subtotal_pence / 100).toFixed(2)}
                      </p>
                    )}
                    {b.deposit_pence !== null && b.deposit_pence > 0 && (
                      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        Deposit {b.deposit_status} · £{(b.deposit_pence / 100).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/${merchantSlug}/plant-hire/extend?ref=${b.reference}`}
                    className="inline-flex h-9 items-center rounded-lg border border-neutral-200 bg-white px-3 text-[10px] font-extrabold uppercase tracking-widest text-neutral-800 hover:bg-neutral-50"
                  >
                    Extend / off-hire →
                  </Link>
                  <Link
                    href={`/${merchantSlug}/plant-hire/delivery-report?ref=${b.reference}`}
                    className="inline-flex h-9 items-center rounded-lg border border-neutral-200 bg-white px-3 text-[10px] font-extrabold uppercase tracking-widest text-neutral-800 hover:bg-neutral-50"
                  >
                    + Delivery report
                  </Link>
                  <Link
                    href={`/${merchantSlug}/plant-hire/damage-report?ref=${b.reference}`}
                    className="inline-flex h-9 items-center rounded-lg border border-neutral-200 bg-white px-3 text-[10px] font-extrabold uppercase tracking-widest text-neutral-800 hover:bg-neutral-50"
                  >
                    + Damage report
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {reports.length > 0 && (
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            Reports · {reports.length}
          </p>
          <ul className="mt-2 space-y-2">
            {reports.map((r) => (
              <li key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-3">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                  {r.kind.replace("_", " ")} · {new Date(r.created_at).toLocaleDateString()}
                </p>
                <p className="mt-1 text-[13px] font-extrabold text-neutral-900">
                  {r.machine_label ?? "Machine"}
                  {r.hire_reference ? ` · Ref ${r.hire_reference}` : ""}
                </p>
                {r.photo_urls && r.photo_urls.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-1">
                    {r.photo_urls.slice(0, 4).map((u, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={u + i}
                        src={u}
                        alt={`Report photo ${i + 1}`}
                        className="aspect-square rounded-lg object-cover"
                      />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    requested: { label: "Requested", bg: "#FFB300", fg: "#0A0A0A" },
    confirmed: { label: "Confirmed", bg: "#0EA5E9", fg: "#FFFFFF" },
    delivered: { label: "Delivered", bg: "#10B981", fg: "#FFFFFF" },
    off_hired: { label: "Off-hired", bg: "#6B7280", fg: "#FFFFFF" },
    cancelled: { label: "Cancelled", bg: "#DC2626", fg: "#FFFFFF" }
  };
  const c = map[status] ?? { label: status, bg: "#E5E7EB", fg: "#111827" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
      style={{ background: c.bg, color: c.fg }}
    >
      {c.label}
    </span>
  );
}
