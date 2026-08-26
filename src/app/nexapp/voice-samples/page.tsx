// NEX Voice Orb Samples · design comparison page.
// One orb per voice state · grid layout · labelled · dark background so the
// glow/plasma reads clearly. Not part of the production shell · standalone.

import { VoiceSamplesClient } from "./VoiceSamplesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEX Voice Orb Samples" };

export default function Page() {
  return <VoiceSamplesClient />;
}
