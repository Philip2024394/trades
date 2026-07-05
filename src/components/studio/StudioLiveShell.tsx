"use client";

// Module 21 — Storefront live-render shell.
//
// The customer-facing renderer for a published Studio layout. No editor
// chrome, no bus, no analytics-of-edit-actions — just the merchant's
// published sections in the order they laid them out.
//
// Used by /trade/[slug] (and future /shop, /contact, product-details
// routes) when the merchant has a published studio_layouts row for that
// pageId. If the merchant has never published, the storefront never
// reaches this component.
//
// Safety: each section is wrapped in an error boundary equivalent —
// missing registrations and thrown renders are logged and skipped so
// one broken section can never take down the whole profile.

import { Fragment } from "react";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
// Side-effect import — populates the registry with every section.
import "@/lib/studio/sections";
import type {
  BrandTokens,
  MerchantData
} from "@/lib/studio/sectionTypes";
import type { StudioLayoutJson } from "@/lib/studio/schema";
import { StormBanner } from "@/components/studio/StormBanner";
import { SectionErrorBoundary } from "@/components/studio/SectionErrorBoundary";

export function StudioLiveShell({
  layout,
  tokens,
  data
}: {
  layout: StudioLayoutJson;
  tokens: BrandTokens;
  data: MerchantData;
}) {
  const byInstanceId = new Map(
    layout.sections.map((s) => [s.instanceId, s])
  );

  return (
    <div data-studio-live="1">
      {data.stormMode && <StormBanner storm={data.stormMode} />}
      {layout.rows.map((row) => {
        const cols = row.columns
          .map((instanceId) => byInstanceId.get(instanceId))
          .filter((s): s is NonNullable<typeof s> => !!s);
        if (cols.length === 0) return null;

        const isSingle = cols.length === 1;
        return (
          <div
            key={row.id}
            className={
              isSingle
                ? "w-full"
                : `grid w-full grid-cols-1 md:grid-cols-${Math.min(cols.length, 4)}`
            }
          >
            {cols.map((instance) => {
              const hiddenGlobal = instance.hidden === true;
              if (hiddenGlobal) return null;

              const reg = sectionRegistry.get(instance.key);
              if (!reg) {
                // Missing registration is a soft error — skip silently in
                // production. A merchant should never see "unknown
                // section" on their live profile.
                return null;
              }
              const Renderer = reg.renderer;
              const mergedTokens: BrandTokens = instance.tokenOverrides
                ? { ...tokens, ...(instance.tokenOverrides as BrandTokens) }
                : tokens;

              return (
                <Fragment key={instance.instanceId}>
                  <SectionErrorBoundary sectionKey={instance.key}>
                    <Renderer
                      instanceId={instance.instanceId}
                      config={instance.config}
                      tokens={mergedTokens}
                      data={data}
                      mode="published"
                    />
                  </SectionErrorBoundary>
                </Fragment>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
