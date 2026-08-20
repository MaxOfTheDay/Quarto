import { describeSharedAttributes, type Board, type Outcome } from '../game'
import { PieceGlyph } from './PieceGlyph'

export interface ResultPanelProps {
  outcome: NonNullable<Outcome>
  board: Board
  names: [string, string]
  onRematch: () => void
  onNewGame: () => void
}

export function ResultPanel({ outcome, board, names, onRematch, onNewGame }: ResultPanelProps) {
  const win = outcome.kind === 'win' ? outcome : null
  const shared = win ? describeSharedAttributes(win.line.mask, win.line.value) : []

  return (
    <section className="result" aria-live="assertive">
      <p className="eyebrow result__eyebrow">{win ? 'Quarto' : 'No Quarto'}</p>
      <h2 className="result__headline">{win ? `${names[win.player]} wins` : 'Draw'}</h2>

      {win ? (
        <>
          <p className="result__reason">
            Four{' '}
            {shared.map((attribute, i) => (
              <span key={attribute}>
                {i > 0 && ' and '}
                <strong>{attribute}</strong>
              </span>
            ))}{' '}
            pieces in a line.
          </p>
          <div className="result__line" aria-hidden="true">
            {win.line.cells.map((cell) => (
              <span className="result__piece" key={cell}>
                <PieceGlyph piece={board[cell]!} className="piece" />
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="result__reason">All sixteen pieces placed, no line ever agreed.</p>
      )}

      <div className="result__actions">
        <button type="button" className="btn btn--primary" onClick={onRematch}>
          Rematch
        </button>
        <button type="button" className="btn" onClick={onNewGame}>
          New game
        </button>
      </div>
    </section>
  )
}
