// Pack barrel: essentials-pack.

import { packRegistry } from "@/platform/packs/registry";
import { essentialsPackManifest } from "./manifest";

packRegistry.register(essentialsPackManifest);

export { essentialsPackManifest };
