// src/app/nexapp/face-scan-debug-inner/page.tsx
//
// Diagnostic INSIDE the /nexapp layout (which mounts NexQuickSearch +
// NexSectionsNav). Same red box as /face-scan-debug.
//
// · If this shows red → the /nexapp layout is fine, the white-page
//   issue is inside my WebGL component (NexHolographicFace3D).
// · If this shows white → the /nexapp layout itself is breaking the
//   render (QuickSearch or SectionsNav mount is causing it).

export default function NexappFaceScanDebugInner() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#059669",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 30,
        fontWeight: 800,
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        padding: "0 1rem",
      }}
    >
      INNER DEBUG (under /nexapp layout) VISIBLE ✓
    </div>
  );
}
