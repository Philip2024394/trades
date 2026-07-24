// Adapter registry — add a file, add a line.

import type { PIAdapter } from "./types";
import { timelineAdapter } from "./adapters/timeline";
import { photosAdapter } from "./adapters/photos";
import { costsAdapter } from "./adapters/costs";
import { documentsAdapter } from "./adapters/documents";
import { postsAdapter } from "./adapters/posts";
import { variationsAdapter } from "./adapters/variations";
import { thingsToFixAdapter } from "./adapters/things_to_fix";
import { teamAdapter } from "./adapters/team";
import { risksAdapter } from "./adapters/risks";

export const ADAPTERS: PIAdapter[] = [
  timelineAdapter,
  photosAdapter,
  costsAdapter,
  documentsAdapter,
  postsAdapter,
  variationsAdapter,
  thingsToFixAdapter,
  teamAdapter,
  risksAdapter
];
