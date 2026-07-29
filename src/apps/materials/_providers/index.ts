// Provider registry
//
// Services look up providers by MaterialCategory. New material types
// register here and become available across the whole app + API.

import { HardwoodProvider } from "./hardwood";
import type { MaterialProvider } from "./_base";
import { MaterialsError, type MaterialCategory } from "../_schema/types";

const registry = new Map<MaterialCategory, MaterialProvider>();

registry.set("hardwood", new HardwoodProvider());

export function getProvider(category: MaterialCategory): MaterialProvider {
  const p = registry.get(category);
  if (!p) {
    throw new MaterialsError(
      "invalid_input",
      `No provider registered for material category '${category}'`,
      501,
    );
  }
  return p;
}

export function listProviders(): MaterialProvider[] {
  return Array.from(registry.values());
}

export { MaterialProvider };
export type { NewMeasurementInput } from "./_base";
