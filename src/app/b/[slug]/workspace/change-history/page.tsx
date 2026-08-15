// NEX Change Control · /b/[slug]/workspace/change-history (Philip 2026-08-14 · Phase 16).

import { notFound } from "next/navigation";
import { NexOwnerWorkspaceShell } from "@/components/nex-business/NexOwnerWorkspaceShell";
import { ChangeHistoryView } from "@/components/nex-business/ChangeHistoryView";
import { ensureSeeded, getBusiness, toOwnerIdentity } from "@/lib/nex/business-context";

export const dynamic = "force-dynamic";

export default async function ChangeHistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  ensureSeeded();
  const { slug } = await params;
  const biz = getBusiness(slug);
  if (!biz) notFound();
  const identity = toOwnerIdentity(biz);
  return (
    <NexOwnerWorkspaceShell business={identity} activeModule="activity">
      <ChangeHistoryView businessSlug={identity.slug} businessDisplayName={identity.displayName} />
    </NexOwnerWorkspaceShell>
  );
}
