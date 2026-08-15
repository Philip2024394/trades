// NEX Business Context · seed businesses (Philip 2026-08-14).
//
// Registers two demo businesses so the /b/[slug]/* routes have real
// content out of the box. In production this is replaced by the Studio
// publish path writing to the registry (or DB).

import { registerBusiness } from "./registry";
import { staircaseCompletedBlueprint } from "@/lib/app-builder/examples/staircase-company-completed";
import { scenario5_ServiceBusinessPlumber } from "@/lib/app-builder/examples/phase10-scenarios";

let seeded = false;

export function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;
  registerBusiness("rowan-staircases", staircaseCompletedBlueprint);
  registerBusiness("harborne-plumbing", scenario5_ServiceBusinessPlumber());
}
