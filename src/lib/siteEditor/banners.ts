// Banner library — small squares (200×200-ish) and tall verticals
// (200×600-ish) the editor drops as ready-made call-out strips.
// Same inline-SVG data-URL approach as overlays.ts.

import type { NetworkSlug } from "./frames";

export type BannerShape = "small-square" | "tall-strip";

export type Banner = {
  id:      string;
  label:   string;
  shape:   BannerShape;
  svg:     string;
  /** Which networks this banner is intended for — drives the
   *  BannerDrawer network-filter toggle. Squares suit feed grids
   *  (IG/FB/Networkers Canteen); talls suit vertical stories +
   *  short-form video (IG/FB/TikTok/Snap). */
  networks: NetworkSlug[];
};

function squareBanner(text: string, bg: string, fg: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'>
    <rect width='200' height='200' rx='16' fill='${bg}'/>
    <text x='100' y='105' font-family='system-ui, sans-serif' font-size='18' font-weight='900' text-anchor='middle' fill='${fg}' letter-spacing='1'>${text.toUpperCase()}</text>
    <text x='100' y='128' font-family='system-ui, sans-serif' font-size='11' text-anchor='middle' fill='${fg}' opacity='0.7'>thenetworkers.app</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function tallBanner(text: string, bg: string, fg: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='600' viewBox='0 0 200 600'>
    <rect width='200' height='600' rx='16' fill='${bg}'/>
    <g transform='translate(100 300) rotate(-90)'>
      <text x='0' y='0' font-family='system-ui, sans-serif' font-size='26' font-weight='900' text-anchor='middle' fill='${fg}' letter-spacing='2'>${text.toUpperCase()}</text>
    </g>
    <text x='100' y='580' font-family='system-ui, sans-serif' font-size='10' text-anchor='middle' fill='${fg}' opacity='0.6'>thenetworkers.app</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const FEED_NETS:  NetworkSlug[] = ["instagram", "facebook", "networkers"];
const STORY_NETS: NetworkSlug[] = ["instagram", "facebook", "tiktok", "snapchat"];

export const BANNER_LIBRARY: Banner[] = [
  // Small squares (feed placements)
  { id: "sq-quote",    label: "Get a quote",     shape: "small-square", networks: FEED_NETS,  svg: squareBanner("Get a quote",       "#0A0A0A", "#FFB300") },
  { id: "sq-verified", label: "Verified trade",  shape: "small-square", networks: FEED_NETS,  svg: squareBanner("Verified trade",    "#166534", "#FFFFFF") },
  { id: "sq-new",      label: "New job",         shape: "small-square", networks: FEED_NETS,  svg: squareBanner("New job on site",   "#B91C1C", "#FFFFFF") },
  { id: "sq-book",     label: "Book now",        shape: "small-square", networks: FEED_NETS,  svg: squareBanner("Book now",          "#FFB300", "#0A0A0A") },
  // Tall strips (story / short-form placements)
  { id: "tall-quote",  label: "Quote strip",     shape: "tall-strip",   networks: STORY_NETS, svg: tallBanner  ("Get a free quote",  "#0A0A0A", "#FFB300") },
  { id: "tall-book",   label: "Book strip",      shape: "tall-strip",   networks: STORY_NETS, svg: tallBanner  ("Book this trade",   "#FFB300", "#0A0A0A") },
  { id: "tall-network",label: "Network strip",   shape: "tall-strip",   networks: [...STORY_NETS, "networkers"], svg: tallBanner("The Networkers", "#166534", "#FFFFFF") }
];
