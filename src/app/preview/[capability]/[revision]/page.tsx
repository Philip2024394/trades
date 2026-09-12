// src/app/preview/[capability]/[revision]/page.tsx
//
// Isolated preview surface. Renders the CAP + version metadata inside an
// isolated frame · fully separate from production live paths. Loaded via
// the Workstation LEFT panel.
//
// Uses Stage 5 preview resolver to enforce:
//   - Only preview-eligible lifecycle states resolve
//   - ACTIVE revisions never render here (they render at their live path)
//   - Capability/version mismatch → 404-style page (not a redirect)
//
// This route deliberately does NOT extend the HQShell — the preview must
// look like the eventual live section, not the HQ shell around it.

import { validatePreviewParams, resolvePreviewFromRevision, PREVIEW_ELIGIBLE_STATES } from "@/lib/nex/preview";
import { workstationStore } from "@/lib/nex/workstation/workstation-store";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ capability: string; revision: string }>;
};

export default async function PreviewPage({ params }: PageProps) {
  const p = await params;
  const routeParams = { capability: p.capability, revision: p.revision };

  const validation = validatePreviewParams(routeParams);
  if (!validation.ok) {
    return <PreviewError title="Bad preview URL" detail={validation.reason} />;
  }

  const revision = workstationStore.getRevisionByCapVersion(p.capability, p.revision);
  const resolution = resolvePreviewFromRevision(revision, routeParams);
  if (!resolution.ok) {
    return <PreviewError title="Preview unavailable" detail={resolution.reason} />;
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #0B1220 0%, #0E1B33 40%, #0B1220 100%)",
      color: "#F9FAFB",
      fontFamily: "Inter, system-ui, sans-serif",
      padding: 32,
    }}>
      <PreviewIsolationBanner
        capabilityId={resolution.capabilityId}
        version={resolution.version}
        state={resolution.state}
      />

      <main style={{ maxWidth: 960, margin: "24px auto" }}>
        <h1 style={{ fontSize: 32, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
          Preview · {resolution.capabilityId} · {resolution.version}
        </h1>
        <p style={{ color: "#94A3B8", margin: "0 0 24px", fontSize: 14 }}>
          This is the isolated preview surface for revision <code style={{ color: "#22D3EE" }}>{revision?.revision_id}</code>.
          The section itself renders here when its code is imported. Preview state:{" "}
          <strong style={{ color: "#22D3EE" }}>{resolution.state}</strong>.
        </p>

        <SectionRenderer capabilityId={resolution.capabilityId} version={resolution.version} />
      </main>

      <footer style={{ textAlign: "center", padding: 24, borderTop: "1px solid rgba(148,163,184,0.15)", marginTop: 32, fontSize: 11, color: "#94A3B8" }}>
        Isolated preview · never live · never production · never founder-live path
      </footer>
    </div>
  );
}

function PreviewIsolationBanner({
  capabilityId,
  version,
  state,
}: {
  capabilityId: string;
  version: string;
  state: string;
}) {
  return (
    <div style={{
      background: "rgba(249, 115, 22, 0.08)",
      border: "1px solid rgba(249, 115, 22, 0.32)",
      color: "#F97316",
      padding: "10px 16px",
      borderRadius: 10,
      fontSize: 12,
      fontWeight: 600,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
    }}>
      <span>◧ ISOLATED PREVIEW · NOT LIVE</span>
      <span>{capabilityId} · {version} · {state}</span>
    </div>
  );
}

function SectionRenderer({ capabilityId, version }: { capabilityId: string; version: string }) {
  // As individual CAPs ship actual preview components, they register here.
  // Until then, render a structured placeholder that shows the revision is
  // real (from the store) even if no component is bound.
  return (
    <div style={{
      background: "rgba(14, 27, 51, 0.6)",
      border: "1px solid rgba(148, 163, 184, 0.18)",
      borderRadius: 12,
      padding: 40,
      textAlign: "center",
      backdropFilter: "blur(8px)",
    }}>
      <div style={{ fontSize: 48, color: "#22D3EE", marginBottom: 12, opacity: 0.5 }}>◧</div>
      <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Section placeholder</h2>
      <p style={{ color: "#94A3B8", margin: 0, fontSize: 13, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
        This CAP has no registered preview component yet. When NEX1 builds the
        actual section, its component gets registered here and this placeholder
        is replaced by the real UI.
      </p>
      <div style={{ marginTop: 20, display: "inline-flex", gap: 8, fontSize: 11, color: "#94A3B8" }}>
        <code style={{ color: "#22D3EE" }}>{capabilityId}</code>
        <span>·</span>
        <code style={{ color: "#22D3EE" }}>{version}</code>
      </div>
    </div>
  );
}

function PreviewError({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0B1220",
      color: "#F9FAFB",
      fontFamily: "Inter, system-ui, sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
    }}>
      <div style={{
        maxWidth: 480,
        background: "rgba(239, 68, 68, 0.08)",
        border: "1px solid rgba(239, 68, 68, 0.4)",
        borderRadius: 12,
        padding: 24,
      }}>
        <h1 style={{ fontSize: 20, color: "#EF4444", margin: "0 0 8px" }}>◧ {title}</h1>
        <p style={{ color: "#94A3B8", margin: 0, fontSize: 13, lineHeight: 1.5 }}>{detail}</p>
        <p style={{ color: "#94A3B8", marginTop: 16, fontSize: 11 }}>
          Eligible preview states: {PREVIEW_ELIGIBLE_STATES.join(" · ")}
        </p>
      </div>
    </div>
  );
}
