"use client";

// Add-on wrapper — Newsletter signup.
//
// Wraps NewsletterSignup. Because the signup form only needs the
// merchant slug + display name (already in MerchantData), the storefront
// hydrator just marks the slot as { enabled: true } — no additional
// payload required.

import { NewsletterSignup } from "@/components/xrated/profile/merchant/NewsletterSignup";
import type { HammerexTradeOffListing } from "@/lib/supabase";
import { defineAddonSection } from "./_adapter";

type NewsletterAddonConfig = {
  headingCopy: string;
  supportingCopy: string;
  buttonLabel: string;
  headingColor: string;
  supportingColor: string;
  background: string;
  buttonBackground: string;
  buttonInk: string;
  cardRadius: number;
  layout: "compact" | "wide";
};

type NewsletterAddonData = { enabled: true };

function NewsletterInner({
  config,
  data
}: {
  config: NewsletterAddonConfig;
  data: { slug: string; merchantName: string };
  addonData: NewsletterAddonData;
  tokens: Record<string, unknown>;
  mode: string;
}) {
  const listingShim = {
    slug: data.slug,
    display_name: data.merchantName
  } as Pick<HammerexTradeOffListing, "slug" | "display_name">;

  return (
    <section
      style={{
        background: config.background,
        borderRadius: config.cardRadius,
        padding: config.layout === "compact" ? "24px" : "40px 24px",
        margin: "16px 0"
      }}
      data-addon-section="newsletter"
    >
      <div
        style={{
          maxWidth: config.layout === "compact" ? 480 : 720,
          margin: "0 auto"
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: config.headingColor,
            margin: 0
          }}
        >
          Newsletter
        </p>
        <h2
          style={{
            color: config.headingColor,
            fontSize: 20,
            fontWeight: 800,
            margin: "6px 0 0"
          }}
        >
          {config.headingCopy}
        </h2>
        {config.supportingCopy && (
          <p
            style={{
              color: config.supportingColor,
              fontSize: 13,
              lineHeight: 1.55,
              margin: "8px 0 16px"
            }}
          >
            {config.supportingCopy}
          </p>
        )}
        <NewsletterSignup listing={listingShim} />
      </div>
    </section>
  );
}

defineAddonSection<NewsletterAddonConfig, NewsletterAddonData>({
  addonSlug: "newsletter",
  library: "newsletter",
  name: "Newsletter",
  description:
    "GDPR-compliant email capture. Merchants export the list; Thenetworkers never sends emails. Appearance only.",
  thumbnail: "/studio/thumbnails/newsletter-signup.png",
  bestForVerticals: ["building-merchant", "builders-supplies", "tool-hire"],
  animations: ["none", "fade"],
  editableFields: [
    {
      key: "headingCopy",
      label: "Heading",
      type: { kind: "text", maxLength: 80 },
      default: "Get stock arrivals + promos in your inbox",
      priority: "text",
      aiPromptable: true,
      group: "Copy"
    },
    {
      key: "supportingCopy",
      label: "Supporting copy",
      type: { kind: "text", maxLength: 200, multiline: true },
      default:
        "One email a week when new stock lands. Unsubscribe anytime — we never share your address.",
      priority: "text",
      aiPromptable: true,
      group: "Copy"
    },
    {
      key: "buttonLabel",
      label: "Button label",
      type: { kind: "text", maxLength: 24 },
      default: "Subscribe",
      priority: "button",
      aiPromptable: true,
      group: "Copy"
    },
    {
      key: "headingColor",
      label: "Heading colour",
      type: { kind: "color", brandBindable: true },
      default: "#0A0A0A",
      bindsTo: "color.ink",
      group: "Colour"
    },
    {
      key: "supportingColor",
      label: "Supporting text colour",
      type: { kind: "color", brandBindable: true },
      default: "#525252",
      bindsTo: "color.muted",
      group: "Colour"
    },
    {
      key: "background",
      label: "Background",
      type: { kind: "color", brandBindable: true },
      default: "#F5F5F5",
      bindsTo: "color.subtle",
      group: "Colour"
    },
    {
      key: "buttonBackground",
      label: "Button background",
      type: { kind: "color", brandBindable: true },
      default: "#FFB300",
      bindsTo: "color.primary",
      group: "Colour"
    },
    {
      key: "buttonInk",
      label: "Button text colour",
      type: { kind: "color", brandBindable: true },
      default: "#0A0A0A",
      bindsTo: "color.ink",
      group: "Colour"
    },
    {
      key: "cardRadius",
      label: "Card corner radius",
      type: { kind: "number", min: 0, max: 32, step: 2, unit: "px" },
      default: 16,
      bindsTo: "radius.md",
      group: "Shape"
    },
    {
      key: "layout",
      label: "Layout",
      type: {
        kind: "select",
        options: [
          { value: "compact", label: "Compact" },
          { value: "wide", label: "Wide" }
        ]
      },
      default: "compact",
      group: "Layout"
    }
  ],
  defaultConfig: () => ({
    headingCopy: "Get stock arrivals + promos in your inbox",
    supportingCopy:
      "One email a week when new stock lands. Unsubscribe anytime — we never share your address.",
    buttonLabel: "Subscribe",
    headingColor: "#0A0A0A",
    supportingColor: "#525252",
    background: "#F5F5F5",
    buttonBackground: "#FFB300",
    buttonInk: "#0A0A0A",
    cardRadius: 16,
    layout: "compact"
  }),
  inner: NewsletterInner
});
