// TradeWarrantyTimeline — trades-themed port of Hammerex's
// WarrantyTimeline.
//
// Hammerex ships their own products, so their timeline referenced a
// serial-number portal and manufacturer claim flow. Trades resell +
// install goods from a mix of merchants, so the copy here is
// deliberately simpler — no serial registration, no portal. If the
// item fails, the customer contacts the trade on WhatsApp with proof
// of purchase and the trade sorts the manufacturer claim on their
// behalf. That matches how UK trades actually handle warranty in the
// field.
//
// Reads product.warranty_years (nullable int, 1–25). Auto-hides when
// null so PDPs without a warranty stay clean.

export function TradeWarrantyTimeline({
  warrantyYears
}: {
  warrantyYears: number | null | undefined;
}) {
  if (warrantyYears === null || warrantyYears === undefined) return null;
  const years = Math.max(1, Math.min(25, Math.floor(warrantyYears)));

  const steps = [
    {
      n: "01",
      t: "Receive your order",
      d: "Track shipment to your door. Open carefully — keep the box for at least 30 days in case of a return."
    },
    {
      n: "02",
      t: "Keep your receipt",
      d: "Your order confirmation is your proof of purchase. No need to register on a portal — the trade holds a record of your order."
    },
    {
      n: "03",
      t: `Covered for ${years} year${years === 1 ? "" : "s"}`,
      d: "Protected against manufacturing defects, parts and labour, for the duration of the manufacturer's warranty."
    },
    {
      n: "04",
      t: "Need help? Message on WhatsApp",
      d: "One message with your order reference and a photo of the issue. The trade handles the manufacturer claim on your behalf — you deal with one person, not two companies."
    }
  ];

  return (
    <section
      id="warranty"
      className="border-t border-[#1B1A17]/10 bg-[#FBF6EC] py-8"
    >
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-2">
            <h2 className="text-[18px] font-black text-[#1B1A17] md:text-[22px]">
              {years}-year warranty journey
            </h2>
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-400 text-[#0A0A0A] transition group-open:rotate-180"
            >
              ▾
            </span>
          </summary>
          <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li
                key={s.n}
                className="relative rounded-2xl border border-[#1B1A17]/10 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="grid h-9 w-9 place-items-center rounded-full bg-amber-400 text-[11px] font-black text-[#0A0A0A]"
                  >
                    {s.n}
                  </span>
                  <h3 className="text-[13.5px] font-black text-[#1B1A17]">
                    {s.t}
                  </h3>
                </div>
                <p className="mt-2 text-[12.5px] leading-[1.55] text-[#1B1A17]/70">
                  {s.d}
                </p>
                {i < steps.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute right-3 top-1/2 hidden h-px w-6 -translate-y-1/2 bg-amber-400/40 lg:block"
                  />
                )}
              </li>
            ))}
          </ol>
        </details>
      </div>
    </section>
  );
}
