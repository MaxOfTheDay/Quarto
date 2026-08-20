/**
 * A Quarto piece is four independent binary attributes, so the whole set of 16
 * pieces is exactly the integers 0..15. Each attribute is one bit, which makes
 * "do these four pieces share an attribute?" a couple of bitwise ANDs.
 */

export type PieceId = number // 0..15

/** Bit masks for the four attribute axes. */
export const HEIGHT = 1 // 0 = short, 1 = tall
export const TONE = 2 // 0 = light, 1 = dark
export const SHAPE = 4 // 0 = round, 1 = square
export const TOP = 8 // 0 = solid, 1 = hollow

export const ATTRIBUTE_MASKS = [HEIGHT, TONE, SHAPE, TOP] as const

export const ALL_PIECES: readonly PieceId[] = Array.from({ length: 16 }, (_, i) => i)

export const isTall = (p: PieceId) => (p & HEIGHT) !== 0
export const isDark = (p: PieceId) => (p & TONE) !== 0
export const isSquare = (p: PieceId) => (p & SHAPE) !== 0
export const isHollow = (p: PieceId) => (p & TOP) !== 0

/** Human-readable name of each side of each axis, used for labels and win copy. */
const AXIS_NAMES: Record<number, { axis: string; off: string; on: string }> = {
  [HEIGHT]: { axis: 'Height', off: 'short', on: 'tall' },
  [TONE]: { axis: 'Tone', off: 'light', on: 'dark' },
  [SHAPE]: { axis: 'Shape', off: 'round', on: 'square' },
  [TOP]: { axis: 'Top', off: 'solid', on: 'hollow' },
}

/** e.g. 11 -> "tall dark round hollow" */
export function describePiece(p: PieceId): string {
  return ATTRIBUTE_MASKS.map((m) => (p & m ? AXIS_NAMES[m].on : AXIS_NAMES[m].off)).join(' ')
}

/** Sentence-cased label suitable for aria-labels: "Tall dark round hollow piece". */
export function pieceLabel(p: PieceId): string {
  const d = describePiece(p)
  return d.charAt(0).toUpperCase() + d.slice(1) + ' piece'
}

/**
 * Names the attribute values shared by a winning line.
 * `mask` holds the bits every piece agreed on, `value` the shared value.
 */
export function describeSharedAttributes(mask: number, value: number): string[] {
  const out: string[] = []
  for (const m of ATTRIBUTE_MASKS) {
    if (mask & m) out.push((value & m ? AXIS_NAMES[m].on : AXIS_NAMES[m].off))
  }
  return out
}

/**
 * Display order for the piece pool: grouped by tone, then shape, then height,
 * then top. Reads as a taxonomy in a 4-wide grid and in an 8-wide grid alike,
 * so remaining pieces stay easy to scan on any screen.
 */
export const POOL_ORDER: readonly PieceId[] = [...ALL_PIECES].sort((a, b) => {
  const key = (p: PieceId) =>
    (p & TONE ? 8 : 0) | (p & SHAPE ? 4 : 0) | (p & HEIGHT ? 2 : 0) | (p & TOP ? 1 : 0)
  return key(a) - key(b)
})
