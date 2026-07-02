// Platform Apps — defineAppSection.
//
// The manifest-aware Studio section adapter. Every App-owned section
// registers via this helper — replacing the legacy `defineAddonSection`
// pattern with a manifest-first API.
//
// Section IDs are automatically namespaced `app.<appSlug>.<localId>`
// so different Apps can never collide. The wrapper:
//   • pulls `appData` from `data.domain.apps.<slug>` (populated by the
//     storefront's app data loader)
//   • shows a friendly placeholder in edit mode when data is missing
//   • renders nothing in published mode when data is missing (a
//     mis-configured App never breaks a live profile)
//
// Legacy `addon.<slug>` registrations remain valid via the old adapter
// under `src/lib/studio/sections/addons/_adapter.tsx` — this is purely
// additive.

import type { ComponentType, ReactNode } from "react";
import type { AppManifest } from "@/platform/manifest/types";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type {
  AiPromptSet,
  BrandTokens,
  EditableField,
  MerchantData,
  ScoreHints,
  SectionLibrary,
  SectionRegistration,
  SectionRenderMode,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

/** Data slot payload — each App wrapper types its own shape. */
export type AppSectionData = Record<string, unknown> | null;

export type AppSectionInnerProps<TConfig, TData extends AppSectionData> = {
  instanceId: string;
  config: TConfig;
  tokens: BrandTokens;
  data: MerchantData;
  appData: TData;
  mode: SectionRenderMode;
};

export type AppSectionDefinition<
  TConfig extends Record<string, unknown>,
  TData extends AppSectionData
> = {
  /** The App's manifest — identity + version are read from here. */
  manifest: AppManifest;
  /** Local section id, unique within the App. Kebab-case. Platform
   *  produces `app.<appSlug>.<localId>` as the full registration id. */
  localId: string;
  name: string;
  library: SectionLibrary;
  description: string;
  editableFields: EditableField[];
  animations?: string[];
  thumbnail?: string;
  scoreHints?: ScoreHints;
  aiPrompts?: Partial<AiPromptSet>;
  bestForVerticals?: string[];
  defaultConfig: () => TConfig;
  inner: ComponentType<AppSectionInnerProps<TConfig, TData>>;
  placeholder?: (ctx: {
    manifest: AppManifest;
    sectionName: string;
    mode: SectionRenderMode;
  }) => ReactNode;
};

/** Register an App section into the Studio section registry. Returns
 *  the frozen registration so tests can assert against it. */
export function defineAppSection<
  TConfig extends Record<string, unknown>,
  TData extends AppSectionData
>(def: AppSectionDefinition<TConfig, TData>): SectionRegistration<TConfig> {
  const fullId = `app.${def.manifest.slug}.${def.localId}`;
  const Inner = def.inner;

  const Renderer: ComponentType<SectionRendererProps<TConfig>> = (props) => {
    const appData = readAppSlot<TData>(props.data, def.manifest.slug);
    if (!appData) {
      if (props.mode === "published") return null;
      return def.placeholder
        ? def.placeholder({
            manifest: def.manifest,
            sectionName: def.name,
            mode: props.mode
          })
        : renderDefaultPlaceholder(def.manifest, def.name);
    }
    return (
      <Inner
        instanceId={props.instanceId}
        config={props.config}
        tokens={props.tokens}
        data={props.data}
        appData={appData}
        mode={props.mode}
      />
    );
  };

  const registration: SectionRegistration<TConfig> = {
    id: fullId,
    name: def.name,
    version: def.manifest.version,
    library: def.library,
    description: def.description,
    editableFields: def.editableFields,
    animations: def.animations ?? ["none", "fade"],
    aiPrompts: {
      explain:
        def.aiPrompts?.explain ??
        `Explain when the ${def.name} section from ${def.manifest.name} works well on this merchant's profile.`,
      improve:
        def.aiPrompts?.improve ??
        `Suggest small appearance tweaks to make ${def.name} fit this merchant's brand tokens without changing content.`,
      rewrite:
        def.aiPrompts?.rewrite ??
        `Rewrite the section copy in the merchant's voice while staying concise.`,
      suggestAlternative:
        def.aiPrompts?.suggestAlternative ??
        `Which other Studio section in the ${def.library} library would work better here?`,
      score:
        def.aiPrompts?.score ??
        `Score the current ${def.name} configuration for loading, accessibility, sales momentum, SEO, mobile fit, and brand consistency.`
    },
    thumbnail: def.thumbnail ?? "",
    scoreHints: def.scoreHints,
    telemetryTags: ["app", def.manifest.slug, def.localId],
    bestForVerticals: def.bestForVerticals,
    defaultConfig: def.defaultConfig,
    renderer: Renderer
  };

  sectionRegistry.register(registration);
  return registration;
}

// ─── Helpers ────────────────────────────────────────────────────────

function readAppSlot<T extends AppSectionData>(
  data: MerchantData,
  slug: string
): T | null {
  const apps = (data.domain?.apps ?? null) as
    | Record<string, unknown>
    | null;
  if (!apps) return null;
  const slot = apps[slug];
  if (slot === undefined || slot === null) return null;
  return slot as T;
}

function renderDefaultPlaceholder(
  manifest: AppManifest,
  sectionName: string
): ReactNode {
  return (
    <div
      data-app-placeholder={manifest.slug}
      style={{
        border: "1px dashed #d4d4d4",
        borderRadius: 16,
        padding: "20px 24px",
        margin: "16px 0",
        background: "#fafafa",
        color: "#525252",
        fontSize: 13,
        lineHeight: 1.5,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "#0A0A0A",
          margin: 0
        }}
      >
        {manifest.name} · {sectionName}
      </p>
      <p style={{ margin: "6px 0 0 0", fontWeight: 600 }}>
        Add {manifest.name} content in its dedicated editor to see this
        render.
      </p>
    </div>
  );
}
