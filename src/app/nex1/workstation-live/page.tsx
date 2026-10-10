// §36-W-1 · WAVE-W1 · 2026-09-14 · workstation-live
// 2026-09-16 consolidation · retired /nexapp/nex-agent is now hosted here.
//
// NEX1 Live Workstation · single canonical URL.
//
// Renders the NEX1 Programming Workstation — moved verbatim from
// /nexapp/nex-agent (all 26 feature files) with all internal ./ imports intact
// and wired to the real /api/nex/agent/* endpoints. The `.naw-root` layout in
// nex-agent-workstation.css uses `position: fixed; inset: 0` — a full-viewport
// grid — so no sibling panel can render alongside it on the same page.
//
// The F3-wired CodingTeamPanel (15-agent dispatch cockpit · brain
// guard/release/lesson-extract wire) lives on its own sub-route so it does
// not collide with the workstation's fixed layout.

import { WorkstationClient } from "./agent/WorkstationClient";
import "./agent/nex-agent-workstation.css";

export const dynamic = "force-dynamic";

export default function WorkstationLivePage() {
  return <WorkstationClient />;
}
