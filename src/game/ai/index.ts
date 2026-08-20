import { Position } from './position'
import { MATE, search, type RootMove } from './search'

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface AiRequest {
  /** 16 entries; -1 for an empty cell. */
  cells: number[]
  /** Piece the computer must place, or -1 when it only has to hand one over. */
  hand: number
  /** Bitmask of pieces still in the pool. */
  avail: number
  difficulty: Difficulty
}

export interface AiMove {
  /** Cell for the piece in hand, or -1 when there was nothing to place. */
  cell: number
  /** Piece to hand the opponent, or -1 when the move ended the game. */
  gift: number
  /** Turns of lookahead actually completed. */
  depth: number
  nodes: number
}

interface Profile {
  maxDepth: number
  budgetMs: number
  slack: number
}

const PROFILES: Record<Exclude<Difficulty, 'easy'>, Profile> = {
  // Two turns of lookahead: enough to punish loose gifts, short of deep traps.
  medium: { maxDepth: 2, budgetMs: 220, slack: 10 },
  // Deepens until the clock or a forced result stops it.
  hard: { maxDepth: 20, budgetMs: 900, slack: 0 },
}

/** Easy blunders often enough to be beatable, not so often it looks broken. */
const EASY_TAKES_WIN = 0.65
const EASY_AVOIDS_HOT_GIFT = 0.5
/** Medium plays a sound but not-best move now and then. */
const MEDIUM_SLIP = 0.15

const pick = <T,>(xs: readonly T[], rng: () => number): T =>
  xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))]

function emptyCells(pos: Position): number[] {
  const out: number[] = []
  for (let c = 0; c < 16; c++) if (pos.cells[c] < 0) out.push(c)
  return out
}

function poolPieces(pos: Position): number[] {
  const out: number[] = []
  for (let p = 0; p < 16; p++) if (pos.avail & (1 << p)) out.push(p)
  return out
}

/** Chooses the computer's move for the given position. */
export function chooseMove(req: AiRequest, rng: () => number = Math.random): AiMove {
  const pos = Position.from(req.cells, req.hand, req.avail)
  if (req.difficulty === 'easy') return playEasy(pos, rng)

  const result = search(pos, PROFILES[req.difficulty])
  const decisive = Math.abs(result.score) > MATE / 2

  let choice: RootMove = { cell: result.cell, gift: result.gift, score: result.score }
  if (result.ties.length > 1) choice = pick(result.ties, rng)

  if (req.difficulty === 'medium' && !decisive && rng() < MEDIUM_SLIP) {
    const alt = looseMove(pos, rng)
    if (alt) choice = alt
  }

  return { cell: choice.cell, gift: choice.gift, depth: result.depth, nodes: result.nodes }
}

/**
 * Easy takes the win in front of it most of the time and dodges the obvious
 * gift about half the time. The rest is honest, readable carelessness.
 */
function playEasy(pos: Position, rng: () => number): AiMove {
  let cell = -1
  const hand = pos.hand

  if (hand >= 0) {
    const win = pos.winningCell(hand)
    cell = win >= 0 && rng() < EASY_TAKES_WIN ? win : pick(emptyCells(pos), rng)
    pos.clearHand(hand)
    if (pos.place(cell, hand)) return { cell, gift: -1, depth: 0, nodes: 0 }
  }

  const pool = poolPieces(pos)
  if (pool.length === 0) return { cell, gift: -1, depth: 0, nodes: 0 }
  const safe = pool.filter((p) => !pos.isHot(p))
  const gift = safe.length > 0 && rng() < EASY_AVOIDS_HOT_GIFT ? pick(safe, rng) : pick(pool, rng)
  return { cell, gift, depth: 0, nodes: 0 }
}

/** A legal, non-suicidal move chosen without search — Medium's occasional slip. */
function looseMove(pos: Position, rng: () => number): RootMove | null {
  if (pos.hand < 0) {
    const pool = poolPieces(pos)
    const safe = pool.filter((p) => !pos.isHot(p))
    const from = safe.length > 0 ? safe : pool
    return from.length > 0 ? { cell: -1, gift: pick(from, rng), score: 0 } : null
  }

  const hand = pos.hand
  if (pos.winningCell(hand) >= 0) return null // never slip out of a win

  const cells = emptyCells(pos)
  if (cells.length === 0) return null
  const cell = pick(cells, rng)

  pos.clearHand(hand)
  const won = pos.place(cell, hand)
  const pool = poolPieces(pos)
  const safe = pool.filter((p) => !pos.isHot(p))
  const gift = won || pool.length === 0 ? -1 : safe.length > 0 ? pick(safe, rng) : pick(pool, rng)
  pos.unplace(cell)
  pos.restoreHand(hand)

  return { cell, gift, score: 0 }
}

export { Position, search, MATE }
