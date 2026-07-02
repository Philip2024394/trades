// App data loader: meet-the-team.
//
// The storefront hydrator calls this to populate
// `data.domain.apps["meet-the-team"]` before rendering the layout.
// Reads directly from the listing — no extra DB fetch needed since
// team_members lives on the listing row.

import { registerAppDataLoader } from "@/platform/apps/_shared/appDataLoader";

registerAppDataLoader("meet-the-team", (listing) => ({
  members: listing.team_members ?? []
}));
