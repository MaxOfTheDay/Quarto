import { describe, expect, it } from 'vitest'
import { chooseMove } from '../ai/index'
import { Position } from '../ai/position'
import { search } from '../ai/search'
import { emptyBoard, isHotPiece, winningCellsFor, type Board } from '../board'
import { HEIGHT, SHAPE, TONE, TOP } from '../pieces'

const req = (board: Board, hand: number, difficulty: 'medium' | 'hard') => ({
  cells: board.map((c) => (c === null ? -1 : c)),
  hand,
  avail: Array.from({ length: 16 }, (_, i) => i)
    .filter((p) => p !== hand && !board.includes(p))
    .reduce((m, p) => m | (1 << p), 0),
  difficulty,
})

const build = (spec: Record<number, number>): Board => {
  const b = emptyBoard().slice()
  for (const [k, v] of Object.entries(spec)) b[Number(k)] = v
  return b
}

describe.each(['medium', 'hard'] as const)('%s', (difficulty) => {
  it('takes an available win immediately', () => {
    // 0, 1, 2 are all tall; handing over another tall piece ends it at cell 3.
    const board = build({ 0: HEIGHT, 1: HEIGHT | TONE, 2: HEIGHT | SHAPE })
    const hand = HEIGHT | TOP
    expect(winningCellsFor(board, hand)).toContain(3)
    expect(chooseMove(req(board, hand, difficulty)).cell).toBe(3)
  })

  it('never hands over a piece that wins on the spot', () => {
    // Three tall pieces on the top row: any remaining tall piece is poison.
    const board = build({ 0: HEIGHT, 1: HEIGHT | TONE, 2: HEIGHT | SHAPE })
    const move = chooseMove(req(board, TONE | SHAPE | TOP, difficulty))
    const after = board.slice()
    after[move.cell] = TONE | SHAPE | TOP
    expect(move.gift).toBeGreaterThanOrEqual(0)
    expect(isHotPiece(after, move.gift)).toBe(false)
  })

  it('does not place a piece where it opens a line it must then feed', () => {
    const board = build({ 0: HEIGHT, 1: HEIGHT | TONE })
    const move = chooseMove(req(board, HEIGHT | SHAPE, difficulty))
    const after = board.slice()
    after[move.cell] = HEIGHT | SHAPE
    // Whatever it does, it must still have a safe piece to hand back.
    expect(isHotPiece(after, move.gift)).toBe(false)
  })
})

describe('search', () => {
  it('reports a forced win as a mate score', () => {
    const board = build({ 0: HEIGHT, 1: HEIGHT | TONE, 2: HEIGHT | SHAPE })
    const pos = Position.from(
      board.map((c) => (c === null ? -1 : c)),
      HEIGHT | TOP,
      0,
    )
    const result = search(pos, { maxDepth: 4, budgetMs: 200 })
    expect(result.score).toBeGreaterThan(10000)
    expect(result.cell).toBe(3)
  })

  it('stays inside its time budget', () => {
    const pos = Position.from(new Array(16).fill(-1), 0, 0xfffe)
    const started = Date.now()
    search(pos, { maxDepth: 20, budgetMs: 250 })
    // Deadline is checked every 1024 nodes, so allow generous slack.
    expect(Date.now() - started).toBeLessThan(1500)
  })

  it('finds the draw when the last piece cannot win', () => {
    // Fifteen pieces down, one cell left, and the final piece completes nothing.
    const order = [0, 7, 9, 14, 11, 12, 2, 5, 6, 1, 15, 8, 13, 10, 4]
    const board = emptyBoard().slice()
    order.forEach((p, i) => (board[i] = p))
    const pos = Position.from(
      board.map((c) => (c === null ? -1 : c)),
      3,
      0,
    )
    expect(search(pos, { maxDepth: 4, budgetMs: 200 }).score).toBe(0)
  })
})
