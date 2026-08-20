# Quarto

A web implementation of Quarto, the abstract strategy game where you never
choose your own piece — your opponent hands you one, you place it, and then you
choose theirs.

Four pieces in a line that share **any one** of four attributes — tall/short,
dark/light, square/round, hollow/solid — wins, no matter who placed them.

## Running it

```bash
npm install
npm run dev        # development server
npm run build      # production build
npm test           # domain and AI unit tests
npm run selfplay   # headless tournament across the difficulty ladder
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
src/lib/           preferences, sound, animation helpers
```

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
