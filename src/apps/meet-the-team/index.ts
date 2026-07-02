// App barrel: meet-the-team.
//
// Importing this file:
//   1. Registers the App manifest with appRegistry
//   2. Registers its Studio sections with sectionRegistry
//   3. Registers its data loader with the app data loader registry

import { appRegistry } from "@/platform/registry";
import { meetTheTeamManifest } from "./manifest";
import "./sections/team-grid";
import "./dataLoader";

appRegistry.register(meetTheTeamManifest);

export { meetTheTeamManifest };
