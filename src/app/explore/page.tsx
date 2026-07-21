// /explore — permanent 308 redirect to /toolbox.
//
// Renamed 2026-07-20 (Philip). The Toolbox is the canonical name for
// the resource ecosystem — tagline "Everything at hand's reach."
// Keeping this stub so any external links / press citations to
// /explore still work.

import { permanentRedirect } from "next/navigation";

export default function ExploreRenamedRedirect() {
  permanentRedirect("/toolbox");
}
