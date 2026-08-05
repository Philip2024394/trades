// NEX Lab layout — scoped surface for prototype work that validates
// architectural doctrine before shipping into the real /nex-app routes.
//
// Reuses the /nex-app design tokens so learnings transfer cleanly.

import type { ReactNode } from "react";
import "../nex-app/nex-app.css";

export const dynamic = "force-dynamic";

export default function NexLabLayout({ children }: { children: ReactNode }) {
  return <div className="nex-app-root">{children}</div>;
}
