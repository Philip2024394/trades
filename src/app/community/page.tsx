// /community — compatibility redirect back to the canonical canteens
// index. See src/app/community/[slug]/page.tsx for context on the
// stale-308 problem this route absorbs.

import { redirect } from "next/navigation";

export default function CommunityIndexCompatRedirect() {
  redirect("/trade-off/yard/canteens");
}
