// SiteBook banner library — presets the homeowner can pick from
// when they tap Edit banner on the hero.
//
// All images are either owner-uploaded, AI-generated, or licensed
// stock (per feedback_image_copyright_risk_rules). No metadata-
// scrubbing to launder rights.
//
// This set is Philip's 2026-07-19 ChatGPT-generated construction
// imagery — brand-consistent with the rest of the platform. Rename
// labels after previewing each one. Vibes rotated across categories
// so the picker has variety; rebalance once each image's content is
// confirmed.
//
// FOLLOW-UP INTEGRATIONS (not yet wired):
//   • Hero library (`scripts/hero-library.json`) — record each entry
//     with keywords/vibe/theme_palette per the schema. Requires visual
//     inspection to fill keywords_strict.
//   • Site Interest catalog — expose the same URLs as licensable
//     hero-image assets. Wait until Site Interest DB shape is finalised.
//   • For-sale surface — surface a subset as free-standing hero
//     images homeowners can buy for their own listings elsewhere.

export type SiteBookBanner = {
  id:          string;
  label:       string;             // human-readable name
  url:         string;             // full-size image URL
  thumbUrl:    string;             // small preview for the picker grid
  vibe:        BannerVibe;
};

export type BannerVibe =
  | "traditional"      // cottage / rectory / period property
  | "modern"           // glass / new-build / contemporary
  | "renovation"       // kitchens / bathrooms / interiors in progress
  | "exterior"         // gardens / driveways / landscaping
  | "trade";           // building sites / tools / trades at work

const IK = "https://ik.imagekit.io/9huhxxvtr";
const thumb = (path: string) => `${IK}/tr:w-400,h-160,f-auto,q-80,fo-auto${path}`;
const full  = (path: string) => `${IK}${path}`;

// 12 ChatGPT-generated construction banners — 2026-07-19 batch.
// Filenames encoded as URL path so thumb transforms work cleanly.
const B = [
  { id: "sb-2026-07-19-0748", path: "/ChatGPT%20Image%20Jul%2019,%202026,%2007_48_05%20AM.png", label: "Homeowner build A", vibe: "renovation"  as const },
  { id: "sb-2026-07-19-0743", path: "/ChatGPT%20Image%20Jul%2019,%202026,%2007_43_00%20AM.png", label: "Homeowner build B", vibe: "traditional" as const },
  { id: "sb-2026-07-19-0740", path: "/ChatGPT%20Image%20Jul%2019,%202026,%2007_40_14%20AM.png", label: "Homeowner build C", vibe: "modern"      as const },
  { id: "sb-2026-07-19-0738", path: "/ChatGPT%20Image%20Jul%2019,%202026,%2007_38_26%20AM.png", label: "Homeowner build D", vibe: "trade"       as const },
  { id: "sb-2026-07-19-0737", path: "/ChatGPT%20Image%20Jul%2019,%202026,%2007_37_32%20AM.png", label: "Homeowner build E", vibe: "exterior"    as const },
  { id: "sb-2026-07-19-0736", path: "/ChatGPT%20Image%20Jul%2019,%202026,%2007_36_29%20AM.png", label: "Homeowner build F", vibe: "renovation"  as const },
  { id: "sb-2026-07-19-0735", path: "/ChatGPT%20Image%20Jul%2019,%202026,%2007_35_39%20AM.png", label: "Homeowner build G", vibe: "traditional" as const },
  { id: "sb-2026-07-19-0733", path: "/ChatGPT%20Image%20Jul%2019,%202026,%2007_33_37%20AM.png", label: "Homeowner build H", vibe: "modern"      as const },
  { id: "sb-2026-07-19-0730", path: "/ChatGPT%20Image%20Jul%2019,%202026,%2007_30_45%20AM.png", label: "Homeowner build I", vibe: "trade"       as const },
  { id: "sb-2026-07-19-0727", path: "/ChatGPT%20Image%20Jul%2019,%202026,%2007_27_16%20AM.png", label: "Homeowner build J", vibe: "exterior"    as const },
  { id: "sb-2026-07-19-0725", path: "/ChatGPT%20Image%20Jul%2019,%202026,%2007_25_36%20AM.png", label: "Homeowner build K", vibe: "renovation"  as const },
  { id: "sb-2026-07-19-0725a",path: "/ChatGPT%20Image%20Jul%2019,%202026,%2007_25_05%20AM.png", label: "Homeowner build L", vibe: "traditional" as const }
];

export const SITEBOOK_BANNERS: SiteBookBanner[] = B.map((b) => ({
  id:       b.id,
  label:    b.label,
  vibe:     b.vibe,
  url:      full(b.path),
  thumbUrl: thumb(b.path)
}));

export const VIBE_LABEL: Record<BannerVibe, string> = {
  traditional: "Traditional",
  modern:      "Modern",
  renovation:  "Renovation",
  exterior:    "Exterior",
  trade:       "Trade site"
};
