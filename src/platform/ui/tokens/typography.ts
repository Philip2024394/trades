// Typography scale — mobile-first responsive text sizes.
//
// Every text style scales UP on wider viewports. Never scale DOWN
// from a big-screen design onto mobile.

/** Display text — hero headlines. */
export const TYPE_DISPLAY = "text-[22px] leading-[1.15] font-bold sm:text-3xl md:text-5xl md:leading-tight";

/** Page title — one per page. */
export const TYPE_H1 = "text-2xl font-bold text-neutral-900 md:text-3xl";

/** Section heading — appears within a page. */
export const TYPE_H2 = "text-xl font-bold text-neutral-900 md:text-2xl";

/** Card title. */
export const TYPE_H3 = "text-[15px] font-semibold text-neutral-900 md:text-[17px]";

/** Compact card title (dense mobile grids). */
export const TYPE_H4 = "text-[12px] font-semibold leading-tight text-neutral-900 md:text-[15px]";

/** Body text — long-form content. */
export const TYPE_BODY = "text-[14px] leading-relaxed text-neutral-700 md:text-[15px]";

/** Small supporting text. */
export const TYPE_SUPPORTING = "text-[13px] text-neutral-600";

/** Meta text — captions, timestamps, tags. Minimum 12px per WCAG. */
export const TYPE_META = "text-[12px] text-neutral-500";

/** Micro text — badges only. Never for reading copy. */
export const TYPE_MICRO = "text-[11px] font-medium uppercase tracking-wide text-neutral-500";

/** Overline — small label above a heading. */
export const TYPE_OVERLINE = "text-[11px] font-semibold uppercase tracking-wide text-neutral-500";

/** Button label — 13px mobile, 14px desktop. */
export const TYPE_BUTTON = "text-[13px] font-semibold md:text-[14px]";

/** Chip label. */
export const TYPE_CHIP = "text-[11px] font-medium";
