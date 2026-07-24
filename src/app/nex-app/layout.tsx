// NEX Platform route layout.
//
// Overrides the root layout's dark theme with the light cream Design
// Language surface. Scoped to /nex-app/* only — every existing route
// unaffected. Applies to the platform landing, Messenger, every Brain
// surface, every Studio.

import type { ReactNode } from "react";
import "./nex-app.css";

export default function NexPlatformLayout({ children }: { children: ReactNode }) {
  return (
    <div className="nex-app-root">
      {children}
    </div>
  );
}
