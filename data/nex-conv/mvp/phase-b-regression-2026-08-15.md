# Phase B regression · 19/19 probes passed

## b1-multi-intent-two-questions · 1/1
_B1 · one message with TWO intents · both must be detected and addressed_

- ✓ Customer: *How much roughly, and how long does installation take?*
  intent=`ask_price` · secondary=[ask_installation] · emotion=`neutral` · focus=[installation,price] · handoff=false
  NEX: I don't want to guess figures — I can get you an accurate quote once we've talked through the specifics. What sort of size is your staircase, roughly?

## b1-multi-intent-correction-plus-question · 3/3
_B1 · correction PLUS new question (T16-type failure) · both handled_

- ✓ Customer: *I want oak*
  intent=`specify_material` · secondary=[] · emotion=`neutral` · focus=[oak] · handoff=false
  NEX: Given your preference for oak, a closed string with oak would be a common choice for a traditional look. Would you consider this option, or are you leaning towards an open string with another material?

- ✓ Customer: *Actually walnut*
  intent=`correct` · secondary=[] · emotion=`neutral` · focus=[oak,walnut] · handoff=false
  NEX: Given your preference for walnut now, the closed string with walnut would be a popular choice for a traditional look. Would you consider this option, or are you leaning towards an open string with another material?

- ✓ Customer: *back to oak, and what's the handrail height rule?*
  intent=`correct` · secondary=[ask_definition] · emotion=`neutral` · focus=[oak,walnut,handrail_height,handrail] · handoff=false
  NEX: Given your preference for oak now, let's focus on the handrail height. The standard rule is around 900mm from the ground to the top of the handrail. Would you like to explore this or consider a different staircase option

## b2-emotion-apologetic · 1/1
_B2 · apologetic register detected · reply tone MUST be reassuring, NOT clinical_

- ✓ Customer: *sorry for the flip flopping*
  intent=`correct` · secondary=[] · emotion=`apologetic` · focus=[] · handoff=false
  NEX: Apologies for that, it sounds like we might have jumped ahead a bit. So, you're looking for a staircase that's against a wall and you want it to be traditional, right? Is there anything specific you're thinking about the

## b2-emotion-frustrated · 1/1
_B2 · frustrated register (multi-punctuation / emphatic) · reply MUST be short + apologetic + real offer_

- ✓ Customer: *I already told you oak!!!!*
  intent=`specify_material` · secondary=[] · emotion=`frustrated` · focus=[oak] · handoff=false
  NEX: Given your preference for oak, a closed string staircase would be a good fit for a traditional look. Would you like to see more examples of this type?

## b2-emotion-uncertain · 1/1
_B2 · uncertain register (hedge words) · reply MUST be gentle, offer options, not push_

- ✓ Customer: *hmm not sure maybe I want closed string?*
  intent=`ask_definition` · secondary=[] · emotion=`uncertain` · focus=[closed_string,string] · handoff=false
  NEX: Absolutely — happy to help. Is this a new staircase, or replacing one that's already there?

## b3-implicit-facts · 1/1
_B3 · 'renovating my Victorian terrace hallway' → captures renovation + victorian + terrace + hallway as entities_

- ✓ Customer: *I'm renovating my Victorian terrace hallway*
  intent=`specify_constraint` · secondary=[] · emotion=`neutral` · focus=[renovation,traditional,hallway,terrace_house] · handoff=false
  NEX: Given your Victorian terrace hallway, a closed string with an oak handrail would be a classic and traditional choice. How does that sound? Would you like to explore another option?

## b4-handoff-signal · 2/2
_B4 · TWO thin-packet price turns in a row → handoff_recommended=true_

- ✓ Customer: *How much?*
  intent=`ask_price` · secondary=[] · emotion=`uncertain` · focus=[price] · handoff=false
  NEX: Given the current state, I don't have a firm figure yet — pricing depends on the specific details of your staircase. Would you mind sharing how much floor space is available for the base of the staircase in square metres

- ✓ Customer: *Rough figure?*
  intent=`ask_price` · secondary=[] · emotion=`uncertain` · focus=[price] · handoff=true
  NEX: Sure, here’s a suitable reply:  "I don't want to guess figures — I can get you the right answer. One of the team can ring you tomorrow morning to discuss the details. When would be a good time for you?"

## b5-condensation · 9/9
_B5 · after >8 turns, condensed_history is populated · recent_turn_summaries stays ≤6_

- ✓ Customer: *hi*
  intent=`meta_greeting` · secondary=[] · emotion=`neutral` · focus=[] · handoff=false
  NEX: Hi there — how can I help?

- ✓ Customer: *oak staircase*
  intent=`specify_material` · secondary=[] · emotion=`neutral` · focus=[staircase,oak] · handoff=false
  NEX: Given your preference for oak, a closed string staircase with a traditional look is often a good choice. Would you like to explore this option further?

- ✓ Customer: *against a wall*
  intent=`specify_constraint` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall] · handoff=false
  NEX: Given your staircase against a wall, a closed string with a traditional look would often be the best fit. Would you prefer to explore this option further?

- ✓ Customer: *closed string*
  intent=`statement` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall,closed_string,string] · handoff=false
  NEX: Given your preference for a traditional look against the wall, a closed string with oak would often be the best fit. Would you prefer to explore this option further?

- ✓ Customer: *bullnose*
  intent=`statement` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall,closed_string,string] · handoff=false
  condensed: _Earlier in this conversation (through turn 10): established facts — material_primary=oak · construct_
  NEX: Given the oak you mentioned, a bullnose starting step can often be a nice touch, providing a smooth transition from the staircase to the floor. Would you like to see some examples of this in action?

- ✓ Customer: *carpet the flight*
  intent=`specify_material` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall,closed_string,string] · handoff=false
  condensed: _Earlier in this conversation (through turn 10): established facts — material_primary=oak · construct_
  NEX: Given your preference for a traditional look against the wall, and the carpeted flight you're planning, a rounded bullnose starting step often works well. Would you like to see some examples of this in action?

- ✓ Customer: *900mm handrail*
  intent=`statement` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall,closed_string,string] · handoff=false
  condensed: _Earlier in this conversation (through turn 14): established facts — material_primary=oak · construct_
  NEX: Given your preference for a traditional look against the wall, a 900mm handrail is a common choice. Would you like to see some examples of this in action?

- ✓ Customer: *yeah*
  intent=`backchannel` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall,closed_string,string] · handoff=false
  condensed: _Earlier in this conversation (through turn 14): established facts — material_primary=oak · construct_
  NEX: Take your time. I'm here when you're ready.

- ✓ Customer: *ok*
  intent=`backchannel` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall,closed_string,string] · handoff=false
  condensed: _Earlier in this conversation (through turn 18): established facts — material_primary=oak · construct_
  NEX: Take your time. I'm here when you're ready.
