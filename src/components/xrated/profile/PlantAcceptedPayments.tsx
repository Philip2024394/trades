// Accepted-payments strip — shows the merchant's activated gateways.
// Rendered on the cart, booking wizard success, breakdown and CDM pages
// so customers see which methods to expect.

import {
  PAYMENT_GATEWAY_META,
  type PlantPaymentGateways
} from "@/lib/plantHire";

export function PlantAcceptedPayments({
  cfg,
  compact
}: {
  cfg: PlantPaymentGateways;
  compact?: boolean;
}) {
  if (!cfg.enabled) return null;
  const active = PAYMENT_GATEWAY_META.filter((m) => cfg.gateways[m.slug].enabled);
  if (active.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Payments
        </p>
        {active.map((m) => (
          <span
            key={m.slug}
            className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-700"
          >
            <span aria-hidden="true">{m.icon}</span>
            {cfg.gateways[m.slug].display_name || m.label.split(" (")[0]}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        Payment · {active.length} accepted
      </p>
      <h3 className="mt-1 text-[18px] font-extrabold text-neutral-900 sm:text-[22px]">
        {cfg.heading}
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">{cfg.subheading}</p>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-neutral-600">
        {cfg.deposit_percent !== null && cfg.deposit_percent > 0 && (
          <span className="rounded-full bg-neutral-100 px-3 py-1">
            <strong className="text-neutral-900">{cfg.deposit_percent}%</strong> deposit at
            booking
          </span>
        )}
        {cfg.balance_when && (
          <span className="rounded-full bg-neutral-100 px-3 py-1">
            Balance <strong className="text-neutral-900">{cfg.balance_when}</strong>
          </span>
        )}
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {active.map((m) => {
          const g = cfg.gateways[m.slug];
          return (
            <li
              key={m.slug}
              className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
            >
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[18px]"
              >
                {m.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-extrabold leading-tight text-neutral-900">
                  {g.display_name || m.label}
                </p>
                {g.fee_note && (
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    Fees · {g.fee_note}
                  </p>
                )}
                {g.instructions && (
                  <p className="mt-1 text-[11px] leading-relaxed text-neutral-600 whitespace-pre-wrap">
                    {g.instructions}
                  </p>
                )}
                {g.payment_url && (
                  <a
                    href={g.payment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex h-8 items-center rounded-lg bg-neutral-900 px-2.5 text-[10px] font-extrabold uppercase tracking-widest text-white hover:bg-black"
                  >
                    Open payment link →
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
