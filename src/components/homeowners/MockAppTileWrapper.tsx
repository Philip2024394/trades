"use client";

// MockAppTileWrapper — listens for the sitebook:mock-app-toggle event
// fired by AppInstallButton in demoMode, and shows/hides its children
// accordingly. Only used on the mock showcase page so the App Store's
// Add/Remove buttons produce visible feedback on sibling tiles.

import { useEffect, useState } from "react";
import type { SiteBookAppSlug } from "@/apps/sitebook/_shared/manifest";

export function MockAppTileWrapper({
  slug,
  initialInstalled = true,
  children
}: {
  slug:              SiteBookAppSlug;
  initialInstalled?: boolean;
  children:          React.ReactNode;
}) {
  const [installed, setInstalled] = useState<boolean>(initialInstalled);

  useEffect(() => {
    function onToggle(e: Event) {
      const { detail } = e as CustomEvent<{ slug: SiteBookAppSlug; installed: boolean }>;
      if (detail?.slug === slug) setInstalled(!!detail.installed);
    }
    window.addEventListener("sitebook:mock-app-toggle", onToggle as EventListener);
    return () => window.removeEventListener("sitebook:mock-app-toggle", onToggle as EventListener);
  }, [slug]);

  if (!installed) return null;
  return <>{children}</>;
}
