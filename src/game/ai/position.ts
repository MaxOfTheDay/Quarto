import { CELLS, LINES, LINES_THROUGH } from '../board'
import type { PieceId } from '../pieces'

/**
 * Mutable, allocation-free mirror of the board used by the search.
 *
 * Each of the ten lines keeps a running AND of the piece codes it holds (`pos`)
 * and a running AND of their complements (`neg`). A full line wins when
 * `pos | neg` is non-zero, and a three-piece line tells us instantly which
 * pieces would complete it — the single primitive the whole engine leans on.
 */

const MASK = 0b1111

/** Deterministic 32-bit PRNG so Zobrist keys are stable across sessions. */
function makeRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s ^= s << 13
    s >>>= 0
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s
  }
}

const rand = makeRandom(0x9e3779b9)
const Z_CELL: number[] = []
const Z_HAND: number[] = []
for (let i = 0; i < CELLS * 16 * 2; i++) Z_CELL.push(rand())
for (let i = 0; i < 17 * 2; i++) Z_HAND.push(rand())

export class Position {
  readonly cells = new Int8Array(CELLS).fill(-1)
  /** Bitmask of pieces still in the pool. */
  avail = 0xffff
  /** Piece awaiting placement, or -1. */
  hand = -1
  empties = CELLS

  private readonly lineCount = new Int8Array(LINES.length)
  private readonly linePos = new Int8Array(LINES.length).fill(MASK)
  private readonly lineNeg = new Int8Array(LINES.length).fill(MASK)
  private h1 = 0
  private h2 = 0

  static from(cells: readonly number[], hand: number, avail: number): Position {
    const p = new Position()
    for (let c = 0; c < CELLS; c++) {
      if (cells[c] >= 0) p.place(c, cells[c])
    }
    p.avail = avail
    p.hand = hand
    if (hand >= 0) {
      p.h1 ^= Z_HAND[hand * 2]
      p.h2 ^= Z_HAND[hand * 2 + 1]
    }
    return p
  }

  /** 53-bit transposition key blending both Zobrist halves. */
  key(): number {
    return this.h1 * 2097152 + (this.h2 & 0x1fffff)
  }

  /** Drops `piece` on `cell`. Returns true when it completes a Quarto. */
  place(cell: number, piece: PieceId): boolean {
    this.cells[cell] = piece
    this.empties--
    const i = cell * 32 + piece * 2
    this.h1 ^= Z_CELL[i]
    this.h2 ^= Z_CELL[i + 1]

    let won = false
    const lines = LINES_THROUGH[cell]
    for (let k = 0; k < lines.length; k++) {
      const li = lines[k]
      const n = ++this.lineCount[li]
      const p = (this.linePos[li] &= piece)
      const g = (this.lineNeg[li] &= ~piece & MASK)
      if (n === 4 && (p | g) !== 0) won = true
    }
    return won
  }

  unplace(cell: number): void {
    const piece = this.cells[cell]
    this.cells[cell] = -1
    this.empties++
    const i = cell * 32 + piece * 2
    this.h1 ^= Z_CELL[i]
    this.h2 ^= Z_CELL[i + 1]

    // AND is not invertible, so rebuild the touched lines from their cells.
    const lines = LINES_THROUGH[cell]
    for (let k = 0; k < lines.length; k++) {
      const li = lines[k]
      const line = LINES[li]
      let count = 0
      let p = MASK
      let g = MASK
      for (let j = 0; j < 4; j++) {
        const v = this.cells[line[j]]
        if (v < 0) continue
        count++
        p &= v
        g &= ~v & MASK
      }
      this.lineCount[li] = count
      this.linePos[li] = p
      this.lineNeg[li] = g
    }
  }

  /** Moves `piece` out of the pool and into the hand. */
  give(piece: PieceId): void {
    this.avail &= ~(1 << piece)
    this.hand = piece
    this.h1 ^= Z_HAND[piece * 2]
    this.h2 ^= Z_HAND[piece * 2 + 1]
  }

  ungive(piece: PieceId): void {
    this.avail |= 1 << piece
    this.hand = -1
    this.h1 ^= Z_HAND[piece * 2]
    this.h2 ^= Z_HAND[piece * 2 + 1]
  }

  /** Clears the hand without returning the piece to the pool (used at the root). */
  clearHand(piece: PieceId): void {
    this.hand = -1
    this.h1 ^= Z_HAND[piece * 2]
    this.h2 ^= Z_HAND[piece * 2 + 1]
  }

  restoreHand(piece: PieceId): void {
    this.hand = piece
    this.h1 ^= Z_HAND[piece * 2]
    this.h2 ^= Z_HAND[piece * 2 + 1]
  }

  /** First cell where `piece` completes a line, or -1. */
  winningCell(piece: PieceId): number {
    for (let li = 0; li < LINES.length; li++) {
      if (this.lineCount[li] !== 3) continue
      if (((this.linePos[li] & piece) | (this.lineNeg[li] & ~piece & MASK)) === 0) continue
      const line = LINES[li]
      for (let j = 0; j < 4; j++) {
        if (this.cells[line[j]] < 0) return line[j]
      }
    }
    return -1
  }

  /** True when the opponent could win on their next placement with `piece`. */
  isHot(piece: PieceId): boolean {
    for (let li = 0; li < LINES.length; li++) {
      if (this.lineCount[li] !== 3) continue
      if (((this.linePos[li] & piece) | (this.lineNeg[li] & ~piece & MASK)) !== 0) return true
    }
    return false
  }

  /** Bitmask of pool pieces that would hand the opponent an immediate win. */
  hotMask(): number {
    let hot = 0
    let rest = this.avail
    while (rest) {
      const p = 31 - Math.clz32(rest & -rest)
      rest &= rest - 1
      if (this.isHot(p)) hot |= 1 << p
    }
    return hot
  }

  /** Lines holding three pieces that still agree on something. */
  threatCount(): number {
    let n = 0
    for (let li = 0; li < LINES.length; li++) {
      if (this.lineCount[li] === 3 && (this.linePos[li] | this.lineNeg[li]) !== 0) n++
    }
    return n
  }

  /**
   * How comfortably `piece` fits the half-built lines: the number of live
   * attribute matches it would keep alive, weighted towards lines that are
   * nearly complete. Low values make awkward, hard-to-use gifts.
   */
  fitScore(piece: PieceId): number {
    let score = 0
    for (let li = 0; li < LINES.length; li++) {
      const n = this.lineCount[li]
      if (n < 1 || n > 2) continue
      const live = (this.linePos[li] & piece) | (this.lineNeg[li] & ~piece & MASK)
      score += popcount(live) * (n === 2 ? 3 : 1)
    }
    return score
  }

  poolList(out: number[]): number {
    let n = 0
    let rest = this.avail
    while (rest) {
      out[n++] = 31 - Math.clz32(rest & -rest)
      rest &= rest - 1
    }
    return n
  }
}

export function popcount(v: number): number {
  v = v - ((v >> 1) & 0x55555555)
  v = (v & 0x33333333) + ((v >> 2) & 0x33333333)
  return (((v + (v >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24
}
