// TradeProductFAQ — trades-themed port of Hammerex's ProductFAQ.
//
// Reads product.faq (Array<{q, a}>) from hammerex_xrated_products and
// renders a collapsible Q&A accordion. Same content shape as Hammerex
// but themed for the cream/amber trades palette. No brand-wide
// evergreen FAQ (Hammerex's WORKSHOP_FAQ) is spliced in — trades
// each have their own workflow, so only the per-product FAQ renders
// here. Later phases can add a Trades-wide FAQ if the shape hardens.

export function TradeProductFAQ({
  faq
}: {
  faq: { q: string; a: string }[] | null;
}) {
  if (!faq?.length) return null;

  return (
    <section id="faq" className="border-t border-[#1B1A17]/10 bg-[#FBF6EC] py-8">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <details className="group" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-2">
            <h2 className="text-[18px] font-black text-[#1B1A17] md:text-[22px]">
              Got a question? We&apos;ve got the answer.
            </h2>
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-400 text-[#0A0A0A] transition group-open:rotate-180"
            >
              ▾
            </span>
          </summary>
          <p className="mb-4 text-[12px] leading-snug text-[#1B1A17]/60">
            Plain answers from the trade who supplies this. Tap a
            question to expand.
          </p>

          <h3 className="mb-2 mt-4 text-[10px] font-black uppercase tracking-[0.22em] text-amber-700">
            About this product
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {faq.map((f, i) => (
              <FaqItem key={i} q={f.q} a={f.a} />
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group/q rounded-2xl border border-[#1B1A17]/10 bg-white p-4 shadow-sm open:bg-[#FFF7E0]">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[13.5px] font-black text-[#1B1A17]">
        <span>{q}</span>
        <span
          aria-hidden
          className="mt-0.5 inline-block shrink-0 rounded-full bg-amber-400/25 px-2 text-[12px] font-black text-amber-800 transition group-open/q:rotate-45"
        >
          +
        </span>
      </summary>
      <p className="mt-3 text-[12.5px] leading-[1.55] text-[#1B1A17]/70">
        {a}
      </p>
    </details>
  );
}
