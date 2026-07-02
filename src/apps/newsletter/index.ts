// App barrel: newsletter.

import { appRegistry } from "@/platform/registry";
import { newsletterManifest } from "./manifest";
import "./sections/inline";
import "./dataLoader";

appRegistry.register(newsletterManifest);

export { newsletterManifest };
