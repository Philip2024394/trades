// video.embed_1 — single-video embed with intro copy.
//
// Merchant pastes a YouTube or Vimeo URL; we parse the ID and mount a
// privacy-preserving embed (youtube-nocookie / player.vimeo). 16:9
// responsive frame — CSS aspect-ratio keeps the tile shape stable
// across viewports. Empty URL renders a placeholder chip so the
// merchant can see where the video would go.

import Link from "next/link";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  videoUrl: string;
  showCta: boolean;
  ctaLabel: string;
  ctaHref: string;
};

/** Extract embed URL from common share URLs. Returns null when we don't
 *  recognise the format — the renderer shows a "paste a video URL"
 *  placeholder in that case. */
function toEmbedUrl(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // youtu.be/<id> or youtube.com/watch?v=<id>
  const yt =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i.exec(
      trimmed
    );
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;

  // vimeo.com/<id>
  const vm = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(trimmed);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;

  // Already an embed URL — trust it as-is.
  if (/(youtube-nocookie|player\.vimeo|youtube\.com\/embed)/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function VideoEmbed({
  instanceId,
  config,
  tokens,
  data,
  mode
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string | undefined) ?? "#FFB300";
  const surface = (tokens["color.surface"] as string | undefined) ?? "#FFFFFF";
  const text = (tokens["color.text"] as string | undefined) ?? "#0A0A0A";
  const muted = (tokens["color.muted"] as string | undefined) ?? "#737373";
  const headingFont = tokens["font.heading"] as string | undefined;
  const bodyFont = tokens["font.body"] as string | undefined;
  const headingWeight = tokens["font.heading.weight"] as number | undefined;
  const bodyWeight = tokens["font.body.weight"] as number | undefined;
  const isEditing = mode === "edit";

  const embedUrl = toEmbedUrl(config.videoUrl);
  const ctaHref =
    config.ctaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.ctaHref;

  return (
    <section
      className="w-full"
      style={{ background: surface, color: text }}
      {...sectionRootAttrs(instanceId, "video.embed_1", "Video")}
    >
      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="text-center">
          {config.eyebrow && (
            <p
              className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: accent }}
              {...treeAttrs(instanceId, "eyebrow", "Small kicker", "text")}
            >
              {config.eyebrow}
            </p>
          )}
          {config.heading && (
            <h2
              className="mt-2 text-3xl leading-tight sm:text-4xl"
              style={{ fontFamily: headingFont, fontWeight: headingWeight ?? 800 }}
              {...treeAttrs(instanceId, "heading", "Main headline", "text")}
            >
              {config.heading}
            </h2>
          )}
          {config.subheading && (
            <p
              className="mx-auto mt-3 max-w-2xl text-[14px] leading-relaxed sm:text-[16px]"
              style={{
                color: muted,
                fontFamily: bodyFont,
                fontWeight: bodyWeight ?? 500
              }}
              {...treeAttrs(instanceId, "subheading", "Supporting line", "text")}
            >
              {config.subheading}
            </p>
          )}
        </div>

        <div
          className="relative mt-8 overflow-hidden rounded-2xl bg-neutral-100 shadow-md"
          style={{ aspectRatio: "16 / 9" }}
          {...treeAttrs(instanceId, "videoUrl", "Video", "image")}
        >
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={config.heading || "Video"}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-neutral-500">
              <span
                aria-hidden="true"
                className="grid h-14 w-14 place-items-center rounded-full text-[22px] font-extrabold text-neutral-900"
                style={{ background: accent }}
              >
                ▶
              </span>
              <p className="text-[11px] font-extrabold uppercase tracking-widest">
                Paste a YouTube or Vimeo URL
              </p>
              <p className="max-w-xs text-center text-[11px] text-neutral-400">
                Click here in edit mode, then choose Replace on the toolbar
                — or paste a URL directly into the video field.
              </p>
            </div>
          )}
        </div>

        {config.showCta && config.ctaLabel && (
          <div className="mt-6 flex justify-center">
            <Link
              href={ctaHref || "#"}
              tabIndex={isEditing ? -1 : undefined}
              className="inline-flex h-12 items-center rounded-xl px-5 text-[12px] font-extrabold uppercase tracking-widest transition hover:brightness-95"
              style={{ background: accent, color: "#0A0A0A" }}
              {...treeAttrs(instanceId, "ctaLabel", "CTA button", "button")}
            >
              {config.ctaLabel} →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "video.embed_1",
  name: "Video embed",
  version: "1.0.0",
  library: "video",
  description:
    "Single 16:9 video embed (YouTube or Vimeo) with intro copy above and optional CTA below. Uses privacy-preserving embed domains and lazy iframe loading. Best for company overview, meet-the-team, or walk-throughs.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Watch", priority: "text", group: "Copy" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 120 }, default: "60 seconds with us.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Supporting line", type: { kind: "text", maxLength: 220, multiline: true }, default: "A quick walk-around of a recent job and how we work with customers day-to-day.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "videoUrl", label: "Video URL", type: { kind: "text", maxLength: 400 }, default: "", description: "Paste a YouTube or Vimeo watch URL — we handle the conversion.", group: "Video" },
    { key: "showCta", label: "Show button below", type: { kind: "boolean" }, default: true, group: "Button" },
    { key: "ctaLabel", label: "Button text", type: { kind: "text", maxLength: 24 }, default: "WhatsApp for a quote", priority: "button", group: "Button" },
    { key: "ctaHref", label: "Button link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "#whatsapp", description: 'Type "#whatsapp" to open WhatsApp instead of a link.', group: "Button" }
  ],
  animations: ["none", "fade"],
  aiPrompts: {
    explain: "Explain why a company-overview video works on a UK trade landing page. Reference specific copy.",
    improve: "Improve without layout change. Headline under 6 words. Sub-line one sentence. Return only patched config.",
    rewrite: "Rewrite copy in a {tone} voice.",
    suggestAlternative: "Suggest an alternative video layout from library='video'. One-sentence rationale.",
    score: "Score across 6 dimensions. JSON only."
  },
  thumbnail: "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/video-embed-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 100, blockingResources: ["youtube-iframe"] },
    accessibility: { contrastMin: 4.5 },
    sales: { primaryActionRequired: true },
    seo: { headingLevel: 2, structuredData: "VideoObject" },
    mobile: { minTapTargetPx: 44 },
    brandConsistency: { boundTokens: ["color.accent", "color.surface", "color.text"] }
  },
  telemetryTags: [
    "video",
    "embed",
    "youtube_vimeo",
    "16_9",
    "single_video"
  ],
  bestForVerticals: [
    "landscaping",
    "joinery",
    "roofing",
    "plant_hire",
    "kitchen_install",
    "bathroom_install",
    "electrical",
    "hvac",
    "carpentry",
    "brickwork"
  ],
  defaultConfig: () => ({
    eyebrow: "Watch",
    heading: "60 seconds with us.",
    subheading:
      "A quick walk-around of a recent job and how we work with customers day-to-day.",
    videoUrl: "",
    showCta: true,
    ctaLabel: "WhatsApp for a quote",
    ctaHref: "#whatsapp"
  }),
  renderer: VideoEmbed
};

sectionRegistry.register(registration);
