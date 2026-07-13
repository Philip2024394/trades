// Platform Apps — barrel.
//
// Every App on the platform is imported here so its manifest
// self-registers with the App Registry at module load. Two shapes exist:
//   • apps with a barrel `index.ts` — import "@/apps/<name>"
//   • apps that only ship `manifest.ts` — import "@/apps/<name>/manifest"
//
// If you add a new App directory, add its import here. Directories
// without a `manifest.ts` (before-after, hero-swap, live-edit) are
// helper packages and are excluded on purpose.

// Barrel-shaped apps (have an index.ts that re-exports the manifest)
import "@/apps/meet-the-team";
import "@/apps/newsletter";
import "@/apps/trade-connections";

// Manifest-only apps — imported at the manifest path directly.
import "@/apps/live-feed/manifest";
import "@/apps/reviews/manifest";
import "@/apps/crm/manifest";
import "@/apps/job-diary/manifest";
import "@/apps/quote-workspace/manifest";
import "@/apps/products/manifest";
import "@/apps/ai-visualiser/manifest";

// Calculator suite — the App Warehouse core for materials estimation.
import "@/apps/calc-bricks/manifest";
import "@/apps/calc-concrete/manifest";
import "@/apps/calc-decking/manifest";
import "@/apps/calc-delivery/manifest";
import "@/apps/calc-fencing/manifest";
import "@/apps/calc-flooring/manifest";
import "@/apps/calc-gravel/manifest";
import "@/apps/calc-insulation/manifest";
import "@/apps/calc-mortar/manifest";
import "@/apps/calc-paint/manifest";
import "@/apps/calc-paving/manifest";
import "@/apps/calc-plasterboard/manifest";
import "@/apps/calc-plastering/manifest";
import "@/apps/calc-render/manifest";
import "@/apps/calc-roof-tiles/manifest";
import "@/apps/calc-skirting/manifest";
import "@/apps/calc-tiles/manifest";
import "@/apps/calc-turf/manifest";
import "@/apps/calc-wallpaper/manifest";

export {};
