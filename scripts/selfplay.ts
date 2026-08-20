/**
 * Headless tournament used to sanity-check the difficulty ladder.
 * Run with: npm run selfplay -- [gamesPerPairing]
 */
import { chooseMove, type Difficulty } from '../src/game/ai/index'
import { createGame, placePiece, selectPiece, type GameState, type PlayerId } from '../src/game/engine'

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const toRequest = (g: GameState, difficulty: Difficulty) => ({
  cells: g.board.map((c) => (c === null ? -1 : c)),
  hand: g.hand ?? -1,
  avail: g.pool.reduce((m, p) => m | (1 << p), 0),
  difficulty,
})

function playGame(levels: [Difficulty, Difficulty], rng: () => number): 0 | 1 | 'draw' {
  let g = createGame(0)
  let guard = 0
  while (!g.outcome && guard++ < 64) {
    const me = g.turn as PlayerId
    const move = chooseMove(toRequest(g, levels[me]), rng)
    if (g.hand !== null) {
      if (move.cell < 0) throw new Error('expected a placement')
      g = placePiece(g, move.cell)
      if (g.outcome) break
    }
    if (move.gift < 0) throw new Error('expected a gift')
    g = selectPiece(g, move.gift)
  }
  if (!g.outcome) throw new Error('game did not terminate')
  return g.outcome.kind === 'draw' ? 'draw' : g.outcome.player
}

const games = Number(process.argv[2] ?? 30)
const pairings: [Difficulty, Difficulty][] = [
  ['hard', 'easy'],
  ['hard', 'medium'],
  ['medium', 'easy'],
  ['hard', 'hard'],
]

for (const [a, b] of pairings) {
  const tally = { [a]: 0, [b]: 0, draw: 0 } as Record<string, number>
  const started = Date.now()
  for (let i = 0; i < games; i++) {
    const rng = mulberry32(0x1234 + i)
    // Alternate who opens so neither side keeps the first-gift advantage.
    const levels: [Difficulty, Difficulty] = i % 2 === 0 ? [a, b] : [b, a]
    const winner = playGame(levels, rng)
    if (winner === 'draw') tally.draw++
    else tally[levels[winner]]++
  }
  const ms = Date.now() - started
  console.log(
    `${a.padEnd(6)} vs ${b.padEnd(6)}  ${a}: ${String(tally[a]).padStart(3)}  ` +
      `${b}: ${String(tally[b]).padStart(3)}  draw: ${String(tally.draw).padStart(3)}  ` +
      `(${(ms / games).toFixed(0)} ms/game)`,
  )
}
