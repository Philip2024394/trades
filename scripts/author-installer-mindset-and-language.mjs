// Installer mindset + solo/team + customer-language anchors · Philip 2026-08-02.
// Extends installation.json + tiny universal-qa addition (customer-language anchors only).
// Per Philip's "stop enlarging universal" rule: minimum-viable universal touch.

import { readFileSync, writeFileSync } from "node:fs";

const now = new Date().toISOString();
function norm(s) { return s.toLowerCase().replace(/\s+/g, " ").trim(); }

function mergeInto(path, newQAs) {
  const doc = JSON.parse(readFileSync(path, "utf8"));
  doc.qa = Array.isArray(doc.qa) ? doc.qa : [];
  const byQ = new Map(doc.qa.map((x, i) => [norm(x.q), i]));
  let added = 0, filled = 0;
  for (const item of newQAs) {
    const key = norm(item.q);
    if (byQ.has(key)) {
      const ex = doc.qa[byQ.get(key)];
      if (!ex.a || ex.a.trim().length === 0) { ex.a = item.a; filled++; }
    } else {
      doc.qa.push(item);
      added++;
    }
  }
  doc.updated_at = now;
  writeFileSync(path, JSON.stringify(doc, null, 2), "utf8");
  const authored = doc.qa.filter((x) => x.a && x.a.trim().length > 0).length;
  return { added, filled, total: doc.qa.length, authored };
}

// ─── INSTALLATION BRAIN · installer mindset + solo/team ────────────────
const INSTALLATION = [
  // Can one person build and install?
  { q: "Can one person build and install a staircase?", a: "Yes for many staircases, no for others. A single skilled staircase craftsman can manufacture and install many types of staircases on their own, but not every staircase is suitable for one-person handling. The deciding factors are size, weight, complexity and safety — not skill alone. For generations, many bespoke staircases were built entirely by one experienced staircase joiner in small family-run workshops." },
  { q: "Do modern staircase factories use teams because one person can't do it?", a: "No. Modern manufacturers often divide work between departments to increase production capacity, reduce lead times, allow specialist skills, improve workflow and enable several staircases to be built simultaneously. This is about efficiency — not because one person lacks the ability." },
  { q: "Can a straight staircase be installed by one person?", a: "A straightforward staircase can often be installed by one experienced installer, provided components are manageable in size and weight, access is good, lifting can be carried out safely and local health-and-safety requirements are met. The installer may still need occasional assistance with heavier items." },
  { q: "When is a second installer typically needed?", a: "Two people are commonly used when handling long stringers, large landing sections, heavy newel posts, continuous handrails, glass panels, oversized treads or awkward access. A second person improves safety and handling — it is not a lack of skill." },
  { q: "Do glass balustrade installations usually need more than one person?", a: "Large glass panels can be heavy, awkward to carry and difficult to position accurately. Many installers prefer at least two people for fitting larger glass balustrades, even if the rest of the staircase is installed by one person." },
  { q: "Do curved staircases typically require more installers?", a: "Yes, generally. Curved staircases frequently require additional handling, careful positioning and more trial fitting. They are more likely to require multiple installers than a straight staircase." },
  { q: "Do many staircase installers prefer working alone?", a: "Yes — many experienced installers prefer working alone or with an apprentice because it gives them complete control over the installation. When one experienced installer fits a staircase, only one person decides where to start, the fixing sequence, the final adjustments, the handrail alignment and the finishing details, which often produces a more consistent result. This is common practice in many bespoke staircase companies, although it depends on the project." },
  { q: "Do all installers use the same installation method?", a: "No. No two installers work exactly the same way. One may fit strings first; another may install newels first; another may partially assemble sections before fixing them. All can produce an excellent staircase. There is no universal installation sequence used by every staircase company — the overall principles (accuracy, safety, structural integrity) remain the same, but the exact sequence varies between companies and individual craftsmen." },
  { q: "Why do experienced installers work efficiently?", a: "Not because they rush — because they plan. An experienced joiner has already thought through the sequence, the fixings, the component order and the handling method before the first screw is fitted. Preparation saves more time than rushing. During installation they often spend more time checking, measuring, assessing and planning than actually drilling or fixing. Professional installation is largely decision-making." },
  { q: "Why do some traditional apprentice models still exist in staircase making?", a: "Traditionally, many staircase companies trained apprentices alongside an experienced joiner. The apprentice would assist by carrying components, preparing tools, cleaning joints, checking measurements and learning installation techniques. Over time they took on more responsibility. Many skilled staircase makers learned their trade in this way." },
  { q: "Can a small staircase company match the quality of a large manufacturer?", a: "Yes. A company with one surveyor, one craftsman and one installer can produce staircases equal in quality to much larger manufacturers. Quality depends on skill, organisation, workmanship and consistency — not company size. Throughout the history of staircase making, many exceptional staircases have been created by individual craftsmen or small teams." },

  // Experienced installer mindset
  { q: "How does an experienced installer plan the installation before starting?", a: "Before fixing the first component, they mentally rehearse the entire installation. They think through where to start, which component locks everything into position, whether a part can still be removed later if needed, whether the handrail will fit through the hallway, when the glass should be fitted and how to clamp each joint. Much of the installation is already rehearsed in the mind before the first screw goes in." },
  { q: "What does 'don't fix yourself into a corner' mean during staircase installation?", a: "It's one of the first lessons many installers learn — do not install components in an order that prevents the next component from being fitted. A handrail fitted too early may stop glass from being installed. A landing balustrade fixed first may restrict access for long strings. Decorative trims installed too soon can be damaged during later work. Experienced installers think several stages ahead." },
  { q: "Do drawings always match the building on site?", a: "No. Factory drawings may be perfect but the building may not be. Installers may find walls out of square, floors out of level, ceilings slightly lower than expected, plaster thicker than surveyed or structural movement. The installer's job is to understand these conditions and determine how they affect the staircase — the building has the final say." },
  { q: "Why do installers keep re-checking measurements during installation?", a: "Because it is quicker to spend five minutes checking than five hours repairing. Before fixing a major component, experienced installers recheck level, plumb, alignment, dimensions and clearances. Repeated checking is a sign of professionalism, not uncertainty." },
  { q: "How does an installer establish reference points?", a: "Professional installers establish reference points — finished floor level, first newel post, string line, centre line, landing level — and check every other measurement against those references. If the reference is wrong, the error can spread throughout the entire installation." },
  { q: "Should an installer correct every small imperfection in the building?", a: "No. Buildings are rarely perfect. An experienced installer avoids making unnecessary adjustments for every minor variation. Instead they aim for straight visual lines, consistent spacing, smooth handrail flow and a balanced appearance. The staircase should look right as well as measure correctly — chasing every millimetre often creates more problems than it solves." },
  { q: "When should an installer stop work rather than continue?", a: "If something unexpected occurs — incorrect dimensions, missing components, major structural issues, unsafe conditions — a professional installer may stop work until the issue has been investigated. Continuing without understanding the problem can make it worse. Stopping is a sign of judgement, not failure." },
  { q: "Is confidence enough on a staircase installation?", a: "No. Experienced installers often work confidently, but confidence should never replace checking, measuring, inspecting and thinking. The best installers continue to verify their work throughout the project — experience builds confidence, but not complacency." },
  { q: "Why does professional installation often look easy?", a: "Because most of the difficulty was solved before the installers arrived. Customers see smooth handrails, neat joints, aligned balusters, comfortable steps and attractive finishes. They rarely see the planning, measuring, problem-solving and careful sequencing that made those results possible. Professional installation is often invisible because the preparation has removed most visible difficulties." },
  { q: "Why is the installer described as 'the last engineer'?", a: "Because the installer is the final person to inspect the staircase before the customer uses it. They confirm geometry, structural fixing, appearance, finish, comfort and safety. If something is wrong, installation is the last opportunity to correct it before handover." },
  { q: "Should a staircase be protected as soon as it's installed?", a: "Yes. Once installed, the staircase can still be damaged by later trades — plaster splashes, paint, dropped tools, tiles, scaffold boards, heavy traffic. Many installers protect finished staircases immediately after installation. A staircase can leave the factory in perfect condition and still be damaged before the house is completed." },
  { q: "Do new houses continue to move after the staircase is installed?", a: "Yes. New buildings naturally settle, and timber responds to seasonal changes in humidity. Small seasonal movement is a normal characteristic of timber and should not automatically be treated as a defect. Nex distinguishes between expected timber movement and excessive movement caused by a fault." },
  { q: "Is every creak in a staircase a defect?", a: "No. Timber is a natural material — minor noises may occur from seasonal humidity changes, normal material movement or slight compression between components. However, persistent squeaks, significant movement or structural looseness should be investigated. Not every creak is a defect, but growing noise or unsafe railing is." },
  { q: "How does an installer recognise problems by pattern?", a: "Experienced installers often recognise problems before measurements confirm them — 'I've seen this before,' 'That wall doesn't look plumb,' 'That landing feels slightly high.' This intuition develops from years of practical experience. It should always be confirmed with measurements rather than relied upon alone." },
  { q: "Can experience be learned from books alone?", a: "No. Books teach terminology, regulations, principles and calculations. Experience teaches judgement, sequencing, troubleshooting, workmanship and efficiency. Both are valuable — the best staircase professionals combine technical knowledge with practical experience." },
  { q: "What does 'customers buy confidence' mean for a staircase company?", a: "A premium staircase company sells more than timber. It also provides reliable advice, accurate surveys, dependable lead times, organised installation, clear communication and confidence that the staircase will fit correctly. Trust is part of the finished product." },
  { q: "What does a good staircase installation feel like to the customer?", a: "When customers admire a staircase they often say 'It looks like it's always been there.' That is one of the highest compliments an installer can receive — the staircase appears to belong naturally within the building. The best installation draws attention to the craftsmanship, not to the effort required to achieve it." },
];

const inst_result = mergeInto("data/nex-component-qa/installation.json", INSTALLATION);

// ─── UNIVERSAL · minimum-viable customer-language anchors ─────────────
// Per Philip's "stop enlarging universal" rule — only the truly essential ones.
// Every customer conversation must correctly interpret "stairs" · "flight" · "stair"
// · "stairwell" without correcting the customer. These 8 anchors are the guardrail.
const UNIVERSAL = [
  { q: "What do customers mean when they say 'my stairs'?", a: "They almost always mean the complete staircase — not the individual steps. 'Stairs' is the everyday word most customers use ('we're replacing our stairs' · 'our stairs squeak' · 'can you quote for oak stairs?'). Nex understands 'stairs' as 'staircase' automatically, and mirrors the customer's own word back to them rather than correcting them." },
  { q: "What is a flight of stairs?", a: "A flight is one uninterrupted run of steps between landings. A staircase with a lower flight, a landing, and an upper flight is ONE staircase with TWO flights — not two staircases. Installers often refer to 'Flight 1' or 'Flight 2' to name a specific run within the same staircase." },
  { q: "Is a staircase the same thing as stairs?", a: "In everyday language, usually yes. Customers say 'stairs'; technical people say 'staircase'. A staircase is the complete assembled system — strings, treads, risers, landings, newel posts, handrails, balusters, glass, balconies, structural supports and everything else that forms the stair. 'Stairs' is the same physical thing described in customer language." },
  { q: "What is a stairwell?", a: "The stairwell is the space in the building that contains the staircase. It is not the staircase itself. The staircase sits inside the stairwell. Some people also use 'stairwell' to mean the whole staircase area — context normally makes the meaning clear." },
  { q: "What is a stair opening?", a: "The stair opening is the structural hole in the floor where the staircase passes through — sometimes called the stairwell opening, stair aperture or stair void. It sets the boundary for the staircase geometry: the size of the opening controls how much horizontal run and headroom are available." },
  { q: "How many staircases is a house with 'lower stairs and upper stairs'?", a: "Usually one staircase with two flights, if the flights are connected by a landing. A house has multiple staircases only when there are separate stair systems that do not connect — for example a main staircase, a rear/kitchen staircase and a basement staircase are three separate staircases. Two flights joined by a landing is one staircase." },
  { q: "What is the difference between a step and a tread?", a: "A step is one walking position — it consists of one tread and the rise to the next tread. A tread is only the horizontal timber (or concrete, steel, stone) that the foot stands on. Customers count 'steps'; manufacturers usually count treads and risers separately during production. In casual conversation they often mean the same thing." },
  { q: "Why does Nex not correct customers who say 'stairs' instead of 'staircase'?", a: "Because 'stairs' is the correct everyday word customers use and a good staircase professional understands they are talking about the whole staircase. Correcting the customer's language feels pedantic and unnecessary. Nex mirrors the customer's word — internally understanding the technical distinction, externally speaking their language." },
];

const universal_path = "data/nex-universal-qa.json";
const universalDoc = JSON.parse(readFileSync(universal_path, "utf8"));
const uniByQ = new Map(universalDoc.qa.map((x, i) => [norm(x.q), i]));
let uniAdded = 0;
for (const item of UNIVERSAL) {
  const key = norm(item.q);
  if (uniByQ.has(key)) universalDoc.qa[uniByQ.get(key)] = item;
  else { universalDoc.qa.push(item); uniAdded++; }
}
universalDoc.updated_at = now;
writeFileSync(universal_path, JSON.stringify(universalDoc, null, 2), "utf8");

// ─── REPORT ─────────────────────────────────────────────────────────────
console.log("=== INSTALLATION BRAIN · mindset + solo/team ===");
console.log(`  installation.json      · added ${inst_result.added} · filled ${inst_result.filled} · TOTAL ${inst_result.total} Qs · ${inst_result.authored} authored`);
console.log("\n=== UNIVERSAL · minimum-viable customer-language anchors ===");
console.log(`  added ${uniAdded} · total ${universalDoc.qa.length} Qs · ${universalDoc.qa.filter(x => x.a && x.a.trim().length > 0).length} authored`);
console.log(`\nGRAND TOTAL new authored Q&As: ${inst_result.added + uniAdded}`);
