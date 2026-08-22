import type { Prefs, Theme } from '../lib/prefs'
import { Modal } from './Modal'

export interface SettingsSheetProps {
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

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/**
 * Everything the player can change, in one place they can find. It used to sit
 * in the middle of the rules, which is a fine place to explain the game and a
 * poor place to look for a volume control.
 */
export function SettingsSheet({ prefs, onChange, onClose }: SettingsSheetProps) {
  return (
    <Modal title="Settings" onClose={onClose} variant="settings">
      <section className="rule">
        <p className="eyebrow">Appearance</p>
        <div className="field field--stack">
          {/* "Appearance" above and "Theme" below it said the same thing twice;
              the group still needs a name, so it keeps one for screen readers. */}
          <span className="visually-hidden" id="theme-label">
            Theme
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="theme-label">
            {THEMES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={prefs.theme === option.value}
                tabIndex={prefs.theme === option.value ? 0 : -1}
                className="segmented__option"
                onClick={() => onChange({ theme: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rule">
        <p className="eyebrow">Play</p>
        <div className="toggles">
          <Toggle
            label="Show what is at stake"
            hint="Marks where you can win, and which pieces win for your opponent"
            on={prefs.coach}
            onToggle={() => onChange({ coach: !prefs.coach, coachSet: true })}
          />
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
        <p className="rule__aside">
          Marks are never shown against Hard.
        </p>
      </section>
    </Modal>
  )
}
