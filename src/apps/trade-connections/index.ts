// App barrel: trade-connections.

import { appRegistry } from "@/platform/registry";
import { tradeConnectionsManifest } from "./manifest";
import "./sections/carousel";
import "./dataLoader";

appRegistry.register(tradeConnectionsManifest);

export { tradeConnectionsManifest };
