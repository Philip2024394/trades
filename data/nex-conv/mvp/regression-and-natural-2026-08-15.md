# NEX conversation · regression + 25-turn natural test · 2026-08-15

- Regression fixtures: **15/15 probes passed**
- Natural conversation: **25 turns**, avg **1997.2ms** per turn
- Final state: material=oak · style=traditional · constraints=[against_wall] · corrections=2

## Regression per-fixture

### reg-fix-4-hello-meta · 2/2
_Fix 4 — meta greetings must NOT force staircase advice_

- **✓** `meta_greeting` · Customer: *hello*
  NEX: Hi there — how can I help?
- **✓** `meta_greeting` · Customer: *hi there*
  NEX: Hi, how can I help you today?

### reg-fix-4-presence-check · 2/2
_Fix 4 — presence checks must confirm you're there, not talk staircases_

- **✓** `meta_presence` · Customer: *Is anyone online?*
  NEX: No problem — I'm here and ready to help. How can I assist you today?
- **✓** `meta_presence` · Customer: *are you there?*
  NEX: Apologies, I'm ready. How can I help you today?

### reg-fix-4-identity · 1/1
_Fix 4 — 'who are you' should identify as Summit assistant, not reveal AI model_

- **✓** `meta_identity` · Customer: *who are you?*
  NEX: No problem — I'm here to help with any staircase questions you have. How can I assist you today?

### reg-fix-1-price-no-fabrication · 2/2
_Fix 1 — asking for a price when NO price is in the packet must NOT invent a £ figure_

- **✓** `specify_material` · Customer: *I'm looking for an oak staircase*
  NEX: Given your preference for oak, a closed string staircase would often be a good fit for a traditional look. Would you consider this option, or are you leaning towards something else?
- **✓** `ask_price` · Customer: *How much would that cost?*
  NEX: Would you prefer to know more about the design options before we discuss the cost?

### reg-fix-1-price-range-no-fabrication · 2/2
_Fix 1 — invented price RANGES also count as fabrication_

- **✓** `specify_material` · Customer: *I want a walnut staircase*
  NEX: Given your preference for walnut, a closed string would be a good choice for a traditional look. Would you consider this option or are you leaning towards an open string instead?
- **✓** `ask_price` · Customer: *roughly what's the price?*
  NEX: Given your preference for walnut, a closed string would be a good choice for a traditional look. Would you consider this option or are you leaning towards an open string instead?

### reg-fix-3-no-op-correction · 2/2
_Fix 3 — correcting to the CURRENT value should not narrate a state change_

- **✓** `specify_material` · Customer: *I'd like an oak staircase*
  NEX: Given your preference for oak, a closed string would often be a good fit for this look. Would you prefer the tread ends hidden or visible?
- **✓** `correct` · Customer: *No, I meant oak*
  NEX: Given your preference for oak, a closed string would often be a good fit for this look. Would you prefer the tread ends hidden or visible?

### reg-fix-2-pronoun-that · 2/2
_Fix 2 — 'is that expensive?' must resolve 'that' from state, not ask what_

- **✓** `specify_material` · Customer: *Can I have a bullnose starting step in oak?*
  NEX: Given your preference for a bullnose starting step in oak, what tread profile would you prefer for this staircase?
- **✓** `ask_price` · Customer: *Is that expensive?*
  NEX: Given your preference for a bullnose starting step in oak, the cost can vary depending on the complexity of the design and the materials used. Typically, a bullnose starting step can be a bit more expensive due to the detailing required. Would you like to expl

### reg-fix-2-pronoun-the-other-one · 2/2
_Fix 2 — 'the other one' must resolve to prior alternative from state_

- **✓** `specify_style` · Customer: *Closed string or cut string for a Victorian oak staircase?*
  NEX: Given your preference for a Victorian look, a closed string would naturally fit well with the traditional style you're aiming for. Which do you lean towards, the closed string or the cut string?
- **✓** `statement` · Customer: *Tell me more about the other one*
  NEX: Given your preference for a Victorian look, the cut string would showcase the tread ends step down as a feature, which might complement the traditional style you're aiming for. Which do you lean towards, the closed string or the cut string?

## Natural 25-turn transcript

| T | Customer | Intent | Reply (first 180 chars) | Facts | Focus (top 4) | Latency |
|---|---|---|---|---|---|---|
| 1 | hi | meta_greeting | Hi there — how can I help with your staircase needs? | — | — | 771ms |
| 2 | u there? | meta_presence | No problem — happy to help. How can I assist you today? | — | — | 701ms |
| 3 | im looking to redo my staircase | statement | Given your staircase against a wall, a closed string with oak would be a common choice. How does that sound? | — | staircase | 1809ms |
| 4 | its against a wall on one side | specify_constraint | Given your staircase against a wall on one side, would you prefer a closed string or a cut string for the open side? | construction_context=against_wall | staircase,against_wall | 1774ms |
| 5 | oak i think | specify_material | Given the oak you mentioned, a closed string with a traditional look would suit your staircase well against the wall. What about a cut string for the open side? | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak | 1942ms |
| 6 | what abt closed vs cut? | compare | Would you like to explore which staircase style appeals more to you, the closed string or the cut string? | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak | 1729ms |
| 7 | and open riser too? | ask_what_about | Would you like to explore which staircase style appeals more to you, the open riser or the open string? | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak,open_riser | 1758ms |
| 8 | hmm | backchannel | Take your time. I'm here when you're ready. | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak,open_riser | 827ms |
| 9 | which would you go for in a Victorian house | specify_style | Given your preference for a traditional look, a closed string staircase would be a fitting choice for a Victorian house. What about the material—would you consider walnut as an opt | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2088ms |
| 10 | how much roughly | ask_price | I don't want to guess figures — I can get you an accurate quote once we've talked through the specifics. What sort of size is your staircase, roughly? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2251ms |
| 11 | and installation - separate? | ask_what_about | Given the oak you mentioned and the traditional direction, a closed string staircase would be a fitting choice for your Victorian house. Would you prefer the installation to be sep | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2438ms |
| 12 | wait sorry, what does 'base rail' mean | statement | Sure, how does "base rail" work in a staircase? Would you like to know more about its function or how it fits into the design? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2411ms |
| 13 | does that apply to cut string too | statement | Sure, how does "base rail" work in a staircase? Would you like to know more about its function or how it fits into the design? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2365ms |
| 14 | actually let's switch to walnut | correct | Given the walnut you mentioned and your traditional style intent, a walnut string would complement the look well. Would you like to explore further? | construction_context=against_wall · material_primary=walnut · style_intent=traditional | staircase,against_wall,oak,open_riser | 2194ms |
| 15 | does that change the recommendation | statement | Given the walnut you mentioned and your traditional style intent, a walnut string would complement the look well. Would you like to explore other materials or styles for your stair | construction_context=against_wall · material_primary=walnut · style_intent=traditional | staircase,against_wall,oak,open_riser | 2333ms |
| 16 | no back to oak | correct | Given your preference to return to oak and your traditional style intent, a closed string staircase in oak would be a classic choice. Would you like to explore this further? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2096ms |
| 17 | sorry for the flip flopping | correct | Given your flip-flopping, how about we revisit the idea of a closed string staircase in oak? Would that appeal to you? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2214ms |
| 18 | what about the bottom step - can it be something special? | ask_what_about | Given your interest in a special feature for the bottom step, a rounded bullnose is a classic and common choice for traditional oak staircases. Would you like to explore this furth | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2494ms |
| 19 | bullnose yes | statement | Given your preference for a bullnose, would you consider a full carpet on the flight with the bullnose starting step left in exposed timber as the feature? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2484ms |
| 20 | and can i carpet the rest but keep that step in oak | ask_what_about | Given the oak you mentioned and the traditional direction, a full carpet on the flight with the bullnose starting step left in exposed timber sounds like a great idea. What do you  | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2493ms |
| 21 | who am i actually talking to btw | meta_identity | No problem — I'm here and ready to help with your staircase. How can I assist you today? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 1766ms |
| 22 | cool, thanks | close | You're welcome — anything else I can help with? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 1048ms |
| 23 | one more - is there a rule for handrail height? | ask_definition | Given the oak you mentioned and your traditional direction, the handrail height should be around 900mm to 1000mm measured vertically above the pitch line of the flight. Is that hel | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2615ms |
| 24 | perfect. summary: oak, against wall, closed string with cut wall option, bullnose bottom step exposed, carpeted flight above, 900mm handrail | confirm | Given your summary, it sounds like a closed string with a cut-walk option would be a good fit. The bullnose bottom step, carpeted flight, and 900mm handrail all align well with thi | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 3009ms |
| 25 | sound right? | ask_definition | Sound right? Would you like to explore a closed string staircase with a cut-walk option for your staircase? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2320ms |
