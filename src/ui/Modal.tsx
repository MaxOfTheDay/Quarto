import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

export interface ModalProps {
  /**
   * The dialog's title. Rendered as its heading and used as its accessible
   * name, so there is one string rather than a prop and a duplicate `<h2>`.
   */
  title: string
  onClose: () => void
  children: ReactNode
  /** Extra class for width and rhythm variations. */
  variant?: string
  /** Right-aligned buttons pinned under the body. */
  actions?: ReactNode
  /** Hidden when the dialog's only exits are its own actions. */
  closeLabel?: string | null
}

/**
 * A focus-trapping dialog: Escape closes, Tab cycles, focus returns on close.
 * Every dialog in the game has the same anatomy — a head that stays put while
 * the body scrolls, and an action row beneath it — so no two of them can drift
 * into slightly different shapes.
 */
export function Modal({
  title,
  onClose,
  children,
  variant,
  actions,
  closeLabel = 'Close',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)
  const titleId = useId()

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      )
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [onClose],
  )

  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null
    document.addEventListener('keydown', onKeyDown)
    const target = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current
    target?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      restoreTo.current?.focus?.()
    }
  }, [onKeyDown])

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        className={`sheet${variant ? ` sheet--${variant}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="sheet__head">
          <h2 className="sheet__title" id={titleId}>
            {title}
          </h2>
          {closeLabel && (
            <button type="button" className="btn btn--quiet sheet__close" onClick={onClose}>
              {closeLabel}
            </button>
          )}
        </header>

        <div className="sheet__body">{children}</div>

        {actions && <div className="sheet__actions">{actions}</div>}
      </div>
    </div>
  )
}
