// Platform SDK — pages.
//
// One verb: list the pages this App created for the merchant's brand.
// Wraps runtime.listAppCreatedPages with the App context filled in.

import { runtime } from "../runtime";
import type { AppContext } from "./context";

export type AppCreatedPage = {
  slug: string;
  name: string;
  hidden: boolean;
};

/** Pages this App has created for the current merchant. `includeHidden`
 *  surfaces soft-hidden pages (e.g. from a prior uninstall) so the
 *  App Store can render "your previously installed pages will reappear
 *  when you reinstall". */
export async function getMyPages(
  ctx: AppContext,
  opts: { includeHidden?: boolean } = {}
): Promise<AppCreatedPage[]> {
  if (!ctx.brandId) return [];
  return runtime.listAppCreatedPages({
    brandId: ctx.brandId,
    appSlug: ctx.manifest.slug,
    includeHidden: opts.includeHidden
  });
}
