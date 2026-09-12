// src/app/nex-head-quarters/workstation/page.tsx
//
// NEX Workstation · founder-facing split-workspace.
// LEFT: real isolated preview iframe · viewport controls · reload · error state.
// RIGHT: NEX1 code/build/test/diagnostics workspace.
//
// Preview is REAL · not a screenshot. Uses the /preview/[cap]/[version] route
// which resolves via the Stage 5 preview resolver.
//
// This page runs under HQShell (see layout.tsx) so it inherits the sidebar +
// header · plus its own deep-navy scope via workstation.css.

import { WorkstationClient } from "./WorkstationClient";
import "./workstation.css";

export const dynamic = "force-dynamic";

export default function WorkstationPage() {
  return (
    <div className="nex-workstation-root" style={{ padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>NEX Workstation</h1>
        <p style={{ color: "var(--nws-slate)", margin: "4px 0 0", fontSize: 13 }}>
          Left · real isolated preview at app-size viewport · updates from NEX1 changes ·
          Right · code / build / test / diagnostics / review / security · <strong>preview never touches production</strong>.
        </p>
      </header>
      <WorkstationClient />
    </div>
  );
}
