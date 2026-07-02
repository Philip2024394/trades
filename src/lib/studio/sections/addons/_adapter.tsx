// Add-on → Studio section adapter.
//
// The bridge helper every add-on wrapper uses to register itself into
// the Studio section registry. Encapsulates the shared behaviour so
// individual wrappers stay tiny (~40 lines of styling metadata + a
// renderer wrapper) and follow the same rules.
//
// Rules encoded here:
//   • Studio owns APPEARANCE. Wrapper editableFields are styling only —
//     never team-member lists, product rows, machine specs, etc.
//   • Content is edited in the dedicated per-add-on editor. The wrapper's
//     `contentEditorPath` deep-links there; the toolbar surfaces it as
//     "Edit Content →".
//   • Add-on gate: in `published` mode, the wrapper renders nothing if
//     the merchant hasn't enabled the add-on. In `edit`/`preview` mode
//     it renders a gentle placeholder so the merchant sees where their
//     add-on will land once they enable it.
//   • Data hydration: the customer-facing storefront loader populates
//     `data.domain.addons[<slug>]` before passing MerchantData to the
//     shell. Wrappers read from there. If the slot is empty, the
//     wrapper renders the "content not ready" placeholder.
//
// The addon's Studio section is always id-prefixed `addon.<slug>` and
// tagged with telemetry so Live Component Intelligence can slice
// usage: `addon`, `<slug>`.

import type { ComponentType, ReactNode } from "react";
import type { XratedAddon } from "@/lib/xratedAddons";
import { getAddonBySlug } from "@/lib/xratedAddons";
import { sectionRegistry } from "../../sectionRegistry";
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
} from "../../sectionTypes";

/** Shape of `data.domain.addons[<slug>]` — each wrapper declares what
 *  it expects; the storefront hydrator populates it from the listing. */
export type AddonDomainSlot = Record<string, unknown> | null;

export type AddonSectionInnerProps<TConfig, TData extends AddonDomainSlot> = {
  instanceId: string;
  config: TConfig;
  tokens: BrandTokens;
  data: MerchantData;
  addonData: TData;
  mode: SectionRenderMode;
};

export type AddonSectionDefinition<
  TConfig extends Record<string, unknown>,
  TData extends AddonDomainSlot
> = {
  /** The addon slug from XRATED_ADDONS. Used to gate visibility and
   *  route "Edit Content →". Throws at registration time if the slug
   *  isn't in the catalogue. */
  addonSlug: string;
  /** Which SectionLibrary bucket this addon lives in. Merchants find
   *  addons by browsing library buckets (Business, Trade, Sales, etc.),
   *  so the SectionLibrary tag maps to that classification. */
  library: SectionLibrary;
  /** Section-registry name shown on cards + toolbar. Often mirrors
   *  the addon's XratedAddon.name. */
  name: string;
  /** One-line pitch on the section card. */
  description: string;
  /** Registration semver — bump on breaking config changes so config
   *  migrations can trigger. */
  version?: string;
  /** URL to the Library UI thumbnail. */
  thumbnail: string;
  /** Editable APPEARANCE fields — colours, typography, radius, spacing,
   *  animations, layout toggles. NEVER content-list fields. */
  editableFields: EditableField[];
  /** Named animations this section supports. */
  animations?: string[];
  /** Starter config when the merchant picks the section. */
  defaultConfig: () => TConfig;
  /** Score-engine hints. Wrapper usually inherits from its inner
   *  component's a11y contract. */
  scoreHints?: ScoreHints;
  /** AI Gateway prompts. */
  aiPrompts?: Partial<AiPromptSet>;
  /** Verticals this addon best serves. */
  bestForVerticals?: string[];
  /** The inner React component that renders the addon. Receives resolved
   *  props including the addon's domain data slot. Wrapper handles gate,
   *  placeholder, and "Edit Content →" chip. */
  inner: ComponentType<AddonSectionInnerProps<TConfig, TData>>;
  /** Optional custom placeholder rendered in `edit`/`preview` when the
   *  add-on isn't yet enabled or has no content. Defaults to the shared
   *  neutral placeholder. */
  placeholder?: (ctx: {
    mode: SectionRenderMode;
    addon: XratedAddon;
    data: MerchantData;
  }) => ReactNode;
};

/** Register an add-on as a Studio section. Returns the SectionRegistration
 *  so the caller can also export it for tests. */
export function defineAddonSection<
  TConfig extends Record<string, unknown>,
  TData extends AddonDomainSlot
>(def: AddonSectionDefinition<TConfig, TData>): SectionRegistration<TConfig> {
  const addon = getAddonBySlug(def.addonSlug);
  if (!addon) {
    throw new Error(
      `defineAddonSection: unknown addon slug "${def.addonSlug}". ` +
        `Add it to XRATED_ADDONS in @/lib/xratedAddons first.`
    );
  }

  const Inner = def.inner;

  const Renderer: ComponentType<SectionRendererProps<TConfig>> = (props) => {
    const { config, tokens, data, mode, instanceId } = props;
    const addonSlot = readAddonSlot<TData>(data, def.addonSlug);
    const isEnabled = readAddonEnabled(data, def.addonSlug);

    // Published mode: never surface a disabled addon to customers.
    if (mode === "published" && (!isEnabled || !addonSlot)) {
      return null;
    }

    // Edit / preview mode: if the slot is missing, show a coach card so
    // the merchant knows what will render once content is added.
    if (!addonSlot) {
      return def.placeholder
        ? def.placeholder({ mode, addon, data })
        : renderDefaultPlaceholder({ addon, mode, missing: "content" });
    }

    if (!isEnabled) {
      return def.placeholder
        ? def.placeholder({ mode, addon, data })
        : renderDefaultPlaceholder({ addon, mode, missing: "enable" });
    }

    return (
      <Inner
        instanceId={instanceId}
        config={config}
        tokens={tokens}
        data={data}
        addonData={addonSlot}
        mode={mode}
      />
    );
  };

  const registration: SectionRegistration<TConfig> = {
    id: `addon.${def.addonSlug}`,
    name: def.name,
    version: def.version ?? "1.0.0",
    library: def.library,
    description: def.description,
    editableFields: def.editableFields,
    animations: def.animations ?? ["none", "fade"],
    aiPrompts: {
      explain:
        def.aiPrompts?.explain ??
        `Explain when the ${addon.name} addon works well on a trade profile and where it can distract.`,
      improve:
        def.aiPrompts?.improve ??
        `Suggest small appearance tweaks to make the ${addon.name} section fit this merchant's brand tokens without changing content.`,
      rewrite:
        def.aiPrompts?.rewrite ??
        `Rewrite the section heading and helper copy in the merchant's voice while keeping it concise.`,
      suggestAlternative:
        def.aiPrompts?.suggestAlternative ??
        `Which other Studio section in the ${def.library} library would work better here for a ${addon.personas.join(", ")} audience?`,
      score:
        def.aiPrompts?.score ??
        `Score the current ${addon.name} configuration for loading, accessibility, sales momentum, SEO, mobile fit, and brand consistency.`
    },
    thumbnail: def.thumbnail,
    scoreHints: def.scoreHints,
    telemetryTags: ["addon", def.addonSlug],
    bestForVerticals: def.bestForVerticals,
    defaultConfig: def.defaultConfig,
    renderer: Renderer
  };

  sectionRegistry.register(registration);
  return registration;
}

/** Read the addon-specific domain slot from MerchantData. Returns null
 *  when the storefront hydrator hasn't populated it. */
function readAddonSlot<TData extends AddonDomainSlot>(
  data: MerchantData,
  slug: string
): TData | null {
  const addons = (data.domain?.addons ?? null) as
    | Record<string, unknown>
    | null;
  if (!addons) return null;
  const slot = addons[slug];
  if (slot === undefined || slot === null) return null;
  return slot as TData;
}

/** True when the merchant has toggled the addon on OR it's included
 *  with their tier. Studio's storefront hydrator writes the boolean
 *  into `data.domain.addonsEnabled` so wrappers don't need the full
 *  listing shape. */
function readAddonEnabled(data: MerchantData, slug: string): boolean {
  const map = (data.domain?.addonsEnabled ?? null) as
    | Record<string, boolean>
    | null;
  if (!map) return false;
  return map[slug] === true;
}

// ─── Default placeholder ────────────────────────────────────────────
//
// Neutral, unstyled hint used when a wrapper hasn't provided its own.
// Shown only in edit/preview — never on the customer-facing storefront.

function renderDefaultPlaceholder({
  addon,
  mode,
  missing
}: {
  addon: XratedAddon;
  mode: SectionRenderMode;
  missing: "enable" | "content";
}): ReactNode {
  if (mode === "published") return null;
  const message =
    missing === "enable"
      ? `Enable ${addon.name} to render this section on the live profile.`
      : `Add ${addon.name} content in the dedicated editor to see it render here.`;
  return (
    <div
      data-addon-placeholder={addon.slug}
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
        {addon.name}
      </p>
      <p style={{ margin: "6px 0 0 0", fontWeight: 600 }}>{message}</p>
    </div>
  );
}
