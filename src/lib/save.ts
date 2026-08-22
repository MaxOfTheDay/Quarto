import { CELLS, createGame, findWin, type GameState, type PieceId, type PlayerId } from '../game'
import type { Difficulty } from '../game/ai'
import type { Mode } from './prefs'

/**
 * Saving the game in progress.
 *
 * The state is four small arrays and three numbers, so the whole history
 * serialises to a few hundred bytes and can be written on every half-move
 * without anyone noticing. Everything here is defensive: a save that cannot be
 * read is treated as no save at all, because losing a stored game silently is
 * far better than starting the app on a corrupted board.
 */

export interface Session {
  mode: Mode
  difficulty: Difficulty
  /** The side the person at the keyboard controls; null when both are human. */
  human: PlayerId | null
  names: [string, string]
  /** Wins by player, then draws — carried across rematches. */
  tally: [number, number, number]
}

export interface SavedGame {
  session: Session
  history: GameState[]
}

const KEY = 'quarto.game.v1'

/** Only what cannot be recomputed. `pool` and `outcome` are derived on load. */
interface Wire {
  s: {
    m: Mode
    d: Difficulty
    h: PlayerId | null
    n: [string, string]
    t: [number, number, number]
  }
  /** Per state: the board as 16 ints (-1 empty), the hand, and whose turn. */
  g: { b: number[]; h: number; t: PlayerId }[]
}

const isPiece = (n: unknown): n is PieceId =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 15

export function save(game: SavedGame): void {
  try {
    const wire: Wire = {
      s: {
        m: game.session.mode,
        d: game.session.difficulty,
        h: game.session.human,
        n: game.session.names,
        t: game.session.tally,
      },
      g: game.history.map((state) => ({
        b: state.board.map((cell) => (cell === null ? -1 : cell)),
        h: state.hand ?? -1,
        t: state.turn,
      })),
    }
    localStorage.setItem(KEY, JSON.stringify(wire))
  } catch {
    /* quota, private browsing, storage disabled — the game just is not saved */
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to do; a stale record is harmless because load() validates */
  }
}

/**
 * Replays the stored half-moves through the real engine rather than trusting a
 * serialised outcome, so a save can never resurrect a position the rules do not
 * allow — and `findWin` stays the single source of truth for who won.
 */
export function load(): SavedGame | null {
  let wire: Wire
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    wire = JSON.parse(raw) as Wire
  } catch {
    return null
  }

  try {
    if (!wire?.s || !Array.isArray(wire.g) || wire.g.length === 0) return null

    const history: GameState[] = []
    for (const frame of wire.g) {
      if (!Array.isArray(frame.b) || frame.b.length !== CELLS) return null

      const board = frame.b.map((cell) => (cell === -1 ? null : cell))
      if (board.some((cell) => cell !== null && !isPiece(cell))) return null

      const hand = frame.h === -1 ? null : frame.h
      if (hand !== null && !isPiece(hand)) return null
      if (frame.t !== 0 && frame.t !== 1) return null

      // A piece is on the board, in hand, or in the pool — never two of those.
      const seen = new Set<PieceId>()
      for (const cell of board) {
        if (cell === null) continue
        if (seen.has(cell)) return null
        seen.add(cell)
      }
      if (hand !== null) {
        if (seen.has(hand)) return null
        seen.add(hand)
      }

      const previous = history[history.length - 1]
      const base = previous ?? createGame(frame.t)
      history.push({
        ...base,
        board,
        pool: base.pool.filter((piece) => !seen.has(piece)),
        hand,
        turn: frame.t,
        // Recomputed below from the board itself.
        outcome: null,
        lastPlaced: previous ? lastDifference(previous.board, board) : null,
        ply: history.length,
      })
    }

    const settled = history.map(withOutcome)
    // A finished game is not worth resuming into.
    if (settled[settled.length - 1].outcome) return null

    const session = wire.s
    if (session.m !== 'local' && session.m !== 'computer') return null

    return {
      session: {
        mode: session.m,
        difficulty: session.d,
        human: session.h,
        names: session.n,
        tally: Array.isArray(session.t) && session.t.length === 3 ? session.t : [0, 0, 0],
      },
      history: settled,
    }
  } catch {
    return null
  }
}

const lastDifference = (before: GameState['board'], after: GameState['board']) => {
  for (let cell = 0; cell < CELLS; cell++) {
    if (before[cell] === null && after[cell] !== null) return cell
  }
  return null
}

/** The rules decide the outcome, not the file. */
function withOutcome(state: GameState): GameState {
  const win = findWin(state.board)
  if (win) return { ...state, outcome: { kind: 'win', player: state.turn, line: win } }
  if (state.board.every((cell) => cell !== null)) return { ...state, outcome: { kind: 'draw' } }
  return state
}
