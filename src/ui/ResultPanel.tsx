import { describeSharedAttributes, type Outcome } from '../game'

export interface ResultPanelProps {
  outcome: NonNullable<Outcome>
  onRematch: () => void
  onNewGame: () => void
}

/**
 * Who won is announced once, by the status line. What is left for the rail is
 * why it happened — the board has already lit the four pieces — and the two
 * ways out of the finished game.
 */
export function ResultPanel({ outcome, onRematch, onNewGame }: ResultPanelProps) {
  const shared = outcome.kind === 'win' ? describeSharedAttributes(outcome.line.mask, outcome.line.value) : []

  return (
    <section className="result">
      <p className="result__reason">
        {outcome.kind === 'win' ? (
          <>
            Four{' '}
            {shared.map((attribute, i) => (
              <span key={attribute}>
                {i > 0 && ' and '}
                <strong>{attribute}</strong>
              </span>
            ))}{' '}
            pieces in a line.
          </>
        ) : (
          'All sixteen pieces placed, and no line ever agreed.'
        )}
      </p>

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
