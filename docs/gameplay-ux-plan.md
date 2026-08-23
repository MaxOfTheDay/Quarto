# Quarto — gameplay screen: UX review and design plan

Review and design planning only. No application code changed.

Conducted against a production build of `claude/quarto-gameplay-ux-review-lh3xvs`,
driven in Chromium at 360×640, 390×844, 412×915 and 430×932, in both themes, across
the opening, place, choose, thinking, mid-game, wrong-surface and result states.
Every number below is measured from the running build, not estimated.

Supersedes nothing in `docs/ux-review.md`: that review was conducted against an
older `main` and most of what it raised has since shipped. This one starts from
what is on screen today.

---

## 1. Current UX diagnosis

### What is genuinely good, and must survive any change

- **The sixteen glyphs.** One coordinate system, shared baseline and footprint, all
  four attributes as real geometry. Readable at 47 px. The best thing in the product.
- **The slab.** Milled edge, sunk sockets, static grain, contact shadows. An object,
  not a grid.
- **The pass flight.** A piece arcs from the pool to the pocket over 450 ms. This is
  the clearest explanation of Quarto's split turn anywhere in the product — better
  than any sentence could be. Do not touch it.
- **The last-placed rim.** A warm inset on the socket, not a floating tick. Exactly
  right, and exactly the amount.
- **Token discipline.** Seven type steps, one radius scale, two control heights, two
  semantic colours. A real system.
- **Keyboard play and the accessibility layer.** Roving tab stops on both grids,
  `aria-disabled` rather than `disabled` so the position stays readable while it is
  not yours to act on, focus handed onward after each half-move.

### The core problem, stated precisely

Quarto's turn has two halves that demand completely different actions. Here is
everything the interface changes between them, measured:

| Signal | Place half | Choose half | Actual delta |
|---|---|---|---|
| Status line (largest text on screen) | "Player 2's turn" | "Player 2's turn" | **none** |
| Accent dot before the actor | on | on | **none** |
| Pocket | holds the piece | empty dark box | strong, but ambiguous |
| Board slab | `filter: none`, full shadow | `saturate(.9) brightness(.96)`, flat | **≈4 % luminance** |
| Target dots | 5.3 px at 42 % opacity | off | present but sub-threshold |
| Pool tray | `saturate(.94) brightness(.985)` | `filter: none` | **≈2 %** |
| Pool header | "REMAINING", grey | "CHOOSE ONE", accent + accent rule | clear, but 12.5 px at the screen's bottom edge |

Of seven candidate signals, **two carry real information** — whether the pocket is
full, and the colour of a 12.5 px label. They sit roughly 600 px apart, at opposite
ends of the screen. The two "surface recession" signals are below perceptual
threshold, especially in dark mode where the board is already dark and its cast
shadow has nothing to fall on.

**The largest text on the screen is constant across the entire turn loop.** It says
who is playing and never what they must do.

### Four consequences

**The interface only explains itself when you get it wrong.** Tap the board during
the choose half and `.status__next` fills with *"Choose a piece below."* in accent,
directly under the actor line. It is the single best-communicating moment in the
product — and it is reserved space (`min-height: 18px`) that sits empty 100 % of the
time except during a 700 ms error state. The right sentence already exists, in the
right place, and is withheld until the player fails.

**The empty pocket reads as a rendering fault.** In the choose half a dark bordered
rectangle sits at top-left — the strongest position on the screen, the first thing
read. It is on screen for half of every game and communicates nothing. On the opening
screen of a brand new game it is the *first* thing a player sees.

**The defining rule of Quarto is never stated on the gameplay screen.** The word
"opponent" appears nowhere. `trayLabel` computes `For Player 2` — and the phone
stylesheet hides it:

```css
.tray .section__head .state-label:not(.tray__warn) { display: none; }
```

The one string that explains the handover is deliberately suppressed on the primary
platform. A first-time player's opening screen is an empty box, an empty board, and
"CHOOSE ONE … 16". Nothing says *you are choosing the piece your opponent must play*.

**22 % of a modern phone screen is empty.** Measured dead vertical space between the
top band and the board, plus board to pool header:

| Viewport | Gap above board | Gap below board | Total dead | % of viewport |
|---|---|---|---|---|
| 360 × 640 | 26 px | 27 px | 53 px | 8 % |
| 390 × 844 | 85 px | 85 px | 170 px | 20 % |
| 412 × 915 | 106 px | 106 px | 212 px | 23 % |
| 430 × 932 | 103 px | 103 px | 206 px | 22 % |

Two identical voids. The board is width-bound (358 px on a 390 px screen) and cannot
grow into them, so this is the largest unspent layout resource in the product — and
meanwhile the pool slots, which are the only place a player must read four attributes
off a piece to plan, are the *smallest* rendering of the pieces anywhere: 47 × 56 px
on a 390 px phone, 43 × 51 px on a 360 px phone (below the 44 px touch minimum on the
narrow axis).

### Smaller findings

- **The accent dot is a constant, not a signal.** It means "it is your move". In local
  two-player it is on for every turn of every game — zero information for half of all
  sessions.
- **The accent carries five different meanings.** "Your move" (dot), "error" (nudge),
  "act here" (target dots, hover ring, pool rule), "this happened" (last-placed rim,
  in `--accent-warm`), "this won" (win stroke, won socket). No player can be expected
  to read `#d9663a` against `#a2401f` as a change of meaning.
- **"REMAINING 13" is split across 342 px.** Label hard left, number hard right. The
  two halves of one fact, as far apart as the layout permits.
- **Undo is the only button inside the game area,** sits beside the most important
  text on screen, and — being a button among labels — reads as the thing to press.
- **The board's top row is outside comfortable one-handed reach** on a 844 px screen
  (y ≈ 232–322 against a thumb arc starting around y ≈ 380). Everything else that is
  interactive is reachable.

---

## 2. Core design principles

**One law, five consequences.**

> **At any moment, exactly one surface is live, one sentence names what to do with it,
> and nothing else on the screen uses the accent.**

1. **The sentence and the surface change together, or not at all.** Two expressions of
   one fact, never out of sync, never one without the other. This is the whole
   interaction language; there is no second highlight convention.
2. **Say it every turn, in the same place, whether or not it is obvious.** A slot that
   always answers "what do I do now?" is worth more than the words it saves by going
   quiet when the answer seems clear. Consistency is the feature.
3. **Every accent has one meaning: *act on this now*.** Anything the accent currently
   says that is not that — "your move", "this happened", "this won" — moves to another
   treatment or goes.
4. **Prefer removing an element to adding one.** The screen already has more parts than
   the game has ideas.
5. **The board and the pieces are the only things allowed to be beautiful.** Chrome is
   type and hairlines. Nothing else earns a container, a shadow or a radius.

---

## 3. Turn-flow analysis

The complete loop, and what should be true at each point. "Lit" means the one surface
carrying elevation, full brightness and the accent hairline.

| # | State | Sentence (line 2) | Lit | Receded | Pocket | Attention lands on |
|---|---|---|---|---|---|---|
| 1 | Game opens — you choose first | *Choose a piece for Player 2* | tray | board | absent | tray |
| 2 | You picked; opponent must place | — | neither | both | holds piece, dimmed | board (to read the position) |
| 3 | Opponent placed; piece is yours | *Place this piece* | board | tray | holds piece, lit | pocket → board |
| 4 | You place | — (200 ms) | board settles | — | empties | the cell you touched |
| 5 | Your turn to choose | *Choose a piece for Player 2* | tray | board | absent | tray |
| 6 | You are pointing at a piece (pointer only) | *Choose a piece for Player 2* | tray | board | shows preview | the piece under the cursor |
| 7 | You chose | — | neither | both | fills, piece flies in | the pocket, briefly |
| 8 | Opponent thinking (vs computer) | — | neither | both | holds piece, dimmed | the board |
| 9 | Quarto | (result headline replaces line 1) | board | tray | absent | the winning line |

Two facts fall out of the table.

**Steps 4 and 7 are the same beat and are currently unmarked.** The moment a half-turn
completes is exactly when a player asks "now what?" — and today the sentence does not
change, because there is no sentence. Filling line 2 makes 4 and 7 the two clearest
moments in the loop instead of the two murkiest.

**Steps 2 and 8 are the only states with no lit surface,** and that is correct: nothing
on screen is yours to touch. The board should be readable and neither surface should
invite. Today these states are visually indistinguishable from step 3, which is the
second-worst confusion in the product after the empty pocket.

---

## 4. Alternative interaction models

### Model A — The sentence

A two-line status block carries the whole turn state. Line 1 is who, line 2 is what.
Surfaces keep their present, near-invisible phase treatment.

*Place:* `Player 2` / `Place this piece` · *Choose:* `Player 2` / `Choose a piece for Player 1`

- **How it works** Fill the reserved `.status__next` slot every turn instead of only on
  error. Everything else stays as built.
- **Advantages** Almost free — the space, the element and the transition already exist.
  Unambiguous. Survives translation, reduced motion, screen readers and colour blindness
  identically. Teaches the handover rule every single turn.
- **Disadvantages** Puts the entire burden of turn state on 13 px of text at the top of
  the screen, ~600 px from the tray it may be pointing at. Players stop reading a line
  that is always there. The screen still does not *look* different between the halves.
- **Risk of confusion** Low, but the sentence and the surfaces would actively disagree:
  the text says "choose below" while the board still looks like the most important
  object on screen.
- **Chrome added** None. **Visual impact** Low. **Suitability** A good half-measure; not
  a game interface.

### Model B — The lit surface

No instruction copy at all. The live surface becomes unmistakable and the inert one
genuinely recedes. Line 1 keeps naming the player.

- **How it works** Raise the phase delta from ~4 % to something a player sees without
  looking for it: the live surface takes real elevation, full brightness and an accent
  hairline; the inert one loses its cast shadow entirely and drops ~12 % in brightness.
- **Advantages** Zero chrome. Most game-like. Communicates by weight and light, which is
  exactly the vocabulary the physical-board aesthetic already speaks. Fast — read in
  peripheral vision, no fixation needed.
- **Disadvantages** Never states the handover rule, so a first-timer still has to
  discover the game's defining mechanic by accident. Carries the whole message in
  contrast and elevation, which is precisely the channel that fails for low-vision
  users, in bright sunlight, and on cheap panels.
- **Risk of confusion** Moderate for a first game, low afterwards. The rule "the piece
  you pick is for the *other* player" is simply never expressed.
- **Chrome added** None. **Visual impact** High. **Suitability** Beautiful and
  under-explained.

### Model C — One sentence, one lit surface *(recommended)*

A and B held under a single law, with the accent spent on nothing else.

- **How it works** Line 2 names the act in accent; exactly one surface is lit; they
  change together on the same 200 ms beat. Everything the accent currently says that is
  not "act here" is removed or re-treated. The pocket exists only while a piece is in
  play. Nothing else in the interface highlights anything.
- **Advantages** Two channels for one fact — words and light — so it survives losing
  either. First-time comprehension comes from the sentence, tenth-game speed comes from
  the light. Directly answers all six questions in the brief. Costs nothing in new UI:
  the sentence uses reserved space, and the lit/receded treatment already exists and
  merely needs to become perceptible.
- **Disadvantages** Requires real discipline about the accent, which means removing
  things that currently look fine on their own (the status dot, the label swap in the
  pool header). Repeats in the place half what a filled pocket already implies.
- **Risk of confusion** Lowest of the four. The failure mode is mild redundancy, not
  ambiguity.
- **Chrome added** **Negative** — the model removes three elements and adds none.
- **Visual impact** High. **Suitability** This is what a polished mobile board game
  looks like.

### Model D — The piece is the cursor

No status copy. The piece in play physically travels, and the interactive mass of the
screen moves with it: handed a piece, it docks against the board's top edge and the
board lifts; place it and the tray rises to become the foreground surface.

- **How it works** State is expressed purely as *where the weight is*. The pocket is
  abolished; the piece in play sits on the board's own frame.
- **Advantages** The most physical model, and the most "game". No text to translate.
  Highest ceiling on delight.
- **Disadvantages** Three serious ones. It depends on motion, so `prefers-reduced-motion`
  destroys it rather than degrading it. It requires the tray to move between the halves
  of a turn — which the codebase already correctly forbids, in a comment, because that
  is exactly when a thumb is reaching for a slot. And it still never states the handover
  rule.
- **Risk of confusion** High for a first game. **Chrome added** None, but significant
  motion. **Suitability** Rejected on accessibility and on the moving-target problem.

---

## 5. Recommended direction

**Model C — one sentence, one lit surface.**

Because it is the only model that answers all six questions in the brief *and* removes
more than it adds:

| The player asks | Answered by |
|---|---|
| Whose turn is it? | Line 1, persistent |
| What must I do now? | Line 2, in accent, changes every half-turn |
| Which piece is actionable? | The pocket — which only exists when a piece is in play |
| Where can it go? | The board is lit; empty sockets carry a quiet dot |
| What happens after I place? | Line 2 swaps in place, on the same beat as the light |
| What is expected next? | *"Choose a piece for Player 1"* — the rule, stated every turn |

And on the brief's hypothesis specifically: **the two-line structure is right and the
decoration around it is not.**

- **Adopt** the persistent actor line plus a changing action line in accent.
- **Reject "YOUR TURN" in caps as a standing header.** It duplicates line 1, adds a
  third type size, and is ambiguous when two people share one phone.
- **Reject the "→" glyph.** It is decoration that points at nothing: the pocket is to
  the *left* of the text and the tray is 600 px *below* it.
- **Add what the hypothesis omits: name the opponent.** *"Choose a piece for Player 1"*,
  not *"Choose a piece for your opponent"*. This is the single highest-value string in
  the proposal — it is the rule that makes Quarto Quarto, and the gameplay screen has
  never said it.
- **Reject a second instruction in the pool header.** The sentence lives in exactly one
  place. The tray's lit state says "act here"; it does not need to say it in words too.

---

## 6. Proposed screen changes, top to bottom

### Top bar — `Quarto` · mode · ⋮
**Keep**, and **move Undo into it**, beside the ⋮ menu.

Undo is app chrome, not game state. In the band it is the only button among labels, it
sits beside the most important text on the screen, and its width changes every half-turn
("Undo choice" / "Undo placement" on wide screens). Moving it empties the band for the
turn statement and puts it where the other secondary controls already live. Being out of
easy thumb reach is *correct* for a rare, deliberate action — it is the accidental-tap
protection the brief asks for.

### The band — pocket · status · Undo
This is where the work is.

**Merge the pocket and the status into one statement.** They are already adjacent and
already about the same thing; today they read as two unrelated widgets because only one
of them ever changes.

```
place:    [piece]   Player 2
                    Place this piece            ← accent

choose:             Player 2
                    Choose a piece for Player 1 ← accent

waiting:  [piece]   Computer is thinking ⁞⁞
                    (line 2 empty)
```

- **Line 1 (`.status__actor`)** — who. Persistent, `--ink`, 16 px. **Remove the accent
  dot.** It is on for every turn of every local game, and once line 2 exists it is a
  third signal for a fact the words already carry.
- **Line 2 (`.status__next`)** — what. The **only** accent text on the screen. The slot
  and its 18 px reservation already exist; today they hold the error nudge and nothing
  else. The nudge keeps this slot — it is the same kind of sentence — and simply becomes
  rare, because the answer is now always present.
- **The pocket exists only while a piece is in play.** In the choose half it collapses
  entirely — no border, no shadow, no dashed mark — and the sentence takes the band's
  full width. The grid already does exactly this for the game-over state, so the
  mechanism is in place. The pocket opening and closing becomes a real, legible
  transition rather than a hole that appears.
  *Fallback if the horizontal reflow tests badly:* keep the pocket's 82 px reserved but
  draw nothing in it. An undrawn gap reads as indentation; a drawn empty box reads as a
  bug.
- **Dim the pocket when the piece is not yours to place** — this already exists
  (`data-away`, opacity 0.5) but at 0.5 against a lit shelf it is too subtle. It should
  be unmistakable that a piece on the shelf during the opponent's turn is *theirs*.

### The gap above the board
**Keep the breathing room; stop making it symmetric.** Two identical 103 px voids read
as a layout accident. One larger margin above and one smaller below reads as
composition, gives the sentence the top third of the screen, and pulls the board and
tray into the thumb's arc.

### The board
- **Make the phase change perceptible.** Lit: full brightness, full cast shadow, and the
  slab's milled edge picks up a low-alpha accent. Receded: drop the cast shadow entirely
  so it sits flat on the page, and take ~12 % of brightness — not the current 4 %.
  Expressed in light only, never position: the board must never move between halves of a
  turn.
- **Do not highlight cells individually beyond a texture.** At the start of a game all
  sixteen are empty, and sixteen identical marks read as wallpaper rather than as an
  invitation. The board as a whole is the signal; the dots are a texture that says
  "these pockets are free".
- **Grow the target dot from 5.3 px / 42 % to roughly 7 px / 50 %.** At its current size
  it is a speck — it registers as grain in the wood, not as an affordance. Still a
  texture at 7 px, but a legible one.
- **Keep** the hover/focus accent ring on the socket, the ghost piece under the pointer,
  the drop animation, and the last-placed rim exactly as they are. They are the best
  touch feedback in the product.
- **The last-placed rim should move out of the warm accent** into a neutral warm
  highlight, so "this happened" and "act here" cannot be confused. The distinction
  between `--accent-warm` and `--accent` is not one a player can be asked to read.

### The gap below the board
**Reduce it,** and spend the recovered height on the tray (below).

### The pool header — `REMAINING 13` / `CHOOSE ONE 13`
- **Stop swapping the label.** The sentence at the top already says "choose"; saying it
  again 600 px lower is the "everything twice" problem the codebase has already fought
  once. The header becomes a constant.
- **Join the label and the count into one left-aligned unit** — `13 LEFT`, grey, always.
  Splitting one fact across 342 px is the weakest piece of typography on the screen.
- **Keep the accent rule under the header** when the tray is live. That is not a second
  sentence; it is part of "this surface is lit".

### The tray
- **Make its lift real.** From ~2 % to a visible change: elevation, full brightness, and
  the accent hairline. It should be obvious in peripheral vision that the bottom of the
  screen has just become the place to act.
- **Spend the surplus phone height here.** On a 430 px phone there are 206 px going
  spare and the board is width-bound and cannot use them. The pool is where a player
  must read four attributes off a 47 px glyph to plan a move — it is the smallest
  rendering of the pieces in the product and the one that most needs to be bigger.
  Raising the slots to ~56 × 66 px costs nothing anyone will miss.
- **Guarantee 48 px on both axes at 360 px width.** Currently 43 × 51 px — under the
  minimum on the narrow axis, on the most common small phone.
- **Keep** the spent-slot well, the edge-to-edge bleed, the eight-column grid on phones,
  and the near-full contrast on waiting pieces. Tone is one of the four attributes; the
  pieces must not go grey when it is not your moment to choose.

### Removed by this proposal
The accent status dot · the `REMAINING` ⇄ `CHOOSE ONE` label swap · Undo's presence in
the game area · the empty pocket. **Four elements out, none in.**

---

## 7. State-by-state specification

Phone, 390 × 844. "Lit" = elevation + full brightness + accent hairline.
"Receded" = flat, no cast shadow, ~12 % darker.

### Waiting for the opponent (their turn to place)
- **Line 1** `Player 2` — or `Computer is thinking ⁞⁞` with the settling bars.
- **Line 2** empty. Nothing is yours; the slot stays reserved and silent.
- **Pocket** present, holding their piece, clearly dimmed — this piece is not yours.
- **Board** receded, fully readable, no target dots. **Tray** receded.
- **Accent on screen** none. This is the only state with no accent anywhere, and that
  absence is itself the signal.
- **Attention** the board, to read the position — which is exactly what there is to do.

### Your turn — place the given piece
- **Line 1** `Your turn` (vs computer) / `Player 2` (local).
- **Line 2** `Place this piece`, accent.
- **Pocket** lit, holding the piece at full contrast.
- **Board** lit; every empty socket carries a 7 px dot at 50 %. **Tray** receded.
- **Attention** pocket → sentence → board, left to right and top to bottom, in the order
  the turn happens.
- **Touch** press a cell → accent ring on the socket, ghost piece at 40 %.

### Immediately after placement (≈350 ms)
- The piece drops into the socket with the existing bounce. The socket takes the
  last-placed rim.
- Target dots fade out across the board on the existing 22 ms-per-cell stagger.
- **On the same beat:** line 2 cross-fades in place to `Choose a piece for Player 1`;
  the board recedes; the tray lifts; the pocket collapses.
- No element moves horizontally except the pocket's own collapse. The board never moves.

### Your turn — choose a piece for the opponent
- **Line 1** `Your turn` / `Player 2`. **Line 2** `Choose a piece for Player 1`, accent.
- **Pocket** absent. **Board** receded, no dots. **Tray** lit, accent rule under `13 LEFT`.
- **Attention** falls to the bottom third — under the thumb, where the action is.
- **Touch** press a slot → face lightens, piece lifts 5 %.

### A piece is selected
- The chosen piece flies from its slot to the pocket on the existing 450 ms arc; its
  slot becomes a spent well.
- The pocket opens to receive it. Line 2 clears. Tray recedes; board stays receded.
- Then the state becomes *waiting for the opponent* above.
- **Pointer only:** hovering a slot previews the piece on the shelf at 72 %; if it hands
  the opponent a win and coaching is on, the danger colour takes the rule and
  *"Wins for your opponent"* appears. Touch has no hover and goes straight to the
  confirm dialog — correct, and unchanged.

### Opponent's turn
Identical to *waiting for the opponent*. Against the computer, the settling bars run in
line 1 and never the accent dot — "thinking" and "your move" must never share a mark.

### Game won / Quarto
- **Line 1** becomes the result headline at display size (`Player 2` `wins`) — this
  already works well.
- **Line 2** hides; nothing follows a finished game.
- **Board** lit and stands up to be looked at: the winning stroke draws through the four
  cells, the four pieces lift on a 95 ms stagger, every other piece dims to 38 %.
- **Pocket** absent; the band gives its column back.
- **Tray** replaced by the result panel — why it happened, the tally, what to do next.
- **Accent** on the winning line only. Everything else on the screen releases it.
- **Draw:** all sixteen pieces settle once, together — the opposite gesture to the win's
  stagger. Already right.

---

## 8. Visual hierarchy

Ranked per state. Primary should be found in well under a second, without reading.

| State | Primary | Secondary | Tertiary |
|---|---|---|---|
| Place | The lit board, and the piece in the pocket | Line 2, `Place this piece` | Line 1 · the receded tray · `13 LEFT` · top bar |
| Choose | The lit tray | Line 2, `Choose a piece for Player 1` | The receded board as a record · line 1 · top bar |
| Waiting | The board, as a position to read | Line 1, who is acting | The dimmed pocket · the receded tray · top bar |
| Won | The winning line on the lit board | The result headline | The tally and the actions · the dimmed rest of the board |

Two rules hold across all four. **The top bar is always tertiary** — the wordmark is
25 px serif and the largest text on screen while a game is running, which is one size
too loud; it should sit closer to the mode label in weight. And **the receded surface is
never invisible** — the position must stay readable during the choose half, because
reading it is exactly what a player is doing while they decide.

---

## 9. Microinteraction recommendations

Only the ones that carry meaning.

**Keep, unchanged**

- **The pass flight** (450 ms, 36 px arc). The best explanation of the split turn in the
  product, and better than any sentence. Untouchable.
- **The piece drop** (350 ms with a settle). Physical, and confirms the tap landed.
- **The target stagger** (22 ms per cell across the board). Turns "the board is yours
  now" into something watched rather than read.
- **The win sequence** — stroke, staggered lift, dim.
- **The refuse shake.** It stays as the answer to a wrong-surface tap; it should simply
  become rare.

**Add — three, all tied to a real event**

- **The phase swap** (200 ms, `--dur-phase`). Line 2 cross-fades in place while the
  board recedes and the tray lifts. One beat, three elements, no movement. This is the
  moment the brief identifies as the weak link, and it is the only genuinely new
  animation the proposal needs.
- **The pocket opening and closing** (200 ms, width and opacity). "A piece is in play" /
  "no piece is in play", stated by the presence of the container rather than by its
  contents.
- **A pocket→board hint on the first game only.** When a piece first arrives in the
  pocket for a player to place, a single 400 ms lift-and-settle on the pocket. Once per
  install, not per turn.

**Do not add**

- Anything on the tray during the place half. It is deliberately the quiet surface.
- Per-piece flags for dangerous pieces. Half the pool can be dangerous at once; eight
  small badges are the noisiest thing the interface could contain. The existing answer —
  a word on the shelf when you point, a confirm when you commit — is right.
- Any motion the meaning depends on. Every animation here decorates a state change that
  is already fully expressed in colour, elevation and text.

---

## 10. Prioritised improvement plan

### High impact — should change

1. **Fill line 2 every turn.** `Place this piece` / `Choose a piece for {opponent}`, in
   accent, in the already-reserved slot. Fixes turn clarity and first-run rule
   comprehension in one change, using space that already exists.
2. **Abolish the empty pocket.** It is on screen for half of every game, occupies the
   first position the eye reaches, and reads as a bug.
3. **Make the lit/receded distinction perceptible** — board and tray, from ~4 % and ~2 %
   to a change a player sees without looking for it. The mechanism is already built; only
   the magnitude is wrong.
4. **Move Undo to the top bar** and remove the accent status dot. Together these empty
   the band for the one statement it should be making.

### Worth refining

5. **Join the pool header into one left-aligned unit** (`13 LEFT`) and stop swapping the
   label.
6. **Grow the target dots** to ~7 px / 50 %.
7. **Spend the surplus phone height on the tray**, not the board — slots to ~56 × 66 px,
   with a 48 px floor on both axes at 360 px width.
8. **Asymmetric vertical rhythm:** more air above the board than below it.
9. **Move the last-placed rim off the accent family** so "this happened" and "act here"
   cannot be read for one another.

### Optional polish

10. The pocket open/close transition.
11. The first-game pocket lift, once per install.
12. Bring the running wordmark down in weight so the top bar reads as tertiary.
13. Reconsider the phone's `--chrome-h: 400px` budget now that the band carries two lines.

---

## 11. Final reflection

**What could still confuse a first-time player?** The sentence explains *the handover* —
that the piece you pick is for the other player — which is the rule people actually get
wrong. It does not explain *why the four attributes matter*, and it should not try: that
is a rule you read once, and the rules sheet already teaches it with a single well-chosen
picture. The honest remaining gap is that a first-timer will not know what a Quarto looks
like until they see one. The coaching layer already answers that at the moment it becomes
relevant, which is the right moment.

**Are we over-explaining?** In the place half, arguably yes — with a piece sitting in a
lit pocket beside a lit board, "Place this piece" tells a returning player nothing. The
tempting fix is to show line 2 only in the choose half. That would be wrong. A slot that
always answers the same question is worth more than the four words it saves, and an
intermittent instruction is a worse thing than a redundant one: it makes the player check
whether the line is there before they can trust that it isn't.

**Are we adding unnecessary UI?** No — the proposal is net negative. Out: the accent
status dot, the pool-header label swap, Undo's presence in the game area, the empty
pocket. In: nothing. Line 2 already exists and is already reserved; it is currently used
for 700 ms per mistake.

**Can anything else be removed?** Two candidates were considered and kept. The pool count
survives because it is genuinely useful late in a game. The `13 LEFT` header rule survives
because it is the tray's lit state rather than a label. One further removal is worth
testing: on a phone, the mode label in the top bar (`Vs computer · Easy`) is read once per
session and never again.

**Does the same visual language really work through the whole loop?** It is worth being
honest about the one place it strains. In *waiting for the opponent* there is no lit
surface and no sentence — the law produces silence. That is defensible, and arguably
correct, but it means the model's clarity comes from the *presence* of accent, so states
with no accent are defined by absence. The mitigation is that these states always have a
dimmed pocket holding the opponent's piece, which is a positive signal of its own. It
should be watched in testing: if "nothing is lit" reads as "the app is stuck", the answer
is to make the dimmed pocket more explicitly *theirs*, not to invent a fifth accent.

**Does the physical board stay the star?** More than today. The board is currently
constant, and constants recede into the wallpaper. Under this model it is the one element
that visibly picks up and sets down twice per turn — it becomes the thing that moves in
the composition. Everything added is type in an existing slot; everything removed was
competing with the board for the same attention.

---

## The recommended concept, in one paragraph

**One sentence, one lit surface.** Under the top bar, a two-line statement: who is
acting, and — in the only accent text on the screen — what they must do, named in full
every turn, including who the piece is for. Beside it, the pocket, which exists when and
only when a piece is in play. Below, the board and the tray, of which exactly one is lit
at a time: it takes elevation, full brightness and an accent hairline while the other
sits flat and quiet, still perfectly readable. When a half-turn completes, the sentence,
the light and the pocket all change on the same 200 ms beat, and nothing moves. The
accent means one thing everywhere: *act on this now*. Four elements leave the screen and
none arrive, the board becomes the only object that visibly rises and settles, and the
question "what do I do now?" is answered twice — once in words for the first game, and
once in light for every game after it.
