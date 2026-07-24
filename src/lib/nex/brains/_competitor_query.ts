// Competitor / company inquiry handler for Nex Staircase chat.
//
// Delegates company detection to the industry registry
// (industry/_index.ts) which is split into 6 category files. Each
// category gets its own response template so Nex answers accurately
// regardless of whether the company is a stair maker, parts supplier,
// builders merchant, DIY retailer, wood supplier, or timber importer.
//
// Legal constraints held: UK BPRs 2008, TMA 1994 s.11(2)(c), DMCCA
// 2024. Nex never endorses or denigrates non-members. Always offers
// Google reviews as an independent public-feedback route.

import type { CompanyEntry, CompanyCategory } from "./industry/_index";
import { detectCompaniesInText } from "./industry/_index";

export type { CompanyCategory } from "./industry/_index";

export type CompetitorQueryType =
  | "named_company"
  | "ranking_question"
  | "none";

export type CompetitorQueryDetection = {
  type:      CompetitorQueryType;
  companies: CompanyEntry[];
  intent:    "info" | "opinion" | "price" | "ranking" | "recommendation";
};

const RANKING_PATTERNS: RegExp[] = [
  /\b(who|which)\s+is\s+(the\s+)?best\b/i,
  /\b(who|which)\s+(makes|manufactures?)\s+the\s+best\b/i,
  /\bbest\s+staircase\s+(maker|manufacturer|company|firm|supplier)/i,
  /\btop\s+(rated|staircase|manufacturer|company)/i,
  /\brecommend(ed)?\s+(a\s+)?(staircase|stair|company|manufacturer)/i,
  /\b(who|which\s+company)\s+(should|would)\s+(i|you)\s+(use|go\s+with|choose)/i
];

const OPINION_PATTERNS: RegExp[] = [
  /\bany\s+good\b/i,
  /\bis\s+.{1,40}\s+(good|any\s+good|worth|reliable|reputable)\b/i,
  /\bare\s+.{1,40}\s+(good|any\s+good|worth|reliable|reputable)\b/i,
  /\bwhat\s+do\s+you\s+(think|know)\s+(about|of)\b/i,
  /\bare\s+they\s+(good|reliable|any\s+good|worth)\b/i,
  /\bare\s+they\s+(cheap|expensive|affordable|dear)\b/i,
  /\bis\s+.{1,40}\s+(cheap|expensive|affordable|dear)\b/i,
  /\bopinions?\s+on\b/i,
  /\breviews?\s+of\b/i
];

// Direct recommendation questions — user is asking Nex explicitly if
// she'd recommend the company. Needs the conditional-recommendation
// answer per the never-judge-businesses rule (adviser not reviewer).
const RECOMMENDATION_PATTERNS: RegExp[] = [
  /\bwould\s+you\s+recommend\b/i,
  /\bdo\s+you\s+recommend\b/i,
  /\bshould\s+i\s+(use|go\s+with|choose|hire|pick)\b/i,
  /\bwould\s+you\s+(use|go\s+with|choose)\b/i,
  /\bworth\s+(using|going\s+with|choosing)\b/i,
  /\brecommend(ed)?\s+for\s+(me|my)\b/i
];

const PRICE_PATTERNS: RegExp[] = [
  /\b(cheap|expensive|affordable|dear|value|prices?)\b/i
];

/** Returns a Google search URL for aggregated public reviews of a
 *  company — used so Nex can offer the user a route to form their
 *  own opinion without Nex having to endorse or denigrate anyone. */
export function googleReviewsUrl(company: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(company + " reviews")}`;
}

export function detectCompetitorQuery(question: string): CompetitorQueryDetection {
  const q = question.trim();
  const companies = detectCompaniesInText(q);

  if (companies.length > 0) {
    let intent: CompetitorQueryDetection["intent"] = "info";
    // Order matters — check recommendation FIRST because "should I use"
    // patterns can trigger opinion detection too
    if (RECOMMENDATION_PATTERNS.some((p) => p.test(q))) intent = "recommendation";
    else if (OPINION_PATTERNS.some((p) => p.test(q))) intent = "opinion";
    if (PRICE_PATTERNS.some((p) => p.test(q))) intent = "price";
    return {
      type:      "named_company",
      companies,
      intent
    };
  }

  if (RANKING_PATTERNS.some((p) => p.test(q))) {
    return {
      type:      "ranking_question",
      companies: [],
      intent:    "ranking"
    };
  }

  return { type: "none", companies: [], intent: "info" };
}

/** Plain-English label for each category — used in responses. */
function categoryLabel(cat: CompanyCategory): string {
  switch (cat) {
    case "staircase_maker":   return "STAIRCASE MANUFACTURER";
    case "parts_supplier":    return "STAIRPARTS SUPPLIER";
    case "builders_merchant": return "BUILDERS' MERCHANT";
    case "diy_retailer":      return "DIY RETAILER";
    case "wood_supplier":     return "HARDWOOD / TIMBER MERCHANT";
    case "timber_importer":   return "WHOLESALE TIMBER IMPORTER";
    default:                  return "COMPANY";
  }
}

/** Build the response Nex returns for a competitor / ranking query.
 *  Category-aware and legally safe. */
export function buildCompetitorResponse(detection: CompetitorQueryDetection): string {
  if (detection.type === "named_company") {
    const companies = detection.companies;
    const single = companies.length === 1;

    // Group companies by category
    const byCategory = new Map<CompanyCategory, CompanyEntry[]>();
    for (const c of companies) {
      const list = byCategory.get(c.category) ?? [];
      list.push(c);
      byCategory.set(c.category, list);
    }

    // MIXED CATEGORY — user named companies from different types of
    // business. Nex has to explain the distinction before answering.
    if (byCategory.size > 1) {
      const parts: string[] = ["Important distinction — those companies aren't the same type of business, so the honest answer depends on which you're actually asking about.\n"];
      for (const [cat, list] of byCategory) {
        const names = list.map((c) => c.canonical).join(" and ");
        const label = categoryLabel(cat);
        parts.push(`**${names}** — ${label}. ${list[0].blurb}.`);
      }
      parts.push(`\nWhich category matches what you're actually trying to do?`);
      return parts.join("\n");
    }

    // SINGLE CATEGORY — deliver a category-appropriate response.
    const category = companies[0].category;
    const listed = single ? companies[0].canonical : companies.map((c) => c.canonical).join(" and ");
    const firstBlurb = companies[0].blurb;
    const reviewsUrl = googleReviewsUrl(companies[0].canonical);

    switch (category) {
      case "staircase_maker": {
        switch (detection.intent) {
          case "recommendation":
            return `Whether ${listed} would be the right choice depends on what you're looking for.

${single ? `${companies[0].canonical} is ${firstBlurb}. That gives you a factual starting point.` : ""} On a staircase project, the things that decide whether any maker is a good fit are: the type of stair you need (bespoke curved / cut-string / straight kit / floating), the timber you want (softwood painted / oak / walnut / other hardwood), the style of finish (hand-oiled / lacquered / spray-painted), and practical stuff like delivery to your location and lead time against your build programme.

${single ? `If those things line up with what ${listed} typically produce, ${listed} may be a strong option. If your project needs something outside their usual range — very high-end bespoke, a rare timber, an unusually curved geometry — you'd probably be better speaking with a specialist in that particular area.` : `Each of them will suit different project types — worth checking each against the things above.`}

Two practical steps that help decide:
- Look at examples of completed work matching your project type (bespoke stair makers usually have portfolios or case studies)
- Read public customer feedback — [see ${companies[0].canonical} reviews on Google](${reviewsUrl}) for a range of recent experiences

If you tell me a bit about your specific project — dimensions, timber preference, style, location — I can give you a much sharper read on fit.`;

          case "opinion":
            return `Whether ${listed} ${single ? "is" : "are"} the right choice depends on what you're looking for — quality of finish, price tier, bespoke capability, delivery lead time, after-sales support, or something else. Different makers weight those differently.

${single ? `${companies[0].canonical} is ${firstBlurb} — that's the publicly documented starting point.` : ""} Rather than a blanket verdict, it's usually more useful to look at:
- Examples of their completed work matching your project type
- A range of recent customer reviews — [see ${companies[0].canonical} reviews on Google](${reviewsUrl}) — customer experiences on any maker can vary, so a spread of feedback tells you more than any single opinion
- Whether their offering (kit vs bespoke, timber range, timeline) actually matches your specific project

If you tell me what matters most for your project, I can be a lot more specific about fit.`;

          case "price":
            return `Two things worth saying on that.

First — I don't quote prices for specific manufacturers. Prices in this trade genuinely depend on final design, timber species, balustrade type, finish choice, delivery and fit, so any number I gave you before those were locked in would be misleading.

Second — the useful way to compare cost between makers is to send the SAME itemised spec to two or three of them (timber, string style, balustrade, delivery, fit, finish — all separate lines) and compare line by line. Two "identical" totals often hide two very different products.

For an independent read on customer experience, Google aggregates public reviews — [see ${companies[0].canonical} reviews on Google](${reviewsUrl}).`;

          case "info":
          default:
            return `${listed} ${single ? "is" : "are"} ${single ? firstBlurb : "in the UK staircase manufacturing market — publicly known companies"}.

Whether ${listed} ${single ? "is" : "are"} the right choice for a specific project depends on what that project needs — kit vs bespoke, timber preference, timeline, style. Different makers suit different jobs.

If you'd like an independent view of customer experience, Google aggregates public reviews — [see ${companies[0].canonical} reviews on Google](${reviewsUrl}). Reviews on any maker vary, so worth reading a spread.

If you tell me what you're planning, I can help you think through fit.`;
        }
        break;
      }

      case "parts_supplier": {
        return `Quick clarification first — ${listed} ${single ? "isn't" : "aren't"} a staircase manufacturer. ${listed} ${single ? "is " : ""}${firstBlurb}.

That matters because whether ${listed} ${single ? "is" : "are"} the right answer depends on what you're doing. As a stairparts source for a DIY project or for a joiner ordering trade components, ${listed} ${single ? "is one of" : "are among"} the mainstream UK suppliers — you'll find their stock at most specialist stair-parts retailers and builders' merchants.

If you're looking to have a COMPLETE STAIRCASE built and fitted, ${listed} ${single ? "isn't" : "aren't"} the type of company you're after. You'd need a staircase manufacturer — a workshop that designs, machines, and assembles the whole flight.

For public reviews of their customer service, Google has aggregated feedback — [see ${companies[0].canonical} reviews on Google](${reviewsUrl}).

Which are you trying to do — order stairparts for a project, or have a full staircase made?`;
      }

      case "builders_merchant": {
        return `${listed} ${single ? "is " : "are "}${firstBlurb}.

Worth being clear on what that means for your project. Trade builders' merchants like ${listed} carry stairparts as one small line within a huge general catalogue — softwood spindles, standard newels, common handrail profiles, occasionally a basic pre-made stair kit. Fine for quick trade jobs where you need to grab components today.

For anything more considered, you're in different territory:
- **Bespoke or premium staircase** → talk to a staircase manufacturer
- **Specific timber or profile matching an existing stair** → talk to a specialist stairparts supplier
- **Trade-account components at trade pricing** → ${listed} ${single ? "is" : "are"} the right shop for the job

For public reviews of their operation, Google has aggregated feedback — [see ${companies[0].canonical} reviews on Google](${reviewsUrl}). Bear in mind reviews there cover the whole operation, not just stairparts.`;
      }

      case "diy_retailer": {
        return `${listed} ${single ? "is " : "are "}${firstBlurb}.

For a DIY project or basic replacement parts, ${listed} ${single ? "is" : "are"} genuinely fine — you'll pick up softwood spindles, standard newel posts, common handrail lengths and the basic accessories at consumer prices without needing a trade account.

For anything beyond that, know what you're getting:
- **Full bespoke staircase** → talk to a staircase manufacturer, not a DIY retailer
- **Specific timber, profile, or higher grade** → talk to a specialist stairparts supplier or hardwood merchant
- **Weekend DIY project with basic parts** → ${listed} ${single ? "is" : "are"} the practical answer

For public reviews of their service, Google has aggregated feedback — [see ${companies[0].canonical} reviews on Google](${reviewsUrl}).`;
      }

      case "wood_supplier": {
        return `${listed} ${single ? "is " : "are "}${firstBlurb}.

Worth knowing what a specialist hardwood merchant does. These companies sit between wholesale timber importers and general builders' merchants — you go to them when you need specific timber species (oak, walnut, sapele, ash, cherry etc) in quantities smaller than a container load, often cut-to-size to your specifications. They stock a much deeper range of hardwood species than a general merchant would, and their staff know timber properly.

Relevant if you're building your own staircase, matching timber to an existing piece, or specifying stock for a workshop. Not the right place if you want a full staircase built for you — you'd go to a staircase manufacturer for that.

For public reviews of their service, Google has aggregated feedback — [see ${companies[0].canonical} reviews on Google](${reviewsUrl}).`;
      }

      case "timber_importer": {
        return `${listed} ${single ? "is " : "are "}${firstBlurb}.

Timber importers like ${listed} sit at the wholesale layer — they import container-scale volumes from sawmills overseas and distribute nationally to trade merchants, stair manufacturers, and specialist wood suppliers. Trade-only, no consumer sales. If you've bought hardwood from a UK merchant, there's a reasonable chance it passed through one of these wholesalers on its way to the shelf.

For a homeowner or DIY-er, you won't buy from ${listed} directly — you'd buy from a hardwood merchant or specialist stairparts supplier who sources through them. Worth knowing they exist so you understand where your timber originates, but not somewhere you'd typically shop.

If you're a trade professional, ${listed} operate ${single ? "the standard trade route" : "standard trade routes"}. For company-level reviews, Google has aggregated feedback — [see ${companies[0].canonical} reviews on Google](${reviewsUrl}).`;
      }

      default:
        return "";
    }
    return "";
  }

  if (detection.type === "ranking_question") {
    return `Honest answer — "who's the best" isn't a question with a useful answer in this trade, and I'd be conning you if I gave one.

Here's why. "Best" depends entirely on what YOUR project needs. A workshop that's brilliant at bespoke curved oak stairs might not be the sensible choice for a straightforward painted pine flight — different equipment, different pricing structure, different lead times. There's no single "best" that answers every case.

Two things worth knowing before you go looking:
- Staircase companies split into six types: MANUFACTURERS (build complete staircases), STAIRPARTS SUPPLIERS (specialist components + mouldings), BUILDERS' MERCHANTS (general trade), DIY RETAILERS (consumer DIY), HARDWOOD MERCHANTS (specialist timber species), and WHOLESALE TIMBER IMPORTERS (trade-only container-scale supply). Different jobs — make sure you're comparing like with like.
- Reviews of a "big brand" tell you less than 3 references from clients whose stairs are now 5-10 years old. Longevity is the honest quality signal in this trade.

What genuinely helps:
- Work out what your specific project needs first (timber, style, budget tier, timeline, access)
- Compare quotes on itemised spec — timber grade, string thickness, joint method, warranty terms, insurance
- Meet the maker if practical — a workshop visit tells you more in 20 minutes than any review site

If you're happy to tell me a bit about your project, I can point you at Network members whose declared capabilities match what you need.`;
  }

  return "";
}
