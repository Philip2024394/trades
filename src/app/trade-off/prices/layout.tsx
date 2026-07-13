// Wraps the public price index with the same AppShell as /trade-off/yard
// so trades never feel like they're leaving the network when navigating
// between Yard, Prices, Discover, or their profile.

import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function PricesLayout({
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
