// Studio Knowledge dashboard — merchant-facing view of the Construction
// Knowledge Graph for their trade.
//
// Server component. Loads the session, resolves the merchant's primary
// trade to a Knowledge Package, walks that Package's resolved
// capability + compliance surface, and hands the flattened view to the
// client renderer.
//
// Nothing on this page is hand-authored per merchant — every domain
// card, capability list, and compliance citation comes from the
// Knowledge Graph. Adding a new Domain or extending a Package upstream
// automatically shows up here.

import { loadStudioSession } from "@/lib/studio/session";
import { packageForTrade } from "@/lib/knowledge";
import { knowledgeDomainRegistry, knowledgePackageRegistry } from "@/lib/knowledge";
import { BUSINESS_MODULES, modulesForDomain } from "@/lib/studio/modules";
import "@/lib/knowledge"; // populate registries
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { KnowledgeDashboardView } from "@/components/studio/KnowledgeDashboardView";

export const dynamic = "force-dynamic";

export default async function StudioKnowledgePage() {
  const session = await loadStudioSession();
  if (!session) return null;

  const trade = session.merchant.primary_trade;
  const pkg = packageForTrade(trade);

  // Read the merchant's currently-installed apps so the coverage view
  // can render "implemented" vs "available" per capability.
  const installed = await supabaseAdmin
    .from("installed_apps")
    .select("app_slug")
    .eq("merchant_id", session.merchant.id)
    .is("uninstalled_at", null);
  const installedSlugs = (installed.data ?? []).map(
    (r) => r.app_slug as string
  );

  // Total counts for the header strip — walk registries once.
  const platformCounts = {
    domains: knowledgeDomainRegistry.size(),
    packages: knowledgePackageRegistry.size(),
    modules: BUSINESS_MODULES.length
  };

  if (!pkg) {
    // Merchant is on a trade with no Package yet (S1.1b backfill).
    // Show the platform overview + a soft note so we don't 404.
    return (
      <KnowledgeDashboardView
        trade={trade}
        packageSummary={null}
        domainCards={[]}
        complianceElements={[]}
        installedSlugs={installedSlugs}
        platformCounts={platformCounts}
      />
    );
  }

  const resolved = knowledgePackageRegistry.resolve(pkg.id);

  // Build Domain cards — one per Domain the Package uses.
  const domainCards = pkg.usesDomains.map((domainId) => {
    const domain = knowledgeDomainRegistry.getOrThrow(domainId);
    const domainCapabilities = domain.capabilities;
    const capabilitiesForDomain =
      resolved.capabilitiesByDomain[domainId] ?? [];

    // Which modules on the platform implement pieces of this Domain?
    // Split into installed vs available so the coverage view is real.
    const modulesInDomain = modulesForDomain(domainId);
    const installedInDomain = modulesInDomain
      .filter((m) => installedSlugs.includes(m.id))
      .map((m) => ({ id: m.id, name: m.name, glyph: m.glyph }));
    const availableInDomain = modulesInDomain
      .filter((m) => !installedSlugs.includes(m.id))
      .map((m) => ({ id: m.id, name: m.name, glyph: m.glyph, state: m.state }));

    return {
      id: domainId,
      name: domain.name,
      tagline: domain.tagline,
      description: domain.description,
      capabilityCount: capabilitiesForDomain.length,
      domainCapabilityCount: domainCapabilities.length,
      integrationCount: domain.integrations.length,
      installedModules: installedInDomain,
      availableModules: availableInDomain
    };
  });

  return (
    <KnowledgeDashboardView
      trade={trade}
      packageSummary={{
        id: pkg.id,
        name: pkg.name,
        emoji: pkg.emoji,
        tagline: pkg.tagline,
        description: pkg.description,
        serviceCount: pkg.services.length,
        customerTypeCount: pkg.customerTypes.length,
        workflowStepCount: pkg.workflow.length,
        faqCount: pkg.commonFaqs.length
      }}
      domainCards={domainCards}
      complianceElements={resolved.complianceElements.map((c) => ({
        id: c.id,
        name: c.name,
        regulator: c.regulator,
        source: c.sourceUrl,
        domainId: c.domainId,
        origin: c.source
      }))}
      installedSlugs={installedSlugs}
      platformCounts={platformCounts}
    />
  );
}
