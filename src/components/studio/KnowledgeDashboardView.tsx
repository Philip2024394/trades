// KnowledgeDashboardView — merchant-facing render of the Knowledge
// Graph for their trade.
//
// Everything on this page is derived from the Graph — no hand-authored
// content per merchant. Adding a Domain or extending a Package upstream
// changes what this page shows for every merchant on that trade.

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const GREEN = "#10B981";
const NEUTRAL = "#404040";

type PackageSummary = {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  serviceCount: number;
  customerTypeCount: number;
  workflowStepCount: number;
  faqCount: number;
};

type DomainCard = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  capabilityCount: number;
  domainCapabilityCount: number;
  integrationCount: number;
  installedModules: Array<{ id: string; name: string; glyph: string }>;
  availableModules: Array<{
    id: string;
    name: string;
    glyph: string;
    state: string;
  }>;
};

type ComplianceRow = {
  id: string;
  name: string;
  regulator: string;
  source: string;
  domainId: string;
  origin: "domain" | "package";
};

export function KnowledgeDashboardView({
  trade,
  packageSummary,
  domainCards,
  complianceElements,
  installedSlugs,
  platformCounts
}: {
  trade: string;
  packageSummary: PackageSummary | null;
  domainCards: DomainCard[];
  complianceElements: ComplianceRow[];
  installedSlugs: string[];
  platformCounts: { domains: number; packages: number; modules: number };
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Construction Knowledge Graph
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        {packageSummary
          ? `${packageSummary.emoji} ${packageSummary.name}`
          : "Your trade's knowledge"}
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        {packageSummary
          ? packageSummary.description
          : `Every Domain, Package and Module on the platform in one place — filtered to what applies to your trade. This page is sourced entirely from the Knowledge Graph so it stays in sync as we ship more.`}
      </p>

      {/* Platform overview strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-4">
        <MetaCell label="Domains" value={String(platformCounts.domains)} />
        <MetaCell label="Packages" value={String(platformCounts.packages)} />
        <MetaCell
          label="Business modules"
          value={String(platformCounts.modules)}
        />
        <MetaCell
          label="Installed"
          value={String(installedSlugs.length)}
          accent={GREEN}
        />
      </div>

      {!packageSummary && (
        <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[12px] leading-relaxed text-amber-900">
          We haven&rsquo;t shipped a Knowledge Package for{" "}
          <strong className="font-mono text-[11px]">{trade}</strong> yet. The
          platform totals above still apply — every Domain and Module is
          available. Once your Package lands you&rsquo;ll see trade-specific
          services, workflow steps, common questions, and cited compliance
          right here.
        </p>
      )}

      {packageSummary && (
        <section className="mt-8">
          <h2 className="text-[14px] font-extrabold uppercase tracking-widest text-neutral-900">
            What your Package carries
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetaCell
              label="Services"
              value={String(packageSummary.serviceCount)}
            />
            <MetaCell
              label="Customer types"
              value={String(packageSummary.customerTypeCount)}
            />
            <MetaCell
              label="Workflow steps"
              value={String(packageSummary.workflowStepCount)}
            />
            <MetaCell
              label="Common FAQs"
              value={String(packageSummary.faqCount)}
            />
          </div>
        </section>
      )}

      {domainCards.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[14px] font-extrabold uppercase tracking-widest text-neutral-900">
            Domains for your trade ({domainCards.length})
          </h2>
          <p className="mt-2 text-[12px] leading-relaxed text-neutral-600">
            Each Domain is a horizontal capability your business needs. The
            modules on the right implement pieces of it — install more to
            cover more of the Domain&rsquo;s capabilities.
          </p>
          <ul className="mt-4 space-y-3">
            {domainCards.map((d) => (
              <li
                key={d.id}
                className="rounded-2xl border border-neutral-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-[16px] font-extrabold text-neutral-900">
                    {d.name}
                  </h3>
                  <p
                    className="text-[10px] font-extrabold uppercase tracking-widest"
                    style={{ color: YELLOW }}
                  >
                    {d.capabilityCount} capabilities · {d.integrationCount}{" "}
                    integrations
                  </p>
                </div>
                <p className="mt-1 text-[12px] font-bold text-neutral-500">
                  {d.tagline}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">
                  {d.description}
                </p>

                {d.installedModules.length > 0 && (
                  <div className="mt-3">
                    <p
                      className="text-[9px] font-extrabold uppercase tracking-widest"
                      style={{ color: GREEN }}
                    >
                      Installed
                    </p>
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {d.installedModules.map((m) => (
                        <li
                          key={m.id}
                          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold"
                          style={{
                            borderColor: GREEN,
                            color: BLACK,
                            background: "rgba(16,185,129,0.08)"
                          }}
                        >
                          <span aria-hidden="true">{m.glyph}</span>
                          {m.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {d.availableModules.length > 0 && (
                  <div className="mt-3">
                    <p
                      className="text-[9px] font-extrabold uppercase tracking-widest"
                      style={{ color: NEUTRAL }}
                    >
                      Available
                    </p>
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {d.availableModules.map((m) => (
                        <li
                          key={m.id}
                          className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] font-bold text-neutral-700"
                        >
                          <span aria-hidden="true">{m.glyph}</span>
                          {m.name}
                          {m.state !== "shipped" &&
                            m.state !== "available-addon" && (
                              <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-400">
                                · {m.state}
                              </span>
                            )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {complianceElements.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[14px] font-extrabold uppercase tracking-widest text-neutral-900">
            Compliance surface ({complianceElements.length})
          </h2>
          <p className="mt-2 text-[12px] leading-relaxed text-neutral-600">
            Every regulation and scheme the platform tracks for your trade,
            with a link to the public source. Nothing here is invented — if
            you don&rsquo;t see a scheme listed, it means we haven&rsquo;t
            confirmed a public URL for it yet.
          </p>
          <ul className="mt-3 space-y-2">
            {complianceElements.map((c) => (
              <li
                key={`${c.domainId}::${c.id}`}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-extrabold text-neutral-900">
                    {c.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    {c.regulator} · Domain: {c.domainId}
                    {c.origin === "package" && (
                      <span
                        className="ml-2 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-widest text-white"
                        style={{ background: YELLOW, color: BLACK }}
                      >
                        Trade-specific
                      </span>
                    )}
                  </p>
                </div>
                <a
                  href={c.source}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-800"
                >
                  Source ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MetaCell({
  label,
  value,
  accent
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div>
      <p
        className="text-[9px] font-extrabold uppercase tracking-widest"
        style={{ color: accent ?? NEUTRAL }}
      >
        {label}
      </p>
      <p className="mt-0.5 text-[18px] font-extrabold text-neutral-900">
        {value}
      </p>
    </div>
  );
}
