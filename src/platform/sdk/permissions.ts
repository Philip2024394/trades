// Platform SDK — capability + permission gates.
//
// Apps declare capabilities + permissions in their manifest. The SDK
// enforces the declaration at the call site: `assertCapability(ctx,
// "payments")` throws if the manifest didn't list "payments".
//
// Why declare + assert twice? Because the manifest is the merchant's
// consent surface (Studio shows what an App can access at install
// time) — but nothing stops an App's code from calling a service it
// forgot to declare. The assertion catches that at development time,
// so shipped Apps have a manifest that reflects reality.

import type { Capability, Permission } from "../manifest/types";
import type { AppContext } from "./context";

export function assertCapability(
  ctx: AppContext,
  cap: Capability
): void {
  if (!ctx.manifest.requirements.capabilities.includes(cap)) {
    throw new Error(
      `assertCapability: App "${ctx.manifest.slug}" attempted to use ` +
        `capability "${cap}" without declaring it in ` +
        `manifest.requirements.capabilities.`
    );
  }
}

export function assertPermission(
  ctx: AppContext,
  perm: Permission
): void {
  if (!ctx.manifest.requirements.permissions.includes(perm)) {
    throw new Error(
      `assertPermission: App "${ctx.manifest.slug}" attempted an action ` +
        `requiring permission "${perm}" without declaring it in ` +
        `manifest.requirements.permissions.`
    );
  }
}

export function hasCapability(ctx: AppContext, cap: Capability): boolean {
  return ctx.manifest.requirements.capabilities.includes(cap);
}

export function hasPermission(ctx: AppContext, perm: Permission): boolean {
  return ctx.manifest.requirements.permissions.includes(perm);
}
