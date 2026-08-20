import { Position } from './position'

/** Score of an immediate win; deeper wins score lower so the engine hurries. */
export const MATE = 30000
const INF = 1 << 30

/** Diagonal cells sit on three lines, edges on two. Search the busy ones first. */
const CELL_ORDER = [5, 6, 9, 10, 0, 3, 12, 15, 1, 2, 4, 7, 8, 11, 13, 14]

const BOUND_EXACT = 0
const BOUND_LOWER = 1
const BOUND_UPPER = 2

interface Entry {
  depth: number
  score: number
  bound: number
  cell: number
}

class Timeout extends Error {}

export interface SearchOptions {
  maxDepth: number
  budgetMs: number
  /** Root moves within this many points of the best count as equally good. */
  slack?: number
  now?: () => number
}

export interface RootMove {
  cell: number
  gift: number
  score: number
}

export interface SearchResult {
  cell: number
  gift: number
  score: number
  depth: number
  nodes: number
  /** Every root move that scored within `slack` of the best. */
  ties: RootMove[]
}

/**
 * Negamax with alpha-beta. One "move" is a whole turn — place the piece you
 * were handed, then hand one back — so depth counts turns, not half-turns.
 *
 * Two sound shortcuts do most of the pruning:
 *  - if the piece in hand completes a line anywhere, that is the move;
 *  - handing over a piece the opponent can win with is never better than
 *    handing over a safe one, so those branches are skipped outright.
 */
class Engine {
  private readonly table = new Map<number, Entry>()
  private nodes = 0
  private deadline = Infinity
  private readonly now: () => number
  private readonly scratch: number[] = new Array(16)

  constructor(
    private readonly pos: Position,
    now: () => number,
  ) {
    this.now = now
  }

  get nodeCount() {
    return this.nodes
  }

  private tick() {
    if ((++this.nodes & 1023) === 0 && this.now() > this.deadline) throw new Timeout()
  }

  /** Pool pieces that would not hand the opponent an immediate Quarto. */
  private safeGifts(): number[] {
    const pos = this.pos
    const n = pos.poolList(this.scratch)
    const hot = pos.hotMask()
    const safe: number[] = []
    for (let i = 0; i < n; i++) {
      const g = this.scratch[i]
      if ((hot & (1 << g)) === 0) safe.push(g)
    }
    // Awkward gifts first: they fit the half-built lines least, so they tend to
    // be both the strongest choice and the quickest to produce a cutoff.
    safe.sort((a, b) => pos.fitScore(a) - pos.fitScore(b))
    return safe
  }

  /**
   * Scores every legal root move. Alpha is propagated between siblings but held
   * `slack` below the best score so far, so any move that ties for best is still
   * returned with a usable score instead of failing low.
   */
  rootScores(depth: number, deadline: number, slack: number): RootMove[] {
    this.deadline = deadline
    const pos = this.pos
    const out: RootMove[] = []
    let alpha = -INF
    let top = -INF

    const consider = (cell: number, gift: number, score: number) => {
      out.push({ cell, gift, score })
      if (score > top) {
        top = score
        const window = Math.abs(top) > MATE / 2 ? 0 : slack
        alpha = Math.max(alpha, top - window - 1)
      }
    }

    if (pos.hand < 0) {
      // Opening move: nothing to place, only a piece to hand over.
      const n = pos.poolList(this.scratch)
      for (let i = 0; i < n; i++) {
        const g = this.scratch[i]
        pos.give(g)
        const score = -this.negamax(depth - 1, -INF, -alpha, 1)
        pos.ungive(g)
        consider(-1, g, score)
      }
      return out
    }

    const hand = pos.hand
    const win = pos.winningCell(hand)
    if (win >= 0) return [{ cell: win, gift: -1, score: MATE }]

    for (const c of CELL_ORDER) {
      if (pos.cells[c] >= 0) continue
      pos.clearHand(hand)
      pos.place(c, hand)

      if (pos.empties === 0) {
        consider(c, -1, 0) // last piece placed without a Quarto: a draw
      } else {
        const safe = this.safeGifts()
        if (safe.length === 0) {
          const n = pos.poolList(this.scratch)
          for (let i = 0; i < n; i++) consider(c, this.scratch[i], -(MATE - 1))
        } else {
          for (const g of safe) {
            pos.give(g)
            const score = -this.negamax(depth - 1, -INF, -alpha, 1)
            pos.ungive(g)
            consider(c, g, score)
          }
        }
      }

      pos.unplace(c)
      pos.restoreHand(hand)
    }
    return out
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number): number {
    this.tick()
    const pos = this.pos
    const hand = pos.hand

    // Cheaper than a table probe, and it settles most tactical nodes outright.
    if (pos.winningCell(hand) >= 0) return MATE - ply
    if (pos.empties === 1) return 0 // the forced last placement fills the board

    if (depth <= 0) return this.evaluate(ply)

    const key = pos.key()
    const hit = this.table.get(key)
    const alphaOrig = alpha
    if (hit && hit.depth >= depth) {
      if (hit.bound === BOUND_EXACT) return hit.score
      if (hit.bound === BOUND_LOWER) alpha = Math.max(alpha, hit.score)
      else beta = Math.min(beta, hit.score)
      if (alpha >= beta) return hit.score
    }

    let best = -INF
    let bestCell = -1
    const preferred = hit ? hit.cell : -1
    let cut = false

    for (let idx = -1; idx < CELL_ORDER.length && !cut; idx++) {
      const c = idx < 0 ? preferred : CELL_ORDER[idx]
      if (c < 0 || pos.cells[c] >= 0) continue
      if (idx >= 0 && c === preferred) continue

      pos.clearHand(hand)
      pos.place(c, hand)

      let value: number
      if (pos.empties === 0) {
        value = 0
      } else {
        const safe = this.safeGifts()
        if (safe.length === 0) {
          // Every remaining piece hands over a Quarto: the reply is forced.
          value = -(MATE - (ply + 1))
        } else {
          value = -INF
          for (const g of safe) {
            pos.give(g)
            const score = -this.negamax(depth - 1, -beta, -Math.max(alpha, value), ply + 1)
            pos.ungive(g)
            if (score > value) value = score
            if (Math.max(alpha, value) >= beta) break
          }
        }
      }

      pos.unplace(c)
      pos.restoreHand(hand)

      if (value > best) {
        best = value
        bestCell = c
      }
      if (best > alpha) alpha = best
      if (alpha >= beta) cut = true
    }

    const bound = best <= alphaOrig ? BOUND_UPPER : cut ? BOUND_LOWER : BOUND_EXACT
    this.table.set(key, { depth, score: best, bound, cell: bestCell })
    return best
  }

  /**
   * Horizon evaluation. The piece in hand cannot win here, so what matters is
   * whether the mover will still hold a safe piece to hand back after placing,
   * and how tightly the board constrains whoever gives next.
   */
  private evaluate(ply: number): number {
    const pos = this.pos
    const hand = pos.hand
    let best = -INF

    for (const c of CELL_ORDER) {
      if (pos.cells[c] >= 0) continue
      pos.clearHand(hand)
      pos.place(c, hand)

      let value: number
      if (pos.empties === 0) {
        value = 0
      } else {
        const n = pos.poolList(this.scratch)
        const hot = pos.hotMask()
        let safe = 0
        for (let i = 0; i < n; i++) if ((hot & (1 << this.scratch[i])) === 0) safe++

        if (safe === 0) {
          value = -(MATE - (ply + 2)) // forced to hand over a winner next turn
        } else {
          // Options are comfort; a board full of pieces nobody wants to hand
          // over is pressure on whoever has to give next.
          value = 12 * Math.min(safe, 3) + 2 * Math.min(n - safe, 6) + pos.threatCount()
        }
      }

      pos.unplace(c)
      pos.restoreHand(hand)
      if (value > best) best = value
    }
    return best
  }
}

/** Iterative deepening inside a wall-clock budget. */
export function search(pos: Position, opts: SearchOptions): SearchResult {
  const now = opts.now ?? (() => Date.now())
  const deadline = now() + opts.budgetMs
  const slack = opts.slack ?? 0
  const engine = new Engine(pos, now)

  let best: SearchResult = { cell: -1, gift: -1, score: 0, depth: 0, nodes: 0, ties: [] }
  const ceiling = Math.min(opts.maxDepth, pos.empties + 1)

  for (let depth = 1; depth <= ceiling; depth++) {
    let scored: RootMove[]
    try {
      scored = engine.rootScores(depth, deadline, slack)
    } catch (err) {
      if (err instanceof Timeout) break
      throw err
    }
    if (scored.length === 0) break

    let top = -INF
    for (const m of scored) if (m.score > top) top = m.score

    // Decisive lines are followed exactly; quiet ones may tie, for variety.
    const window = Math.abs(top) > MATE / 2 ? 0 : slack
    const ties = scored.filter((m) => m.score >= top - window)
    const pick = scored.find((m) => m.score === top)!

    best = { cell: pick.cell, gift: pick.gift, score: top, depth, nodes: engine.nodeCount, ties }

    if (Math.abs(top) > MATE / 2) break // a forced result will not change with depth
    if (now() > deadline) break
  }

  return best
}
