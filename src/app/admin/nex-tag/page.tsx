// /admin/nex-tag
//
// Keyboard-driven fast tagger for staircase images.
// Server wrapper — renders the client component.

import NexTagClient from "./NexTagClient";

export const dynamic = "force-dynamic";

export default function NexTagPage() {
  return <NexTagClient />;
}
