# SiteBook Apps — architecture sketch

Author: Philip · 2026-07-19
Status: design proposal · nothing built yet
Owner: `/sitebook` homeowner surface

Follow-up to the "strip SiteBook to a simple core + add-on apps" thesis.
Mirrors the existing merchant-side platform pattern (`src/platform/runtime/`
+ `src/apps/<slug>/manifest.ts`) applied to homeowners.

## Constitutional rules this must obey

1. **Every App is manifest-first** (per `feedback_platform_apps_manifest_first`).
2. **Runtime is authoritative; the SDK is a thin adapter** (per `feedback_platform_runtime_vs_sdk`).
3. **Extend the platform. Don't duplicate.** (per `project_extend_dont_duplicate_permanent_rule`).
4. **Rule 3 · Hide, don't delete** (per SITEBOOK_BLUEPRINT_v2_2). Un-installed apps stay in the repo; their data survives.
5. **Every paid app clears Stripe margin both directions** (per ADR-0010).

## The three tiers

| Tier | Removable? | Renders |
|---|---|---|
| **Core** | never | Feed · Composer (Update + New project) · Trades panel · Profile card |
| **Default-installed** | yes | Photo Library (universal value — every homeowner takes photos) |
| **App Store** | yes | Cost, Ledger, Documents, Home Care, Snag, Warranty Vault, AI |

## Directory shape

```
src/apps/sitebook/
  photo-library/
    manifest.ts       # slug, name, icon, price, slots
    server.ts         # loader — runs server-side
    card.tsx          # left-rail component ("use client" if interactive)
    composer-row.tsx  # optional inflated composer row
    README.md
  cost-ledger/
    manifest.ts
    server.ts
    card.tsx
    composer-row.tsx  # "£" chip inflates this
    ledger.tsx        # full-page view at /sitebook?view=costs
  home-care/
    manifest.ts
    server.ts
    card.tsx
    composer-row.tsx  # 🏠 chip inflates this
  documents/
    manifest.ts
    server.ts
    inline-thumbs.tsx # renders under each cost row when installed
  snag-list/
    manifest.ts
    server.ts
    card.tsx
    composer-row.tsx  # 🔧 chip inflates this
  warranty-vault/
    manifest.ts
    server.ts
    export.tsx        # £9.99 one-off purchase flow
```

Each app owns its files. Uninstalling = flip a row in `hammerex_homeowner_apps`. Nothing is deleted from the repo.

## Manifest shape

```ts
// src/apps/sitebook/_shared/manifest.ts
export type SiteBookAppSlug =
  | "photo-library"
  | "cost-ledger"
  | "cost-summary"
  | "documents"
  | "home-care"
  | "snag-list"
  | "warranty-vault";

export type SiteBookAppSlot =
  | "left-rail"        // rendered in the left column, stacked
  | "right-rail"       // rendered in the right column, stacked
  | "composer-chip"    // adds a toolbar chip to the composer
  | "composer-row"     // inflated row when the chip is tapped
  | "feed-inline"      // renders inline within a post card
  | "full-page";       // owns a ?view= slug

export type SiteBookAppManifest = {
  slug:          SiteBookAppSlug;
  name:          string;                 // "Photo Library"
  shortName?:    string;                 // "Photos"
  description:   string;                 // one line for the App Store card
  icon:          string;                 // lucide-react name
  category:      "essential" | "money" | "quality" | "maintenance" | "reports";
  cost:          "free" | { monthlyPence: number } | { onePence: number };
  defaultInstalled?: boolean;            // photo-library only, initially

  slots: {
    slot:      SiteBookAppSlot;
    componentPath: string;               // relative to app dir, e.g. "./card"
    order?:    number;                   // sort within slot
  }[];

  server?: {
    loaderPath: string;                  // "./server" — exports load(homeownerId)
  };

  dependsOn?: SiteBookAppSlug[];         // documents dependsOn cost-ledger
  monetization?: {
    tierGate?: "free" | "starter" | "pro" | "business";
    stripeProduct?: string;              // for one-off purchases
  };
};
```

## Registry

```ts
// src/apps/sitebook/registry.ts
import photoLibrary  from "./photo-library/manifest";
import costSummary   from "./cost-summary/manifest";
import costLedger    from "./cost-ledger/manifest";
import documents     from "./documents/manifest";
import homeCare      from "./home-care/manifest";
import snagList      from "./snag-list/manifest";
import warrantyVault from "./warranty-vault/manifest";

export const SITEBOOK_APPS: Record<SiteBookAppSlug, SiteBookAppManifest> = {
  "photo-library":   photoLibrary,
  "cost-summary":    costSummary,
  "cost-ledger":     costLedger,
  documents:         documents,
  "home-care":       homeCare,
  "snag-list":       snagList,
  "warranty-vault":  warrantyVault
};
```

## Storage

```sql
-- hammerex_homeowner_apps · one row per (homeowner × installed app)
CREATE TABLE IF NOT EXISTS public.hammerex_homeowner_apps (
  homeowner_id   UUID NOT NULL REFERENCES public.hammerex_homeowners(id) ON DELETE CASCADE,
  app_slug       TEXT NOT NULL,
  installed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settings       JSONB,                    -- per-app UI prefs (order in rail, colours, etc.)
  PRIMARY KEY (homeowner_id, app_slug)
);

CREATE INDEX idx_homeowner_apps_slug ON public.hammerex_homeowner_apps (app_slug);
```

Uninstalled = row absent. Reinstalled = row returns; settings JSON persists across re-installs so history isn't lost.

## Runtime — `/sitebook` render flow

```
1. Server: load homeowner + core data (projects, posts, inbox).
2. Server: SELECT * FROM hammerex_homeowner_apps WHERE homeowner_id = ?
   → set of installed app slugs.
3. Server: for each installed app with a server.loaderPath, run its loader
   in parallel (like the existing Promise.all in /sitebook/page.tsx).
4. Server: render CORE panels first (Feed / Composer / Trades / Profile).
5. Server: for each app slot ("left-rail", "right-rail", "composer-chip",
   "feed-inline"), look up the components and render them in order.
6. Client: composer picks up "composer-chip" apps to build its toolbar and
   "composer-row" apps for the inflated rows.
```

Zero hard-coded references in the page. Adding/removing an app = adding/removing a manifest and a row in the DB.

## Contextual install prompts

Never nag; suggest at the right moment. Event-driven:

| Trigger | Suggested app |
|---|---|
| Homeowner sent first WhatsApp to a trade | Cost Summary (free) |
| Cost logged for first time | Cost Ledger + Documents |
| Trade posted "job complete" | Warranty Vault |
| Boiler / gutter / roof mentioned in a post | Home Care |
| 5+ photos uploaded across posts | (photo-library is default; skip) |
| Snag reported via WhatsApp scan | Snag List |

Each prompt is a subtle chip on the relevant surface, never a modal.

## App Store page — `/sitebook/apps`

Grid of manifest cards:
- Icon + name + one-line description
- Price chip (`Free` / `£4.99/mo` / `£9.99 once`)
- Install / Uninstall pill
- "Preview" opens a screenshot / short GIF of the app

Categories: Essential · Money · Quality · Maintenance · Reports.

## Migration path from what exists today

Rule: **no code deleted, no data lost**. What we have today becomes the first set of app modules:

| Today's component | New location |
|---|---|
| `SiteBookGalleryCard` | `src/apps/sitebook/photo-library/card.tsx` |
| `ProjectCostCard` | `src/apps/sitebook/cost-summary/card.tsx` |
| `CostLedgerView` | `src/apps/sitebook/cost-ledger/ledger.tsx` |
| `CostDocumentUpload/Thumbs` | `src/apps/sitebook/documents/` |
| `HomeCareCard` | `src/apps/sitebook/home-care/card.tsx` |
| `ThingsToFixCard` | `src/apps/sitebook/snag-list/card.tsx` |
| Composer £/📎/🔧/🏠/🏗️ rows | each app's `composer-row.tsx` |
| `UnifiedPostComposer` | trimmed to core (Update / New project only); toolbar chips fed by installed apps |

Existing tables + APIs stay. Only new code = the registry + install/uninstall + `/sitebook/apps` page.

## Sequencing (what to build first, in order)

1. **Migration** — `hammerex_homeowner_apps` table (5 min)
2. **Registry + types** — `src/apps/sitebook/registry.ts` + `_shared/manifest.ts` (30 min)
3. **7 manifest files** — one per app, initially with hard-coded slot info (1 hr)
4. **Runtime loader** — `loadInstalledApps(homeownerId)` + slot rendering helper (2 hr)
5. **Strip `/sitebook`** — core panels only, then render installed apps by slot (3 hr)
6. **App Store page** — grid + install/uninstall (3 hr)
7. **Onboarding** — first-run modal suggesting default apps (1 hr)
8. **Contextual prompts** — event-driven install nudges (spread over next few sessions)

Total: ~10 hours of engineering to ship v1 of the app model. Everything already built survives, just gated by manifest.

## What NOT to build

- Third-party SDK. Only first-party apps for now.
- Cross-app event bus for homeowners. Later — all apps read the same DB tables directly.
- Per-app permissions for trades viewing an owner's SiteBook. v1 = homeowner-only.
- Marketplace / rating system for apps. Later.

## Open questions for Philip

1. **Is Photo Library the only default-installed app**, or would you add Cost Summary + Home Care (both free) as defaults too? Trade-off: more defaults = more perceived value / more decisions to un-check.
2. **Should the App Store live at `/sitebook/apps` or as a slide-in panel from `/sitebook`?** Slide-in feels closer to the "single door" thesis.
3. **Uninstall behaviour**: does uninstalling Cost Ledger hide the tile only, or also stop logging new costs from the composer chip? Recommend: hide + disable the composer chip, but keep old data queryable via a re-install.
4. **Pricing tiers**: Free / Pro (£4.99) / Vault-Export (£9.99 one-off). Correct?
