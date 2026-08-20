import { describe, expect, it } from 'vitest'
import { findWin, winningCellsFor, liveThreats, emptyBoard, type Board } from '../board'
import { HEIGHT, SHAPE, TONE, TOP, describeSharedAttributes, POOL_ORDER } from '../pieces'
import { createGame, placePiece, selectPiece, phaseOf } from '../engine'

const board = (spec: Record<number, number>): Board => {
  const b = emptyBoard().slice()
  for (const [k, v] of Object.entries(spec)) b[Number(k)] = v
  return b
}

describe('win detection', () => {
  it('finds a row sharing a set attribute', () => {
    // All four tall (bit 1 set).
    const win = findWin(board({ 0: HEIGHT, 1: HEIGHT | TONE, 2: HEIGHT | SHAPE, 3: HEIGHT | TOP }))
    expect(win).not.toBeNull()
    expect(win!.cells).toEqual([0, 1, 2, 3])
    expect(describeSharedAttributes(win!.mask, win!.value)).toContain('tall')
  })

  it('finds a column sharing an unset attribute', () => {
    // None hollow: they agree on "solid".
    const win = findWin(board({ 1: 0, 5: HEIGHT, 9: TONE, 13: SHAPE }))
    expect(win).not.toBeNull()
    expect(win!.cells).toEqual([1, 5, 9, 13])
    expect(describeSharedAttributes(win!.mask, win!.value)).toContain('solid')
  })

  it('finds both diagonals', () => {
    expect(findWin(board({ 0: TONE, 5: TONE | 1, 10: TONE | 4, 15: TONE | 8 }))).not.toBeNull()
    expect(findWin(board({ 3: SHAPE, 6: SHAPE | 1, 9: SHAPE | 2, 12: SHAPE | 8 }))).not.toBeNull()
  })

  it('reports every shared attribute of a win', () => {
    // Four pieces that are all tall and all dark.
    const w = findWin(board({ 0: 3, 1: 7, 2: 11, 3: 15 }))!
    const shared = describeSharedAttributes(w.mask, w.value)
    expect(shared).toEqual(expect.arrayContaining(['tall', 'dark']))
  })

  it('rejects a full line with nothing in common', () => {
    // 0 = short light round solid, 15 = tall dark square hollow: opposites.
    expect(findWin(board({ 0: 0, 1: 15, 2: 3, 3: 12 }))).toBeNull()
  })

  it('ignores incomplete lines', () => {
    expect(findWin(board({ 0: HEIGHT, 1: HEIGHT, 2: HEIGHT }))).toBeNull()
  })
})

describe('threat detection', () => {
  const three = board({ 0: HEIGHT, 1: HEIGHT | TONE, 2: HEIGHT | SHAPE })

  it('lists the cell where a piece would complete a line', () => {
    expect(winningCellsFor(three, HEIGHT | TOP)).toContain(3)
  })

  it('says nothing when the piece does not fit', () => {
    // The three placed pieces are all short-or-tall mixed but all solid, so the
    // only piece that fails to complete the line is a short hollow one.
    expect(winningCellsFor(three, TOP)).toEqual([])
  })

  it('counts live three-piece lines', () => {
    expect(liveThreats(three)).toEqual([0])
    expect(liveThreats(emptyBoard())).toEqual([])
  })
})

describe('turn flow', () => {
  it('alternates: you place what you were given, then give one back', () => {
    let g = createGame(0)
    expect(phaseOf(g)).toBe('select')
    expect(g.turn).toBe(0)

    g = selectPiece(g, 5)
    expect(phaseOf(g)).toBe('place')
    expect(g.turn).toBe(1) // the opponent places what player 0 handed over
    expect(g.pool).not.toContain(5)

    g = placePiece(g, 0)
    expect(g.board[0]).toBe(5)
    expect(phaseOf(g)).toBe('select')
    expect(g.turn).toBe(1) // same player now chooses for player 0
  })

  it('credits the win to whoever placed the piece', () => {
    let g = createGame(0)
    const line = [HEIGHT, HEIGHT | TONE, HEIGHT | SHAPE, HEIGHT | TOP]
    for (let i = 0; i < 4; i++) {
      g = selectPiece(g, line[i])
      g = placePiece(g, i)
      if (g.outcome) break
    }
    // Placements alternate 1, 0, 1, 0 — player 0 lays the fourth piece.
    expect(g.outcome).toEqual(expect.objectContaining({ kind: 'win', player: 0 }))
    expect(phaseOf(g)).toBe('over')
  })

  it('refuses illegal actions instead of corrupting state', () => {
    let g = createGame(0)
    expect(placePiece(g, 0)).toBe(g) // nothing in hand yet
    g = selectPiece(g, 3)
    expect(selectPiece(g, 4)).toBe(g) // already holding a piece
    g = placePiece(g, 0)
    g = selectPiece(g, 4)
    expect(placePiece(g, 0)).toBe(g) // cell taken
  })

  it('draws when the board fills with no Quarto', () => {
    // A known 4x4 arrangement of all 16 pieces with no winning line.
    const order = [0, 7, 9, 14, 11, 12, 2, 5, 6, 1, 15, 8, 13, 10, 4, 3]
    let g = createGame(0)
    for (let i = 0; i < 16; i++) {
      g = selectPiece(g, order[i])
      g = placePiece(g, i)
    }
    expect(g.outcome).toEqual({ kind: 'draw' })
  })
})

describe('pool ordering', () => {
  it('covers all sixteen pieces exactly once', () => {
    expect([...POOL_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i))
  })

  it('groups light before dark and round before square', () => {
    const firstDark = POOL_ORDER.findIndex((p) => p & TONE)
    const lastLight = 15 - [...POOL_ORDER].reverse().findIndex((p) => !(p & TONE))
    expect(firstDark).toBeGreaterThan(lastLight)
  })
})
