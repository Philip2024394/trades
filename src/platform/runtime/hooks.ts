// Platform Runtime — lifecycle hook loader (v1 skeleton).
//
// Manifests declare lifecycle hook module paths (e.g. `lifecycle:
// { onInstall: "./install.ts" }`). The Runtime is responsible for
// invoking them at the correct point in the install/uninstall/upgrade
// pipeline.
//
// v1 note: dynamic import of App-declared module paths requires a
// resolver that maps `<appDir>/lifecycle.ts` → an actual import path.
// Since Apps don't yet ship code (Phase 4 will land the first
// manifest-driven Apps), the resolver is a no-op stub. When Apps land,
// this module becomes the single place hook invocation is implemented
// — nothing else in the Runtime has to change.

import type { AppManifest, AppLifecycleHook } from "../manifest/types";

export type LifecycleHookContext = {
  merchantId: string;
  brandId: string | null;
  config: Record<string, unknown>;
};

/** Invoke a lifecycle hook if declared. Returns { ok: true } when the
 *  hook is not declared or completes successfully; { ok: false } with
 *  a reason when the hook throws. Never allowed to bubble — the
 *  install/uninstall pipeline needs to convert failures into a typed
 *  InstallErr. */
export async function invokeLifecycleHook(
  _manifest: AppManifest,
  hook: AppLifecycleHook,
  _ctx: LifecycleHookContext
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const declared = _manifest.lifecycle?.[hook];
  if (!declared) return { ok: true };

  // v1: dynamic import of App-shipped code is not yet wired. The
  // manifest field is preserved for forward compat so the first App
  // that ships code (Phase 4 retrofit) can flip this on with no
  // schema churn. Silently succeed for now so manifests can declare
  // hooks aspirationally without breaking installs.
  return { ok: true };
}
