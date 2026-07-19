// /project/start — LEGACY ENTRY. Redirected 2026-07-18 to the
// SiteBook signup flow now that the platform's single homeowner
// destination is `/sitebook/{projectId}`.
//
// Old wizard files under /project/details, /project/matches, etc
// still exist for anyone mid-flow but no new entry points route
// here. External references (why, home/trades, audience gates)
// have been repointed to /homeowners/signup?intent=create-project.

import { redirect } from "next/navigation";

export default function LegacyProjectStartRedirect() {
  redirect("/homeowners/signup?intent=create-project");
}
