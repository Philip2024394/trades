// Four-Layer Distinction · public exports.
//
// Doctrine: docs/brains/nex-four-layer-distinction-philip-2026-08-04.md

export {
  classifyModule, modulesInLayer, describeLayer, walkOrderBackward,
  isReadOnlyAcrossLayers, requireLayerRegistration,
} from "./classify";
export {
  LAYER_ORDER, LAYER_DESCRIPTION, LAYER_QUESTION, LAYER_MAP, READ_ONLY_ACROSS_LAYERS,
} from "./types";
export type { Layer, LayerAttribution } from "./types";
