# Quarto — UI/UX review and improvement proposal

Review only. No application code was changed.

Conducted against the production build of `main`, driven in Chromium at twelve
viewports across the setup, first-turn, place, choose, thinking, mid-game, win,
restart-confirm and rules states. Layout figures in section E are measured, not
estimated.

---

## A. Overall assessment

The level of polish is high — comfortably top decile for a web board game, and
conspicuously *not* the generic AI-frontend look. No stray cards, no arbitrary
gradients, no oversized headings, no decorative pills. Almost everything on
screen is doing a job. The problems are concentrated in specific states rather
than spread across the product, which is the good kind of problem to have.

### Preserve — do not touch

- **The sixteen piece glyphs.** One coordinate system, shared baseline and
  footprint, all four attributes expressed as real geometry — height, material
  gradient, cross-section, a bored-out well rather than a printed ring. All four
  remain readable down to 42 px pool slots. The best thing in the product.
- **The board slab.** Milled edge, sunk sockets, static grain overlay, contact
  shadows. It reads as an object rather than a grid.
- **The place-phase affordance.** Target dot on every legal cell, growing on
  hover, with an accent inset ring on the socket. Tactile and unambiguous.
- **The status grammar.** Actor / action / what happens next, in one line that
  never changes height between phases. The correct answer to Quarto's split turn,
  and well written.
- **Token discipline.** One radius scale, exactly two control heights, a single
  accent reserved for "it is your move on this thing", named easings and
  durations. A real system, not decoration.
- **Keyboard play.** Roving tabindex on both grids, focus handed onward after
  each half-move, six tab stops in total during a game.
- **The PWA layer.** Content-revisioned precache entries; a new worker refuses to
  activate under a game in progress.
- **Sound.** Synthesised, quiet, sits under the interaction.

### Holding it back

- Hierarchy is inverted for half of every turn.
- The empty hand tray reads as a rendering fault.
- The app knows more than it says: `liveThreats`, `isHotPiece`,
  `winningCellsFor` are implemented, tested, and never called by the UI.
- Games are not saved; a reload or an app switch loses the position.
- Three layout cracks: landscape phone, a desktop height band, tablets.
- Settings have no home.
- Nothing marks the last move.

### The biggest opportunity

Quarto has two completely different actions in one turn, and the interface
distinguishes them mainly by re-colouring a 10.5 px eyebrow and swapping one
hairline from grey to terracotta.

**Make the composition change shape between the two phases.** The live surface
gains weight and the inert one recedes. One change resolves the hierarchy
problem, absorbs the empty-tray problem, and removes most of the "what am I
supposed to do now" hesitation — without adding a word of explanatory copy.

---

## B. Top UX issues

### 01 — The board dominates while it is inert · **Critical**

**Where** Every `select` phase — half of every turn — at all viewport sizes.
Worst on desktop and tablet.

**Why it matters** On a 1440×900 desktop the board occupies ~55% of the
composition and is the only dark mass on a light page. The pool — where the
decision happens — is a pale grid about one-sixth the visual weight in the right
rail. During the choose phase the board is not merely secondary, it is completely
unusable: every cell is disabled. The only cues that the pool is live are the
word `REMAINING` turning terracotta at 10.5 px, a 1 px rule changing colour, and
slot backgrounds shifting `#f2ece1` → `#f8f3e9` — invisible at arm's length.

**Fix** Give the two phases genuinely different compositions:
- While choosing: recede the board (drop elevation, desaturate, reduce shadow
  spread) and bring the pool forward (real elevation, larger slots, full-contrast
  pieces, visible hover lift).
- While placing: reverse it.
- Move the live-state signal off the eyebrow onto the surface itself — weight,
  elevation and scale, not a colour swap on 10.5 px type.

### 02 — The empty hand tray reads as a rendering fault · **Critical**

**Where** `HandTray` whenever `piece === null`, on every layout. Worst on tablet
and landscape phone.

**Why it matters** The shelf holds its size so the board and pool never shift —
right instinct. But what fills the reserved space is a label, ~110 px of nothing,
a small dashed ellipse and a hairline; on stacked layouts the label and ellipse
are not even in the same column. It is the second thing the eye reaches after the
board, on screen for half the game, communicating nothing. On landscape phone it
stretches a label, an ellipse and a rule across 1,100 px of empty width.

**Fix**, in preference order:
- **Best:** reuse the shelf as a live preview — hovering or focusing a pool piece
  renders it on the shelf at full size with its four attributes spelled out. The
  reserved space becomes the most useful element on screen and teaches the
  attribute vocabulary exactly when it is needed.
- **Simpler:** replace the void with one aligned block — a muted piece outline
  plus "Pick one below for Player 2".
- **Minimum:** collapse the shelf to its label height and reserve the space at
  stage level, so nothing empty is drawn.

### 03 — Threat information is computed, tested, and thrown away · **High**

**Where** `src/game/board.ts` — `winningCellsFor`, `isHotPiece`, `liveThreats`.
All exported, all unit-tested, zero UI call sites. The comment on `liveThreats`
even reads "used by the UI to explain risk" — it isn't.

**Why it matters** What makes Quarto hard for a newcomer is losing by handing
over a piece without noticing it completes a line. The engine already knows when
that is true. Beginners lose repeatedly without learning why, and the win
screen's otherwise excellent "Four **tall** and **solid** pieces in a line"
arrives too late to be instructive.

**Fix** An optional **Coaching** setting (default on for the first few games, off
thereafter; never on Hard):
- *Place phase:* mark cells where the held piece completes a Quarto — a second,
  brighter target treatment.
- *Choose phase:* mark pool pieces that would let the opponent win immediately
  (`isHotPiece`), and confirm on tap: "This lets Player 1 win. Hand it over?"
- *Ambient:* when `liveThreats` is non-empty, a faint marker on the threatened
  line's remaining cell.

Keep it a setting — the training wheels must come off.

### 04 — An in-progress game does not survive a reload or app switch · **High**

**Where** `App.tsx` — `history` is `useState`. Only `prefs` is persisted.

**Why it matters** Verified: start a game, place a piece, reload — back to the
start screen, position gone, no acknowledgement. A browser inconvenience but an
*installed-app defect*: Android routinely evicts backgrounded PWAs, so taking a
phone call mid-game destroys it. It also undercuts the update logic, which goes
to real trouble to avoid swapping the bundle under a game that any other
interruption discards anyway.

**Fix** Persist the game the way preferences are persisted — the state is tiny.
Write to `localStorage` on every ply under a versioned key alongside the session.
On launch, if a live game is stored, the start screen leads with **Resume game**
and demotes the setup fields. Clear the record on a finished game.

### 05 — Landscape phone clips pieces at both edges · **High**

**Where** `(max-height: 560px) and (min-width: 620px)`. Measured at 844×390 and
740×360.

**Why it matters** Two clips at once. The pool's two rows are squeezed by
`minmax(0, 1fr)` until the slot is shorter than the glyph, so the top row's tall
pieces are sliced by the pool's own `overflow: hidden`; simultaneously the bottom
row overflows the viewport by 8–12 px and the stage clips it. Beyond the
clipping this is the weakest composition in the product: the board is squeezed to
222 px with 47 px cells while a great deal of width sits unused.

**Fix**
- Size the pool from available height and let the slot set the piece size; cap
  the glyph to the slot's inner box.
- Reduce reserved chrome so the last row lands inside the viewport — the current
  `--chrome-h: 168px` under-counts by ~12 px.
- Recompose landscape as three columns: board, hand, pool.

### 06 — A desktop-height band clips the pool and breaks the no-scroll promise · **High**

**Where** Widths above ~1000 px with heights ~561–640 px — the gap between the
landscape breakpoint (`max-height: 560px`) and where the desktop rail genuinely
fits.

**Why it matters** Measured at 1280×600: the pool's fourth row extends 34 px past
the viewport and the stage reports 52 px of overflow it then clips. At 1280×580
it is 54 px. Four pieces half-visible, no scrollbar. This is a browser window
that is not maximised, or a 1366×768 laptop with a toolbar. The layout sizes the
board from the viewport but assumes the board is the tallest column; when height
is short the rail is taller and nothing accounts for it.

**Fix** Constrain the stage by the taller column. Let the desktop pool fall to
8×2 once the rail cannot fit 4×4. Add the 561–640 px band to the suite that
asserts the whole pool is visible — it tests seven widths but not this height
range.

### 07 — Clicking the inert surface does nothing at all · **Medium**

**Where** Pool slots during the place phase; board cells during the choose phase.
Verified: `cursor: default`, `opacity: 1`, no handler, no sound, no movement.

**Why it matters** The likeliest first-timer error is acting on the wrong surface.
The app's response is total silence, which reads as "broken" rather than "not
this half of the turn".

**Fix** Answer the wrong action by pointing at the right one — a short pulse on
the live surface's rule or a 120 ms shake of the held piece, plus a transient
status line for the first two or three occurrences only. No dialog, no sound.

### 08 — Tablets get a phone layout with a third of the screen unused · **Medium**

**Where** `(max-width: 900px) and (min-height: 561px)` forces `--frame: 520px`.
Measured at 834×1112 and 744×1133.

**Why it matters** On an 834 px iPad the composition is capped at 520 px, leaving
~150 px empty each side while the layout stacks and opens 80–90 px holes above
and below the board. A portrait tablet has room for the desktop arrangement
(560 + 24 + 232 ≈ 816 px).

**Fix** Add a portrait-tablet case (~`min-width: 700px` with sufficient height)
using the two-column arrangement with a narrower rail — or keep the stack, let
the frame grow, and spend the extra height on the board.

### 09 — Settings hidden inside "How to play", behind a keyboard table shown on phones · **Medium**

**Where** `RulesSheet.tsx`.

**Why it matters** Three problems in one dialog. Settings have no discoverable
home. Sound has two controls in two visual languages with no relationship. On a
phone the keyboard table occupies ~a third of the sheet while being inapplicable.
Close also scrolls out of view — the header is not sticky.

**Fix** Split into **How to play** and **Settings**, reachable from the top bar
and the start screen. Hide the keyboard section behind
`@media (hover: hover) and (pointer: fine)`. Make `.sheet__head` sticky. Decide
which sound control is canonical; if both stay, make them look related.

### 10 — Nothing marks the last move once its animation ends · **Medium**

**Where** `Board.tsx` — `lastPlaced` drives only the `piece-drop` keyframes.

**Why it matters** After the 350 ms drop the board carries no record of what
happened. Against the computer — where the move lands while you are looking at
the pool, after a 420 ms pause — "where did it go?" is routine. In pass-and-play
the arriving player cannot see the position they inherited.

**Fix** A persistent quiet marker on the last-placed socket, in the existing warm
highlight rather than the accent, cleared when the next piece lands.

### 11 — Disabling the inert grid removes it from the accessibility tree · **Medium**

**Where** `Board.tsx` (`disabled={!targetable}`) and `Pool.tsx`
(`disabled={!enabled}`).

**Why it matters** During the choose phase all sixteen cells are `disabled`;
during the place phase all sixteen slots are. Native `disabled` makes a control
non-focusable and, in several screen readers, effectively unreadable — so a
screen-reader user cannot review the board while deciding what to hand over,
which is exactly when they need to. Sighted players have no equivalent problem.
For keyboard users the current behaviour is a feature; the fix should keep it.

**Fix** Swap `disabled` for `aria-disabled="true"` plus a guarded handler, keep
`tabIndex={-1}` on the inert grid, and make the grid container reachable so
assistive tech can read the position on demand. Also add an `<h1>` — once setup
closes the document has no headings at all.

### 12 — "New game" is the loudest control on every screen, and appears twice at the end · **Low**

**Where** Top bar at all sizes; plus `ResultPanel`.

**Why it matters** The only bordered button in the top bar, so it out-weights the
wordmark and every gameplay element — on a phone it is the most prominent thing
on screen, while being the least-used and only mildly destructive control. On the
result screen two "New game" buttons are visible at once, and the confirm dialog
answers a click on "New game" with a button also labelled "New game".

**Fix** Demote the top-bar control to `btn--quiet`; the confirm already protects
against accidents. Hide it on the result screen. Relabel the confirm's
affirmative to "Discard and start over".

---

## C. Screen and flow review

### Launch, setup and first run

The most resolved part of the product. The segmented control — a hairline frame
divided into cells, no pills — is exactly right for this design language.

- **The primer's piece row is decoration.** Four unlabelled pieces on a rule. The
  Rules sheet contains the best teaching device in the app — four *different*
  pieces in board sockets captioned "All four are hollow — that is a Quarto".
  Move that to the start screen; delete the decorative row.
- **"Chooses first" is the most confusing label in the app.** Selecting "You"
  means the *computer* makes the first placement, because the opener hands over
  rather than plays. Rename to "Hands over the first piece", or put the
  consequence in the opening turn's status line.
- **Setup returns on every launch.** With issue 04, a returning player's path is:
  land on setup they have already answered, press Begin, get a fresh board.
- **The screen scrolls on a 360×640 phone** — Begin at or below the fold on first
  run. Three progressively tighter height breakpoints already do heroic work; the
  real relief is a shorter primer.
- **Difficulty is unexplained.** One line per option — "never looks ahead",
  "looks two turns ahead", "searches until its time runs out". The README already
  has the wording.

### First turn and the split-turn transition

The hardest moment and the least supported: an empty board, an empty tray
labelled for the *other* player, a full pool. The status line does the whole job
alone — well written, but text carrying a burden the interface should share.

The transition itself is handled well and should be preserved: the clone flies
along an arc from pool slot to shelf, the shelf's rule lights, the attributes
appear, target dots bloom. That sequence is the clearest explanation of the split
turn anywhere in the app — just too fast and too small to land the first time.
Consider slowing the first pass of a first game, and staggering the target dots.

### Active gameplay

- The **place** phase is in good shape. Little to change beyond a ghost preview
  of the held piece under the cursor.
- The **choose** phase is where the work is — issues 01, 02, 03.
- **Eye travel is long on desktop.** The piece to place is top-right; the board is
  left. Consider moving the hand shelf beside or above the board on wide screens,
  leaving the rail to the pool alone.
- **Spent pool slots are almost invisible.** Which pieces are gone is strategic
  information; an empty slot should read as clearly empty.
- **Two meanings for one dot.** A 6 px accent dot before the actor means "your
  turn"; a 5 px pulsing accent dot after the action means "computer thinking".
  Same colour, same shape, opposite sides, unrelated meanings.

### Undo, restart and rematch

- **Undo is per half-move and unlabelled.** Verified: one press after placing
  returns the piece to your hand; a second returns it to the pool. Right model,
  but "Undo" never says which. Label it with its effect.
- **Undo stays enabled after the game ends**, beside "Player 1 wins" and Rematch.
  It works — it rewinds into a live game — but nothing says so.
- **The restart confirm repeats its own trigger's label** and makes "Keep
  playing" visually primary. Emphasising cancel is defensible; the duplicated
  label is not.
- **Rematch is good.** Preserve it. A running tally ("2–1 to you") is the
  cheapest way to make a series feel like a series.

### Win, draw and result

The win reveal is the most confident moment in the product — accent socket rings,
staggered piece lift, a drawn stroke, dimmed losers. No confetti, no modal. Keep
all of it.

- **The composition collapses around it.** The result panel occupies ~130 px of a
  780 px column; on a phone a 280 px void opens above the headline. The win state
  deserves its own arrangement, not the gameplay one with things removed.
- **The headline is under-scaled** — 30 px top-left, smaller than the empty board
  below it. The one place the display face should be large.
- **The win stroke is nearly invisible** at 0.62 units, behind the pieces, low in
  the cell. Either commit to it or drop it and let the rings and lift carry it.
- **The draw is under-served.** A lovely line, but the board just stops.

### Rules, settings and onboarding

Structure: issue 09. On content, the writing is excellent and should be kept
nearly verbatim. Two notes: the axis names (Height / Tone / Shape / Top) appear
only here, and "Top" for solid/hollow is obscure — the paired glyphs carry the
meaning without them. And the demo panel uses a different wood treatment from the
real board, so the app contains two versions of its own signature object.

### Install, offline and update

Well handled and largely invisible, which is correct.

- No acknowledgement that the game *works* offline. One line on the start screen
  costs nothing.
- The service worker's cold-offline fallback is a bare `text/plain` 503 — nearly
  unreachable, but the only ugly surface in the product.
- "Update ready" doesn't say what pressing it does. "Restart to update" does.

---

## D. Visual system review

**Do not restyle this app.** The warm-paper ground, the single dark slab, the one
terracotta accent reserved for "your move", the Instrument Serif / Inter pairing
and the tight radius scale add up to a real identity specific to Quarto.
Everything below tightens what exists.

### Typography

Two families used with discipline; the division is sound. The sans scale has
drifted into fractional one-offs: 10, 10.5, 11.5, 12, 12.5, 13, 13.5, 14, 14.5,
15, 15.5, 16, 17, 25, 27, 30 px, several appearing once.

- Collapse to ~seven steps (11 / 12.5 / 13 / 15 / 17 / 21 / 30) as tokens.
- **The eyebrow is too small for its job.** At 10.5 px / 0.16em it carries primary
  state labels. State labels should be ≥12 px and should stop carrying the
  live/inert distinction on their own.
- Bind three line heights — tight for headings, 1.45 UI, 1.6 prose.

### Spacing and layout

- No spacing scale exists; values are literal at each site (7, 9, 10, 11, 13, 14,
  16, 17, 18, 21, 22, 24, 26 px). A 4 px scale as tokens is the highest-leverage
  consistency change in the codebase, because it is what makes the odd gaps
  possible.
- **The stage floats.** At 1440×900: 106 px dead above the status line, 160 px
  below the pool — ~30% of the viewport unused while the board is capped at
  560 px.
- **The tray-to-board gap** measures 72 px (Pixel), 80 px (iPad), 91 px (iPad
  mini). Spend it on the board.
- The mobile and landscape breakpoints duplicate an identical 40-line tray block
  verbatim.

### Controls and states

- Button variants are well defined and consistently applied. Keep.
- **Focus rings have three treatments** and two colours. Use `--accent`
  everywhere; vary only the offset.
- **Disabled has two languages** — 0.45 opacity for buttons, 0.86 for pool pieces.
  Deliberate, but define it once: unavailable-because-inert and
  unavailable-because-spent are different states.
- **Two dialog anatomies.** Unify on one, with an optional close. `Modal` takes a
  `title` prop for its `aria-label` while the children repeat the same string as
  an `<h2>` — one source of truth.
- The settings switch is the only accent-filled control. Fine as the single
  exception, but make it a decision.

### Surfaces, board and pieces

- Elevation is expressive and correct. Keep the four-step shadow scale.
- **The pool has no material identity** — a hairline lattice on the page, while
  the board is a milled slab. If the board is a table object, the pool should be a
  tray or a cloth, which also gives the choose phase something to bring forward.
- Two wood treatments exist for the same object. Extract one.
- At the smallest slots (42×50 px) short-versus-tall is the least readable
  attribute, because both pieces are bottom-aligned in a short box. A shared
  baseline rule under the slot would restore the comparison.

### Colour

- The palette is disciplined and "one accent, one meaning" is real. Coaching
  (issue 03) needs a *second* semantic colour for danger that is not the "your
  move" terracotta.
- Text contrast is fine throughout — lightest UI text measures 5.3:1.
- **No dark theme exists.** For a phone game played in the evening this is a real
  gap, and the identity survives it easily.

### Motion

The most tastefully judged part of the visual system. Nothing decorative, nothing
excessive, and both the OS preference and an in-app switch collapse everything to
1 ms.

- The one gap: *phase change* has no motion of its own. The transition that most
  needs explaining is the only one that happens instantly.
- The pass animation hides the destination behind `visibility: hidden` while a
  clone flies; an interrupted flight can leave the shelf briefly blank.

---

## E. Mobile and PWA review

The core mobile promise — nothing scrolls, board and whole pool on one screen,
turn state always visible — is genuinely delivered on phone portrait, and that is
harder than it sounds. Portrait phones are the best-served size. Landscape and
tablet are not.

All values in CSS pixels, measured in the two-player place phase on the
production build. Negative "past viewport" means clearance.

| Viewport | Board | Slot | Tray→board gap | Pool past viewport | Verdict |
|---|---|---|---|---|---|
| 1440 × 900 | 560 | 73×73 | — | −161 | fits, floats |
| 1280 × 800 | 560 | 73×73 | — | −116 | fits |
| 1280 × 640 | 430 | 73×73 | — | −3 | marginal |
| 1280 × 600 | 390 | 73×73 | — | **+34** | **pool clipped** |
| 1280 × 580 | 370 | 73×73 | — | **+54** | **pool clipped** |
| 834 × 1112 tablet | 520 | 64×76 | 80 | −17 | ≈300 px unused width |
| 744 × 1133 tablet | 520 | 64×76 | 91 | −17 | ≈200 px unused width |
| 412 × 915 phone | 380 | 49×58 | 72 | −17 | good |
| 375 × 667 phone | 299 | 44×52 | −1 | −17 | tight, fits |
| 360 × 780 phone | 328 | 42×50 | 42 | −17 | slot under 44 px |
| 360 × 640 phone | 272 | 42×50 | 1 | −17 | setup scrolls |
| 844 × 390 landscape | 222 | 67×80 | — | **+8** | **clipped both edges** |
| 740 × 360 landscape | 192 | 59×70 | — | **+12** | **clipped both edges** |

### Phone portrait

Stack order is right: status, piece in hand, board, pool at the bottom within
thumb reach. Nobody scrolls back and forth during a turn. The pool bleeding to the
screen edges to buy slot width is a good call, and the compact side-by-side tray
is better than the desktop stacked version.

- **Reclaim the 42–72 px hole above the board** — roughly a 15% larger board on a
  Pixel, for free.
- **Pool slots fall below the 44 px minimum on 360 px devices** (42 px).
- **The top bar spends ~135 px of a 915 px screen** on a wordmark and three
  rarely-used controls, the loudest being the destructive one.

### Landscape — the weakest state

See issue 05. Beyond the clipping, the arrangement wastes its best resource: it
has plenty of width and spends it on a stretched tray row and a squeezed board.
Three columns — board, hand, pool — would use the shape of the screen. Since
landscape is most often entered by accident, the rotation transition should also
reassure the player that the game survived.

### Installed-app experience

- **Manifest is correct and complete** — standalone, maskable icons with a
  properly respected safe zone, matching theme and background colours.
- **Safe-area insets are handled everywhere.** Frequently missed; right here.
- **The app icon is on-brand but weak at launcher size.** A 2×2 board crop reads
  as a brown square at 48 px, and the light hollow cylinder is ambiguous. Consider
  a simpler high-contrast mark.
- **The one genuinely non-native behaviour is state loss** (issue 04). Highest-
  value PWA fix by a distance.
- **`orientation: "any"` is honest but currently expensive.** Fix landscape rather
  than locking — locking would be wrong for tablets.
- Consider a manifest shortcut for "New game vs computer".

---

## F. Quick wins

Low effort, low risk, immediately noticeable. Roughly a day in total.

| # | Change | Where |
|---|---|---|
| 01 | Hide keyboard shortcuts on touch (`@media (hover: hover) and (pointer: fine)`) | RulesSheet.tsx · overlays.css |
| 02 | Make the sheet header sticky so Close stays reachable | overlays.css |
| 03 | Demote top-bar "New game" to `btn--quiet` | App.tsx |
| 04 | Hide top-bar "New game" on the result screen | App.tsx |
| 05 | Relabel: "Discard and start over", "Restart to update" | App.tsx |
| 06 | Give Undo its object; disable or relabel at game over | App.tsx |
| 07 | Close the tray-to-board gap on portrait | rail.css |
| 08 | Clear the 44 px touch-target floor for pool slots at 360 px | rail.css |
| 09 | Unify the focus-ring colour | board.css · base.css |
| 10 | Deepen the spent-slot well | rail.css |
| 11 | Add an `<h1>` to the game screen | App.tsx |
| 12 | Say it plays offline | Setup.tsx |
| 13 | Explain the difficulties | Setup.tsx |
| 14 | Resolve the double meaning of the accent dot | rail.css · App.tsx |

---

## G. Larger improvements

**1 — Two compositions for two phases.** Not a restyle; making the layout express
the state machine that already exists. *Worth it because* it is the only change
that addresses "what am I supposed to do now" structurally rather than with more
words. Every other clarity fix is downstream of it.

**2 — Coaching mode.** The engine work is done; this is UI, a preference, and one
new semantic colour. *Worth it because* Quarto's difficulty is perceptual, not
mechanical. A player who cannot see the line they are about to complete for
someone else loses without learning, and stops playing. Biggest lever on
retention, and nearly free.

**3 — Game persistence and a Resume-first start screen.** *Worth it because* it
converts the product from a web page you play in one sitting into an app you
return to.

**4 — Rebuild the landscape and tablet layouts.** Issues 05, 06 and 08 share a
root cause: everything derives from the board's height budget and nothing accounts
for the rail being the taller column. *Worth it because* it fixes two visibly
broken states and removes the class of bug rather than the instances.

**5 — A settings home, and a start screen that teaches.** *Worth it because* the
app has the right teaching device in the wrong place, and settings that cannot be
found. Both are one move from being right.

**6 — A dark theme.** Optional, and only after the token consolidation in section
D — otherwise it doubles a palette that is not yet centralised. *Worth it because*
a phone game is played in the evening.

### Deliberately not recommended

- **Drag-and-drop for placement.** Tap-to-place is faster, works identically for
  keyboard and touch, and is unambiguous.
- **A restyle of the pieces or the slab.** They are the best assets in the product.
- **A modal win screen.** The in-place reveal is better and more confident.
- **More explanatory copy.** Move meaning into the interaction instead.

---

## H. Recommended target experience

> A wooden set on a table that happens to be behind glass — where the interface
> never has to tell you whose move it is, because the table has already changed.

You open it and your game is where you left it. When it is your turn to place, the
board comes forward and the piece you were handed sits waiting with its four
properties named; the pool has quietly settled back. When you place it, the board
settles and the pool rises to meet you, and you are choosing what to hand over.
Nothing announces the switch — you can see it.

If you are new, the app quietly points at the line you are about to complete and
the piece you are about to give away, and stops doing so once you no longer need
it. If you are not, it never says anything you did not ask for.

Every piece is instantly readable at every size on every screen you turn the phone
to. Nothing scrolls, nothing is clipped, nothing floats in a hole. The board is the
largest thing when the board matters and the pieces are when they do. Winning is
four pieces lifting off a slab, in silence, and then a rematch a thumb's width
away.

---

## I. Proposed implementation plan

### Phase 1 — UX clarity

Make the two halves of the turn unmistakable, and stop the app forgetting the
game. Nothing here is cosmetic.

**1.1 Phase-aware surface treatment.** Define a `live` / `receded` pair of surface
states as tokens (elevation, saturation, scale) and apply them to the board and
pool from `phase`. Board live during `place`, pool live during `select`.
Transition ~200 ms with `--ease-out`, collapsing to 1 ms under reduced motion.
*Acceptance:* from a still screenshot with all text removed, which surface is live
is unambiguous at every viewport in section E.
`App.tsx · Board.tsx · Pool.tsx · board.css · rail.css`

**1.2 Rebuild the hand tray's empty state.** Replace the dashed-ellipse void with
a live preview: hovering or focusing an available pool piece renders it on the
shelf at full size with its four attributes named. With nothing hovered, one
aligned line of intent. Keep the reserved footprint. Applies to all three layouts;
label, shelf and attribute row aligned as one block in each.
`HandTray.tsx · Pool.tsx · App.tsx · rail.css`

**1.3 Persist the game; Resume-first start screen.** Serialise
`{ session, history }` to `localStorage` under a versioned key on every ply,
guarded like `prefs`. On launch, if a live game is stored, lead with **Resume
game** showing mode, difficulty and pieces remaining; demote the setup fields.
Clear on leaving a finished game. *Acceptance:* place a piece, reload, land back
on the same position.
`App.tsx · Setup.tsx · lib/prefs.ts (or a new lib/save.ts)`

**1.4 Feedback for actions on the inert surface.** Swap `disabled` for
`aria-disabled` plus a guarded handler on both grids (also fixes 1.5). On click,
pulse the live surface's rule and, for the first two or three occurrences of a
session only, show a transient status line. No dialog, no sound.
`Board.tsx · Pool.tsx · App.tsx`

**1.5 Keep the inert grid readable to assistive tech.** With `aria-disabled` in
place, keep `tabIndex={-1}` so tab order is unchanged, and make the grid container
reachable so a screen-reader user can review the board while choosing. Add an
`<h1>` to the game screen.
`Board.tsx · Pool.tsx · App.tsx`

**1.6 Persistent last-move marker.** A quiet notch or corner tick on the
`lastPlaced` socket, in the existing warm highlight rather than the accent,
cleared when the next piece lands.
`Board.tsx · board.css`

**1.7 Copy pass.**

| Now | Proposed | Reason |
|---|---|---|
| Chooses first | Hands over the first piece | "Chooses first" reads as "moves first"; the opener does not place |
| PLAYER 2'S PIECE | PLAYER 2 PLACES | No piece belongs to a player — the rules sheet says so |
| FOR PLAYER 2 | CHOOSING FOR PLAYER 2 | Names the action in progress rather than labelling an empty shelf |
| Undo | Undo placement / Undo choice | Undo is per half-move; the label never says which |
| New game (confirm dialog) | Discard and start over | Currently repeats the label of the control that opened it |
| Update ready | Restart to update | States what pressing it does |
| Height / Tone / Shape / Top | *(drop the axis names)* | Used nowhere else; the paired glyphs carry it, and "Top" is obscure |

Terminology to standardise: **choose** for handing a piece over, **place** for
putting one on the board. Both are already consistent in the status line — keep
"select" out of user-facing copy entirely and leave it as the internal phase name.

### Phase 2 — Visual system and hierarchy

Consolidate what exists so the phase treatment from 1.1 has somewhere to live, and
remove the one-off values that let the odd gaps happen.

**2.1** Type and space scales as tokens. Collapse ~16 font sizes to seven steps;
introduce a 4 px spacing scale. Migrate all five stylesheets. No visual change
intended beyond the rounding. `base.css · board.css · rail.css · overlays.css`

**2.2** Raise state labels out of eyebrow size. Separate "eyebrow" (decorative
section label) from "state label" (whose turn, what surface is live); state labels
to ≥12 px, no longer carrying the live/inert distinction. `base.css · rail.css ·
HandTray.tsx`

**2.3** One dialog anatomy. Unify rules and confirm on a single head/body/actions
structure with an optional close; move the title into `Modal`; make the head
sticky. `Modal.tsx · RulesSheet.tsx · App.tsx · overlays.css`

**2.4** Give the pool a material — a tray or cloth the pieces rest on, so bringing
it forward in 1.1 has something to bring. Extract the wood treatment shared by the
board and the rules demo at the same time. `rail.css · board.css · overlays.css`

**2.5** Consistent state treatments. Define disabled once, distinguishing
unavailable-because-inert from unavailable-because-spent. Unify focus-ring colour.
Settle the two meanings of the accent dot. `base.css · board.css · rail.css`

**2.6** Recompose the win and draw states. Result headline at display scale,
reason and actions grouped beneath, no 280 px void above. Decide whether the win
stroke is committed to or dropped. Add a settle across the board for the draw. Add
a rematch tally. `ResultPanel.tsx · App.tsx · rail.css · board.css`

**2.7** Settings home and a teaching start screen. Split the rules sheet; replace
the start screen's decorative piece row with the four-hollow-pieces demonstration
and its caption. `RulesSheet.tsx (split) · Setup.tsx · App.tsx`

### Phase 3 — Responsive and PWA

**3.1** Size the stage from the binding column. Derive the board cap from the
rail's real minimum height as well as `--chrome-h`. Let the desktop pool fall to
8×2 when the rail cannot fit 4×4. *Acceptance:* no clipping or stage overflow in
the 561–640 px height band above 1000 px wide. `base.css · rail.css`

**3.2** Rebuild landscape as three columns — board, hand, pool. Size the pool from
available height; cap the glyph to the slot's inner box. Correct reserved chrome.
*Acceptance:* at 844×390 and 740×360, every piece fully visible, no overflow,
board meaningfully larger than 222 px. `rail.css · base.css`

**3.3** Portrait-tablet layout. A case between the phone and desktop rules using
the two-column arrangement with a narrower rail, or a growing frame that spends
the height on the board. Target 744–900 px wide with ample height. `base.css ·
rail.css`

**3.4** Reclaim phone chrome. Close the tray-to-board gap, clear the 44 px slot
floor at 360 px, reduce the top bar's footprint. `rail.css · base.css · App.tsx`

**3.5** Extend the layout test matrix. Add heights — the 561–640 px band and both
landscape sizes — and assert no piece glyph is clipped by its slot.
`scripts/e2e.mjs`

**3.6** Installed-app finish. Redraw the launcher icon for 48 px legibility.
Replace the plain-text cold-offline response with a minimal styled page. Add a
manifest shortcut for "New game vs computer". State on the start screen that the
game plays offline. `scripts/icon.mjs · scripts/sw-template.js ·
manifest.webmanifest · Setup.tsx`

### Phase 4 — Coaching, motion and polish

**4.1 Coaching mode.** Wire `winningCellsFor`, `isHotPiece` and `liveThreats` to
the UI behind a setting. Winning cells get a distinct brighter target treatment;
pieces that would let the opponent win get a quiet warning treatment and a confirm
on tap; threatened lines get a faint ambient marker. Needs one new semantic colour
for danger that is not the "your move" terracotta. Default on for the first three
games, off thereafter; never available on Hard.
`App.tsx · Board.tsx · Pool.tsx · lib/prefs.ts · board.css · rail.css`

**4.2 A motion beat for the phase change.** Stagger the target dots in; let the
live/receded swap from 1.1 carry a short single gesture. Guard the pass animation
so an interrupted flight can never leave the shelf blank.
`board.css · rail.css · lib/flight.ts`

**4.3 Ghost preview on the board.** Render the held piece at low opacity in the
hovered or focused cell during the place phase. `Board.tsx · board.css`

**4.4 Small-size piece legibility.** Test short-versus-tall at 42×50 px slots; if
it is the weakest attribute at that size, add a shared baseline rule under the
slot. Change glyph geometry only if that is not enough.
`rail.css · PieceGlyph.tsx`

**4.5 Dark theme.** Only after 2.1. A lamplit slab on a dark ground; pieces keep
their bone-and-steel contrast; the accent shifts warmer. Follow the system
preference with an override in Settings.
`base.css · board.css · rail.css · overlays.css · index.html`

**4.6 First-game pacing.** Slow the very first pass of a player's first game so
the fly-across is actually seen. One game only, never under reduced motion.
`App.tsx · lib/flight.ts · lib/prefs.ts`
