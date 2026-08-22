import { useEffect, useRef, useState } from 'react'
import { POOL_ORDER, pieceLabel, type PieceId } from '../game'
import { useMediaQuery } from '../lib/useMediaQuery'
import { PieceGlyph } from './PieceGlyph'

/**
 * Must match the pool's grid in rail.css, or arrow keys move the wrong way.
 * Eight across wherever height is the scarce dimension: upright phones and
 * small tablets, anything turned sideways, and a desktop window too short for
 * the rail to hold four rows.
 */
const WIDE_COLUMNS =
  '(max-width: 900px) and (min-height: 561px), (max-width: 619px), (max-height: 560px) and (min-width: 620px), (max-height: 700px) and (min-width: 901px)'

export interface PoolProps {
  /** Pieces still available to hand over. */
  pool: readonly PieceId[]
  /** True while the local player is choosing their opponent's piece. */
  selecting: boolean
  /** Pieces that would let the opponent win at once. Empty unless coaching. */
  hot: readonly PieceId[]
  onSelect: (piece: PieceId) => void
  /** The piece under the pointer or the keyboard cursor, for the shelf preview. */
  onPreview: (piece: PieceId | null) => void
  /** Called when a piece is acted on while the pool is not the live surface. */
  onRefuse?: () => void
  slotRef: (piece: PieceId, el: HTMLElement | null) => void
}

/**
 * The pool mirrors the board: a 4×4 grid whose rows are the four families
 * (light round, light square, dark round, dark square), resting on a tray of
 * its own so it reads as a surface rather than a list. It drains as the board
 * fills, so what is left is legible at a glance.
 */
export function Pool({ pool, selecting, hot, onSelect, onPreview, onRefuse, slotRef }: PoolProps) {
  const [cursor, setCursor] = useState(POOL_ORDER[0])
  const gridRef = useRef<HTMLDivElement>(null)
  const columns = useMediaQuery(WIDE_COLUMNS) ? 8 : 4

  useEffect(() => {
    if (!selecting || pool.includes(cursor)) return
    if (pool.length > 0) setCursor(POOL_ORDER.find((p) => pool.includes(p)) ?? pool[0])
  }, [selecting, pool, cursor])

  useEffect(() => {
    if (!selecting) onPreview(null)
  }, [selecting, onPreview])

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
      onPointerLeave={() => onPreview(null)}
    >
      {POOL_ORDER.map((piece) => {
        const available = pool.includes(piece)
        const enabled = selecting && available
        const risky = enabled && hot.includes(piece)

        return (
          <button
            key={piece}
            type="button"
            data-piece={piece}
            className="slot"
            data-state={available ? 'available' : 'spent'}
            /*
             * `aria-disabled`, not `disabled`: which pieces are left is exactly
             * what a player reads while planning, including in the half of the
             * turn when the pool cannot be acted on. Withdrawing the tab stop
             * still keeps keyboard focus on the live surface only.
             */
            aria-disabled={enabled ? undefined : 'true'}
            tabIndex={selecting && piece === cursor ? 0 : -1}
            /*
             * The shelf preview is a hover affordance, and a touch screen has
             * no hover: a tap fires pointerenter and focus on its way to the
             * click, so the piece flashed onto the shelf for a frame and then
             * flew there anyway. Only a real mouse, or keyboard focus, asks for
             * a preview — a finger goes straight to the move.
             */
            onFocus={(e) => {
              setCursor(piece)
              if (enabled && e.currentTarget.matches(':focus-visible')) onPreview(piece)
            }}
            onBlur={() => onPreview(null)}
            onKeyDown={(e) => onKeyDown(e, piece)}
            onPointerEnter={(e) => enabled && e.pointerType === 'mouse' && onPreview(piece)}
            onClick={() => (enabled ? onSelect(piece) : onRefuse?.())}
            aria-label={
              available
                ? `${pieceLabel(piece)}${risky ? ', wins for your opponent' : ''}`
                : `${pieceLabel(piece)}, already played`
            }
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
