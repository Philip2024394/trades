// hero.chat_bubble_hero_1 — WhatsApp Chat Bubble Hero.
//
// Trade-native show-don't-tell hero: renders a realistic WhatsApp
// conversation preview between "You" and the customer. Reduces the
// customer's cognitive load — they see exactly what tapping the
// WhatsApp button will produce.
//
// Design principles applied:
//   • Show the customer the outcome of the CTA before they tap
//   • Familiar chat UI = instant "I know how to use this"
//   • Merchant messages read as the trade's actual voice (editable)
//   • Timestamp + "read" tick = active-and-professional signal
//   • WhatsApp green + white on dark surface = universal recognition

"use client";

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
  ctaLabel: string;
  ctaHref: string;
  supportingCopy: string;
  customerName: string;
  customerAvatarUrl: string;
  msg1Customer: string;
  msg1Time: string;
  msg2Merchant: string;
  msg2Time: string;
  msg3Customer: string;
  msg3Time: string;
  msg4Merchant: string;
  msg4Time: string;
  onlineStatus: string;
  backgroundImageUrl: string;
  backgroundImageOpacity: number;
};

const WA_GREEN = "#166534";
const WA_TINT = "#DCF8C6";
const WA_BG = "#0B141A";
const WA_BUBBLE = "#202C33";

function ChatBubbleHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const headingFont = (tokens["font.heading"] as string) ?? "inherit";
  const bodyFont = (tokens["font.body"] as string) ?? "inherit";

  const ctaHref =
    config.ctaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.ctaHref;

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #0A0A0A 0%, #141414 100%)",
        color: "#FFFFFF",
        fontFamily: bodyFont
      }}
      {...sectionRootAttrs(instanceId, "hero.chat_bubble_hero_1", "WhatsApp Chat Hero")}
    >
      {config.backgroundImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={config.backgroundImageUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover"
          style={{
            opacity: Math.max(0, Math.min(1, config.backgroundImageOpacity ?? 1))
          }}
          {...treeAttrs(instanceId, "backgroundImageUrl", "Background photo", "image")}
        />
      )}
      {config.backgroundImageUrl && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.55) 100%)"
          }}
        />
      )}

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14 lg:py-24">
        {/* LEFT — copy column */}
        <div>
          {config.eyebrow && (
            <p
              className="text-[11px] font-extrabold uppercase tracking-[0.28em]"
              style={{ color: accent }}
              {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
            >
              {config.eyebrow}
            </p>
          )}
          <h1
            className="mt-3 text-4xl font-extrabold leading-[0.95] sm:text-5xl lg:text-6xl"
            style={{ fontFamily: headingFont, letterSpacing: "-0.02em" }}
            {...treeAttrs(instanceId, "heading", "Headline", "text")}
          >
            {config.heading}
          </h1>
          {config.subheading && (
            <p
              className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/75 sm:text-[17px]"
              {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
            >
              {config.subheading}
            </p>
          )}

          <Link
            href={ctaHref || "#"}
            className="mt-8 inline-flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest transition active:scale-[0.98]"
            style={{
              background: WA_GREEN,
              color: "#FFFFFF",
              boxShadow: `0 8px 24px ${WA_GREEN}55`
            }}
            {...treeAttrs(instanceId, "ctaLabel", "WhatsApp CTA", "button")}
          >
            <WhatsAppIcon />
            <span>{config.ctaLabel}</span>
          </Link>

          {config.supportingCopy && (
            <p
              className="mt-4 text-[11px] font-bold uppercase tracking-[0.22em] text-white/50"
              {...treeAttrs(instanceId, "supportingCopy", "Supporting copy", "text")}
            >
              {config.supportingCopy}
            </p>
          )}
        </div>

        {/* RIGHT — WhatsApp chat mockup */}
        <div className="flex justify-center lg:justify-end">
          <div
            className="w-full max-w-sm overflow-hidden rounded-3xl border shadow-2xl"
            style={{
              background: WA_BG,
              borderColor: "rgba(255,255,255,0.08)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
            }}
          >
            {/* WhatsApp header */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ background: WA_BUBBLE }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full"
                style={{ background: WA_GREEN }}
              >
                {config.customerAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={config.customerAvatarUrl}
                    alt={config.customerName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-extrabold text-white">
                    {config.customerName?.[0]?.toUpperCase() ?? "?"}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-extrabold text-white"
                  {...treeAttrs(instanceId, "customerName", "Customer name", "text")}
                >
                  {config.customerName}
                </p>
                <p
                  className="mt-0.5 text-[10px]"
                  style={{ color: WA_GREEN }}
                  {...treeAttrs(instanceId, "onlineStatus", "Online status", "text")}
                >
                  {config.onlineStatus}
                </p>
              </div>
              <VideoIcon />
              <PhoneIcon />
            </div>

            {/* Chat body — repeating dot pattern like real WA */}
            <div
              className="relative flex flex-col gap-2 p-4"
              style={{
                background: WA_BG,
                backgroundImage:
                  "radial-gradient(circle, rgba(255,255,255,0.02) 1px, transparent 1px)",
                backgroundSize: "20px 20px"
              }}
            >
              {config.msg1Customer && (
                <Bubble side="left" time={config.msg1Time} instanceId={instanceId} treeKey="msg1Customer">
                  {config.msg1Customer}
                </Bubble>
              )}
              {config.msg2Merchant && (
                <Bubble side="right" time={config.msg2Time} instanceId={instanceId} treeKey="msg2Merchant" read>
                  {config.msg2Merchant}
                </Bubble>
              )}
              {config.msg3Customer && (
                <Bubble side="left" time={config.msg3Time} instanceId={instanceId} treeKey="msg3Customer">
                  {config.msg3Customer}
                </Bubble>
              )}
              {config.msg4Merchant && (
                <Bubble side="right" time={config.msg4Time} instanceId={instanceId} treeKey="msg4Merchant" read>
                  {config.msg4Merchant}
                </Bubble>
              )}
            </div>

            {/* Input mock */}
            <div
              className="flex items-center gap-2 px-3 py-3"
              style={{ background: WA_BUBBLE }}
            >
              <div
                className="flex h-10 flex-1 items-center rounded-full px-4 text-[13px] text-white/45"
                style={{ background: WA_BG }}
              >
                Type a message
              </div>
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: WA_GREEN }}
              >
                <MicIcon />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bubble({
  children,
  side,
  time,
  read,
  instanceId,
  treeKey
}: {
  children: React.ReactNode;
  side: "left" | "right";
  time: string;
  read?: boolean;
  instanceId: string;
  treeKey: string;
}) {
  const isRight = side === "right";
  return (
    <div className={`flex ${isRight ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[85%] rounded-2xl px-3 py-2 shadow-sm"
        style={{
          background: isRight ? WA_TINT : WA_BUBBLE,
          color: isRight ? "#0B141A" : "#E9EDEF",
          borderTopRightRadius: isRight ? 4 : 16,
          borderTopLeftRadius: isRight ? 16 : 4
        }}
        {...treeAttrs(instanceId, treeKey, "Message", "text")}
      >
        <p className="whitespace-pre-wrap text-[13px] leading-snug">{children}</p>
        <div className="mt-1 flex items-center justify-end gap-1">
          <span
            className="text-[10px]"
            style={{ color: isRight ? "rgba(11,20,26,0.55)" : "rgba(233,237,239,0.55)" }}
          >
            {time}
          </span>
          {isRight && (
            <svg width="14" height="10" viewBox="0 0 16 10" fill="none" aria-hidden="true">
              <path
                d="M1 5.5 4 8.5 10 1.5"
                stroke={read ? "#53BDEB" : "rgba(11,20,26,0.55)"}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M5 5.5 8 8.5 15 1.5"
                stroke={read ? "#53BDEB" : "rgba(11,20,26,0.55)"}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M20.52 3.449C12.831-3.984.106 1.407.101 11.893c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652c7.29 3.925 16.436-1.322 16.437-10.348-.001-3.166-1.233-6.144-3.253-8.55zm-8.62 17.204c-1.796 0-3.554-.482-5.09-1.395l-.365-.217-3.79.988 1.01-3.677-.237-.379a10.001 10.001 0 01-1.53-5.339c.003-7.72 7.955-11.582 13.395-6.14 5.44 5.441 1.594 13.44-6.14 13.44z" />
    </svg>
  );
}
function VideoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.chat_bubble_hero_1",
  name: "WhatsApp Chat Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Show-don't-tell hero: renders a realistic WhatsApp conversation preview so customers see exactly what tapping the CTA produces.",
  editableFields: [
    { key: "eyebrow", role: "eyebrow",label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Real quotes. Real fast.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", role: "headline",label: "Headline", type: { kind: "text", maxLength: 100 }, default: "Message us. We reply in minutes.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", role: "subhead",label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "No phone calls, no forms, no email tag. One WhatsApp message and a real engineer replies with a quote — usually inside 20 minutes.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "ctaLabel", role: "primary_action_label",label: "CTA label", type: { kind: "text", maxLength: 30 }, default: "Message us on WhatsApp", priority: "button", aiPromptable: true, group: "CTA" },
    { key: "ctaHref", role: "primary_action_href",label: "CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTA" },
    { key: "supportingCopy", role: "supporting_copy",label: "Supporting copy", type: { kind: "text", maxLength: 80 }, default: "Avg reply: 12 minutes · Mon-Sat, 7am-9pm", priority: "text", group: "Copy" },
    { key: "customerName", label: "Customer name (mockup)", type: { kind: "text", maxLength: 40 }, default: "Sarah — Leeds", priority: "text", group: "Chat mockup" },
    { key: "customerAvatarUrl", role: "avatar_media",label: "Customer avatar URL", type: { kind: "image", aspectRatio: "1:1", recommendedWidthPx: 200 }, default: "", group: "Chat mockup" },
    { key: "onlineStatus", label: "Online status", type: { kind: "text", maxLength: 40 }, default: "online now", group: "Chat mockup" },
    { key: "msg1Customer", label: "Message 1 (customer)", type: { kind: "text", maxLength: 200, multiline: true }, default: "Hi, my boiler's making a weird noise — can you take a look this week?", group: "Messages" },
    { key: "msg1Time", label: "Message 1 time", type: { kind: "text", maxLength: 10 }, default: "10:14", group: "Messages" },
    { key: "msg2Merchant", label: "Message 2 (you)", type: { kind: "text", maxLength: 200, multiline: true }, default: "Sure — is it a knocking sound or more of a whine? Any error code on the display?", group: "Messages" },
    { key: "msg2Time", label: "Message 2 time", type: { kind: "text", maxLength: 10 }, default: "10:17", group: "Messages" },
    { key: "msg3Customer", label: "Message 3 (customer)", type: { kind: "text", maxLength: 200, multiline: true }, default: "Knocking. And it says F22.", group: "Messages" },
    { key: "msg3Time", label: "Message 3 time", type: { kind: "text", maxLength: 10 }, default: "10:19", group: "Messages" },
    { key: "msg4Merchant", label: "Message 4 (you)", type: { kind: "text", maxLength: 200, multiline: true }, default: "Sounds like the pump. £180 for the fix, in stock, I can be there tomorrow morning. Shall I book you in?", group: "Messages" },
    { key: "msg4Time", label: "Message 4 time", type: { kind: "text", maxLength: 10 }, default: "10:23", group: "Messages" },
    { key: "backgroundImageUrl", role: "background_media",label: "Background photo", type: { kind: "image", aspectRatio: "16:9", recommendedWidthPx: 1920 }, default: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2009_25_35%20AM.png?updatedAt=1783045558515", group: "Background", description: "Full-bleed photo behind the copy + chat mockup. Leave empty for the plain dark gradient." },
    { key: "backgroundImageOpacity", role: "opacity",label: "Background photo opacity", type: { kind: "number", min: 0, max: 1, step: 0.05 }, default: 1, group: "Background" }
  ],
  animations: ["none", "fade-in", "type-in"],
  aiPrompts: {
    explain: "Explain when the WhatsApp Chat hero works best.",
    improve: "Suggest which mock messages best represent this merchant's real voice.",
    rewrite: "Rewrite the mock conversation for this trade.",
    suggestAlternative: "Which hero would work for a trade that doesn't do WhatsApp?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "whatsapp", "chat", "show-dont-tell"],
  bestForVerticals: ["plumber", "electrician", "boiler-engineer", "carpenter", "roofer", "cleaner", "landscaper", "handyman"],
  defaultConfig: () => ({
    eyebrow: "Real quotes. Real fast.",
    heading: "Message us. We reply in minutes.",
    subheading: "No phone calls, no forms, no email tag. One WhatsApp message and a real engineer replies with a quote — usually inside 20 minutes.",
    ctaLabel: "Message us on WhatsApp",
    ctaHref: "#whatsapp",
    supportingCopy: "Avg reply: 12 minutes · Mon-Sat, 7am-9pm",
    customerName: "Sarah — Leeds",
    customerAvatarUrl: "",
    onlineStatus: "online now",
    msg1Customer: "Hi, my boiler's making a weird noise — can you take a look this week?",
    msg1Time: "10:14",
    msg2Merchant: "Sure — is it a knocking sound or more of a whine? Any error code on the display?",
    msg2Time: "10:17",
    msg3Customer: "Knocking. And it says F22.",
    msg3Time: "10:19",
    msg4Merchant: "Sounds like the pump. £180 for the fix, in stock, I can be there tomorrow morning. Shall I book you in?",
    msg4Time: "10:23",
    backgroundImageUrl:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2009_25_35%20AM.png?updatedAt=1783045558515",
    backgroundImageOpacity: 1
  }),
  renderer: ChatBubbleHero
};

sectionRegistry.register(registration);
