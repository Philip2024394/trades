// /trade-off/yard/manage — DEPRECATED redirect stub.
//
// This was the old "Your Yard posts" dashboard that listed every one
// of the merchant's posts with per-row Boost / Archive / Delete
// controls. It has been replaced by the 3-dots-per-post pattern on
// the Yard feed itself (PostCardActionsMenu on each YardPostCard when
// the viewer owns the post) plus a "My posts" filter chip at the top
// of the Yard.
//
// This file remains only to preserve URL compatibility — old
// bookmarks, WhatsApp shares, and the "Manage" link that used to sit
// in the canteen header all resolve to /trade-off/yard?mine=1 now.
//
// YardManageList.tsx was deleted 2026-07-14 along with this rewrite.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function YardManagePage() {
  redirect("/trade-off/yard?mine=1");
}
