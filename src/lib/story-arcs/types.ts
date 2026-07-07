// Story arc types.

export type StoryArcStatus = "open" | "closed" | "archived" | "expired";
export type StoryArcType =
  | "project_progress"
  | "seasonal"
  | "series"
  | "top_of_period";
export type StoryArcEventRole =
  | "opener"
  | "progress"
  | "climax"
  | "closer"
  | "sequel";

export type StoryArc = {
  id: string;
  merchantId: string;
  naturalKey: string | null;
  arcType: StoryArcType;
  status: StoryArcStatus;
  narrative: Record<string, unknown>;
  facets: Record<string, unknown>;
  startsAt: string;
  lastEventAt: string;
  closedAt: string | null;
  autoCloseAfterDays: number;
  caseStudyPublicationIds: string[];
  caseStudyFeedPostId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StoryArcEvent = {
  arcId: string;
  eventId: string;
  role: StoryArcEventRole;
  addedAt: string;
};
