// /project — LEGACY ENTRY. Redirected 2026-07-18 to /homeowners
// (the current homeowner landing). SiteBook is the single homeowner
// destination now.

import { redirect } from "next/navigation";

export default function LegacyProjectLandingRedirect() {
  redirect("/homeowners");
}
