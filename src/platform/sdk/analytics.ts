// Platform SDK — analytics.
//
// One verb: `trackAppEvent(ctx, name, payload?)`. Wraps
// runtime.recordAppEvent so every write goes through the Runtime and
// the SDK never touches the DB directly.

import { runtime } from "../runtime";
import { assertCapability } from "./permissions";
import type { AppContext } from "./context";

/** Record an App-emitted analytics event. Best-effort — never throws,
 *  never blocks the App's real work. */
export async function trackAppEvent(
  ctx: AppContext,
  eventName: string,
  payload?: Record<string, unknown>
): Promise<void> {
  assertCapability(ctx, "analytics");
  await runtime.recordAppEvent({
    merchantId: ctx.merchantId,
    appSlug: ctx.manifest.slug,
    eventName,
    payload: payload ?? null
  });
}
