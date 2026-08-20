import { HEIGHT, SHAPE, TONE, TOP } from '../game'
import type { Difficulty } from '../game/ai'
import type { Mode, Opener, Prefs } from '../lib/prefs'
import { PieceGlyph } from './PieceGlyph'

export interface SetupProps {
  prefs: Prefs
  onChange: (patch: Partial<Prefs>) => void
  onStart: () => void
  onRules: () => void
  /** Only offered once a game exists to go back to. */
  onDismiss?: () => void
}

interface Choice<T> {
  value: T
  label: string
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Choice<T>[]
  onChange: (value: T) => void
}) {
  return (
    <div className="field">
      <span className="eyebrow field__label" id={`field-${label}`}>
        {label}
      </span>
      <div className="segmented" role="radiogroup" aria-labelledby={`field-${label}`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className="segmented__option"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Setup({ prefs, onChange, onStart, onRules, onDismiss }: SetupProps) {
  const vsComputer = prefs.mode === 'computer'

  const openerOptions: Choice<Opener>[] = vsComputer
    ? [
        { value: 'p1', label: 'You' },
        { value: 'p2', label: 'Computer' },
        { value: 'random', label: 'Random' },
      ]
    : [
        { value: 'p1', label: 'Player 1' },
        { value: 'p2', label: 'Player 2' },
        { value: 'random', label: 'Random' },
      ]

  return (
    <div className="setup">
      <div className="setup__inner">
        <header className="setup__head">
          <h1 className="setup__title">Quarto</h1>
          <p className="setup__tagline">Sixteen pieces. Four attributes. One shared line.</p>
        </header>

        {!prefs.seenIntro && (
          <section className="primer" aria-label="How Quarto works">
            <ol className="primer__list">
              <li>
                <span className="primer__num">1</span>
                <span>
                  Your opponent chooses the piece you place — and then you choose theirs.
                </span>
              </li>
              <li>
                <span className="primer__num">2</span>
                <span>
                  Four in a line sharing any one attribute wins, whoever placed them.
                </span>
              </li>
            </ol>
            <div className="primer__pieces" aria-hidden="true">
              {[0, HEIGHT, TONE | SHAPE, HEIGHT | TONE | TOP].map((p) => (
                <PieceGlyph key={p} piece={p} className="piece" />
              ))}
            </div>
          </section>
        )}

        <div className="setup__fields">
          <Segmented<Mode>
            label="Players"
            value={prefs.mode}
            onChange={(mode) => onChange({ mode })}
            options={[
              { value: 'local', label: 'Two players' },
              { value: 'computer', label: 'Vs computer' },
            ]}
          />

          {vsComputer && (
            <Segmented<Difficulty>
              label="Difficulty"
              value={prefs.difficulty}
              onChange={(difficulty) => onChange({ difficulty })}
              options={[
                { value: 'easy', label: 'Easy' },
                { value: 'medium', label: 'Medium' },
                { value: 'hard', label: 'Hard' },
              ]}
            />
          )}

          <Segmented<Opener>
            label="Who chooses first"
            value={prefs.opener}
            onChange={(opener) => onChange({ opener })}
            options={openerOptions}
          />
        </div>

        <footer className="setup__foot">
          <button type="button" className="btn btn--primary" onClick={onStart}>
            Begin
          </button>
          <div className="setup__links">
            <button type="button" className="link" onClick={onRules}>
              Full rules
            </button>
            {onDismiss && (
              <button type="button" className="link" onClick={onDismiss}>
                Back to game
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
