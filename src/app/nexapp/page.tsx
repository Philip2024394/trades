// NEX home experience · route entry (server component · metadata carrier).
//
// UI + interactivity lives in ./NexAppShell (client). This file only exports
// route-level metadata + viewport per Next 13 rules (metadata cannot be
// exported from a client component).
//
// 2026-08-25 · Phase 1 install of the console HUD frame per Philip. See
// project_nex_workspace_identity_doctrine_2026_08_25 for the shell doctrine.

import { NexAppShell } from "./NexAppShell";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "NEX",
  description: "NEX · Ask. Discover. Connect.",
};

// 2026-08-25 · Philip · frame must be the device boundary · viewportFit
// changed from "cover" (which painted the bezel behind notches) to
// "auto" so the browser gives us a viewport that already excludes the
// notch area. Prevents top clipping on notched phones.
export const viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function NexAppRoute() {
  return <NexAppShell />;
}
