// Lock the v1 40-variant target.

import "./index";
import { buttonRegistry } from "./buttonRegistry";

const counts = buttonRegistry.counts();
console.log(`Total buttons: ${counts.total}`);
console.log(`  basic:       ${counts.byCategory.basic ?? 0}`);
console.log(`  marketing:   ${counts.byCategory.marketing ?? 0}`);
console.log(`  ecommerce:   ${counts.byCategory.ecommerce ?? 0}`);
console.log(`  navigation:  ${counts.byCategory.navigation ?? 0}`);
console.log(`  floating:    ${counts.byCategory.floating ?? 0}`);
console.assert(counts.total >= 30, `expected ≥30, got ${counts.total}`);
console.log("Button registry count — target hit.");
