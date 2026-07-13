import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function SellHubLayout({
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
