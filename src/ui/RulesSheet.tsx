import { HEIGHT, SHAPE, TONE, TOP } from '../game'
import type { Prefs } from '../lib/prefs'
import { Modal } from './Modal'
import { PieceGlyph } from './PieceGlyph'

/**
 * Each pair changes exactly one attribute from the same tall, light, round,
 * solid piece — which is what makes the difference readable at this size.
 */
const AXES = [
  { label: 'Height', a: 0, b: HEIGHT, note: 'short / tall' },
  { label: 'Tone', a: HEIGHT, b: HEIGHT | TONE, note: 'light / dark' },
  { label: 'Shape', a: HEIGHT, b: HEIGHT | SHAPE, note: 'round / square' },
  { label: 'Top', a: HEIGHT, b: HEIGHT | TOP, note: 'solid / hollow' },
]

const SHORTCUTS = [
  ['Arrow keys', 'Move between cells or pieces'],
  ['Enter / Space', 'Place or choose'],
  ['U', 'Undo'],
  ['N', 'New game'],
  ['M', 'Mute'],
  ['?', 'These rules'],
]

export interface RulesSheetProps {
  prefs: Prefs
  onChange: (patch: Partial<Prefs>) => void
  onClose: () => void
}

function Toggle({
  label,
  hint,
  on,
  onToggle,
}: {
  label: string
  hint: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <button type="button" className="toggle" role="switch" aria-checked={on} onClick={onToggle}>
      <span className="toggle__text">
        <span className="toggle__label">{label}</span>
        <span className="toggle__hint">{hint}</span>
      </span>
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__knob" />
      </span>
      <span className="toggle__state" aria-hidden="true">
        {on ? 'On' : 'Off'}
      </span>
    </button>
  )
}

export function RulesSheet({ prefs, onChange, onClose }: RulesSheetProps) {
  return (
    <Modal title="How to play" onClose={onClose} variant="rules">
      <header className="sheet__head">
        <h2 className="sheet__title">How to play</h2>
        <button type="button" className="btn btn--quiet sheet__close" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="sheet__body">
        <section className="rule">
          <p className="eyebrow">The turn</p>
          <p className="rule__lead">
            You never choose your own piece. Your opponent chooses it for you, you place it, then
            you choose theirs.
          </p>
        </section>

        <section className="rule">
          <p className="eyebrow">Winning</p>
          <p className="rule__lead">
            Four in a row — across, down or diagonally — sharing any one attribute wins. It does not
            matter who placed them.
          </p>
          <div
            className="rule__demo"
            aria-label="Four different pieces that all share one attribute: hollow"
          >
            {[TOP, TOP | HEIGHT, TOP | TONE | SHAPE, TOP | SHAPE].map((p, i) => (
              <span className="rule__demo-cell" key={i}>
                <PieceGlyph piece={p} className="piece" />
              </span>
            ))}
            <p className="rule__demo-note">All four are hollow — that is a Quarto.</p>
          </div>
        </section>

        <section className="rule">
          <p className="eyebrow">The pieces</p>
          <ul className="axes">
            {AXES.map((axis) => (
              <li className="axis" key={axis.label}>
                <span className="axis__pair" aria-hidden="true">
                  <PieceGlyph piece={axis.a} className="piece" />
                  <PieceGlyph piece={axis.b} className="piece" />
                </span>
                <span className="axis__text">
                  <span className="axis__name">{axis.label}</span>
                  <span className="axis__note">{axis.note}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="rule__aside">
            Sixteen pieces, one for every combination. No piece belongs to either player.
          </p>
        </section>

        <section className="rule">
          <p className="eyebrow">Settings</p>
          <div className="toggles">
            <Toggle
              label="Sound"
              hint="Placing, choosing and the win"
              on={prefs.sound}
              onToggle={() => onChange({ sound: !prefs.sound })}
            />
            <Toggle
              label="Reduced motion"
              hint="Removes animation and transitions"
              on={prefs.reducedEffects}
              onToggle={() => onChange({ reducedEffects: !prefs.reducedEffects })}
            />
          </div>
        </section>

        <section className="rule">
          <p className="eyebrow">Keyboard</p>
          <dl className="keys">
            {SHORTCUTS.map(([key, what]) => (
              <div className="keys__row" key={key}>
                <dt>
                  <kbd>{key}</kbd>
                </dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </Modal>
  )
}
