/* eslint-disable no-restricted-globals */
/**
 * Quarto's service worker.
 *
 * The whole game is a fixed set of static files, so it is precached outright:
 * after one visit it opens instantly and plays offline, including the AI
 * worker. `scripts/build-sw.mjs` fills in the file list and a version derived
 * from their contents, which is what makes updates work — a changed build
 * changes this file, the browser notices, and the new worker precaches into a
 * fresh cache instead of patching the old one.
 *
 * Paths here are relative to the worker's own URL, so everything resolves under
 * the GitHub Pages subdirectory without the base being hardcoded.
 */

const VERSION = '__VERSION__'
/**
 * Each entry is `{ url, revision }`. Vite already content-hashes everything
 * under assets/, so those carry no revision; the rest — index.html, the
 * manifest, the icons — keep a stable name across deploys and get one.
 */
const ASSETS = __ASSETS__

const CACHE = `quarto-${VERSION}`
const INDEX = new URL('index.html', self.location.href).href

/**
 * GitHub Pages serves with a max-age, and a precache fetch would happily be
 * answered from the HTTP cache — which is how a "new" worker ends up installing
 * the previous deploy's index.html. Appending the content revision makes each
 * version a distinct URL, so the HTTP cache can only ever help, never lie.
 */
const precacheUrl = ({ url, revision }) => (revision ? `${url}?v=${revision}` : url)

/*
 * Only reachable on a first visit that happens to be offline — after that the
 * whole game is cached and this can never be served. It is still the one
 * surface a player might see that is not the game, so it is not a bare string.
 */
const OFFLINE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Quarto</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    padding: 2rem; text-align: center;
    font: 400 16px/1.6 system-ui, -apple-system, 'Segoe UI', sans-serif;
    background: #e9e3d7; color: #1f1a15;
  }
  @media (prefers-color-scheme: dark) { body { background: #191512; color: #f2ece0; } }
  h1 { font-family: 'Iowan Old Style', Georgia, serif; font-weight: 400; font-size: 2.5rem; margin: 0 0 .75rem; }
  p { margin: 0; max-width: 32ch; opacity: .75; }
</style></head>
<body><div>
  <h1>Quarto</h1>
  <p>Not connected, and this device has not saved the game yet. Open it once with a connection and it will play offline from then on.</p>
</div></body></html>`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map(precacheUrl))),
    // No skipWaiting: the page decides when to switch over, so an update never
    // swaps the bundle out from under a game in progress.
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => key.startsWith('quarto-') && key !== CACHE).map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return

  // Any navigation inside the scope is the game; there are no other routes.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        // ignoreSearch, because precached entries carry a ?v= revision.
        const cached = await caches.match(INDEX, { ignoreSearch: true })
        if (cached) return cached
        try {
          return await fetch(request)
        } catch {
          return new Response(OFFLINE, {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        }
      })(),
    )
    return
  }

  event.respondWith(
    (async () => {
      // Everything precached is either content-hashed or replaced wholesale by
      // the next version, so serving it from the cache can never go stale.
      const cached = await caches.match(request, { ignoreSearch: true })
      if (cached) return cached
      try {
        const response = await fetch(request)
        if (response.ok && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      } catch {
        return Response.error()
      }
    })(),
  )
})
