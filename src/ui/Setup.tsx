import { useId, useRef, useState } from 'react'
import type { Difficulty } from '../game/ai'
import type { Mode, Opener, Prefs } from '../lib/prefs'
import type { SavedGame } from '../lib/save'
import { describeSaved } from '../lib/save'
import { QuartoDemo } from './RulesSheet'

export interface SetupProps {
  prefs: Prefs
  onChange: (patch: Partial<Prefs>) => void
  onStart: () => void
  onRules: () => void
  /** A game in progress, if one was left behind. */
  saved: SavedGame | null
  onResume: () => void
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
  hint,
  onChange,
}: {
  label: string
  value: T
  options: Choice<T>[]
  hint?: string
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
      <div className="field__control">
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
        {hint && <p className="field__hint">{hint}</p>}
      </div>
    </div>
  )
}

/**
 * The one genuinely counter-intuitive setting in the game: whoever goes first
 * hands a piece over, they do not place one. Saying which side then places is
 * the whole point of the line.
 */
function openerHint(opener: Opener, vsComputer: boolean): string {
  if (opener === 'random') return 'Decided when the game starts.'
  if (vsComputer) {
    return opener === 'p1'
      ? 'You pick the opening piece; the computer places it.'
      : 'The computer picks the opening piece; you place it.'
  }
  return opener === 'p1'
    ? 'Player 1 picks the opening piece; Player 2 places it.'
    : 'Player 2 picks the opening piece; Player 1 places it.'
}

/** What each computer actually does, in its own words. */
const DIFFICULTY_HINT: Record<Difficulty, string> = {
  easy: 'Never looks ahead. Misses about a third of its wins.',
  medium: 'Looks two turns ahead.',
  hard: 'Searches until its time runs out. Rarely loses.',
}

export function Setup({
  prefs,
  onChange,
  onStart,
  onRules,
  saved,
  onResume,
  onInstall,
  onDismiss,
}: SetupProps) {
  const vsComputer = prefs.mode === 'computer'
  /* A stored game is the answer to "what now?", so the choices behind it stay
     folded away until they are actually wanted. */
  const [showFields, setShowFields] = useState(saved === null)

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
          hint={DIFFICULTY_HINT[prefs.difficulty]}
          onChange={(difficulty) => onChange({ difficulty })}
          options={[
            { value: 'easy', label: 'Easy' },
            { value: 'medium', label: 'Medium' },
            { value: 'hard', label: 'Hard' },
          ]}
        />
      )}

      <Segmented<Opener>
        label="Hands over first"
        value={prefs.opener}
        hint={openerHint(prefs.opener, vsComputer)}
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
          <p className="setup__tagline">Sixteen pieces. Four attributes. One shared line.</p>
        </header>

        {!prefs.seenIntro && (
          <section className="primer" aria-label="How Quarto works">
            <ol className="primer__list">
              <li>
                <span className="primer__num">1</span>
                <span>Your opponent chooses the piece you place — then you choose theirs.</span>
              </li>
              <li>
                <span className="primer__num">2</span>
                <span>Four in a line sharing any one attribute wins, whoever placed them.</span>
              </li>
            </ol>
            <QuartoDemo />
          </section>
        )}

        {saved && (
          <section className="resume" aria-label="Game in progress">
            <div className="resume__text">
              <p className="state-label" data-accent="true">
                Game in progress
              </p>
              <p className="resume__detail">{describeSaved(saved)}</p>
            </div>
            <button type="button" className="btn btn--primary btn--lg" onClick={onResume}>
              Resume game
            </button>
          </section>
        )}

        {saved && !showFields ? (
          <div className="setup__more">
            <button type="button" className="link" onClick={() => setShowFields(true)}>
              Start something else
            </button>
          </div>
        ) : (
          fields
        )}

        <footer className="setup__foot" data-quiet={saved && !showFields ? 'true' : undefined}>
          {(!saved || showFields) && (
            <button
              type="button"
              className={`btn btn--lg${saved ? '' : ' btn--primary'}`}
              onClick={onStart}
            >
              {saved ? 'Start new game' : 'Begin'}
            </button>
          )}
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

        <p className="setup__offline">Plays offline. Nothing is sent anywhere.</p>
      </div>
    </div>
  )
}
