// NEX home experience · route entry.
//
// The one canonical NEX home surface per Philip's 2026-08-21 build spec.
// Reference image: mobile portrait mockup · four corner shortcuts +
// central conversation area + reactive orange particle field + living
// NEX identity button in the bottom nav.
//
// Doctrine-compliant:
//   · Reuses existing /api/nex-conv/chat endpoint (single conversation
//     brain, per Router doctrine).
//   · Reuses existing NexVoiceProvider (voice adapter is frozen).
//   · No fabricated prices in business cards (Owner-Provenanced Pricing).
//   · State is language-neutral (Indonesian works via existing layer).
//   · No new backend, no architecture changes, no touching frozen files.

import { NexAppHome } from "@/components/nexapp/NexAppHome";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "NEX",
  description: "NEX · Ask. Discover. Connect.",
};

export const viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
};

export default function NexAppRoute() {
  return <NexAppHome />;
}
