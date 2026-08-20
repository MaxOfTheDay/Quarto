import { useCallback, useSyncExternalStore } from 'react'

/**
 * Install prompt and service-worker update handling.
 *
 * The listeners are attached when this module is imported rather than from a
 * component: `beforeinstallprompt` can fire before React has mounted, and an
 * install prompt that is missed cannot be recovered.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PwaSnapshot {
  /** The browser has offered an install prompt we are holding. */
  canInstall: boolean
  /** A newer build is precached and waiting to take over. */
  updateReady: boolean
}

let snapshot: PwaSnapshot = { canInstall: false, updateReady: false }
let deferredPrompt: BeforeInstallPromptEvent | null = null
let waiting: ServiceWorkerRegistration | null = null
let updateRequested = false
let reloading = false

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function patch(next: Partial<PwaSnapshot>) {
  const merged = { ...snapshot, ...next }
  if (merged.canInstall === snapshot.canInstall && merged.updateReady === snapshot.updateReady) return
  snapshot = merged
  for (const listener of listeners) listener()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Holding the event is what lets the game offer installation on its own
    // terms instead of whenever the browser decides to interrupt.
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    patch({ canInstall: true })
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    patch({ canInstall: false })
  })
}

/** True when running from the home screen rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

async function promptInstall(): Promise<boolean> {
  const event = deferredPrompt
  if (!event) return false
  // The event is single-use, and a declined prompt will not be offered again
  // this session, so the affordance goes away either way.
  deferredPrompt = null
  patch({ canInstall: false })
  await event.prompt()
  const { outcome } = await event.userChoice
  return outcome === 'accepted'
}

function applyUpdate(): void {
  const worker = waiting?.waiting
  if (!worker) return
  // The reload is driven by the controllerchange this causes, not from here,
  // so it happens only once the new worker is genuinely in charge.
  updateRequested = true
  worker.postMessage({ type: 'SKIP_WAITING' })
}

export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  if (!import.meta.env.PROD) return

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The first worker claims the page on its very first install, which is not
    // an update and must not bounce the player through a reload. Only a switch
    // this page asked for gets one.
    if (!updateRequested) {
      // Another tab applied the update. Drop the prompt here and let this tab
      // pick the new build up on its next navigation rather than yanking it
      // out mid-game.
      patch({ updateReady: false })
      return
    }
    if (reloading) return
    reloading = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    void (async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          `${import.meta.env.BASE_URL}sw.js`,
          // Scope matches the Pages subdirectory; updateViaCache keeps the
          // worker script itself off the HTTP cache so updates are not delayed
          // by however long Pages says it may be held.
          { scope: import.meta.env.BASE_URL, updateViaCache: 'none' },
        )

        const watch = (worker: ServiceWorker | null) => {
          if (!worker) return
          const check = () => {
            // A worker that reaches `installed` while another already controls
            // the page is a new version queued behind the running one.
            if (worker.state !== 'installed' || !navigator.serviceWorker.controller) return
            waiting = registration
            patch({ updateReady: true })
            worker.removeEventListener('statechange', check)
          }
          worker.addEventListener('statechange', check)
          check()
        }

        watch(registration.waiting)
        registration.addEventListener('updatefound', () => watch(registration.installing))

        // Pages may serve sw.js from its own cache for a few minutes, so look
        // again when the player returns to the tab rather than only on load.
        const recheck = () => void registration.update().catch(() => undefined)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') recheck()
        })
        window.setInterval(recheck, 60 * 60 * 1000)
      } catch {
        // Without a service worker the game still works; it just will not
        // start offline.
      }
    })()
  })
}

export function usePwa() {
  const state = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  )
  const install = useCallback(() => promptInstall(), [])
  const update = useCallback(() => applyUpdate(), [])
  return { ...state, install, update }
}
