// ApprenticeshipBanner — three variants of the recruitment banner
// used across the platform.
//
//   variant="right-cta"    — big image with a floating right-side
//                            'Learn More' or 'Apply Today' pill.
//                            Used on hubs (/apprenticeships, /careers).
//
//   variant="button-under" — image + caption + a full-width button
//                            below. Used on success + confirmation
//                            surfaces, and on Yard + Canteen side rail.
//
//   variant="start-free"   — image already has 'start free' burned in.
//                            The whole thing is a link to
//                            /apprenticeships/apply. Do not add copy.
//
// All three images live in scripts/hero-library.json under
// sibling_group_id "apprenticeship-recruitment". Never hard-code the
// URLs elsewhere — import this component.

import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";

const IMG_RIGHT_CTA  = "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2006_04_23%20AM.png";
const IMG_BUTTON_UNDER = "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2006_03_37%20AM.png";
const IMG_START_FREE = "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2006_02_25%20AM.png";

type CtaHref = "/apprenticeships/apply" | "/apprenticeships" | "/careers";

type Props = {
  variant:  "right-cta" | "button-under" | "start-free";
  /** CTA label — only used by right-cta + button-under. Ignored on start-free. */
  ctaLabel?: string;
  /** CTA target. Defaults sensibly per variant. */
  href?:    CtaHref;
  /** Caption line under the image on button-under variant. */
  caption?: string;
  /** Compact mode — shrinks padding + text for side-rail placements. */
  compact?: boolean;
  className?: string;
};

export function ApprenticeshipBanner({
  variant, ctaLabel, href, caption, compact, className
}: Props) {
  if (variant === "start-free") {
    return (
      <Link
        href={href ?? "/apprenticeships/apply"}
        className={`group block overflow-hidden rounded-2xl border-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${className ?? ""}`}
        style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}
        aria-label="Apply for an apprenticeship — free"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={IMG_START_FREE}
          alt="Start a UK trade apprenticeship free — The Networkers supports UK trade youth"
          className="h-auto w-full object-cover"
          loading="lazy"
        />
      </Link>
    );
  }

  if (variant === "right-cta") {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl border-2 shadow-sm ${className ?? ""}`}
        style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={IMG_RIGHT_CTA}
          alt="UK trade apprenticeships — verified local trades hiring 16+ candidates"
          className="h-auto w-full object-cover"
          loading="lazy"
        />
        {/* Right-side floating CTA */}
        <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center ${compact ? "pr-3" : "pr-4 md:pr-8"}`}>
          <Link
            href={href ?? "/apprenticeships/apply"}
            className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-lg font-black uppercase tracking-wider text-neutral-900 shadow-md active:scale-[0.97] ${compact ? "h-9 px-3 text-[10.5px]" : "h-11 px-5 text-[11.5px]"}`}
            style={{ backgroundColor: "#FFB300" }}
          >
            <Sparkles size={compact ? 11 : 13} strokeWidth={2.6}/>
            {ctaLabel ?? "Apply today"}
            <ArrowUpRight size={compact ? 11 : 13} strokeWidth={2.6}/>
          </Link>
        </div>
      </div>
    );
  }

  // variant === "button-under"
  return (
    <div className={className}>
      <div
        className="overflow-hidden rounded-2xl border-2 shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={IMG_BUTTON_UNDER}
          alt="You're on your way — The Networkers supports UK trade youth"
          className="h-auto w-full object-cover"
          loading="lazy"
        />
      </div>
      {caption && (
        <p className={`mt-3 text-center font-black text-neutral-800 ${compact ? "text-[12px]" : "text-[13.5px]"}`}>
          {caption}
        </p>
      )}
      <div className="mt-3 flex justify-center">
        <Link
          href={href ?? "/apprenticeships/apply"}
          className={`inline-flex items-center gap-1.5 rounded-lg font-black uppercase tracking-wider text-neutral-900 shadow-md active:scale-[0.97] ${compact ? "h-9 px-4 text-[10.5px]" : "h-11 px-5 text-[11.5px]"}`}
          style={{ backgroundColor: "#FFB300" }}
        >
          <Sparkles size={compact ? 11 : 13} strokeWidth={2.6}/>
          {ctaLabel ?? "Apply today"}
          <ArrowUpRight size={compact ? 11 : 13} strokeWidth={2.6}/>
        </Link>
      </div>
    </div>
  );
}
