# Quarto

A web implementation of Quarto, the abstract strategy game where you never
choose your own piece — your opponent hands you one, you place it, and then you
choose theirs.

Installable on Android and playable offline. Pushing to `main` deploys it.

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

No backend, no analytics, no network calls — fonts are bundled. Preferences
live in `localStorage`.

There is also a browser suite covering undo, keyboard play, the draw, the
restart prompt, persistence, horizontal overflow at seven widths, and a full
game against Hard while watching for main-thread stalls. Playwright
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
  engine.ts        turn state machine (place → choose → hand over)
  ai/position.ts   fast mutable board with incremental line state
  ai/search.ts     negamax + alpha-beta, transposition table, iterative deepening
  ai/index.ts      the three difficulties
  ai/worker.ts     runs the search off the main thread
src/ui/            presentation only
src/lib/           preferences, sound, animation, install and update handling
scripts/           icon generation, service worker build, verification
```

The service worker is generated at build time by `scripts/build-sw.mjs` from
`scripts/sw-template.js`, with the real file list and a version derived from
their contents — so an unchanged build produces an identical worker (no
pointless update prompts) and any change at all produces a different one (no
stale installs). Its paths are relative to its own URL, so it works under any
base without one being compiled in.

### Win detection

A piece is an integer 0–15, one bit per attribute. Four pieces share an
attribute when `p0 & p1 & p2 & p3` is non-zero (all have it) or when
`~p0 & ~p1 & ~p2 & ~p3` is non-zero (none do). Each of the ten lines keeps a
running AND of both, so checking a placement is a handful of bitwise operations.

### The computer

Depth counts whole turns — place a piece, then hand one over — searched with
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
