// NEX LIVE surface prototype · /nex-live · Philip 2026-08-27.
//
// VISUAL / PRODUCT-SURFACE PROTOTYPE ONLY.
//
// This is NOT Stage 4 LIVE infrastructure. It is a visual surface that:
//   · uses NEX's dark visual language
//   · plays ONE real uploaded video from the already-shipped Media Foundation
//   · lets us physically see and interact with the LIVE placement
//
// NO RTMP / LL-HLS / broadcaster pipeline / SFU / viewer scaling / commerce
// overlays / social features / monetisation. Those all wait for real ramp-gate
// evidence per project_nex_operating_layer_doctrine_2026_08_27.

import { NexLiveClient } from "./NexLiveClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEX · LIVE", robots: { index: false } };

export default function Page() {
  return <NexLiveClient />;
}
