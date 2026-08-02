// Populate data/nex-universal-qa.json with Philip's AUTHORED answers
// from his 2026-08-02 "Can It Be Built?" universal brain content.
//
// Rule A: every `a` is Philip's verbatim wording · nothing invented.
//
// Idempotent · re-run to update in place (matches by q text · adds if new).

import { readFileSync, writeFileSync } from "node:fs";

const PATH = "data/nex-universal-qa.json";
const doc = JSON.parse(readFileSync(PATH, "utf8"));

// Philip's authored Q&A · verbatim.
const AUTHORED = [
  // ─── Can It Be Built · Core ───
  {
    q: "Can this staircase actually be made?",
    a: "Yes. The images in the Nex Library are design concepts and inspiration, but they are based on real staircase construction methods. Many of these staircases can be manufactured by experienced bespoke staircase companies. Some designs may need small engineering adjustments to suit your home, local building regulations or manufacturing methods, but the overall style and appearance can usually be achieved. If specialist engineering is required, Nex can — with your permission — help connect you with a suitable staircase manufacturer to review the design."
  },
  {
    q: "Is this just an AI picture?",
    a: "The image is a visual design concept, not a photograph of an existing installation. Its purpose is to help you explore styles, materials and layouts that could be suitable for your home. Many modern staircase manufacturers regularly build staircases inspired by design concepts like these."
  },
  {
    q: "Can someone really build this staircase?",
    a: "In many cases, yes. Professional staircase manufacturers build bespoke staircases every day. Every project is individually designed, engineered and manufactured for the customer's property. The final staircase may include engineering adjustments to meet structural requirements and building regulations while keeping the same overall appearance."
  },
  {
    q: "Is this impossible to manufacture?",
    a: "Not necessarily. Some concepts are straightforward to manufacture. Others may require more advanced engineering, specialist fabrication or custom materials. Rather than guessing, Nex can help have the design reviewed by an experienced staircase manufacturer if technical confirmation is needed."
  },
  {
    q: "Why doesn't the finished staircase look exactly like the image?",
    a: "Every home is different. Factors such as floor-to-floor height, room size, ceiling opening, structural supports, local building regulations and customer preferences all influence the final design. The aim is normally to capture the same overall style while adapting it for your property."
  },
  {
    q: "Can I build exactly what I see?",
    a: "Sometimes yes. Sometimes small changes are needed. The closer the image is to practical construction methods, the closer the finished staircase can usually be to the concept. If changes are required, they are normally structural rather than visual."
  },
  {
    q: "How do I know if this design is possible?",
    a: "Some designs can be assessed immediately. More complex designs may need review by an experienced staircase designer or structural engineer. If required, Nex can — with your permission — prepare your project information and connect you with a suitable specialist for confirmation."
  },
  {
    q: "What if no company has built one like this before?",
    a: "That doesn't necessarily mean it cannot be built. Many bespoke staircase companies create completely new designs every year. Experienced manufacturers often combine proven engineering with new architectural styles to produce unique staircases."
  },
  {
    q: "Is Nex guaranteeing this staircase can be built?",
    a: "No. Nex does not guarantee that every design can be manufactured exactly as shown. Nex explains what is generally possible based on staircase construction principles. Where specialist engineering or manufacturer confirmation is needed, Nex will say so honestly rather than guess."
  },
  {
    q: "Who decides if the staircase is structurally safe?",
    a: "The staircase manufacturer and, where required, qualified engineers. They are responsible for ensuring the staircase is suitable for manufacture and complies with the relevant structural and building requirements for your location."
  },
  {
    q: "Can Nex speak to a manufacturer for me?",
    a: "Yes. With your permission, Nex can prepare your project brief and connect you with a suitable staircase manufacturer or specialist to discuss your design and answer technical questions."
  },
  {
    q: "What if the manufacturer says changes are needed?",
    a: "That is completely normal. Small adjustments may be recommended to improve strength, safety, installation, manufacturing efficiency, or compliance with local regulations. The overall appearance can often remain very close to the original concept."
  },
  {
    q: "Has this exact staircase been built before?",
    a: "Not always. Some library designs are inspired by existing staircase styles, while others explore new design ideas. Even if an identical staircase has not been built before, experienced bespoke manufacturers may still be able to produce a very similar result."
  },
  {
    q: "Why does Nex show designs that haven't been built yet?",
    a: "The purpose of the Nex Library is to inspire homeowners and help them explore possibilities. Many architectural projects begin as concepts before becoming real buildings or products. The library helps customers communicate their ideas clearly before a manufacturer develops the final engineered design."
  },
  {
    q: "What if I'm worried it's only AI?",
    a: "That's a sensible question. Nex is designed to separate design inspiration from engineering reality. If a question can be answered confidently, Nex will answer it. If a question requires manufacturer-specific engineering or construction confirmation, Nex will say: \"I don't want to guess. With your permission, I can help prepare your project and ask a suitable staircase manufacturer to confirm the technical details.\" That approach keeps the advice accurate while helping you turn a concept into a real staircase."
  },

  // ─── Can It Be Built · Extended trust framing ───
  {
    q: "Can this design really be built?",
    a: "Many people look at a staircase like this and assume it's \"just AI.\" In reality, every staircase begins as an idea. Before it exists, it is simply a drawing, a sketch or a digital concept. The difference between an idea and a real staircase is the knowledge, engineering and craftsmanship used to build it. With the right design team and experienced manufacturers, many concept staircases can become real projects."
  },
  {
    q: "This looks impossible.",
    a: "It may look unusual, but unusual does not always mean impossible. Modern staircase manufacturers use advanced engineering, CNC machining, laser cutting, 3D modelling and precision fabrication to build designs that would have been extremely difficult to produce many years ago. Some concepts can be built exactly as shown, while others may need small engineering changes to suit your home and local building regulations. If specialist confirmation is needed, Nex can help connect you with an experienced manufacturer."
  },
  {
    q: "People say AI designs can't be built.",
    a: "That is a common misunderstanding. AI can generate ideas, but it does not manufacture staircases. Experienced designers, engineers and skilled craftsmen turn ideas into real products. Many of the world's most impressive buildings, bridges and staircases started as concepts long before they became reality."
  },
  {
    q: "Has anything like this ever happened before?",
    a: "Yes. Throughout history, many designs were once considered impossible until new skills, materials and technology made them practical. Curved glass buildings, floating staircases, long-span bridges and complex architectural roofs all began as ambitious ideas before becoming everyday construction projects. Innovation happens because skilled people find solutions."
  },
  {
    q: "Could this become a real staircase?",
    a: "In many cases, yes. The image represents a design vision. The manufacturer then determines the safest and most practical engineering solution to achieve that vision. Sometimes the staircase can be built almost exactly as shown. Sometimes small structural adjustments are recommended while keeping the same overall appearance."
  },
  {
    q: "What if nobody has built this exact staircase before?",
    a: "That doesn't automatically mean it cannot be built. Every year, bespoke staircase companies create designs they have never built before. Experienced manufacturers often enjoy challenging projects because they allow them to demonstrate their design and engineering capabilities."
  },
  {
    q: "How does an idea become a real staircase?",
    a: "The process usually follows these stages: (1) a design concept or inspiration · (2) measurements taken from your property · (3) structural engineering where required · (4) detailed manufacturing drawings · (5) customer approval · (6) precision manufacturing · (7) delivery and installation. Every bespoke staircase in the world started somewhere along this journey."
  },
  {
    q: "Is Nex promising every AI image can be built?",
    a: "No. Nex will never promise something it cannot verify. If a staircase uses recognised construction methods, Nex can explain how it would normally be manufactured. If a design contains features that require specialist engineering or manufacturer confirmation, Nex will tell you honestly. Rather than guessing, Nex can — with your permission — prepare your project and ask an experienced staircase manufacturer to review the concept."
  },
  {
    q: "Why does Nex show ambitious designs?",
    a: "Because imagination drives innovation. Many of today's iconic staircases would once have been considered too difficult or too expensive to build. As manufacturing technology improves, new materials become available and skilled craftspeople develop better techniques, more ambitious designs become achievable. The purpose of the Nex Library is to inspire possibilities while remaining honest about what still requires expert engineering."
  },
  {
    q: "Can skilled manufacturers build things that seem impossible?",
    a: "Often, yes. History shows that many remarkable structures were once thought to be beyond reach until experienced designers and engineers developed the knowledge to build them. Nex believes great design begins with imagination, but every successful project also depends on skilled people, careful engineering and quality workmanship. That's why, whenever technical confirmation is needed, Nex prefers to involve experienced manufacturers rather than make assumptions."
  },
  {
    q: "Can a one-off staircase really be manufactured?",
    a: "Yes. Every bespoke staircase starts as a one-off project. Unlike mass-produced products, bespoke staircases are designed around a specific property and customer. Manufacturers regularly produce staircases they have never built before."
  },
  {
    q: "Has anyone built this exact staircase?",
    a: "Possibly, but not necessarily. Many staircases are unique and built only once for a particular home. The important question is not whether an identical staircase exists, but whether experienced designers and manufacturers have the skills to build it safely. If confirmation is required, Nex can prepare your project for review by a specialist."
  },
  {
    q: "What if the design needs changing?",
    a: "That is perfectly normal. During the design process a manufacturer may recommend changes to improve strength, installation, comfort or compliance with local building regulations. Their goal is to keep the appearance as close as possible to your chosen design while ensuring it performs correctly."
  },
  {
    q: "Why doesn't Nex simply say yes or no?",
    a: "Because honesty matters. Some questions require engineering calculations, structural assessment or knowledge of manufacturing methods that depend on your property. Rather than guessing, Nex prefers to involve qualified professionals whenever specialist advice is needed."
  },
  {
    q: "Can modern manufacturing produce shapes like this?",
    a: "Yes. Today's staircase manufacturers can use CNC machining, laser cutting, robotic welding, curved timber laminating, precision glass processing and advanced CAD software to manufacture designs that were once extremely difficult to produce. The final solution always depends on the project's engineering requirements."
  },
  {
    q: "What if the manufacturer says something needs changing?",
    a: "That doesn't mean your idea has failed. It simply means they have found a safer or more practical way to achieve the same overall appearance. Many successful bespoke staircases go through several design revisions before manufacturing begins."
  },
  {
    q: "Does every staircase have to follow the image exactly?",
    a: "No. The image is your inspiration. The finished staircase can usually be customised to suit your room, measurements, preferred materials and budget while keeping the same overall style."
  },
  {
    q: "Could future technology make even more designs possible?",
    a: "Absolutely. Construction methods continue to improve every year. New materials, stronger glass, better steel fabrication, improved timber engineering and more advanced manufacturing techniques allow designers to create staircases that would have been difficult to build in the past. Innovation never stands still."
  },
  {
    q: "Why do manufacturers enjoy challenging staircases?",
    a: "Complex projects allow skilled companies to demonstrate their experience and craftsmanship. Many specialist staircase manufacturers take pride in producing unique designs that showcase their engineering capabilities."
  },
  {
    q: "What happens if no manufacturer wants the project?",
    a: "That is uncommon, but it can happen if a design is outside a company's capabilities or current workload. Nex can continue looking for manufacturers with different skills or experience until suitable specialists are found, where available."
  },
  {
    q: "Can Nex guarantee the staircase will be built?",
    a: "No. Only the manufacturer responsible for the project can confirm what they are prepared to manufacture. Nex helps explain designs, prepare project information and connect you with suitable specialists, but it never guarantees engineering decisions."
  },
  {
    q: "Can a manufacturer improve my idea?",
    a: "Very often. Customers usually arrive with an inspiration image. Experienced staircase designers frequently suggest improvements that make the staircase stronger, easier to build, more comfortable to use or more visually striking."
  },
  {
    q: "Does every manufacturer build the same way?",
    a: "No. Two experienced companies may produce a staircase that looks almost identical while using different internal structures, fixing methods or manufacturing techniques. There is often more than one correct engineering solution."
  },
  {
    q: "Why do experienced staircase makers matter?",
    a: "A staircase combines structural engineering, precision manufacturing and fine joinery. Experience helps manufacturers solve challenges before they become problems, resulting in a safer installation and a better finished product."
  },
  {
    q: "Could this become a signature feature of my home?",
    a: "Many bespoke staircases become the focal point of a property. A well-designed staircase can transform an entrance hall, improve first impressions and become one of the most memorable architectural features in the home."
  },
  {
    q: "Is Nex replacing staircase designers?",
    a: "No. Nex is designed to help you explore ideas, understand options and prepare your project. Professional designers, engineers and manufacturers remain an essential part of creating a real staircase."
  },
  {
    q: "What if experts disagree?",
    a: "That can happen. Different manufacturers sometimes recommend different engineering approaches based on their experience. Nex encourages customers to compare professional opinions before making a final decision."
  },
  {
    q: "Can something beautiful also be practical?",
    a: "Yes. The best staircase designs combine appearance with everyday usability. Good design considers comfort, safety, maintenance, durability and long-term performance — not just how the staircase looks."
  },
  {
    q: "Why does Nex ask questions before introducing a manufacturer?",
    a: "Because good preparation saves time. The more information you provide about your home, measurements, preferred materials and design goals, the easier it is for manufacturers to understand your project and provide meaningful advice."
  },
  {
    q: "What if my dream staircase seems impossible?",
    a: "Many remarkable projects began as ambitious ideas. The purpose of Nex is not to dismiss creative designs, but to explore them responsibly. If a concept appears technically challenging, Nex can help gather the right information and, with your permission, involve experienced manufacturers to assess what is possible."
  },

  // ─── Buying / Process / Business ───
  {
    q: "Can I use my own builder to install the staircase?",
    a: "Yes, some manufacturers will supply the staircase only, allowing your own builder or carpenter to install it. Others prefer their own installation teams to ensure the staircase is fitted correctly and to maintain any warranty. Always confirm this before ordering."
  },
  {
    q: "Do I have to buy the staircase from the company that designed it?",
    a: "Not necessarily. Some customers obtain drawings and quotations from several manufacturers before deciding who to use. Always check who owns the design and whether drawings can be shared with another company."
  },
  {
    q: "Can one company design it and another company build it?",
    a: "Sometimes yes. However, responsibility should be clearly agreed. If one company designs the staircase and another manufactures it, make sure everyone is working from the latest approved drawings."
  },
  {
    q: "What information will the staircase company need from me?",
    a: "They may ask for: floor-to-floor height, ceiling height, structural opening size, building plans, photographs, videos, site address, access information, preferred style, budget guidance and desired completion date."
  },
  {
    q: "Do I need planning permission for a new staircase?",
    a: "In many situations, replacing or installing an internal staircase does not require planning permission, but building regulations or local approval may still apply. Requirements vary by location."
  },
  {
    q: "Who checks that the staircase meets regulations?",
    a: "Normally this is handled by the staircase designer, structural engineer where required, and the relevant building control authority according to local regulations."
  },
  {
    q: "Can my staircase be built before the house is finished?",
    a: "Yes. Many staircases are manufactured while the building work is progressing, although final dimensions are often confirmed during a site survey before production."
  },
  {
    q: "Should decorating be finished before the staircase is installed?",
    a: "Many people install the staircase before final decorating so any minor marks or adjustments can be completed first. Every project is different."
  },
  {
    q: "Can the staircase be removed years later?",
    a: "Most staircases can be removed, although this often requires dismantling and may involve building work because the staircase forms part of the home's structure."
  },
  {
    q: "Can I move the staircase to another house?",
    a: "Usually not without significant redesign. A staircase is normally manufactured specifically for one property and one set of measurements."
  },
  {
    q: "Will the staircase be numbered for installation?",
    a: "Many bespoke staircase manufacturers label individual components to simplify assembly on site."
  },
  {
    q: "Does the staircase arrive fully assembled?",
    a: "That depends on its size. Smaller staircases may arrive largely assembled. Large bespoke staircases often arrive in sections that are assembled inside the property."
  },
  {
    q: "Can bad weather delay delivery?",
    a: "Yes. Transport schedules can occasionally change due to severe weather, traffic restrictions or access issues."
  },
  {
    q: "Should I inspect the staircase before signing for delivery?",
    a: "Yes. If possible, check for visible transport damage and report any concerns immediately according to the supplier's delivery procedure."
  },
  {
    q: "What if something is damaged during delivery?",
    a: "Notify the supplier as soon as possible and follow their reporting process. Photographs are often helpful."
  },
  {
    q: "Should I insure the staircase before it is installed?",
    a: "Some home insurance policies may not cover building materials before installation. It is worth checking with your insurer if the staircase will be stored on site."
  },
  {
    q: "Can I choose a local staircase company?",
    a: "Many customers prefer local manufacturers because site visits and after-sales support may be easier. Others are happy to use specialist companies that travel nationally."
  },
  {
    q: "How far will staircase companies travel?",
    a: "Some work within a single region, while others undertake projects across the country or internationally. Nex can help identify companies that serve your location."
  },
  {
    q: "What if I don't know which staircase style is best?",
    a: "That is exactly what Nex is designed to help with. By understanding your home, available space, lifestyle and preferences, Nex can narrow the options before introducing you to suitable manufacturers."
  },
  {
    q: "Can Nex recommend one manufacturer over another?",
    a: "Nex aims to help you find suitable manufacturers based on your project and location. The final choice is always yours."
  },
  {
    q: "Can Nex tell me if something is technically possible?",
    a: "Nex can explain known construction principles and recognised staircase designs. If your project involves unusual engineering or bespoke structural details, Nex will clearly say when specialist confirmation is needed and, with your permission, connect you with an experienced manufacturer or engineer rather than guessing."
  },
  {
    q: "Why doesn't Nex just give me a fixed answer?",
    a: "Because every home is different. Dimensions, structure, local regulations, engineering requirements and manufacturing methods all vary. Nex would rather provide honest guidance and connect you with the right expert than give an answer that could be inaccurate."
  }
];

// Merge · keep existing empty slots, update if `q` matches, add if new.
const existingByQ = new Map(doc.qa.map((x) => [normaliseQ(x.q), x]));
function normaliseQ(q) {
  return String(q ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

let updated = 0, added = 0;
for (const entry of AUTHORED) {
  const key = normaliseQ(entry.q);
  const existing = existingByQ.get(key);
  if (existing) {
    existing.q = entry.q;   // canonical Q text
    existing.a = entry.a;   // authored answer
    updated++;
  } else {
    doc.qa.push({ q: entry.q, a: entry.a });
    existingByQ.set(key, entry);
    added++;
  }
}

doc.updated_at = new Date().toISOString();
writeFileSync(PATH, JSON.stringify(doc, null, 2), "utf8");

const authored = doc.qa.filter((x) => x.a && x.a.trim().length > 0).length;
console.log("Universal Q&A updated ·");
console.log("  Answers written (existing slots):", updated);
console.log("  New Qs added:                    ", added);
console.log("  Total qa entries:                ", doc.qa.length);
console.log("  Total AUTHORED (a not empty):    ", authored);
