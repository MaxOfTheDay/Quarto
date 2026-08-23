import { forwardRef } from 'react'
import { type PieceId } from '../game'
import { PieceGlyph } from './PieceGlyph'

export interface HandTrayProps {
  /** The piece in play, or null while its owner is choosing the next one. */
  piece: PieceId | null
  /** The pool piece under the pointer or keyboard cursor, while choosing. */
  preview: PieceId | null
  /** Read out to assistive tech in place of the visual shelf. */
  description: string
  hidden: boolean
  /** True when the local player is the one who must place this piece. */
  armed: boolean
  /** True when the previewed piece would let the opponent win at once. */
  warn: boolean
}

/**
 * The piece in play, in a pocket of the same material the pool's pieces sit in,
 * which takes the accent when it is yours to act on.
 *
 * The hand and the pool are the two halves of a Quarto turn — place the piece
 * you were handed, then choose one from what is left — so they are drawn as a
 * matching pair with the board between them, in the order they happen.
 *
 * There is no such thing as an empty pocket here. Drawn empty it was a dark
 * bordered hole in the first place on the screen the eye reaches, on screen for
 * half of every game and saying nothing — the opening frame of a new game was a
 * hole, an empty board and a heading. So the pocket exists exactly when a piece
 * does: it folds away when the piece it was holding goes onto the board, and it
 * is simply there again, at once, when the next one arrives. Its presence is
 * the statement, and the sentence at the top of the screen is the other half of
 * it.
 *
 * Opening is deliberately not animated. The pocket is where a flying piece
 * lands, and a landing point that is still moving is a landing point the flight
 * measures wrong — so the width transition is declared on the folded state,
 * where it applies on the way in and not on the way out.
 */
export const HandTray = forwardRef<HTMLSpanElement, HandTrayProps>(function HandTray(
  { piece, preview, description, hidden, armed, warn },
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
      data-collapsed={shown === null ? 'true' : undefined}
      data-preview={previewing ? 'true' : undefined}
      data-warn={previewing && warn ? 'true' : undefined}
      data-away={away ? 'true' : undefined}
      aria-label={description}
    >
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
          /* Holds the flight's landing point while the pocket is folded away;
             draws nothing. */
          <span ref={ref} className="tray__anchor" aria-hidden="true" />
        )}
      </div>
    </section>
  )
})
