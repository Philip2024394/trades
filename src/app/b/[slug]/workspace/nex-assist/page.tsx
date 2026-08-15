// NEX Assist · dedicated route (Philip 2026-08-14 · Phase 15).
// Larger surface for the owner chat with NEX. Same component as
// the workspace landing but rendered without the module tile grid.

import { notFound } from "next/navigation";
import { NexOwnerWorkspaceShell } from "@/components/nex-business/NexOwnerWorkspaceShell";
import { NexAssistChat } from "@/components/nex-business/NexAssistChat";
import { ensureSeeded, getBusiness, toOwnerIdentity } from "@/lib/nex/business-context";

export const dynamic = "force-dynamic";

export default async function NexAssistPage({ params }: { params: Promise<{ slug: string }> }) {
  ensureSeeded();
  const { slug } = await params;
  const biz = getBusiness(slug);
  if (!biz) notFound();
  const identity = toOwnerIdentity(biz);

  return (
    <NexOwnerWorkspaceShell business={identity} activeModule="nex-assist">
      <div>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", opacity: 0.55, marginBottom: 6 }}>
          NEX
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 8px" }}>NEX Assist</h1>
        <p style={{ margin: "0 0 20px", color: "#4b5563", fontSize: 14 }}>
          Change {identity.displayName}&rsquo;s live data by talking to NEX. Every change is proposed, confirmed, applied and audited.
        </p>
        <NexAssistChat businessSlug={identity.slug} businessDisplayName={identity.displayName} />
      </div>
    </NexOwnerWorkspaceShell>
  );
}
