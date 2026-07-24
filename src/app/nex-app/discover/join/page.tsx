// Discover — Join / signup surface.
//
// Route: /nex-app/discover/join
// Simple form for a new user to be added to the discovery pool:
// Name · Country · Age · Occupation · Looking for.
// Deliberately NO interests field (spec: user removed it).

import { JoinDiscoverShell } from "@/components/nex-app/discover/JoinDiscoverShell";

export const dynamic = "force-dynamic";

export default function DiscoverJoinPage() {
  return <JoinDiscoverShell />;
}
