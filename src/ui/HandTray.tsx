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
  /** Shown on the shelf while choosing and nothing is under the pointer. */
  prompt: string
  /** Read out to assistive tech in place of the visual shelf. */
  description: string
  hidden: boolean
  /** True when the local player is the one who must place this piece. */
  armed: boolean
  /** True when the previewed piece would let the opponent win at once. */
  warn: boolean
}

/**
 * The piece in play, set on its own shelf so it never reads as part of the
 * pool. Its four attributes are spelled out underneath — the one place in the
 * game where naming them matters, and the reason tone never has to carry
 * meaning on its own.
 *
 * The shelf keeps its size in both phases, which is what stops the board and
 * the pool shifting on every half-move. While its owner is choosing, that
 * reserved space shows the piece they are considering rather than an empty
 * socket: it is the same shelf the chosen piece flies to, so the preview is
 * literally a picture of what is about to happen.
 */
export const HandTray = forwardRef<HTMLSpanElement, HandTrayProps>(function HandTray(
  { piece, preview, label, prompt, description, hidden, armed, warn },
  ref,
) {
  const shown = piece ?? preview
  const previewing = piece === null && preview !== null
  /*
   * A piece on the shelf that is not yours to place. Handing one over and being
   * handed one used to look the same — the same arc, the same shelf, the same
   * four attributes spelled out — which made giving a piece away read as
   * receiving one. The attributes are a study aid for the piece you are about
   * to place; on a piece that has just left your hands they are noise, and the
   * shelf says whose it is instead.
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
      <p className="state-label tray__label" data-accent={armed ? 'true' : undefined}>
        {label}
      </p>

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
          <span ref={ref} className="tray__prompt">
            {prompt}
          </span>
        )}
      </div>

      {/*
        * Says only what the drawing cannot. The four attributes used to be
        * spelled out here every turn, which restated what the piece already
        * shows — tall against short, bone against steel, round against square,
        * a hole in the top or not — in the busiest line of the row. It was
        * `aria-hidden` besides, so it never reached a screen reader; the live
        * region names the piece in full and still does. What is left is the
        * two things the drawing genuinely cannot say: whose piece it is, and
        * that handing this one over loses the game. The line keeps its height
        * either way, so the row does not move when it speaks.
        */}
      <p className="tray__attrs" aria-hidden="true">
        {previewing && warn ? (
          <span className="tray__attrs-warn">Wins for your opponent</span>
        ) : away ? (
          <span className="tray__owner">{label}</span>
        ) : null}
      </p>
    </section>
  )
})
