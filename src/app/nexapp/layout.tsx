// src/app/nexapp/layout.tsx
//
// Founder Phase 30 (2026-09-10) — /nexapp is the canonical NEX chat home
// (confirmed by founder). This layout mounts the same chrome that the
// /nex-app mirror had: the magnifying-glass QuickSearch icon (top-right)
// and the sections drawer. NexAppShell (page.tsx) still renders full-
// bleed underneath.
//
// Discipline: identical composition to /nex-app/layout.tsx so both URL
// forms present the same experience. Founder's stated canonical is
// /nexapp — /nex-app remains as a mirror for backward compat.

import type { ReactNode } from "react";
import { NexSectionsNav } from "@/components/nex-app/shell/NexSectionsNav";
import { NexQuickSearch } from "@/components/nex-app/shell/NexQuickSearch";

export default function NexappLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      {/* Magnifying-glass icon (top-right) opens the NEX Directory
          search overlay. Press "/" from any page to focus it. */}
      <NexQuickSearch />
      {/* Sections drawer (top-right, LEFT of the search icon) */}
      <NexSectionsNav />
    </>
  );
}
