// Platform Apps — storefront data loader registry + hydrator.
//
// Every App with a rendered surface registers a data loader here.
// The storefront (Module 21 render path) scans the layout for
// `app.<slug>.*` section keys, dispatches through the registry, and
// populates `data.domain.apps.<slug>` before passing MerchantData to
// StudioLiveShell.
//
// Registration is one line per App at module load time:
//
//   registerAppDataLoader("meet-the-team", async (listing) => ({
//     members: listing.team_members ?? []
//   }));
//
// The hydrator only calls loaders for App slugs that appear in the
// layout — a merchant with 20 Apps installed but a home page using
// two pays for exactly two hydrations per render.

import type { HammerexTradeOffListing } from "@/lib/supabase";
import type { StudioLayoutJson } from "@/lib/studio/schema";

const APP_ID_PREFIX = "app.";

export type AppDataLoader = (
  listing: HammerexTradeOffListing
) => Promise<unknown> | unknown;

const loaders = new Map<string, AppDataLoader>();

export function registerAppDataLoader(
  slug: string,
  loader: AppDataLoader
): void {
  loaders.set(slug, loader);
}

export function getAppDataLoader(slug: string): AppDataLoader | undefined {
  return loaders.get(slug);
}

/** Return the set of App slugs referenced by a layout. */
export function collectAppSlugsFromLayout(
  layout: StudioLayoutJson
): string[] {
  const slugs = new Set<string>();
  for (const section of layout.sections) {
    if (!section.key.startsWith(APP_ID_PREFIX)) continue;
    // Full key shape: app.<slug>.<localId>
    const parts = section.key.split(".");
    if (parts.length >= 3 && parts[1]) {
      slugs.add(parts[1]);
    }
  }
  return Array.from(slugs);
}

export type AppDomainPayload = {
  apps: Record<string, unknown>;
};

/** Hydrate the App domain payload for a listing's published layout.
 *  Unregistered App slugs are silently skipped so a section referencing
 *  an App we haven't shipped yet renders its placeholder rather than
 *  breaking the page. */
export async function hydrateAppDomain(
  listing: HammerexTradeOffListing,
  layout: StudioLayoutJson
): Promise<AppDomainPayload> {
  const slugs = collectAppSlugsFromLayout(layout);
  const apps: Record<string, unknown> = {};

  await Promise.all(
    slugs.map(async (slug) => {
      const loader = loaders.get(slug);
      if (!loader) return;
      try {
        apps[slug] = await loader(listing);
      } catch (err) {
        console.warn(
          `hydrateAppDomain: loader "${slug}" failed:`,
          (err as Error).message
        );
      }
    })
  );

  return { apps };
}
