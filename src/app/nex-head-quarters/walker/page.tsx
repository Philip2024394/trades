// NEX HQ · /walker · index redirect (2026-08-23).
//
// The Walker page is per-vertical now · /walker/food · /walker/accommodation
// · /walker/{next-vertical}. The bare /walker URL keeps working by redirecting
// to the default (food) so any bookmark or historical link lands somewhere
// sensible instead of a 404. New sidebar entries link straight to
// /walker/{vertical} · this redirect is a safety net, not the primary path.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function WalkerIndexRedirect(): never {
  redirect("/nex-head-quarters/walker/food");
}
