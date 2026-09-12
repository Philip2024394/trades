// src/app/nex-app/page.tsx
//
// NEX · frameless home · Philip 2026-09-07
//
// Route mount swap · minimum change · mounts the existing full-featured
// `NexAppShell` from `/nexapp` at this route so every legacy workspace
// (Contacts · Friends · Chat · Recent Pages · Rooms/Drawers · Mascot ·
// Voice · Cards · Discover verticals · Business/Provider workspaces ·
// full navigation) is available without the phone chassis.
//
// NexAppShell hardcodes `frameless={true}` on its <NexHudFrame> mount
// (see NexAppShell.tsx line ~2056), so the shell renders in its
// frameless mode: no phone chassis, no aspect-locked container, full
// mobile viewport, `.nex-console-viewport` preserved for portals
// (ControlCenterPanel, NexKebabQuickPanel, etc.).
//
// The legacy `/nexapp` route remains authoritative for regression
// reference and continues to render the same NexAppShell (also in
// frameless mode).
//
// Slice 1's `NexHomeClient` + `HomeConsole` + `HomeKebabButton` remain
// on disk as historical artifacts · they are no longer mounted from
// any live route. Not deleted per founder's "keep the function"
// preservation rule.
//
// The parent /nex-app layout mounts NexSectionsNav + CentreFeedPreloader;
// NexSectionsNav suppresses itself on the exact `/nex-app` pathname
// (see the modify in NexSectionsNav.tsx) so the shell's own header
// controls own the top-right chrome.

import { NexAppShell } from "../nexapp/NexAppShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "NEX",
  description: "NEX · Ask. Discover. Connect.",
};

export default function NexAppFramelessRoute() {
  return <NexAppShell />;
}
