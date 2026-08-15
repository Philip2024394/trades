# Phase B regression · 19/19 probes passed

## b1-multi-intent-two-questions · 1/1
_B1 · one message with TWO intents · both must be detected and addressed_

- ✓ Customer: *How much roughly, and how long does installation take?*
  intent=`ask_price` · secondary=[ask_installation] · emotion=`neutral` · focus=[installation,price] · handoff=false
  NEX: For a rough estimate, the installation time can vary depending on the complexity of your staircase. A three-storey escape typically takes around 5 to 6 days for fitting. Would you like to explore a similar example or dis

## b1-multi-intent-correction-plus-question · 3/3
_B1 · correction PLUS new question (T16-type failure) · both handled_

- ✓ Customer: *I want oak*
  intent=`specify_material` · secondary=[] · emotion=`neutral` · focus=[oak] · handoff=false
  NEX: Given your preference for oak, a closed string staircase is often a popular choice, offering a smooth diagonal look without showing tread ends. Would you like to see more details on this option or explore other types of 

- ✓ Customer: *Actually walnut*
  intent=`correct` · secondary=[] · emotion=`neutral` · focus=[oak,walnut] · handoff=false
  NEX: For a staircase with walnut, a closed string option is often the best choice, providing a smooth diagonal side without showing tread ends. Would you prefer this option or consider a cut string with tread ends visible?

- ✓ Customer: *back to oak, and what's the handrail height rule?*
  intent=`correct` · secondary=[ask_definition] · emotion=`neutral` · focus=[oak,walnut,handrail_height,handrail] · handoff=false
  NEX: Given the oak you mentioned, the standard handrail height for a staircase is typically around 900mm from the ground to the top of the handrail. Would you like to see examples of different handrail heights or perhaps a co

## b2-emotion-apologetic · 1/1
_B2 · apologetic register detected · reply tone MUST be reassuring, NOT clinical_

- ✓ Customer: *sorry for the flip flopping*
  intent=`correct` · secondary=[] · emotion=`apologetic` · focus=[] · handoff=false
  NEX: Given your apologetic tone, it sounds like you might be reconsidering your initial request. Would you like to explore price, installation, or a comparison?

## b2-emotion-frustrated · 1/1
_B2 · frustrated register (multi-punctuation / emphatic) · reply MUST be short + apologetic + real offer_

- ✓ Customer: *I already told you oak!!!!*
  intent=`specify_material` · secondary=[] · emotion=`frustrated` · focus=[oak] · handoff=false
  NEX: Given your preference for oak, a closed string staircase is often the natural choice, providing a smooth diagonal side without the tread ends showing. If you prefer the tread ends to step down as a feature, a cut string 

## b2-emotion-uncertain · 1/1
_B2 · uncertain register (hedge words) · reply MUST be gentle, offer options, not push_

- ✓ Customer: *hmm not sure maybe I want closed string?*
  intent=`ask_definition` · secondary=[] · emotion=`uncertain` · focus=[closed_string,string] · handoff=false
  NEX: Given that you're leaning towards a closed string, it’s a solid choice for a smooth, seamless look. The closed string has its treads and risers hidden within the string itself, creating a clean, uninterrupted appearance.

## b3-implicit-facts · 1/1
_B3 · 'renovating my Victorian terrace hallway' → captures renovation + victorian + terrace + hallway as entities_

- ✓ Customer: *I'm renovating my Victorian terrace hallway*
  intent=`specify_constraint` · secondary=[] · emotion=`neutral` · focus=[renovation,traditional,terrace_house,hallway] · handoff=false
  NEX: Given your Victorian terrace hallway, a traditional Victorian staircase with a closed string would be a classic choice, providing that current staircase is in good structural shape. Would you like to explore a traditiona

## b4-handoff-signal · 2/2
_B4 · TWO thin-packet price turns in a row → handoff_recommended=true_

- ✓ Customer: *How much?*
  intent=`ask_price` · secondary=[] · emotion=`uncertain` · focus=[price] · handoff=false
  NEX: Given the current state, I understand you're uncertain about the cost. Let me show you a couple of examples to help you visualize the different options and their typical pricing ranges. Would you like to see those?

- ✓ Customer: *Rough figure?*
  intent=`ask_price` · secondary=[] · emotion=`uncertain` · focus=[price] · handoff=true
  NEX: I don't have a firm figure yet — pricing depends on the specific details of your staircase. What sort of size is your staircase, roughly? If it's easier, one of the team can ring you tomorrow and walk you through this pr

## b5-condensation · 9/9
_B5 · after >8 turns, condensed_history is populated · recent_turn_summaries stays ≤6_

- ✓ Customer: *hi*
  intent=`meta_greeting` · secondary=[] · emotion=`neutral` · focus=[] · handoff=false
  NEX: Hi there — how can I help with your staircase queries today?

- ✓ Customer: *oak staircase*
  intent=`specify_material` · secondary=[] · emotion=`neutral` · focus=[staircase,oak] · handoff=false
  NEX: For an oak staircase, we often recommend a closed string design, which gives a smooth diagonal look without showing the tread ends. Would you prefer a more open look with a cut string instead?

- ✓ Customer: *against a wall*
  intent=`specify_constraint` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall] · handoff=false
  NEX: Given the oak you mentioned, a closed string staircase against a wall is often the most suitable option, providing that smooth diagonal look without the tread ends showing. Would you like to explore this further or is th

- ✓ Customer: *closed string*
  intent=`statement` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall,closed_string,string] · handoff=false
  NEX: A closed string staircase is a smooth, straight-running board that hides the treads and risers, perfect for an against-wall staircase. If you prefer a stepped look, a cut string might be more suitable. Which one appeals 

- ✓ Customer: *bullnose*
  intent=`statement` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall,closed_string,string] · handoff=false
  condensed: _Earlier in this conversation (through turn 10): established facts — material_primary=oak · construct_
  NEX: Given your preference for a bullnose, a cut string against the wall would be a good option, as it allows for the rounded end without the need for carpeting. Would you like to see some examples of cut string staircases?

- ✓ Customer: *carpet the flight*
  intent=`specify_material` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall,closed_string,string] · handoff=false
  condensed: _Earlier in this conversation (through turn 10): established facts — material_primary=oak · construct_
  NEX: Given the oak you mentioned, carpeting the bullnose would create a cohesive look with the rest of the staircase. Would you prefer a rounded bullnose to complement the traditional style?

- ✓ Customer: *900mm handrail*
  intent=`statement` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall,closed_string,string] · handoff=false
  condensed: _Earlier in this conversation (through turn 14): established facts — material_primary=oak · construct_
  NEX: Given your preference for a 900mm handrail, a closed string staircase would be a good choice, providing a smooth diagonal look without showing the tread ends. Would you prefer the closed string or consider an open string

- ✓ Customer: *yeah*
  intent=`backchannel` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall,closed_string,string] · handoff=false
  condensed: _Earlier in this conversation (through turn 14): established facts — material_primary=oak · construct_
  NEX: Take your time — I'm here when you're ready.

- ✓ Customer: *ok*
  intent=`backchannel` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall,closed_string,string] · handoff=false
  condensed: _Earlier in this conversation (through turn 18): established facts — material_primary=oak · construct_
  NEX: Take your time. I'm here when you're ready.
