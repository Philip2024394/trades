// SiteBook App Store — manifest types.
//
// Every installable SiteBook app declares a manifest. The registry
// aggregates them; /sitebook renders installed apps by slot; the
// App Store page reads them for the grid.
//
// Rules:
//   • Manifest is the ONLY source of truth for slot placement, cost,
//     copy, icon, category. Do NOT hard-code any of this in /sitebook.
//   • Adding a new app = adding a new folder + a new registry entry.
//     No changes required to the runtime.
//   • Removing an app from the registry hides it from the App Store
//     but does NOT delete anyone's installed row — data survives.

export type SiteBookAppSlug =
  | "project-cost"        // v1: the first app — the current Project Cost tile
  | "photo-library"
  | "cost-ledger"
  | "documents"
  | "home-care"
  | "snag-list"
  | "warranty-vault";

export type SiteBookAppSlot =
  | "left-rail"        // rendered in the left column, stacked below the inbox
  | "right-rail"       // rendered in the right column, stacked below the profile
  | "composer-chip"    // adds a toolbar chip to the composer
  | "composer-row"     // inflated row when the chip is tapped
  | "feed-inline"      // renders inline within a post card
  | "full-page";       // owns a ?view= URL slug

export type SiteBookAppCategory =
  | "essential"
  | "money"
  | "quality"
  | "maintenance"
  | "reports";

export type SiteBookAppCost =
  | { kind: "free" }
  | { kind: "monthly"; pence: number }
  | { kind: "one-off"; pence: number };

export type SiteBookAppManifest = {
  slug:               SiteBookAppSlug;
  name:               string;
  shortName?:         string;
  description:        string;                // one line for the App Store card
  longDescription?:   string;                // shown in the "Preview" panel
  icon:               string;                // lucide-react component name
  brandColour?:       string;                // small accent used on the card
  category:           SiteBookAppCategory;
  cost:               SiteBookAppCost;

  /** When true, every homeowner has this app auto-installed on
   *  first-time /sitebook visit. */
  defaultInstalled?:  boolean;

  slots:              { slot: SiteBookAppSlot; order?: number }[];

  /** Slugs of other apps this one depends on. If any dependency is
   *  missing, the App Store card shows a note + installs deps
   *  transitively when the user installs this one. */
  dependsOn?:         SiteBookAppSlug[];

  /** Free-text badges shown on the App Store card ("New", "Popular",
   *  "Beta"). No behavioural impact. */
  badges?:            string[];
};

export function formatCost(cost: SiteBookAppCost): string {
  if (cost.kind === "free")    return "Free";
  if (cost.kind === "monthly") return `£${(cost.pence / 100).toFixed(2)}/mo`;
  return `£${(cost.pence / 100).toFixed(2)} once`;
}
