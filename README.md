# Quarto

A web implementation of Quarto, the abstract strategy game where you never
choose your own piece — your opponent hands you one, you place it, and then you
choose theirs.

Installable on Android and playable offline. A game in progress is kept, so
closing the tab loses nothing. Pushing to `main` deploys it.

Four pieces in a line that share **any one** of four attributes — tall/short,
dark/light, square/round, hollow/solid — wins, no matter who placed them.

## Deploying

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every
push to `main`.

**Enable Pages once before the first deploy:** Settings → Pages → Source →
**GitHub Actions**. A workflow cannot do this for itself — the default
`GITHUB_TOKEN` is not permitted to create a Pages site — so until it is set,
the Configure Pages step fails with `Get Pages site failed … Not Found`. After
that one click, deployment is an ordinary `git push`.

The stable URL is `https://<username>.github.io/<repository>/`, which is what
to bookmark and what an installed app launches.

Pages serves a project site from a subdirectory, so every asset URL, the
manifest scope and the service worker scope have to carry that prefix. The
workflow reads it from `actions/configure-pages` — correct for a project site
(`/repo/`) and for a user site (`/`) alike — and passes it to the build as
`BASE_PATH`. Renaming the repository needs no code change. The default in
`vite.config.ts` matches this repository so a plain `npm run build` is already
deployable, and the dev server uses the same base on purpose: a service worker
registered at a different scope in development would hide the bugs it exists to
catch.

There is no client-side routing, so nothing needs a redirect or 404 fallback.

## Installing it

The deployed site is a PWA: a manifest, maskable Android icons, and a service
worker that precaches the whole app. After one visit it opens instantly, starts
from the home screen with no browser chrome, and plays offline — including
against the computer, since the AI worker is cached too. When a browser offers
an install prompt, a quiet **Install** appears in the top bar (and on the start
screen on phones). Nothing is ever prompted unasked, and the game is fully
usable without installing.

Long-pressing the installed icon offers **Vs computer** and **Two players**,
which open straight into a new game rather than the start screen. The theme
colour follows the device's light or dark setting, and the stored theme is
applied before first paint so an installed app never opens on the wrong ground.

Updates are the part that usually breaks. Two things make it reliable:

- Files Vite does not content-hash (`index.html`, the manifest, the icons) are
  precached with a `?v=<content hash>` suffix. Pages serves with a `max-age`,
  and without this a new worker will cheerfully precache the *previous* deploy
  straight out of the HTTP cache.
- A new worker never activates under a game in progress. On the start screen it
  applies silently; mid-game it waits behind an **Update ready** control. Since
  every session begins on the start screen, nobody can get stranded on an old
  build either way.

## Running it

```bash
npm install
npm run dev          # development server, at /Quarto/
npm run build        # production build, including the service worker
npm run preview      # serve the production build
npm test             # domain and AI unit tests
npm run verify:build # static checks that dist/ is deployable (runs in CI)
npm run selfplay     # headless tournament across the difficulty ladder
npm run build:icons  # regenerate the app icons from scripts/icon.mjs
```

No backend, no analytics, no network calls — fonts are bundled. Preferences and
the game in progress live in `localStorage`.

There is also a browser suite covering undo, keyboard play, the draw, the
restart prompt, preferences, saving and resuming a game, the home-screen
shortcuts, acting on the surface that is not yours, horizontal overflow at seven
widths, the layout at twelve sizes, and a full game against Hard while watching
for main-thread stalls. Playwright
is deliberately not a dependency, since installing it downloads browser
binaries this game has no other use for:

```bash
npm i -D playwright && npx playwright install chromium
npm run test:e2e
```

## How it is put together

Game logic is kept entirely out of the components.

```
src/game/          the domain — no React anywhere in here
  pieces.ts        the sixteen pieces as four attribute bits
  board.ts         lines, win detection, threat detection
  engine.ts        turn state machine (place, then choose for the opponent)
  ai/position.ts   fast mutable board with incremental line state
  ai/search.ts     negamax + alpha-beta, transposition table, iterative deepening
  ai/index.ts      the three difficulties
  ai/worker.ts     runs the search off the main thread
src/ui/            presentation only
src/lib/           preferences, saving, sound, animation, install and update
scripts/           icon generation, service worker build, verification
```

### Saying whose half of the turn it is

A Quarto turn is two actions on two different surfaces: place the piece you were
handed on the board, then choose one from the pool. Only one of them is live at
a time, and the interface says which without being asked.

The live surface is lifted and the other one settles — a shadow and a shade of
saturation, never a position, because moving the thing a player is reaching for
between the two halves of every turn is worse than the problem it solves. The
board's empty pockets show their targets only while it is the board's half.
Acting on the surface that is not live is answered rather than ignored: it
shrugs, and the status line says which way round the turn is.

The shelf between them is the same size in both halves. While its owner is
choosing it shows whichever pool piece is under the pointer, at full size with
its four attributes spelled out — which is both a preview of the decision and a
picture of the arc the chosen piece is about to fly along.

`src/lib/prefs.ts` also carries a coaching setting, on for the first three games
unless it is turned off, that marks where the piece in hand wins and which
pieces win for the opponent. It reads `winningCellsFor` and `isHotPiece` from
`board.ts`, which the AI already used, and it is never shown against Hard.

The service worker is generated at build time by `scripts/build-sw.mjs` from
`scripts/sw-template.js`, with the real file list and a version derived from
their contents — so an unchanged build produces an identical worker (no
pointless update prompts) and any change at all produces a different one (no
stale installs). Its paths are relative to its own URL, so it works under any
base without one being compiled in.

### Fitting the screen

The game is a composition sized to the viewport, not a document: nothing
scrolls, and the board takes whatever room the rest of it leaves. Whose turn it
is has to stay visible at every moment, which a scrolling page cannot promise.

`--chrome-h` in `base.css` is the height everything other than the board takes
on a given layout — top bar, status, tray, pool. `--board-size` is what is left
after it, capped at 640px, and `--frame` is the width the board and the rail
come to together, which the top bar is held to as well so the page has a single
left and right edge. Three arrangements share those tokens:

- **Board beside a rail.** Desktops and upright tablets. Below about 700px of
  height the rail is the taller column, so its pool falls to eight across.
- **Board over a rail.** Upright phones and small tablets, up to 900px wide —
  wide enough that a tablet's board reaches its cap instead of being held to a
  phone's column. Spare height is spread between the rows rather than pooled
  into one hole above the board, because a phone's board is as wide as the
  screen allows and cannot grow into it.
- **Board, hand and pool in three columns.** Anything turned sideways. The
  status keeps the full width — given a column of its own it wraps to three
  lines and eats the height the board needs — and the hand is a narrow column
  between the two grids, because every pixel it does not take is a wider pool
  slot. The pool keeps the proportion eight-by-two implies, so a wide screen
  leaves air rather than stretching sixteen pieces into letterboxes.

Changing anything above or below the board means re-checking `--chrome-h`. The
end-to-end suite asserts, at twelve sizes spanning both axes, that neither the
page nor the stage scrolls, that the turn state is on screen before and after a
move, that the whole pool is visible, that the board is square, and that no
piece is clipped by the slot it stands in.

### Win detection

A piece is an integer 0–15, one bit per attribute. Four pieces share an
attribute when `p0 & p1 & p2 & p3` is non-zero (all have it) or when
`~p0 & ~p1 & ~p2 & ~p3` is non-zero (none do). Each of the ten lines keeps a
running AND of both, so checking a placement is a handful of bitwise operations.

### The computer

Depth counts whole turns — place a piece, then choose the opponent’s — searched with
negamax and alpha-beta. Two shortcuts do most of the pruning:

- if the piece in hand completes a line anywhere, that is the move;
- handing over a piece the opponent can win with is never better than handing
  over a safe one, so those branches are skipped outright.

`easy` never searches: it takes the win in front of it about two thirds of the
time and dodges the obvious gift about half the time. `medium` looks two turns
ahead. `hard` deepens until its time budget or a forced result stops it, and
runs in a Web Worker so the board keeps responding.

Over 24 games per pairing (`npm run selfplay 24`), hard beat easy 24–0, beat
medium 17–0 with 7 draws, and drew 18 of 24 against itself. Playing a full game
against hard in a browser, the longest gap between animation frames was 33 ms —
the search never touches the main thread.
