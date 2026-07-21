// Overlay library — types, category catalogue, and default badges
// for the Site Editor's Overlays drawer.
//
// SCOPE — these badges are EDITOR-ONLY. They ship exclusively inside
// the /site/editor Overlays drawer and are never surfaced anywhere
// else in the app (not the Canteen, Yard, wall, or any other feed).
//
// Sources:
//   • Default catalogue (EDITOR_BADGES below) — curated AI-generated
//     scene badges the merchant can drop straight onto a composition.
//     Files live at social-media/editor-badges/<slug>.webp.
//   • User uploads — persisted in hammerex_site_editor_overlays and
//     fetched at drawer-open time via /api/site/editor/overlays.
//     Rendered under the "My uploads" category.
//
// The drawer merges both lists client-side. Default badges get
// isMine=false so the delete affordance doesn't render on them.

const CDN = "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/social-media/editor-badges";
const cdn = (slug: string): string => `${CDN}/${slug}.webp`;

export type OverlayGroup =
  | "hero"          // headline scene badges (curated defaults)
  | "promo"
  | "cta"
  | "trust"
  | "status"
  | "job"
  | "price"
  | "banner"
  | "custom";       // user uploads

export type Overlay = {
  id:           string;
  label:        string;
  group:        OverlayGroup;
  /** Public URL of the asset — hosted on Supabase Storage. */
  url:          string;
  /** width/height ratio for initial layer sizing. */
  aspectRatio?: number;
  /** True when this overlay is owned by the caller (drawer shows a
   *  small delete affordance next to it). */
  isMine?:      boolean;
};

/** Curated default badges bundled with the editor. Every one lives
 *  under the "hero" group so the drawer opens on them first. */
export const EDITOR_BADGES: Overlay[] = [
  { id: "check-this-out",     label: "Check this out",     group: "hero", url: cdn("check-this-out"),     aspectRatio: 1.5 },
  { id: "new-product-update", label: "New product update", group: "hero", url: cdn("new-product-update"), aspectRatio: 1.5 },
  { id: "join-us-updates",    label: "Join us for updates",group: "hero", url: cdn("join-us-updates"),    aspectRatio: 1.5 },
  { id: "no-way",             label: "No way!",            group: "hero", url: cdn("no-way"),             aspectRatio: 1.5 },
  { id: "discounted",         label: "Discounted",         group: "hero", url: cdn("discounted"),         aspectRatio: 1.5 },
  { id: "1000-followers",     label: "1000 followers",     group: "hero", url: cdn("1000-followers"),     aspectRatio: 1.5 }
];

/** Category chips in the drawer toggle strip. Order = display order.
 *  Hero (curated defaults) sits first so a merchant sees something
 *  to click the moment they open the drawer. */
export const OVERLAY_GROUPS: Array<{ slug: OverlayGroup; label: string }> = [
  { slug: "hero",   label: "Editor picks"   },
  { slug: "promo",  label: "Promo"          },
  { slug: "cta",    label: "Call to action" },
  { slug: "trust",  label: "Trust"          },
  { slug: "status", label: "Status"         },
  { slug: "job",    label: "Job"            },
  { slug: "price",  label: "Price"          },
  { slug: "banner", label: "Banner"         },
  { slug: "custom", label: "My uploads"     }
];
