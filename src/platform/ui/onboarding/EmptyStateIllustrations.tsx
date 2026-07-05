// EmptyStateIllustrations — named SVG illustrations for empty states.
//
// Reference: Vercel Design + HyperUI empty-state blocks. Rewritten
// as native SVG components using our token colours (amber-400
// accent, neutral scale).
//
// Named — not generic — so each empty state has identity in the app.
// Sized 200×160 by default: fits above-the-fold on 375px mobile.

import type { SVGProps } from "react";

const BASE_PROPS: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 200 160",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  className: "h-32 w-40 md:h-40 md:w-52"
};

// ─── NoLeadsIllustration ────────────────────────────────────
export function NoLeadsIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <ellipse cx="100" cy="140" rx="60" ry="6" className="fill-neutral-100" />
      <rect x="52" y="42" width="96" height="72" rx="10" className="fill-white stroke-neutral-200" strokeWidth={2} />
      <path d="M52 52l48 34 48-34" className="stroke-neutral-300" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="148" cy="42" r="14" className="fill-amber-400" />
      <path d="M148 34v16M140 42h16" className="stroke-neutral-900" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}

// ─── NoProjectsIllustration ─────────────────────────────────
export function NoProjectsIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <ellipse cx="100" cy="140" rx="60" ry="6" className="fill-neutral-100" />
      <rect x="46" y="52" width="46" height="60" rx="6" className="fill-neutral-200" />
      <rect x="98" y="70" width="46" height="42" rx="6" className="fill-neutral-100 stroke-neutral-200" strokeWidth={2} strokeDasharray="4 4" />
      <circle cx="72" cy="74" r="8" className="fill-amber-400" />
      <path d="M56 100l14-12 14 12" className="stroke-neutral-400" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M117 96v-8M113 92h8" className="stroke-neutral-400" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

// ─── NoReviewsIllustration ──────────────────────────────────
export function NoReviewsIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <ellipse cx="100" cy="140" rx="60" ry="6" className="fill-neutral-100" />
      <path
        d="M100 44l7 20h20l-16 12 6 20-17-12-17 12 6-20-16-12h20z"
        className="fill-amber-400"
      />
      <path
        d="M60 90l3 8h8l-6 5 2 8-7-5-7 5 2-8-6-5h8z"
        className="fill-neutral-200"
      />
      <path
        d="M140 90l3 8h8l-6 5 2 8-7-5-7 5 2-8-6-5h8z"
        className="fill-neutral-200"
      />
    </svg>
  );
}

// ─── AllDoneIllustration ────────────────────────────────────
export function AllDoneIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <ellipse cx="100" cy="140" rx="60" ry="6" className="fill-neutral-100" />
      <circle cx="100" cy="80" r="32" className="fill-emerald-100" />
      <circle cx="100" cy="80" r="24" className="fill-emerald-500" />
      <path
        d="M88 82l8 8 16-18"
        className="stroke-white"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="150" cy="50" r="4" className="fill-amber-300" />
      <circle cx="52" cy="62" r="3" className="fill-amber-300" />
      <circle cx="146" cy="98" r="3" className="fill-amber-300" />
    </svg>
  );
}

// ─── WelcomeIllustration ────────────────────────────────────
export function WelcomeIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <ellipse cx="100" cy="140" rx="60" ry="6" className="fill-neutral-100" />
      <rect x="40" y="52" width="60" height="60" rx="8" className="fill-white stroke-neutral-200" strokeWidth={2} />
      <rect x="100" y="42" width="60" height="70" rx="8" className="fill-neutral-900" />
      <circle cx="130" cy="66" r="10" className="fill-amber-400" />
      <path d="M110 92h40" className="stroke-neutral-600" strokeWidth={2} strokeLinecap="round" />
      <path d="M110 100h28" className="stroke-neutral-700" strokeWidth={2} strokeLinecap="round" />
      <path d="M50 70h40" className="stroke-neutral-200" strokeWidth={2} strokeLinecap="round" />
      <path d="M50 80h32" className="stroke-neutral-100" strokeWidth={2} strokeLinecap="round" />
      <path d="M50 90h36" className="stroke-neutral-100" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

// ─── NoMessagesIllustration ─────────────────────────────────
export function NoMessagesIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <ellipse cx="100" cy="140" rx="60" ry="6" className="fill-neutral-100" />
      <path
        d="M50 60c0-6 5-10 10-10h80c6 0 10 4 10 10v40c0 6-4 10-10 10h-56l-16 14v-14h-8c-5 0-10-4-10-10z"
        className="fill-white stroke-neutral-200"
        strokeWidth={2}
      />
      <circle cx="82" cy="80" r="3" className="fill-neutral-300" />
      <circle cx="100" cy="80" r="3" className="fill-neutral-300" />
      <circle cx="118" cy="80" r="3" className="fill-neutral-300" />
    </svg>
  );
}
