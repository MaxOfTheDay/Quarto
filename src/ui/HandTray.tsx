import { forwardRef } from 'react'
import { describePiece, type PieceId } from '../game'
import { PieceGlyph } from './PieceGlyph'

export interface HandTrayProps {
  piece: PieceId | null
  label: string
  /** Read out to assistive tech in place of the visual shelf. */
  description: string
  hidden: boolean
  /** True when the local player is the one who must place this piece. */
  armed: boolean
}

/**
 * The piece your opponent handed you, set on its own shelf so it never reads as
 * part of the pool. Its four attributes are spelled out underneath — the one
 * place in the game where naming them matters, and the reason tone never has to
 * carry meaning on its own.
 */
export const HandTray = forwardRef<HTMLSpanElement, HandTrayProps>(function HandTray(
  { piece, label, description, hidden, armed },
  ref,
) {
  const attributes = piece === null ? [] : describePiece(piece).split(' ')

  return (
    <section className="tray" data-armed={armed ? 'true' : undefined} aria-label={description}>
      <p className="eyebrow tray__label" data-accent={armed ? 'true' : undefined}>
        {label}
      </p>

      <div className="tray__shelf">
        {piece !== null ? (
          <span ref={ref} className="tray__piece" data-hidden={hidden ? 'true' : undefined} key={piece}>
            <PieceGlyph piece={piece} className="piece" />
          </span>
        ) : (
          <span className="tray__socket" aria-hidden="true" />
        )}
      </div>

      <p className="tray__attrs" aria-hidden="true">
        {attributes.length > 0
          ? attributes.map((attribute) => <span key={attribute}>{attribute}</span>)
          : <span className="tray__attrs-empty">waiting</span>}
      </p>
    </section>
  )
})
