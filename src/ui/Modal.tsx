import { useCallback, useEffect, useRef, type ReactNode } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

export interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** Extra class for width and rhythm variations. */
  variant?: string
}

/** A focus-trapping dialog: Escape closes, Tab cycles, focus returns on close. */
export function Modal({ title, onClose, children, variant }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

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
        aria-label={title}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  )
}
