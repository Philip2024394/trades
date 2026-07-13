// Wraps /trade-off/following with the same AppShell as /trade-off/yard
// and /trade-off/prices so trades never feel like they're leaving the
// network when navigating between their feeds.

import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function FollowingLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-[100dvh]">{children}</div>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
