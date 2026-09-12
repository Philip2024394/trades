// src/app/nex-head-quarters/component-registry/page.tsx

import { ComponentRegistryClient } from "./ComponentRegistryClient";
import "../workstation/workstation.css";

export const dynamic = "force-dynamic";

export default function ComponentRegistryPage() {
  return (
    <div className="nex-workstation-root" style={{ padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Component Registry</h1>
        <p style={{ color: "var(--nws-slate)", margin: "4px 0 0", fontSize: 13 }}>
          Every reusable NEX component with identity · version · owning capability · UI DNA verdict · doctrine tags. Deprecated versions marked · latest OK version highlighted.
        </p>
      </header>
      <ComponentRegistryClient />
    </div>
  );
}
