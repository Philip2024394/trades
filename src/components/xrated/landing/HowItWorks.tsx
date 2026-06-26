// Xrated Trades — three-step explainer.
// Server component. Big orange numerals, three terse lines each.

import { XRATED_BRAND } from "@/lib/xratedTrades";

const STEPS = [
  {
    n: "1",
    title: "Search or post",
    body: "Browse trades or post a job in 60 seconds. No sign-up to look around."
  },
  {
    n: "2",
    title: "WhatsApp direct",
    body: "Message the tradie or get pinged when a customer needs you. No middleman."
  },
  {
    n: "3",
    title: "Get the job done",
    body: "Agree the work, the date, and the price. We keep the directory free."
  }
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 md:py-16">
      <p
        className="text-xs font-bold uppercase tracking-[0.18em]"
        style={{ color: XRATED_BRAND.accent }}
      >
        How it works
      </p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl">
        Three steps. Free for life.
      </h2>

      <ol className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="rounded-2xl border border-neutral-200 bg-white p-5 md:p-6"
          >
            <div
              className="text-5xl font-black leading-none tracking-tight md:text-6xl"
              style={{ color: XRATED_BRAND.accent }}
            >
              {s.n}
            </div>
            <h3 className="mt-3 text-lg font-bold text-neutral-900 md:text-xl">
              {s.title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500 md:text-sm">
              {s.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default HowItWorks;
