import { HEIGHT, SHAPE, TONE, TOP } from '../game'
import { Modal } from './Modal'
import { PieceGlyph } from './PieceGlyph'

/**
 * Each pair changes exactly one attribute from the same tall, light, round,
 * solid piece — which is what makes the difference readable at this size. The
 * values are the vocabulary the rest of the game uses; the axis they sit on
 * has no name anywhere else, so it does not get one here either.
 */
const AXES = [
  { key: 'height', a: 0, b: HEIGHT, note: 'short / tall' },
  { key: 'tone', a: HEIGHT, b: HEIGHT | TONE, note: 'light / dark' },
  { key: 'shape', a: HEIGHT, b: HEIGHT | SHAPE, note: 'round / square' },
  { key: 'top', a: HEIGHT, b: HEIGHT | TOP, note: 'solid / hollow' },
]

const SHORTCUTS = [
  ['Arrow keys', 'Move between cells or pieces'],
  ['Enter / Space', 'Place or choose'],
  ['U', 'Undo'],
  ['N', 'New game'],
  ['M', 'Mute'],
  ['?', 'How to play'],
]

export interface RulesSheetProps {
  onClose: () => void
}

/**
 * The four pieces that share one attribute — the game in a single picture.
 *
 * They share tone, and differ in every other way. Hollow was the wrong choice
 * for the shared one: it is a small dark hole in the top face, which is the
 * least visible attribute at this size, so the picture asked the reader to take
 * its caption on trust. Light against dark is the one nobody can miss.
 */
const DEMO = [
  TONE, // short round solid
  TONE | HEIGHT | TOP, // tall round hollow
  TONE | HEIGHT | SHAPE, // tall square solid
  TONE | SHAPE | TOP, // short square hollow
]

function QuartoDemo() {
  return (
    <div className="demo" aria-label="Four different pieces that are all dark">
      {DEMO.map((p, i) => (
        <span className="demo__cell" key={i}>
          <PieceGlyph piece={p} className="piece" />
        </span>
      ))}
      <p className="demo__note">All four are dark — that is a Quarto.</p>
    </div>
  )
}

export function RulesSheet({ onClose }: RulesSheetProps) {
  return (
    <Modal title="How to play" onClose={onClose} variant="rules">
      <section className="rule">
        <p className="eyebrow">The turn</p>
        <p className="rule__lead">
          Your opponent picks the piece you place. You pick theirs — you never choose your own.
        </p>
      </section>

      <section className="rule">
        <p className="eyebrow">Winning</p>
        <p className="rule__lead">
          Four in a row — across, down or diagonally — sharing any one attribute wins. It does not
          matter who placed them.
        </p>
        <QuartoDemo />
      </section>

      <section className="rule">
        <p className="eyebrow">The pieces</p>
        <ul className="axes">
          {AXES.map((axis) => (
            <li className="axis" key={axis.key}>
              <span className="axis__pair" aria-hidden="true">
                <PieceGlyph piece={axis.a} className="piece" />
                <PieceGlyph piece={axis.b} className="piece" />
              </span>
              <span className="axis__note">{axis.note}</span>
            </li>
          ))}
        </ul>
        <p className="rule__aside">
          Sixteen pieces, one for every combination. No piece belongs to either player.
        </p>
      </section>

      <section className="rule keys-section">
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
    </Modal>
  )
}
