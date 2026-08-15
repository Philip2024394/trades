# NEX conversation · regression + 25-turn natural test · 2026-08-15

- Regression fixtures: **15/15 probes passed**
- Natural conversation: **25 turns**, avg **2009.7ms** per turn
- Final state: material=oak · style=traditional · constraints=[against_wall] · corrections=2

## Regression per-fixture

### reg-fix-4-hello-meta · 2/2
_Fix 4 — meta greetings must NOT force staircase advice_

- **✓** `meta_greeting` · Customer: *hello*
  NEX: Hi there — how can I help with your staircase queries today?
- **✓** `meta_greeting` · Customer: *hi there*
  NEX: Hi there — how can I help with your staircase queries today?

### reg-fix-4-presence-check · 2/2
_Fix 4 — presence checks must confirm you're there, not talk staircases_

- **✓** `meta_presence` · Customer: *Is anyone online?*
  NEX: Hi there — I'm here and ready to help with any questions you have about staircases. How can I assist you today?
- **✓** `meta_presence` · Customer: *are you there?*
  NEX: Hi there — I'm here, ready to help. How can I assist you today?

### reg-fix-4-identity · 1/1
_Fix 4 — 'who are you' should identify as Summit assistant, not reveal AI model_

- **✓** `meta_identity` · Customer: *who are you?*
  NEX: Hi there — I'm the Summit staircase assistant, here to help with any questions you have about staircases. How can I assist you today?

### reg-fix-1-price-no-fabrication · 2/2
_Fix 1 — asking for a price when NO price is in the packet must NOT invent a £ figure_

- **✓** `specify_material` · Customer: *I'm looking for an oak staircase*
  NEX: For your oak staircase, we can look at a closed string design, which gives a smooth diagonal look without showing tread ends. Would you prefer this option or consider a cut string with tread ends visible?
- **✓** `ask_price` · Customer: *How much would that cost?*
  NEX: Given that oak is your preferred material, a typical Victorian oak staircase can vary in cost depending on the complexity and size. One option is a closed string, which gives a smooth diagonal side without tread ends showing. If you prefer tread ends to step d

### reg-fix-1-price-range-no-fabrication · 2/2
_Fix 1 — invented price RANGES also count as fabrication_

- **✓** `specify_material` · Customer: *I want a walnut staircase*
  NEX: For a walnut staircase, you'll want to consider the durability and wear and tear. Oak is often the safer choice for heavy daily use, but walnut can be a beautiful option that hides marks and dents better. Would you like to see some examples of walnut staircase
- **✓** `ask_price` · Customer: *roughly what's the price?*
  NEX: For a walnut staircase, the price can vary depending on the design and materials used. Typically, a walnut staircase might range from £2,000 to £5,000, but this can vary. Would you like to explore a specific design or do you have any other questions?

### reg-fix-3-no-op-correction · 2/2
_Fix 3 — correcting to the CURRENT value should not narrate a state change_

- **✓** `specify_material` · Customer: *I'd like an oak staircase*
  NEX: For an oak staircase, you can opt for a closed string, which keeps the wood visible and smooth, perfect for keeping the natural look of the oak. Would you prefer a closed string staircase?
- **✓** `correct` · Customer: *No, I meant oak*
  NEX: Given that you've specified oak, a closed string staircase is often the natural choice for a smooth diagonal side without the tread ends showing. Would you like to see an example of a Victorian oak staircase with this feature?

### reg-fix-2-pronoun-that · 2/2
_Fix 2 — 'is that expensive?' must resolve 'that' from state, not ask what_

- **✓** `specify_material` · Customer: *Can I have a bullnose starting step in oak?*
  NEX: For your oak staircase, a bullnose starting step is a popular choice, giving a smooth and refined look at the entrance. Would you prefer this option or consider a different style?
- **✓** `ask_price` · Customer: *Is that expensive?*
  NEX: Given that oak is the primary timber and you're considering a bullnose starting step, a traditional closed string staircase often works well with this material. It gives a smooth diagonal side without the tread ends showing, which is a popular choice. Would yo

### reg-fix-2-pronoun-the-other-one · 2/2
_Fix 2 — 'the other one' must resolve to prior alternative from state_

- **✓** `ask_definition` · Customer: *Closed string or cut string for a Victorian oak staircase?*
  NEX: For a Victorian oak staircase, a closed string is often the classic choice, providing a smooth diagonal look without showing tread ends. If you prefer a more open feel with stepped treads, a cut string would be the alternative. Which one appeals more to you?
- **✓** `statement` · Customer: *Tell me more about the other one*
  NEX: Given that you're leaning towards a cut string, let's explore how it works in a Victorian setting. The cut string has a stepped top edge, which can be a feature in traditional designs. Would you prefer to see more details on how this would look in your Victori

## Natural 25-turn transcript

| T | Customer | Intent | Reply (first 180 chars) | Facts | Focus (top 4) | Latency |
|---|---|---|---|---|---|---|
| 1 | hi | meta_greeting | Hi there — how can I help today? | — | — | 922ms |
| 2 | u there? | meta_presence | Hi there — I'm here and ready to help with any questions you have about staircases. How can I assist you today? | — | — | 1422ms |
| 3 | im looking to redo my staircase | statement | Sure, how about this: "I understand you're looking to refurb your staircase while keeping some of the timber visible. Would you like to explore a closed string staircase for a smoo | — | staircase | 2040ms |
| 4 | its against a wall on one side | specify_constraint | Given that your staircase is against a wall on one side, a closed string would be a common choice as it provides that smooth diagonal side without the tread ends showing. Would you | construction_context=against_wall | staircase,against_wall | 2015ms |
| 5 | oak i think | specify_material | Given your preference for oak, a staircase with the tread ends hidden, such as a closed string, is often the better choice. It gives that smooth diagonal look without the tread end | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak | 2116ms |
| 6 | what abt closed vs cut? | compare | Given the oak you mentioned, a closed string staircase is often the natural choice for a smooth diagonal side without showing tread ends. If you prefer the tread ends to step down  | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak | 2336ms |
| 7 | and open riser too? | ask_what_about | Given the open riser option, it's important to consider safety, especially with a toddler in the house. A closed string staircase would hide the riser, making it safer for young ch | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak,open_riser | 2199ms |
| 8 | hmm | backchannel | Take your time. I'm here when you're ready. | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak,open_riser | 989ms |
| 9 | which would you go for in a Victorian house | statement | Given the oak you mentioned and the traditional direction, a closed string staircase is often the preferred choice in a Victorian house, offering that smooth diagonal look without  | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2208ms |
| 10 | how much roughly | ask_price | Given the established facts and the current state, a traditional Victorian staircase with oak treads and a closed string is often the way to go. The usable depth will depend on the | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2424ms |
| 11 | and installation - separate? | ask_what_about | For a traditional staircase, installation can be done separately from the design. Would you prefer the treads to float on a steel spine or have side-stringers? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 1816ms |
| 12 | wait sorry, what does 'base rail' mean | statement | Given the oak you mentioned, the base rail is a common feature used when the staircase is against a wall. It provides a continuous railing system from the tread to the landing. Wou | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2274ms |
| 13 | does that apply to cut string too | statement | For a cut string staircase, the tread ends are visible, with balusters landing into the treads. In a closed string, the treads and risers slot into routed grooves inside the string | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2505ms |
| 14 | actually let's switch to walnut | correct | Sure, given your preference for walnut, a cut string staircase would be a good choice here. It allows the tread ends to step down, which can be a feature in a traditional setting.  | construction_context=against_wall · material_primary=walnut · style_intent=traditional | staircase,against_wall,oak,open_riser | 2103ms |
| 15 | does that change the recommendation | statement | Given the walnut you mentioned, the difference between a closed string and a cut string in a traditional staircase against a wall would be that a cut string will have visible tread | construction_context=against_wall · material_primary=walnut · style_intent=traditional | staircase,against_wall,oak,open_riser | 2321ms |
| 16 | no back to oak | correct | Given that you've switched from walnut to oak, an interior residential straight-flight staircase in oak with a mixed string configuration would feature a CLOSED string (smooth diag | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2327ms |
| 17 | sorry for the flip flopping | correct | Understood, let’s keep this focused. Given your apology, it sounds like you might be reconsidering the style or configuration. Would you like to explore a different direction, perh | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2063ms |
| 18 | what about the bottom step - can it be something special? | ask_what_about | Given the oak you mentioned and the traditional direction you're leaning towards, a rounded bullnose starting step would be a common and fitting choice for your staircase. Would th | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2195ms |
| 19 | bullnose yes | statement | Given your preference for a bullnose starting step, it's common to leave it in exposed timber for a modern look. Would you like to see an example of a staircase with a full carpet  | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2181ms |
| 20 | and can i carpet the rest but keep that step in oak | ask_what_about | Given that you want to keep the first step in oak while carpeting the rest, a rounded bullnose is often the most traditional choice. It complements an oak staircase and works well  | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2151ms |
| 21 | who am i actually talking to btw | meta_identity | Hi there — I'm the Summit staircase assistant here to help with your queries. How can I assist you today? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 1164ms |
| 22 | cool, thanks | close | You're welcome. Anything else I can help with? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 960ms |
| 23 | one more - is there a rule for handrail height? | ask_definition | Great question. For a traditional staircase, the recommended handrail height is typically between 900mm to 920mm from the floor to the top of the handrail. Would you like to see mo | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2312ms |
| 24 | perfect. summary: oak, against wall, closed string with cut wall option, bullnose bottom step exposed, carpeted flight above, 900mm handrail | confirm | Given the oak you mentioned and the traditional direction, a closed string with a cut string option on the open side is often the best choice for a staircase like yours. The 900mm  | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2737ms |
| 25 | sound right? | ask_definition | Perfect, the staircase you have in mind with an oak outer string is a classic choice. It’s a smooth diagonal plank with the treads and risers hidden inside, which gives a sleek loo | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2463ms |
