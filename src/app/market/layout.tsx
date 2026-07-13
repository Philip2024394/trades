import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";

// The Network shell — same AppShell every other public surface uses
// (`/trade-off/yard`, `/trade-off/sell`, etc.). Cream header with the
// "The Network" mark, search-trades pill, and Join free / Sign in
// actions on the right.

export default function MarketLayout({
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
