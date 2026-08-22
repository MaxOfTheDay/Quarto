import { useEffect, useRef, useState } from 'react'

export interface MenuProps {
  soundOn: boolean
  onToggleSound: () => void
  onRules: () => void
  onSettings: () => void
  onNewGame: () => void
  /** Hidden once the game is over, where the result panel owns the exits. */
  showNewGame: boolean
}

/** Speaker with waves, or speaker with a slash. The state is in the shape. */
function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" strokeLinejoin="round" />
      {on ? (
        <>
          <path d="M15 9.5a3.5 3.5 0 0 1 0 5" strokeLinecap="round" />
          <path d="M17.8 6.8a7 7 0 0 1 0 10.4" strokeLinecap="round" />
        </>
      ) : (
        <path d="m16 9.5 5 5m0-5-5 5" strokeLinecap="round" />
      )}
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5.5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="18.5" r="1.6" />
    </svg>
  )
}

/**
 * The controls a game needs once an hour, kept out of the way of the one it
 * needs every few seconds. On a wide screen they are simply buttons; on a phone
 * they collapse behind one, which is worth about forty pixels of board.
 */
export function Menu({
  soundOn,
  onToggleSound,
  onRules,
  onSettings,
  onNewGame,
  showNewGame,
}: MenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        root.current?.querySelector<HTMLElement>('.menu__trigger')?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const run = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  return (
    <>
      {/* Wide screens: the same actions, spelled out. */}
      <div className="topbar__wide">
        <button type="button" className="btn btn--quiet" onClick={onRules}>
          How to play
        </button>
        <button
          type="button"
          className="btn btn--quiet btn--icon"
          aria-label={soundOn ? 'Sound on' : 'Sound off'}
          aria-pressed={soundOn}
          title={soundOn ? 'Sound on' : 'Sound off'}
          onClick={onToggleSound}
        >
          <SoundIcon on={soundOn} />
        </button>
        <button type="button" className="btn btn--quiet" onClick={onSettings}>
          Settings
        </button>
        {showNewGame && (
          <button type="button" className="btn btn--quiet" onClick={onNewGame}>
            New game
          </button>
        )}
      </div>

      {/* Phones: one control, and the board keeps the height. */}
      <div className="menu topbar__narrow" ref={root}>
        <button
          type="button"
          className="btn btn--quiet btn--icon menu__trigger"
          aria-label="Menu"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
        >
          <MoreIcon />
        </button>
        {open && (
          <div className="menu__panel" role="menu">
            <button type="button" role="menuitem" className="menu__item" onClick={run(onRules)}>
              How to play
            </button>
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={soundOn}
              className="menu__item"
              onClick={run(onToggleSound)}
            >
              Sound
              <span className="menu__value">{soundOn ? 'On' : 'Off'}</span>
            </button>
            <button type="button" role="menuitem" className="menu__item" onClick={run(onSettings)}>
              Settings
            </button>
            {showNewGame && (
              <>
                <span className="menu__sep" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  className="menu__item"
                  onClick={run(onNewGame)}
                >
                  New game
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
