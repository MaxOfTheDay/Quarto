import { CELLS, emptyBoard, findWin, type Board, type WinLine } from './board'
import { ALL_PIECES, type PieceId } from './pieces'

export type PlayerId = 0 | 1

/**
 * A turn is two actions by the same person: place the piece you were handed,
 * then hand a piece back. `hand === null` means we are between those two, i.e.
 * the current player is choosing what the opponent will place.
 */
export type Phase = 'place' | 'select' | 'over'

export type Outcome = { kind: 'win'; player: PlayerId; line: WinLine } | { kind: 'draw' } | null

export interface GameState {
  board: Board
  /** Pieces still in the pool — neither placed nor currently in hand. */
  pool: readonly PieceId[]
  /** The piece the current player must place, or null while they are choosing. */
  hand: PieceId | null
  /** Whose action it is right now. */
  turn: PlayerId
  outcome: Outcome
  /** Cell filled by the most recent placement, for animation and review. */
  lastPlaced: number | null
  /** Half-moves played, used for stable animation keys. */
  ply: number
}

export const otherPlayer = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0)

export function phaseOf(state: GameState): Phase {
  if (state.outcome) return 'over'
  return state.hand === null ? 'select' : 'place'
}

/**
 * `opener` is the player who hands over the very first piece; their opponent
 * makes the first placement.
 */
export function createGame(opener: PlayerId = 0): GameState {
  return {
    board: emptyBoard(),
    pool: ALL_PIECES,
    hand: null,
    turn: opener,
    outcome: null,
    lastPlaced: null,
    ply: 0,
  }
}

/** Current player hands `piece` to their opponent, who becomes the placer. */
export function selectPiece(state: GameState, piece: PieceId): GameState {
  if (state.outcome || state.hand !== null) return state
  if (!state.pool.includes(piece)) return state
  return {
    ...state,
    pool: state.pool.filter((p) => p !== piece),
    hand: piece,
    turn: otherPlayer(state.turn),
    ply: state.ply + 1,
  }
}

/** Current player drops the piece in hand onto an empty cell. */
export function placePiece(state: GameState, cell: number): GameState {
  if (state.outcome || state.hand === null) return state
  if (cell < 0 || cell >= CELLS || state.board[cell] !== null) return state

  const board = state.board.slice()
  board[cell] = state.hand

  const win = findWin(board)
  const outcome: Outcome = win
    ? { kind: 'win', player: state.turn, line: win }
    : board.every((c) => c !== null)
      ? { kind: 'draw' }
      : null

  return {
    ...state,
    board,
    hand: null,
    outcome,
    lastPlaced: cell,
    ply: state.ply + 1,
    // The placer keeps the turn: their second action is choosing the reply piece.
  }
}

export const isGameStarted = (state: GameState) => state.ply > 0

/** The player who is not acting right now. */
export const opponentOf = (state: GameState) => otherPlayer(state.turn)
