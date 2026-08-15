// NEX Business Context · /b/[slug]/workspace/conversations · OWNER module (Philip 2026-08-14).
//
// Server component · reads conversations directly from the store (owner has permission).

import { notFound } from "next/navigation";
import { NexOwnerWorkspaceShell } from "@/components/nex-business/NexOwnerWorkspaceShell";
import { ensureSeeded, getBusiness, toOwnerIdentity } from "@/lib/nex/business-context";
import { listConversationsForBusiness } from "@/lib/nex/business-context/conversations";

export const dynamic = "force-dynamic";

export default async function OwnerConversationsPage({ params }: { params: Promise<{ slug: string }> }) {
  ensureSeeded();
  const { slug } = await params;
  const biz = getBusiness(slug);
  if (!biz) notFound();
  const identity = toOwnerIdentity(biz);
  const conversations = listConversationsForBusiness(slug);

  return (
    <NexOwnerWorkspaceShell business={identity} activeModule="conversations">
      <div>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", opacity: 0.55, marginBottom: 6 }}>
          Customer
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 12px" }}>Conversations</h1>
        <p style={{ margin: "0 0 20px", color: "#4b5563" }}>
          {conversations.length === 0
            ? `No customer conversations yet. When someone chats with ${identity.displayName}, it will appear here.`
            : `${conversations.length} conversation${conversations.length === 1 ? "" : "s"} from customers of ${identity.displayName}.`}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {conversations.map((c) => (
            <div key={c.id} data-testid={`conv-${c.id}`} style={{ padding: 14, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <div style={{ fontSize: 13, color: "#4b5563" }}>Customer <code>{c.customerId}</code></div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{new Date(c.updatedAt).toLocaleString()}</div>
              </div>
              {c.messages.length > 0 && (
                <div style={{ fontSize: 14, color: "#1a1a1a" }}>
                  <strong>{c.messages[c.messages.length - 1].author}:</strong> {c.messages[c.messages.length - 1].text}
                </div>
              )}
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
                {c.messages.length} message{c.messages.length === 1 ? "" : "s"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </NexOwnerWorkspaceShell>
  );
}
