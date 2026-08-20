import { ATTRIBUTE_MASKS, type PieceId } from './pieces'

export const SIZE = 4
export const CELLS = SIZE * SIZE

/** The ten lines that can win: four rows, four columns, two diagonals. */
export const LINES: readonly (readonly number[])[] = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 10, 11],
  [12, 13, 14, 15],
  [0, 4, 8, 12],
  [1, 5, 9, 13],
  [2, 6, 10, 14],
  [3, 7, 11, 15],
  [0, 5, 10, 15],
  [3, 6, 9, 12],
]

/** Reverse index: which lines pass through each cell (2 or 3 of them). */
export const LINES_THROUGH: readonly (readonly number[])[] = (() => {
  const out: number[][] = Array.from({ length: CELLS }, () => [])
  LINES.forEach((line, i) => line.forEach((cell) => out[cell].push(i)))
  return out
})()

/** Cells on a diagonal touch three lines; they are worth more, all else equal. */
export const CELL_WEIGHT: readonly number[] = LINES_THROUGH.map((l) => l.length)

export type Board = readonly (PieceId | null)[]

export const emptyBoard = (): Board => Array<PieceId | null>(CELLS).fill(null)

export interface WinLine {
  /** Index into LINES. */
  line: number
  cells: readonly number[]
  /** Bits on which all four pieces agree. */
  mask: number
  /** The agreed-upon value for those bits. */
  value: number
}

/**
 * Four pieces win when they agree on at least one attribute. ANDing the codes
 * finds attributes all four have; ANDing the complements finds attributes none
 * of them have. Either is a Quarto.
 */
export function findWin(board: Board): WinLine | null {
  for (let i = 0; i < LINES.length; i++) {
    const [a, b, c, d] = LINES[i]
    const pa = board[a]
    if (pa === null) continue
    const pb = board[b]
    if (pb === null) continue
    const pc = board[c]
    if (pc === null) continue
    const pd = board[d]
    if (pd === null) continue

    const all = pa & pb & pc & pd
    const none = ~pa & ~pb & ~pc & ~pd & 0b1111
    const mask = all | none
    if (mask !== 0) return { line: i, cells: LINES[i], mask, value: all }
  }
  return null
}

/** Every cell where dropping `piece` would complete a Quarto right now. */
export function winningCellsFor(board: Board, piece: PieceId): number[] {
  const cells: number[] = []
  for (let c = 0; c < CELLS; c++) {
    if (board[c] !== null) continue
    for (const li of LINES_THROUGH[c]) {
      const line = LINES[li]
      let all = piece
      let none = ~piece & 0b1111
      let filled = 1
      for (const cell of line) {
        if (cell === c) continue
        const p = board[cell]
        if (p === null) break
        all &= p
        none &= ~p & 0b1111
        filled++
      }
      if (filled === 4 && (all | none) !== 0) {
        cells.push(c)
        break
      }
    }
  }
  return cells
}

/** True when handing `piece` over lets the opponent win immediately. */
export const isHotPiece = (board: Board, piece: PieceId): boolean =>
  winningCellsFor(board, piece).length > 0

/**
 * Lines that already hold three pieces agreeing on something — one placement
 * away from a Quarto. Used by the UI to explain risk, not by the search.
 */
export function liveThreats(board: Board): number[] {
  const out: number[] = []
  for (let i = 0; i < LINES.length; i++) {
    let filled = 0
    let all = 0b1111
    let none = 0b1111
    for (const cell of LINES[i]) {
      const p = board[cell]
      if (p === null) continue
      filled++
      all &= p
      none &= ~p & 0b1111
    }
    if (filled === 3 && (all | none) !== 0) out.push(i)
  }
  return out
}

export { ATTRIBUTE_MASKS }
