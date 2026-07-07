// ai-visualiser — public entry point.
//
// Usage:
//   <AiVisualiserApp size="square" merchantId={m.id} scope={leaves} onLaunch={openFlow} />
//   <AiVisualiserApp size="landscape" ... />   {/* gold-path slot */}
//   <AiVisualiserApp size="portrait" ... />

import { AI_VISUALISER_APP_MANIFEST } from "./manifest";
import type { AiVisualiserAppSize } from "./manifest";
import { AiVisualiserSquare } from "./AiVisualiserSquare";
import { AiVisualiserLandscape } from "./AiVisualiserLandscape";
import { AiVisualiserPortrait } from "./AiVisualiserPortrait";
import type { AiVisualiserTilePropsBase } from "./types";

export type AiVisualiserAppProps = AiVisualiserTilePropsBase & {
  size: AiVisualiserAppSize;
};

export function AiVisualiserApp({ size, ...rest }: AiVisualiserAppProps) {
  switch (size) {
    case "square":
      return <AiVisualiserSquare {...rest} />;
    case "landscape":
      return <AiVisualiserLandscape {...rest} />;
    case "portrait":
      return <AiVisualiserPortrait {...rest} />;
  }
}

export { AI_VISUALISER_APP_MANIFEST } from "./manifest";
export type { AiVisualiserAppSize, AiVisualiserPlanKey } from "./manifest";
export { AiVisualiserSquare } from "./AiVisualiserSquare";
export { AiVisualiserLandscape } from "./AiVisualiserLandscape";
export { AiVisualiserPortrait } from "./AiVisualiserPortrait";
export { AiVisualiserFlow } from "./AiVisualiserFlow";
export type { AiVisualiserFlowProps } from "./AiVisualiserFlow";
export type {
  AiVisualiserLeaf,
  AiVisualiserTilePropsBase
} from "./types";
