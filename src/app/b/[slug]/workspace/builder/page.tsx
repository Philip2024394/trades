// NEX Business Context · /b/[slug]/workspace/builder (Philip 2026-08-14 · Phase 18).
//
// The App Builder as an in-workspace module. After publish the owner keeps
// their business inside the workspace · the Builder is a step accessible
// from the side drawer, not a parallel surface. Consistent with the
// "one NEX system with branches" constitutional rule.
//
// Permission model matches the workspace root · API routes still enforce
// owner-only mutation access · this page is a shell + linkout for now.

import { notFound } from "next/navigation";
import { ensureSeeded, getBusiness, toOwnerIdentity } from "@/lib/nex/business-context";
import { NexOwnerWorkspaceShell } from "@/components/nex-business/NexOwnerWorkspaceShell";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  ensureSeeded();
  const { slug } = await params;
  const biz = getBusiness(slug);
  return { title: biz ? `${biz.blueprint.identity.displayName} · Builder` : "Builder", robots: { index: false } };
}

export default async function WorkspaceBuilderPage({ params }: { params: Promise<{ slug: string }> }) {
  ensureSeeded();
  const { slug } = await params;
  const biz = getBusiness(slug);
  if (!biz) notFound();
  const identity = toOwnerIdentity(biz);
  return (
    <NexOwnerWorkspaceShell business={identity} activeModule="builder">
      <div style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#6b7280", marginBottom: 6 }}>
          NEX Workspace · Builder
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>Builder</h1>
        <p style={{ margin: "0 0 20px", color: "#4b5563", fontSize: 14 }}>
          Return to the App Builder chat to iterate on your business app. Every published change flows through the same governed
          mutation pipeline · nothing skips propose → approve → apply → audit.
        </p>
        <div style={{ padding: 16, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10 }}>
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 12 }}>
            The Builder chat lives at <a href="/nex-app/app-builder" style={{ color: "#F97316", fontWeight: 500 }}>/nex-app/app-builder</a>{" "}
            today. Future iterations will render it inline here as an embedded module inside the workspace.
          </div>
          <a href="/nex-app/app-builder"
            style={{ display: "inline-block", padding: "10px 16px", background: "#F97316", color: "#fff", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
            Open Builder chat
          </a>
        </div>
      </div>
    </NexOwnerWorkspaceShell>
  );
}
