import { useId, useRef } from 'react'
import type { Difficulty } from '../game/ai'
import type { Mode, Opener, Prefs } from '../lib/prefs'
import { QuartoDemo } from './RulesSheet'

export interface SetupProps {
  prefs: Prefs
  onChange: (patch: Partial<Prefs>) => void
  onStart: () => void
  onRules: () => void
  /** Offered only while the browser is holding an install prompt for us. */
  onInstall?: () => void
  /** Only offered once a game exists to go back to. */
  onDismiss?: () => void
}

interface Choice<T> {
  value: T
  label: string
}

/**
 * A radio group that behaves like one: arrow keys move the selection, and only
 * the chosen option is a tab stop, so the whole group is a single step through
 * the form rather than three.
 */
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
  const id = useId()
  const groupRef = useRef<HTMLDivElement>(null)

  const moveTo = (index: number) => {
    const next = options[(index + options.length) % options.length]
    onChange(next.value)
    groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[
      (index + options.length) % options.length
    ]?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step =
      event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? -1
        : event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : 0
    if (step === 0) return
    event.preventDefault()
    moveTo(index + step)
  }

  return (
    <div className="field">
      <span className="eyebrow field__label" id={id}>
        {label}
      </span>
      <div className="segmented" role="radiogroup" aria-labelledby={id} ref={groupRef}>
        {options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            tabIndex={value === option.value ? 0 : -1}
            className="segmented__option"
            onKeyDown={(e) => onKeyDown(e, index)}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Setup({
  prefs,
  onChange,
  onStart,
  onRules,
  onInstall,
  onDismiss,
}: SetupProps) {
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

  const fields = (
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

      {/* Named so it explains itself: "Picks first piece — You" needs no line
          of help underneath it the way "Hands over first" did. */}
      <Segmented<Opener>
        label="Picks first piece"
        value={prefs.opener}
        onChange={(opener) => onChange({ opener })}
        options={openerOptions}
      />
    </div>
  )

  return (
    <div className="setup">
      <div className="setup__inner">
        <header className="setup__head">
          <h1 className="setup__title">Quarto</h1>
        </header>

        {/*
          * One sentence and one picture. The screen used to say the win
          * condition three times over — a tagline, a numbered rule and the
          * picture's own caption — and state the split turn twice. The
          * sentence is the half nobody guesses; the picture is the half no
          * sentence explains as well.
          */}
        {!prefs.seenIntro && (
          <section className="primer" aria-label="How Quarto works">
            <p className="primer__lead">
              Your opponent picks the piece you place. You pick theirs.
            </p>
            <QuartoDemo />
          </section>
        )}

        {fields}

        <footer className="setup__foot">
          <button type="button" className="btn btn--primary btn--lg" onClick={onStart}>
            Begin
          </button>
          <div className="setup__links">
            <button type="button" className="link" onClick={onRules}>
              How to play
            </button>
            {onInstall && (
              <button type="button" className="link" onClick={onInstall}>
                Install app
              </button>
            )}
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
