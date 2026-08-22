import { describeSharedAttributes, type Outcome } from '../game'
import type { Session } from '../lib/save'

export interface ResultPanelProps {
  outcome: NonNullable<Outcome>
  session: Session
  onRematch: () => void
  onNewGame: () => void
}

/**
 * Who won is announced once, by the status line. What is left for the rail is
 * why it happened — the board has already lit the four pieces — the score so
 * far, and the two ways out of the finished game.
 */
export function ResultPanel({ outcome, session, onRematch, onNewGame }: ResultPanelProps) {
  const shared =
    outcome.kind === 'win' ? describeSharedAttributes(outcome.line.mask, outcome.line.value) : []
  const [w0, w1, draws] = session.tally
  const played = w0 + w1 + draws

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

      {/* A second game is a series, and a series wants a score. */}
      {played > 1 && (
        <dl className="tally" aria-label="Games won">
          <div className="tally__side">
            <dt>{session.names[0]}</dt>
            <dd>{w0}</dd>
          </div>
          <div className="tally__side">
            <dt>{session.names[1]}</dt>
            <dd>{w1}</dd>
          </div>
          {draws > 0 && (
            <div className="tally__side">
              <dt>Drawn</dt>
              <dd>{draws}</dd>
            </div>
          )}
        </dl>
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
