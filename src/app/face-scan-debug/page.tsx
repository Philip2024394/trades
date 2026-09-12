// src/app/face-scan-debug/page.tsx
//
// Diagnostic route · NO /nexapp layout, NO Three.js, NO WebGL.
// Just a plain server component with a big colored box + text.
// If THIS page also shows white, the issue is root layout / CSS.
// If this renders normally, the issue is inside /nexapp or the
// WebGL component.

export default function FaceScanDebugPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#dc2626",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 32,
        fontWeight: 800,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      DEBUG PAGE VISIBLE ✓
    </div>
  );
}
