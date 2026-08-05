// NEX Platform route layout.
//
// Overrides the root layout's dark theme with the light cream Design
// Language surface. Scoped to /nex-app/* only — every existing route
// unaffected. Applies to the platform landing, Messenger, every Brain
// surface, every Studio.
//
// Mounts the persistent NexSectionsNav (top-right menu → side drawer with
// all top-level sections) so users can jump between Discover · Contacts ·
// Centre · Staircase Configurator · Design System from any /nex-app/* page.

import type { ReactNode } from "react";
import { NexSectionsNav } from "@/components/nex-app/shell/NexSectionsNav";
import { CentreFeedPreloader } from "@/components/nex-app/shell/CentreFeedPreloader";
import "./nex-app.css";

export default function NexPlatformLayout({ children }: { children: ReactNode }) {
  return (
    <div className="nex-app-root">
      {children}
      <NexSectionsNav />
      {/* Warm the Trade Centre feed cache the moment the user enters
          the app so navigating into /nex-app/centre lands instantly. */}
      <CentreFeedPreloader />
    </div>
  );
}
