// EmergencyHero — 24/7 badge + response-time promise + Call Now hero.
//
// The hero for emergency plumbers, electricians, locksmiths — trades
// where seconds matter and the first fold has to convert to a phone
// call.

import { AlertTriangle, Clock, Phone } from "lucide-react";
import { Button } from "../primitives/Button";

export type EmergencyHeroProps = {
  headline: string;
  subheadline?: string;
  /** e.g. "within 60 minutes" — the promise that turns urgency into
   *  a phone call. */
  responseTime?: string;
  phoneNumber: string;
  phoneLabel?: string;
  bookVisitLabel?: string;
  bookVisitHref?: string;
  /** e.g. "Covering Dublin · Cork · Galway 24/7". */
  areaCoverage?: string;
};

export function EmergencyHero({
  headline,
  subheadline,
  responseTime,
  phoneNumber,
  phoneLabel = "Call Now",
  bookVisitLabel = "Book Emergency Visit",
  bookVisitHref = "#contact",
  areaCoverage
}: EmergencyHeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-red-900 via-red-800 to-neutral-900 text-white">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_theme(colors.red.500)_0%,_transparent_50%)]" />
      </div>
      <div className="relative mx-auto max-w-3xl px-4 py-12 text-center md:py-20">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-100">
          <AlertTriangle className="h-3 w-3" />
          24/7 Emergency Service
        </div>
        <h1 className="text-[26px] font-bold leading-tight sm:text-4xl md:text-5xl">
          {headline}
        </h1>
        {subheadline ? (
          <p className="mx-auto mt-3 max-w-2xl text-[14px] leading-relaxed text-red-100 md:mt-4 md:text-[17px]">
            {subheadline}
          </p>
        ) : null}
        {responseTime ? (
          <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur">
            <Clock className="h-3.5 w-3.5 text-amber-300" />
            On site {responseTime}
          </div>
        ) : null}
        <div className="mx-auto mt-6 flex max-w-md flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
          <Button
            href={`tel:${phoneNumber.replace(/\s/g, "")}`}
            intent="danger"
            size="lg"
            icon={Phone}
            className="!bg-white !text-red-700 hover:!bg-red-50"
          >
            {phoneLabel}
          </Button>
          <Button
            href={bookVisitHref}
            intent="secondary"
            size="lg"
            className="border-white/30 bg-transparent text-white hover:bg-white/10"
          >
            {bookVisitLabel}
          </Button>
        </div>
        {areaCoverage ? (
          <p className="mt-5 text-[11px] text-red-200">{areaCoverage}</p>
        ) : null}
      </div>
    </section>
  );
}
