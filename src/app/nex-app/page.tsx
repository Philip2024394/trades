// NEX Platform landing — global entry surface for every user.
//
// Route: /nex-app
// This is not a Brain surface. It's the platform home.
// One App. Endless Possibilities. Chat. Create. Grow.

import { PlatformShell } from "@/components/nex-app/platform/PlatformShell";

export const dynamic = "force-dynamic";

export default function PlatformLandingPage() {
  return <PlatformShell />;
}
