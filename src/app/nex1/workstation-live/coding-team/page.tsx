// 2026-09-16 · coding-team sub-route
//
// The main /nex1/workstation-live page renders the full-viewport
// NexAgentWorkstation (.naw-root · position:fixed; inset:0). The 15-agent
// coding-team dispatch cockpit cannot render alongside it, so it lives here
// as a sibling route.
//
// Wired to real endpoints:
//   /api/nex-coding-team/{dispatch,status,health,interrupt}
//   /api/nex-coding-chat/attach
//   /api/nex-migration/ledger
// Behind the scenes: guardCodingTeamRun → runPipeline → releaseCodingTeamRun
// → extractLessonFromRun · full F3 wire live-verified 2026-09-15.

import { CodingTeamPanel } from "../panels/CodingTeamPanel";

export const dynamic = "force-dynamic";

export default function CodingTeamPage() {
  return <CodingTeamPanel />;
}
