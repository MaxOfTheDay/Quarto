import { forwardRef } from 'react'
import { type PieceId } from '../game'
import { PieceGlyph } from './PieceGlyph'

export interface HandTrayProps {
  /** The piece in play, or null while its owner is choosing the next one. */
  piece: PieceId | null
  /** The pool piece under the pointer or keyboard cursor, while choosing. */
  preview: PieceId | null
  /** Whose piece it is, or who the next one is for. */
  label: string
  /** Read out to assistive tech in place of the visual shelf. */
  description: string
  hidden: boolean
  /** True when the local player is the one who must place this piece. */
  armed: boolean
  /** True when the previewed piece would let the opponent win at once. */
  warn: boolean
}

/**
 * The piece in play, in a section built exactly like the pool below it: a
 * heading that names what the surface is for and takes the accent when it is
 * yours to act on, over a pocket of the same material the pool's pieces sit in.
 *
 * The two sections are the two halves of a Quarto turn — place the piece you
 * were handed, then choose one from what is left — so they are drawn as a
 * matching pair with the board between them, in the order they happen. An empty
 * pocket here reads the way a spent pocket reads in the pool, which is also
 * exactly what it is: the place the piece chosen next will land.
 */
export const HandTray = forwardRef<HTMLSpanElement, HandTrayProps>(function HandTray(
  { piece, preview, label, description, hidden, armed, warn },
  ref,
) {
  const shown = piece ?? preview
  const previewing = piece === null && preview !== null
  /*
   * A piece on the shelf that is not yours to place. Handing one over and being
   * handed one used to look the same, which made giving a piece away read as
   * receiving one.
   */
  const away = piece !== null && !armed

  return (
    <section
      className="tray"
      data-armed={armed ? 'true' : undefined}
      data-empty={piece === null ? 'true' : undefined}
      data-preview={previewing ? 'true' : undefined}
      data-warn={previewing && warn ? 'true' : undefined}
      data-away={away ? 'true' : undefined}
      aria-label={description}
    >
      <div className="section__head">
        <p className="state-label" data-accent={armed ? 'true' : undefined}>
          {label}
        </p>
        {/* The one thing the drawing cannot say, in the place the count sits
            on the pool's own heading. */}
        {previewing && warn && <p className="state-label tray__warn">Wins for your opponent</p>}
      </div>

      <div className="tray__shelf">
        {shown !== null ? (
          <span
            ref={ref}
            className="tray__piece"
            data-ghost={previewing ? 'true' : undefined}
            data-hidden={hidden ? 'true' : undefined}
            /* A preview is one element changing its contents, not a new piece
               arriving — so it must not replay the arrival keyframes. */
            key={previewing ? 'preview' : `hand-${shown}`}
          >
            <PieceGlyph piece={shown} className="piece" />
          </span>
        ) : (
          <span ref={ref} className="tray__well" aria-hidden="true" />
        )}
      </div>
    </section>
  )
})
