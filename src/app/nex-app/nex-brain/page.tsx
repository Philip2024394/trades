// NEX Headquarters · single front door.
//
// Route: /nex-app/nex-brain
//
// Renders the Reception experience directly. Reception itself is the
// operations-centre page (rooms · roster · living timeline · providers ·
// worker floor). This route aliases that component so users landing at
// /nex-app/nex-brain arrive at Reception without a redirect hop.
//
// The /nex-app/nex-brain/operations-centre URL still works (same file,
// same rendering). Every other centre — Knowledge, Storage, Data Platform,
// Review, Journal, Audit, Comms Social — is reachable from the shared
// HQ sidebar (see components/nex-app/nex-brain/HQShell.tsx).

export { default } from "./operations-centre/page";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "NEX Headquarters · Reception",
  robots: { index: false },
};
