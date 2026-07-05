// BrandVoiceComposer — the tone transformer.
//
// v1: emits a `brand-voice-profile` block declaring which personality
// is active, its tone notes, and vocabulary preferences. Doesn't
// mutate existing copy blocks in v1 — the render layer + LLM
// personality adapter (Phase 3.5) will consume this profile.
//
// This ships the CONTRACT so downstream layers can start reading
// the personality; the LLM-driven transformation lands next.

import { composerRegistry } from "../composers";
import type { BrandVoiceProfileBlockData } from "../blocks";
import { buildBlock, buildProvenance, buildRegenerationHints } from "../provenance";
import type { BrandVoicePersonality, ContentBlock, CreativeBrief } from "../types";

const COMPOSER_META = {
  slug: "brand-voice",
  version: "1.0.0",
  backend: "template" as const
};

const P = { name: "Xrated Trades Platform", verified: true } as const;

type VoiceProfile = {
  toneNotes: string;
  prefer: readonly string[];
  avoid: readonly string[];
};

const PROFILES: Record<BrandVoicePersonality, VoiceProfile> = {
  premium: {
    toneNotes:
      "Confident and considered. Longer sentences. Emphasise craftsmanship, materials, and provenance. Avoid discount language.",
    prefer: ["crafted", "considered", "bespoke", "finish", "detail"],
    avoid: ["cheap", "budget", "quick job", "no-frills"]
  },
  friendly: {
    toneNotes:
      "Warm, plain-spoken, contractions welcome. Short sentences. Speak like a friendly tradesperson at the door, not a sales page.",
    prefer: ["you", "we", "chat", "sort", "sort out"],
    avoid: ["utilize", "leverage", "solutions", "premier"]
  },
  traditional: {
    toneNotes:
      "Reassuring, understated, values-led. Reference family / years / trust. Avoid trendy phrasing.",
    prefer: ["family-run", "years", "trusted", "reliable", "workmanship"],
    avoid: ["disruptive", "innovative", "cutting edge"]
  },
  luxury: {
    toneNotes:
      "Editorial, sparse, image-forward. Every sentence earns its place. Never mention price unless prompted.",
    prefer: ["consideration", "atelier", "collection", "commission", "sensibility"],
    avoid: ["cheap", "budget", "value", "affordable", "sale"]
  },
  commercial: {
    toneNotes:
      "Business-to-business. Case studies, ROI, uptime, compliance. Sentences are direct.",
    prefer: ["ROI", "compliance", "case study", "scope", "delivery"],
    avoid: ["homely", "cosy", "family"]
  },
  emergency: {
    toneNotes:
      "Direct and reassuring. Response time first. Short sentences. Address the panic head-on.",
    prefer: ["now", "call", "on our way", "within", "response"],
    avoid: ["consult", "consider", "browse", "showroom"]
  },
  casual: {
    toneNotes:
      "Relaxed, human. Colloquial where appropriate. Never corporate.",
    prefer: ["give us a shout", "we'll come round", "have a chat"],
    avoid: ["at your convenience", "in due course"]
  },
  expert: {
    toneNotes:
      "Authoritative, technical when needed. Explains the WHY behind decisions. Cites standards, materials, methods.",
    prefer: ["standard", "specification", "method", "reason"],
    avoid: ["magic", "amazing", "incredible"]
  }
};

function composeBrandVoiceBlock(brief: CreativeBrief): ContentBlock[] {
  const personality = brief.brandVoice;
  const profile = PROFILES[personality] ?? PROFILES.friendly;

  const data: BrandVoiceProfileBlockData = {
    personality,
    toneNotes: profile.toneNotes,
    vocabulary: {
      prefer: profile.prefer,
      avoid: profile.avoid
    },
    transformationsApplied: []            // future LLM adapter fills this in
  };

  return [
    buildBlock<BrandVoiceProfileBlockData>({
      slug: "brand-voice-profile",
      kind: "brand-voice-profile",
      data,
      provenance: buildProvenance({
        strategy: brief.strategy,
        composer: COMPOSER_META,
        purpose: "brand-voice"
      }),
      regeneration: buildRegenerationHints({
        editableFields: ["personality", "toneNotes"],
        invalidatedBy: ["brandVoice"],
        regenerationHint:
          "Change the personality (premium / friendly / traditional / luxury / commercial / emergency / casual / expert)"
      })
    })
  ];
}

composerRegistry.register({
  manifestVersion: 1,
  slug: COMPOSER_META.slug,
  name: "Brand Voice Composer (template v1)",
  description:
    "Declares which brand-voice personality is active plus its tone notes and vocabulary preferences. LLM adapter registers alongside in Phase 3.5 to transform copy blocks.",
  version: COMPOSER_META.version,
  supportedBlockKinds: ["brand-voice-profile"],
  supportedOutputMedia: [
    "website",
    "landing-page",
    "email-campaign",
    "google-business-post",
    "facebook-ad",
    "brochure",
    "sms-follow-up",
    "ai-assistant-response",
    "customer-portal-message"
  ],
  backend: COMPOSER_META.backend,
  compose: composeBrandVoiceBlock,
  publisher: P
});
