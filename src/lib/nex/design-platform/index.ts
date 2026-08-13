// Design Platform · public exports.
//
// Doctrine: docs/brains/nex-design-platform-and-design-object-model-philip-2026-08-04.md

export {
  defaultCapabilities,
  isProduct, isMarketing, isConstruction, isDesignToken, isEnvironment,
} from "./design-object";
export type {
  DesignObject, DesignObjectBase, DesignObjectCategory, DesignObjectType,
  DesignObjectCapabilities, DesignObjectProvenance,
  ProductObject, MarketingObject, ConstructionObject, DesignTokenObject, EnvironmentObject,
} from "./design-object";
export { register, upsert, get, all, byCategory, byTag, byType, compatibleWith, clear, count } from "./registry";
export { listPrimitiveKinds } from "./primitives";
export type { Primitive, PrimitiveKind, RectanglePrimitive, TextPrimitive, ImagePrimitive, VideoPrimitive, GradientPrimitive, ShadowPrimitive, MaskPrimitive, PathPrimitive, IconPrimitive, BorderPrimitive, Box } from "./primitives";
export { countNodes } from "./document-tree";
export type { DocumentTree, PageNode, SectionNode, ContainerNode, ComponentNode, LayerNode, ContainerLayout } from "./document-tree";
export { propagate, STAIRCASE_HEIGHT_RULES } from "./parametric";
export type { ParametricObject, ParametricProperty, PropagationRule, PropertyDelta } from "./parametric";
