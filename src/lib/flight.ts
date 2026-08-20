/**
 * Moves a piece between two places on screen by flying a clone of the
 * destination element along an arc. Used for the two moments that matter:
 * handing a piece to your opponent, and setting it on the board.
 */

export interface FlightOptions {
  duration?: number
  /** Peak of the arc, in pixels. */
  lift?: number
  easing?: string
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  if (document.documentElement.dataset.motion === 'reduced') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function flyClone(
  from: DOMRect,
  target: HTMLElement,
  { duration = 320, lift = 26, easing = 'cubic-bezier(0.3, 0.72, 0.28, 1)' }: FlightOptions = {},
): Promise<void> {
  if (prefersReducedMotion() || typeof target.animate !== 'function') return Promise.resolve()

  const to = target.getBoundingClientRect()
  if (!from.width || !to.width) return Promise.resolve()

  const clone = target.cloneNode(true) as HTMLElement
  clone.setAttribute('aria-hidden', 'true')
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: '0',
    zIndex: '90',
    pointerEvents: 'none',
    transformOrigin: 'top left',
    opacity: '1',
    visibility: 'visible',
  } satisfies Partial<CSSStyleDeclaration>)
  document.body.appendChild(clone)

  const dx = to.left - from.left
  const dy = to.top - from.top
  const sx = to.width / from.width
  const sy = to.height / from.height

  const animation = clone.animate(
    [
      { transform: 'translate(0px, 0px) scale(1, 1)' },
      {
        offset: 0.5,
        transform: `translate(${dx / 2}px, ${dy / 2 - lift}px) scale(${(1 + sx) / 2}, ${(1 + sy) / 2})`,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
    ],
    { duration, easing, fill: 'forwards' },
  )

  return animation.finished
    .catch(() => undefined)
    .then(() => {
      clone.remove()
    })
}
