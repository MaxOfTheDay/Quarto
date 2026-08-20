import { useEffect, useRef, useState } from 'react'
import { POOL_ORDER, pieceLabel, type PieceId } from '../game'
import { useMediaQuery } from '../lib/useMediaQuery'
import { PieceGlyph } from './PieceGlyph'

/** Must match the pool's grid in rail.css, or arrow keys move the wrong way. */
const WIDE_COLUMNS = '(max-width: 900px) and (min-height: 561px), (max-width: 619px)'

export interface PoolProps {
  /** Pieces still available to hand over. */
  pool: readonly PieceId[]
  /** True while the local player is choosing their opponent's piece. */
  selecting: boolean
  onSelect: (piece: PieceId) => void
  slotRef: (piece: PieceId, el: HTMLElement | null) => void
}

/**
 * The pool mirrors the board: a 4×4 grid whose rows are the four families
 * (light round, light square, dark round, dark square). It drains as the
 * board fills, so what is left is legible at a glance.
 */
export function Pool({ pool, selecting, onSelect, slotRef }: PoolProps) {
  const [cursor, setCursor] = useState(POOL_ORDER[0])
  const gridRef = useRef<HTMLDivElement>(null)
  const columns = useMediaQuery(WIDE_COLUMNS) ? 8 : 4

  useEffect(() => {
    if (!selecting || pool.includes(cursor)) return
    if (pool.length > 0) setCursor(POOL_ORDER.find((p) => pool.includes(p)) ?? pool[0])
  }, [selecting, pool, cursor])

  const focusAt = (index: number) => {
    const clamped = Math.min(POOL_ORDER.length - 1, Math.max(0, index))
    const piece = POOL_ORDER[clamped]
    setCursor(piece)
    gridRef.current?.querySelector<HTMLElement>(`[data-piece="${piece}"]`)?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent, piece: PieceId) => {
    const index = POOL_ORDER.indexOf(piece)
    const deltas: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -columns,
      ArrowDown: columns,
    }
    const delta = deltas[event.key]
    if (delta === undefined) return
    event.preventDefault()
    focusAt(index + delta)
  }

  return (
    <div
      ref={gridRef}
      className="pool"
      data-active={selecting ? 'true' : undefined}
      role="group"
      aria-label="Remaining pieces"
    >
      {POOL_ORDER.map((piece) => {
        const available = pool.includes(piece)
        const enabled = selecting && available

        return (
          <button
            key={piece}
            type="button"
            data-piece={piece}
            className="slot"
            data-state={available ? 'available' : 'spent'}
            disabled={!enabled}
            tabIndex={piece === cursor ? 0 : -1}
            onFocus={() => setCursor(piece)}
            onKeyDown={(e) => onKeyDown(e, piece)}
            onClick={() => enabled && onSelect(piece)}
            aria-label={available ? pieceLabel(piece) : `${pieceLabel(piece)}, already played`}
            title={available ? pieceLabel(piece) : undefined}
          >
            <span className="slot__well" aria-hidden="true" />
            {available && (
              <span ref={(el) => slotRef(piece, el)} className="slot__piece">
                <PieceGlyph piece={piece} className="piece" crop />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
