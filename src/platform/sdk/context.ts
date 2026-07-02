// Platform SDK — AppContext.
//
// The identity object every SDK function is bound to. Holds the App's
// frozen manifest plus the merchant/brand scope the App is currently
// operating on. Passing ctx as the first argument to every SDK verb
// keeps the API pure (no globals, no async local storage), which
// means the SDK is safe in edge runtimes, server actions, RSC and
// route handlers alike.

import type { FrozenAppManifest } from "../manifest/types";

export type AppContext = {
  readonly manifest: FrozenAppManifest;
  readonly merchantId: string;
  readonly brandId: string | null;
};

export type AppContextScope = {
  merchantId: string;
  brandId?: string | null;
};

/** Bind an App's manifest to a merchant scope. Returns a readonly
 *  context — mutation is meaningless and would only encourage bugs. */
export function createAppContext(
  manifest: FrozenAppManifest,
  scope: AppContextScope
): AppContext {
  return Object.freeze({
    manifest,
    merchantId: scope.merchantId,
    brandId: scope.brandId ?? null
  });
}
