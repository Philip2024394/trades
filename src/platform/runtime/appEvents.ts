// Platform Runtime — app_events writer.
//
// Owns writes to public.app_events. SDK's trackAppEvent is the
// developer-facing wrapper; every other analytics path must call
// through here so the write path stays single-authored.
//
// Never throws — analytics is best-effort. Failures are logged to
// stderr so ops can see them but never block the App's real work.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type RecordAppEventArgs = {
  merchantId: string | null;
  appSlug: string;
  eventName: string;
  payload?: Record<string, unknown> | null;
};

export async function recordAppEvent(
  args: RecordAppEventArgs
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("app_events").insert({
      merchant_id: args.merchantId,
      app_slug: args.appSlug,
      event_name: args.eventName,
      payload_json: args.payload ?? null
    });
    if (error) {
      // Best-effort — surface to ops without breaking the caller.
      console.warn(
        `recordAppEvent: ${args.appSlug}/${args.eventName} failed:`,
        error.message
      );
    }
  } catch (err) {
    console.warn(
      `recordAppEvent: ${args.appSlug}/${args.eventName} threw:`,
      (err as Error).message
    );
  }
}
