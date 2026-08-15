# Phase B regression · 19/19 probes passed

## b1-multi-intent-two-questions · 1/1
_B1 · one message with TWO intents · both must be detected and addressed_

- ✓ Customer: *How much roughly, and how long does installation take?*
  intent=`ask_price` · secondary=[ask_installation] · emotion=`neutral` · focus=[installation,price] · handoff=false
  NEX: Given the size of your staircase, we can estimate the installation time. A typical closed string staircase can be installed in a day or two, depending on the complexity and the number of steps. The price will depend on t

## b1-multi-intent-correction-plus-question · 3/3
_B1 · correction PLUS new question (T16-type failure) · both handled_

- ✓ Customer: *I want oak*
  intent=`specify_material` · secondary=[] · emotion=`neutral` · focus=[oak] · handoff=false
  NEX: Given your preference for oak, a closed string would often be a good fit for a traditional look. What about the balustrade? Would you prefer a solid wood or a different material for that?

- ✓ Customer: *Actually walnut*
  intent=`correct` · secondary=[] · emotion=`neutral` · focus=[oak,walnut] · handoff=false
  NEX: Given your preference for walnut now, would you prefer the closed string look with walnut or consider an open string with oak for contrast?

- ✓ Customer: *back to oak, and what's the handrail height rule?*
  intent=`correct` · secondary=[ask_definition] · emotion=`neutral` · focus=[oak,walnut,handrail_height,handrail] · handoff=false
  NEX: The standard handrail height for a staircase is typically around 900mm from the floor to the top of the handrail. Would you like to know more about this or discuss any other aspect of your staircase?

## b2-emotion-apologetic · 1/1
_B2 · apologetic register detected · reply tone MUST be reassuring, NOT clinical_

- ✓ Customer: *sorry for the flip flopping*
  intent=`correct` · secondary=[] · emotion=`apologetic` · focus=[] · handoff=false
  NEX: Apologies for the confusion, but it seems we're still gathering more details. Could you tell me if this staircase is against a wall or if you have a specific design in mind?

## b2-emotion-frustrated · 1/1
_B2 · frustrated register (multi-punctuation / emphatic) · reply MUST be short + apologetic + real offer_

- ✓ Customer: *I already told you oak!!!!*
  intent=`specify_material` · secondary=[] · emotion=`frustrated` · focus=[oak] · handoff=false
  NEX: Given your preference for oak, would you consider a closed string staircase for the traditional look you're aiming for?

## b2-emotion-uncertain · 1/1
_B2 · uncertain register (hedge words) · reply MUST be gentle, offer options, not push_

- ✓ Customer: *hmm not sure maybe I want closed string?*
  intent=`ask_definition` · secondary=[] · emotion=`uncertain` · focus=[closed_string,string] · handoff=false
  NEX: Of course. What sort of look are you going for — traditional, contemporary, or something in between?

## b3-implicit-facts · 1/1
_B3 · 'renovating my Victorian terrace hallway' → captures renovation + victorian + terrace + hallway as entities_

- ✓ Customer: *I'm renovating my Victorian terrace hallway*
  intent=`specify_constraint` · secondary=[] · emotion=`neutral` · focus=[renovation,traditional,hallway,terrace_house] · handoff=false
  NEX: Given your Victorian terrace hallway, how about a closed string with oak for a traditional look?

## b4-handoff-signal · 2/2
_B4 · TWO thin-packet price turns in a row → handoff_recommended=true_

- ✓ Customer: *How much?*
  intent=`ask_price` · secondary=[] · emotion=`uncertain` · focus=[price] · handoff=false
  NEX: Given your interest in a traditional look, the cost can vary widely depending on the materials and complexity of the staircase. A basic closed string staircase might start around £1,500 to £2,000, but for a more elaborat

- ✓ Customer: *Rough figure?*
  intent=`ask_price` · secondary=[] · emotion=`uncertain` · focus=[price] · handoff=true
  NEX: Sure, here’s a suitable reply:  Given your interest in a rough figure, I don't want to guess figures — let me get you the right answer. One of the team can ring you tomorrow morning to discuss the details further. Could 

## b5-condensation · 9/9
_B5 · after >8 turns, condensed_history is populated · recent_turn_summaries stays ≤6_

- ✓ Customer: *hi*
  intent=`meta_greeting` · secondary=[] · emotion=`neutral` · focus=[] · handoff=false
  NEX: Hi there — how can I help?

- ✓ Customer: *oak staircase*
  intent=`specify_material` · secondary=[] · emotion=`neutral` · focus=[staircase,oak] · handoff=false
  NEX: Given your preference for an oak staircase, would you prefer a closed string look or consider an open string with oak for contrast?

- ✓ Customer: *against a wall*
  intent=`specify_constraint` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall] · handoff=false
  NEX: Given your preference for an oak staircase against the wall, would you consider a cut string for a more open look, or do you prefer the smooth, closed string with the tread ends hidden?

- ✓ Customer: *closed string*
  intent=`statement` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall,closed_string,string] · handoff=false
  NEX: Given your preference for a closed string look with oak, would you consider this for your staircase against the wall?

- ✓ Customer: *bullnose*
  intent=`statement` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall,closed_string,string] · handoff=false
  condensed: _Earlier in this conversation (through turn 10): established facts — material_primary=oak · construct_
  NEX: Given the oak you mentioned, would you consider a bullnose starting step for your staircase against the wall?

- ✓ Customer: *carpet the flight*
  intent=`statement` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall,closed_string,string] · handoff=false
  condensed: _Earlier in this conversation (through turn 10): established facts — material_primary=oak · construct_
  NEX: Given your preference for carpeting the flight, would you consider a rounded bullnose starting step for your staircase against the wall?

- ✓ Customer: *900mm handrail*
  intent=`ask_options` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall,closed_string,string] · handoff=false
  condensed: _Earlier in this conversation (through turn 14): established facts — material_primary=oak · construct_
  NEX: For wood specifically, common choices are oak, walnut, and mahogany — the look and budget usually drive the pick. Any of those catch your eye?

- ✓ Customer: *yeah*
  intent=`backchannel` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall,closed_string,string] · handoff=false
  condensed: _Earlier in this conversation (through turn 14): established facts — material_primary=oak · construct_
  NEX: Take your time. I'm here when you're ready.

- ✓ Customer: *ok*
  intent=`backchannel` · secondary=[] · emotion=`neutral` · focus=[staircase,oak,against_wall,closed_string,string] · handoff=false
  condensed: _Earlier in this conversation (through turn 18): established facts — material_primary=oak · construct_
  NEX: Take your time. I'm here when you're ready.
