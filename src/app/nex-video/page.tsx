// NEX Video Feed V1 · /nex-video · Philip 2026-08-27.
// Server component that renders the client player.

import { VideoFeedClient } from "./VideoFeedClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEX Video", robots: { index: false } };

export default function Page() {
  return <VideoFeedClient />;
}
