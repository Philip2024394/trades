// Design Intelligence Layer runtime — per V3 Q14.
// The compiler asks the DIL for rules. Modules never generate prompts.

import type { DesignIR } from "@/lib/design/compiler/ir";

export type DesignContext = {
  surface: DesignIR["intent"]["surface"];
  trade:   string;
  ir:      DesignIR;
};

export type DesignRule = {
  id:          string;
  module:      string;
  version:     string;
  outputs:     Record<string, unknown>;
  confidence:  number;
};

export interface IntelligenceModule {
  id:         string;
  version:    string;
  category:   string;
  supports:   string[];   // surfaces this module applies to
  evaluate(context: DesignContext): DesignRule[];
}

import { layoutModule }       from "./layout";
import { colourModule }       from "./colour";
import { typographyModule }   from "./typography";
import { vehicleModule }      from "./vehicle";
import { photographyModule }  from "./photography";
import { logoModule }         from "./logo";
import { tradeModule }        from "./trade";
import { uiModule }           from "./ui";
import { printModule }        from "./print";
import { accessibilityModule } from "./accessibility";
import { motionModule }       from "./motion";
import { premiumScoringModule } from "./premium-scoring";

const MODULES: IntelligenceModule[] = [
  layoutModule, colourModule, typographyModule, vehicleModule,
  photographyModule, logoModule, tradeModule, uiModule,
  printModule, accessibilityModule, motionModule, premiumScoringModule
];

/** Return every rule that fires for this context, per module. */
export function evaluateAll(context: DesignContext): DesignRule[] {
  const out: DesignRule[] = [];
  for (const mod of MODULES) {
    if (mod.supports.length > 0 && !mod.supports.includes(context.surface)) continue;
    for (const rule of mod.evaluate(context)) out.push(rule);
  }
  return out;
}

/** Query a specific module by id. */
export function moduleById(id: string): IntelligenceModule | undefined {
  return MODULES.find((m) => m.id === id);
}
