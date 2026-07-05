// forms — barrel. Populated with 6 strategy-aware forms in B5.

import "@/platform/business/facets";   // facet kinds must register first
import "./seeds";

export { formRegistry, REGISTRY_METADATA } from "./registry";
export { StrategyAwareForm } from "./StrategyAwareForm";
export { buildFormSchema, buildFieldSchema } from "./schema";
export type {
  FieldVisibilityRule,
  FormFacetConsumer,
  FormFieldDefinition,
  FormFieldKind,
  FormManifest,
  FormRenderer,
  FormRendererProps,
  FormStep,
  FormSubmitAdapter,
  FormSuccessBehaviour,
  FrozenFormManifest
} from "./types";
