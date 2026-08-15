# NEX conversation · regression + 25-turn natural test · 2026-08-15

- Regression fixtures: **15/15 probes passed**
- Natural conversation: **25 turns**, avg **1964.1ms** per turn
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
  NEX: Hi there — I'm here and ready to help. How can I assist you today?
- **✓** `meta_presence` · Customer: *are you there?*
  NEX: Hi there — I'm here and ready to help with any questions you might have. How can I assist you today?

### reg-fix-4-identity · 1/1
_Fix 4 — 'who are you' should identify as Summit assistant, not reveal AI model_

- **✓** `meta_identity` · Customer: *who are you?*
  NEX: Hi there — I'm the Summit staircase assistant here to help with any questions you might have. How can I assist you today?

### reg-fix-1-price-no-fabrication · 2/2
_Fix 1 — asking for a price when NO price is in the packet must NOT invent a £ figure_

- **✓** `specify_material` · Customer: *I'm looking for an oak staircase*
  NEX: For your oak staircase, we can explore a closed string design, which gives a smooth diagonal look without showing the tread ends. Would you prefer that or something with a cut string, where the tread ends are visible?
- **✓** `ask_price` · Customer: *How much would that cost?*
  NEX: I don't want to guess figures — I can get you an accurate quote once we've talked through the specifics. What sort of size is your staircase, roughly?

### reg-fix-1-price-range-no-fabrication · 2/2
_Fix 1 — invented price RANGES also count as fabrication_

- **✓** `specify_material` · Customer: *I want a walnut staircase*
  NEX: For a walnut staircase, you'll get a warm, natural look that's gentle on the eyes. It's a popular choice for its rich, earthy tones. Do you have any preferences for the style, such as open or closed string?
- **✓** `ask_price` · Customer: *roughly what's the price?*
  NEX: I don't have a firm figure yet — pricing depends on the size of your staircase. What sort of size is your staircase, roughly?

### reg-fix-3-no-op-correction · 2/2
_Fix 3 — correcting to the CURRENT value should not narrate a state change_

- **✓** `specify_material` · Customer: *I'd like an oak staircase*
  NEX: For a staircase against a wall, an oak closed string would be a classic choice, giving a smooth, attractive look without the tread ends showing. Would you prefer this option?
- **✓** `correct` · Customer: *No, I meant oak*
  NEX: Given that you've specified oak, a closed string staircase would be a good choice, providing a smooth, hidden look. Would you like to see examples of different designs or dimensions?

### reg-fix-2-pronoun-that · 2/2
_Fix 2 — 'is that expensive?' must resolve 'that' from state, not ask what_

- **✓** `specify_material` · Customer: *Can I have a bullnose starting step in oak?*
  NEX: For your oak staircase, a bullnose starting step is a popular choice, giving a smooth and refined look. Would you prefer this option or consider a different starting step?
- **✓** `ask_price` · Customer: *Is that expensive?*
  NEX: Given that oak is your primary timber and you're against a wall, a closed string bullnose staircase is often the way to go. It gives a smooth, traditional look without the tread ends showing. If you prefer the tread ends to step down as a feature, a cut string

### reg-fix-2-pronoun-the-other-one · 2/2
_Fix 2 — 'the other one' must resolve to prior alternative from state_

- **✓** `ask_definition` · Customer: *Closed string or cut string for a Victorian oak staircase?*
  NEX: For a Victorian oak staircase, a closed string is often the traditional choice, providing a smooth diagonal side with treads and risers hidden. If you prefer a cut string with tread ends visible, that's also an option. Which one appeals more to you?
- **✓** `statement` · Customer: *Tell me more about the other one*
  NEX: Given that you're leaning towards the cut string, it often works well for Victorian oak staircases, providing a feature-rich look with visible tread ends. Would you like to see how a cut string staircase might look in your space?

## Natural 25-turn transcript

| T | Customer | Intent | Reply (first 180 chars) | Facts | Focus (top 4) | Latency |
|---|---|---|---|---|---|---|
| 1 | hi | meta_greeting | Hi there — how can I help with your staircase queries today? | — | — | 995ms |
| 2 | u there? | meta_presence | Hi there — I'm here and ready to help with any questions you might have about staircases. How can I assist you today? | — | — | 1222ms |
| 3 | im looking to redo my staircase | statement | Sure, given your interest in refurbishing your staircase while keeping some of the timber visible, a closed string staircase would be a good choice. It keeps the wood exposed and g | — | staircase | 1965ms |
| 4 | its against a wall on one side | specify_constraint | Given your staircase is against a wall on one side, a closed string would be a common choice, providing that smooth diagonal look without the tread ends showing. Would you prefer t | construction_context=against_wall | staircase,against_wall | 2015ms |
| 5 | oak i think | specify_material | For a staircase against a wall, oak is often the preferred choice for its durability and ability to hide marks and dents. Would you like to see some examples of oak stairs or perha | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak | 1840ms |
| 6 | what abt closed vs cut? | compare | Given the oak you mentioned, a closed string staircase would be a good option, providing a smooth diagonal side without the tread ends showing. If you prefer the tread ends to step | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak | 2319ms |
| 7 | and open riser too? | ask_what_about | Given your preference for an open-riser staircase with a toddler in the house, it's important to consider the safety implications. Usually, a cut-string staircase with open risers  | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak,open_riser | 2476ms |
| 8 | hmm | backchannel | Take your time. I'm here when you're ready. | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak,open_riser | 1022ms |
| 9 | which would you go for in a Victorian house | statement | Given the oak you mentioned and the traditional direction, a closed string staircase is often the better choice in a Victorian house, as it provides a smooth, seamless look without | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2180ms |
| 10 | how much roughly | ask_price | I don't want to guess figures — I can get you an accurate quote once we've talked through the specifics. What sort of size is your staircase, roughly? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 1844ms |
| 11 | and installation - separate? | ask_what_about | For a traditional staircase with oak treads, a separate installation would allow for more customization and easier coordination with other renovations. Which part of the installati | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 1858ms |
| 12 | wait sorry, what does 'base rail' mean | statement | Given the oak you mentioned, the base rail is a common feature in traditional oak staircases. It's the vertical board that runs along the underside of the handrail, providing a sec | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2331ms |
| 13 | does that apply to cut string too | statement | For a cut string staircase, the tread ends are visible and the balusters land into the treads, whereas a closed string keeps the tread ends hidden. Does that apply to your cut stri | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 1982ms |
| 14 | actually let's switch to walnut | correct | Given your preference to switch to walnut, a cut string staircase would be a good choice here. The tread ends step down, making it a feature rather than hiding them. Would you like | construction_context=against_wall · material_primary=walnut · style_intent=traditional | staircase,against_wall,oak,open_riser | 2156ms |
| 15 | does that change the recommendation | statement | Given the walnut you mentioned, a cut string staircase would often be a good choice, as it keeps the traditional look with the tread ends visible. Would you prefer the closed strin | construction_context=against_wall · material_primary=walnut · style_intent=traditional | staircase,against_wall,oak,open_riser | 2265ms |
| 16 | no back to oak | correct | Given the switch from walnut to oak, a closed string staircase would be the natural choice for your Victorian-style staircase. Would you like to see an example of a mixed string co | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2556ms |
| 17 | sorry for the flip flopping | correct | Given your apologetic tone, it sounds like you might be feeling a bit uncertain about the staircase options. Would you like to take a look at a couple of similar examples in our ga | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2063ms |
| 18 | what about the bottom step - can it be something special? | ask_what_about | Given the oak you mentioned and the traditional direction we've been discussing, a rounded bullnose would be a common choice for the starting step, complementing the smooth diagona | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2121ms |
| 19 | bullnose yes | statement | Given that you want a modern staircase with a nice big first step and glass above it, a bullnose starting step can indeed be a striking feature. Would you prefer the bullnose to be | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2355ms |
| 20 | and can i carpet the rest but keep that step in oak | ask_what_about | In that case, a rounded bullnose in oak would complement your existing staircase nicely, keeping the rest of the steps carpeted. Would you prefer the bullnose to be exposed or hidd | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2178ms |
| 21 | who am i actually talking to btw | meta_identity | Hi there — I'm the Summit staircase assistant, here to help with your staircase needs. How can I assist you today? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 1209ms |
| 22 | cool, thanks | close | You're welcome — anything else I can help with? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 878ms |
| 23 | one more - is there a rule for handrail height? | ask_definition | Great question. The UK Building Regulations specify that handrail height should be between 900mm and 1000mm above the pitch line of the flight. Would you like to see some examples  | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2196ms |
| 24 | perfect. summary: oak, against wall, closed string with cut wall option, bullnose bottom step exposed, carpeted flight above, 900mm handrail | confirm | Given the oak you mentioned and the traditional direction, a closed string staircase with a cut string option for the open side is often the way to go. The 900mm handrail height is | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2401ms |
| 25 | sound right? | ask_definition | It sounds like you have a staircase with an oak finish, against a wall, and you're considering a closed string. The outer visible string would be a smooth diagonal oak plank with a | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2675ms |
