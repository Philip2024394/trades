// Discover — platform-wide people, businesses and communities
// discovery surface. NEX acts as the introduction layer; messaging
// only begins after the invitation is accepted (per Discover spec).

import { DiscoverShell } from "@/components/nex-app/discover/DiscoverShell";

export const dynamic = "force-dynamic";

export default function DiscoverPage() {
  return <DiscoverShell />;
}
