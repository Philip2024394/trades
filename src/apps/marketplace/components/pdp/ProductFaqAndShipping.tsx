// Product FAQ (accordion) + Shipping & Returns (collapsible). Two smaller
// blocks combined into one file to keep pdp folder tidy.

"use client";

import { useState } from "react";
import { ChevronDown, Truck, ShieldCheck, RotateCcw, Package } from "lucide-react";
import type { ProductFaq } from "../../data/productDetails";

// ─── FAQ ─────────────────────────────────────────────────────────────

export function ProductFaqBlock({ faq }: { faq: ProductFaq[] }) {
  if (faq.length === 0) return null;
  return (
    <section className="border-t py-8" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-[16px] font-black text-neutral-900">Frequently asked questions</h2>
        <ul className="mt-4 flex flex-col gap-2">
          {faq.map((item, i) => (
            <FaqRow key={i} item={item}/>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FaqRow({ item }: { item: ProductFaq }) {
  const [open, setOpen] = useState(false);
  return (
    <li
      className="overflow-hidden rounded-xl border bg-white shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full min-h-[52px] items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-[12.5px] font-black text-neutral-900">{item.q}</span>
        <ChevronDown
          size={16}
          className="flex-shrink-0 text-neutral-500 transition"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>
      {open && (
        <div className="border-t px-4 py-3 text-[11.5px] leading-relaxed text-neutral-700" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          {item.a}
        </div>
      )}
    </li>
  );
}

// ─── Shipping & Returns ──────────────────────────────────────────────

type ShippingProps = {
  dispatchLeadDays?: number;
  freeDeliveryOver?: number;
  warrantyYears?: number;
};

export function ShippingReturnsBlock({
  dispatchLeadDays,
  freeDeliveryOver,
  warrantyYears
}: ShippingProps) {
  return (
    <section className="border-t py-8" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-[16px] font-black text-neutral-900">Shipping &amp; returns</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <InfoTile
            Icon={Truck}
            title="Dispatch"
            body={
              dispatchLeadDays === 0 || dispatchLeadDays == null
                ? "Same-day dispatch on orders before 2pm."
                : `Dispatched within ${dispatchLeadDays} working day${dispatchLeadDays === 1 ? "" : "s"}.`
            }
          />
          <InfoTile
            Icon={Package}
            title="Free delivery"
            body={
              freeDeliveryOver
                ? `Orders over £${freeDeliveryOver} ship free within the UK.`
                : "Standard UK delivery from £3.99."
            }
          />
          <InfoTile
            Icon={RotateCcw}
            title="30-day returns"
            body="Unused items returned within 30 days for a full refund."
          />
          <InfoTile
            Icon={ShieldCheck}
            title="Warranty"
            body={`${warrantyYears ?? 1}-year manufacturer warranty against defects.`}
          />
        </div>
      </div>
    </section>
  );
}

function InfoTile({
  Icon,
  title,
  body
}: {
  Icon: typeof Truck;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-xl border bg-white p-4 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <Icon size={18} className="text-neutral-700"/>
      <div className="mt-2 text-[12.5px] font-black text-neutral-900">{title}</div>
      <p className="mt-0.5 text-[11px] leading-snug text-neutral-600">{body}</p>
    </div>
  );
}
