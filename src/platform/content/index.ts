// Content — AI Creative Director. Side-effect registers 4 specialists.

import "./specialists/copy";
import "./specialists/projectStory";
import "./specialists/seo";
import "./specialists/brandVoice";

export { composerRegistry, REGISTRY_METADATA } from "./composers";
export type {
  ComposerBackend,
  ComposerManifest,
  FrozenComposerManifest
} from "./composers";
export { buildBlock, buildProvenance, buildRegenerationHints, bandForPlaybooks } from "./provenance";
export { CreativeDirector, direct, regenerate } from "./CreativeDirector";
export type {
  BrandVoicePersonality,
  ContentAudience,
  ContentBlock,
  ContentBlockKind,
  ContentManifest,
  ContentPage,
  ContentProvenance,
  ContentPurpose,
  ContentSection,
  CreativeBrief,
  OutputMedium,
  ProjectInput,
  RegenerationHints,
  RegenerationRequest,
  RegenerationScope
} from "./types";
export type {
  BrandVoiceProfileBlockData,
  CtaBandBlockData,
  FaqBlockData,
  HeroBlockData,
  ProjectStoryBlockData,
  SeoPageBlockData,
  ServiceListBlockData,
  TestimonialCopyBlockData,
  TrustCopyBlockData,
  ValuePropsBlockData
} from "./blocks";
