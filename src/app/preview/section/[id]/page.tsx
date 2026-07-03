// Public preview route — renders a single Studio section standalone.
//
// Consumed via <iframe> from the Studio Templates Library so every
// preview gets:
//   • Total layout / event / animation isolation from its neighbours
//   • Chrome site-isolation → rendered in a separate process where
//     available; heavy animation work no longer blocks the templates
//     page main thread
//   • loading="lazy" on the parent iframe → the browser skips
//     bootstrapping off-screen previews until the merchant scrolls
//
// Kept OUTSIDE the /studio/ tree deliberately so it doesn't require
// a session cookie — the preview surface has no merchant data, just
// section defaults + DEFAULT_TOKENS.

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
// Side-effect: register every section so the id lookup resolves.
import "@/lib/studio/sections";
import { DEFAULT_TOKENS } from "@/lib/studio/tokens";
import { StudioErrorBoundary } from "@/components/studio/StudioErrorBoundary";

export const dynamic = "force-static";
export const revalidate = 3600;

export default async function SectionPreviewPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reg = sectionRegistry.get(id);

  if (!reg) {
    return (
      <div
        style={{
          padding: 40,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          color: "#525252",
          background: "#F5F5F5",
          minHeight: "100vh"
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            color: "#A3A3A3",
            margin: 0
          }}
        >
          Preview error
        </p>
        <h1 style={{ fontSize: 20, marginTop: 8 }}>
          Section not found:{" "}
          <code
            style={{
              background: "#FFFFFF",
              padding: "2px 6px",
              borderRadius: 6,
              fontFamily: "ui-monospace, monospace"
            }}
          >
            {id}
          </code>
        </h1>
      </div>
    );
  }

  const Renderer = reg.renderer;
  const data = {
    merchantId: "preview",
    slug: "your-business",
    merchantName: "Your business",
    city: "Your city",
    whatsappHref: null,
    brandName: "Main brand",
    domain: {}
  };

  // Reset body margins so the section fills edge-to-edge inside the
  // iframe. The parent's `<html>` layout still owns the outer wrapper.
  return (
    <>
      <style>{`
        body { margin: 0; padding: 0; background: #0A0A0A; }
        html, body { overflow-x: hidden; }
      `}</style>
      <StudioErrorBoundary label={`Preview iframe: ${reg.id}`}>
        <Renderer
          instanceId="preview"
          config={reg.defaultConfig()}
          tokens={DEFAULT_TOKENS}
          data={data}
          mode="preview"
        />
      </StudioErrorBoundary>
    </>
  );
}
