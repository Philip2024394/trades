// team.cards_1 — 4-cell meet-the-team grid.
//
// Portrait card per team member: square photo, name, role, one-line
// bio. 4 fixed slots keeps the schema flat and works cleanly at all
// viewport widths (2×2 on mobile, 1×4 on desktop).
//
// Trust-heavy trade merchants use this to humanise the pitch —
// "the actual people who turn up." Every photo is a data-tree-priority
// image slot so Module 7's picker works per-member.

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Slot = 1 | 2 | 3 | 4;

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  m1PhotoUrl: string; m1Name: string; m1Role: string; m1Bio: string;
  m2PhotoUrl: string; m2Name: string; m2Role: string; m2Bio: string;
  m3PhotoUrl: string; m3Name: string; m3Role: string; m3Bio: string;
  m4PhotoUrl: string; m4Name: string; m4Role: string; m4Bio: string;
};

function TeamCards({
  instanceId,
  config,
  tokens,
  mode
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string | undefined) ?? "#FFB300";
  const surface = (tokens["color.surface"] as string | undefined) ?? "#FFFFFF";
  const text = (tokens["color.text"] as string | undefined) ?? "#0A0A0A";
  const muted = (tokens["color.muted"] as string | undefined) ?? "#737373";
  const headingFont = tokens["font.heading"] as string | undefined;
  const bodyFont = tokens["font.body"] as string | undefined;
  const headingWeight = tokens["font.heading.weight"] as number | undefined;
  const bodyWeight = tokens["font.body.weight"] as number | undefined;
  const isEditing = mode === "edit";

  type Member = {
    i: Slot;
    photo: string;
    name: string;
    role: string;
    bio: string;
  };
  const slots: Member[] = [
    { i: 1, photo: config.m1PhotoUrl, name: config.m1Name, role: config.m1Role, bio: config.m1Bio },
    { i: 2, photo: config.m2PhotoUrl, name: config.m2Name, role: config.m2Role, bio: config.m2Bio },
    { i: 3, photo: config.m3PhotoUrl, name: config.m3Name, role: config.m3Role, bio: config.m3Bio },
    { i: 4, photo: config.m4PhotoUrl, name: config.m4Name, role: config.m4Role, bio: config.m4Bio }
  ];
  // Preview / published: hide slots with no name (no team member set).
  // Edit mode: render all 4 so merchant can tap-to-upload.
  const members = isEditing ? slots : slots.filter((m) => m.name);

  return (
    <section
      className="w-full"
      style={{ background: surface, color: text }}
      {...sectionRootAttrs(instanceId, "team.cards_1", "Team")}
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div>
          {config.eyebrow && (
            <p
              className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: accent }}
              {...treeAttrs(instanceId, "eyebrow", "Small kicker", "text")}
            >
              {config.eyebrow}
            </p>
          )}
          {config.heading && (
            <h2
              className="mt-2 text-3xl leading-tight sm:text-4xl"
              style={{ fontFamily: headingFont, fontWeight: headingWeight ?? 800 }}
              {...treeAttrs(instanceId, "heading", "Main headline", "text")}
            >
              {config.heading}
            </h2>
          )}
          {config.subheading && (
            <p
              className="mt-2 max-w-2xl text-[14px] leading-relaxed sm:text-[16px]"
              style={{
                color: muted,
                fontFamily: bodyFont,
                fontWeight: bodyWeight ?? 500
              }}
              {...treeAttrs(instanceId, "subheading", "Supporting line", "text")}
            >
              {config.subheading}
            </p>
          )}
        </div>

        <ul className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {members.map((m) => (
            <li key={m.i}>
              <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="relative aspect-square w-full overflow-hidden bg-neutral-100">
                  {m.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.photo}
                      alt={m.name || `Team ${m.i}`}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                      {...treeAttrs(instanceId, `m${m.i}PhotoUrl`, `Member ${m.i} photo`, "image")}
                    />
                  ) : (
                    <span
                      className="absolute inset-0 grid place-items-center text-[10px] font-extrabold uppercase tracking-widest text-neutral-400"
                      {...treeAttrs(instanceId, `m${m.i}PhotoUrl`, `Member ${m.i} photo`, "image")}
                    >
                      + Photo
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  {m.name && (
                    <p
                      className="text-[15px] leading-tight"
                      style={{
                        fontFamily: headingFont,
                        fontWeight: headingWeight ?? 800,
                        color: text
                      }}
                      {...treeAttrs(instanceId, `m${m.i}Name`, `Member ${m.i} name`, "text")}
                    >
                      {m.name}
                    </p>
                  )}
                  {m.role && (
                    <p
                      className="text-[10px] font-extrabold uppercase tracking-widest"
                      style={{ color: accent }}
                      {...treeAttrs(instanceId, `m${m.i}Role`, `Member ${m.i} role`, "text")}
                    >
                      {m.role}
                    </p>
                  )}
                  {m.bio && (
                    <p
                      className="mt-1 text-[12px] leading-relaxed"
                      style={{
                        color: muted,
                        fontFamily: bodyFont,
                        fontWeight: bodyWeight ?? 500
                      }}
                      {...treeAttrs(instanceId, `m${m.i}Bio`, `Member ${m.i} bio`, "text")}
                    >
                      {m.bio}
                    </p>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const memberFields = (i: Slot, name: string, role: string, bio: string) => [
  { key: `m${i}PhotoUrl`, label: `Member ${i} photo`, type: { kind: "image" as const, aspectRatio: "1/1", recommendedWidthPx: 600 }, default: "", priority: "image" as const, group: `Member ${i}` },
  { key: `m${i}Name`, label: `Member ${i} name`, type: { kind: "text" as const, maxLength: 40 }, default: name, priority: "text" as const, group: `Member ${i}` },
  { key: `m${i}Role`, label: `Member ${i} role`, type: { kind: "text" as const, maxLength: 40 }, default: role, priority: "text" as const, group: `Member ${i}` },
  { key: `m${i}Bio`, label: `Member ${i} bio`, type: { kind: "text" as const, maxLength: 200, multiline: true }, default: bio, priority: "text" as const, aiPromptable: true, group: `Member ${i}` }
];

const registration: SectionRegistration<Config> = {
  id: "team.cards_1",
  name: "Team cards",
  version: "1.0.0",
  library: "team",
  description:
    "Four portrait cards side-by-side: photo, name, role, one-line bio. Humanises the pitch on trust-heavy trades — landscaping, joinery, kitchen installers.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Meet the team", priority: "text", group: "Copy" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 120 }, default: "The people who turn up.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Supporting line", type: { kind: "text", maxLength: 220, multiline: true }, default: "Directly employed. CSCS-carded. Everyone here has been with us five years or more.", priority: "text", aiPromptable: true, group: "Copy" },
    ...memberFields(1, "Sarah", "Foreman", "20 years on the tools. Runs the big jobs and quality-checks every finish."),
    ...memberFields(2, "Mark", "Lead plumber", "Gas Safe #558432. Boiler + heating specialist since 2003."),
    ...memberFields(3, "Priya", "Electrician", "NICEIC-registered, 18th edition. EV chargers, consumer units, faults."),
    ...memberFields(4, "James", "Apprentice", "Second-year with us. Under Sarah's wing for every job.")
  ],
  animations: ["none", "fade", "stagger"],
  aiPrompts: {
    explain: "Explain why a meet-the-team section works for UK trades. Reference specific team members and their trust signals.",
    improve: "Improve without layout change. Names first-name only or first-name last-initial. Roles under 3 words. Bios under 20 words. Return only patched config.",
    rewrite: "Rewrite bios in a {tone} voice. Keep facts factual.",
    suggestAlternative: "Suggest an alternative team layout from library='team'. One-sentence rationale.",
    score: "Score across 6 dimensions. JSON only."
  },
  thumbnail: "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/team-cards-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 600 },
    accessibility: { contrastMin: 4.5, requiredAlt: [] },
    sales: { socialProofRecommended: true },
    seo: { headingLevel: 2, structuredData: "Person" },
    mobile: { minTapTargetPx: 44 },
    brandConsistency: { boundTokens: ["color.accent", "color.surface", "color.text"] }
  },
  telemetryTags: ["team", "cards", "four_slots", "portrait_photos", "trust"],
  bestForVerticals: ["landscaping", "joinery", "kitchen_install", "bathroom_install", "roofing", "brickwork", "plumbing", "electrical", "carpentry", "plastering"],
  defaultConfig: () => ({
    eyebrow: "Meet the team",
    heading: "The people who turn up.",
    subheading: "Directly employed. CSCS-carded. Everyone here has been with us five years or more.",
    m1PhotoUrl: "", m1Name: "Sarah", m1Role: "Foreman", m1Bio: "20 years on the tools. Runs the big jobs and quality-checks every finish.",
    m2PhotoUrl: "", m2Name: "Mark", m2Role: "Lead plumber", m2Bio: "Gas Safe #558432. Boiler + heating specialist since 2003.",
    m3PhotoUrl: "", m3Name: "Priya", m3Role: "Electrician", m3Bio: "NICEIC-registered, 18th edition. EV chargers, consumer units, faults.",
    m4PhotoUrl: "", m4Name: "James", m4Role: "Apprentice", m4Bio: "Second-year with us. Under Sarah's wing for every job."
  }),
  renderer: TeamCards
};

sectionRegistry.register(registration);
