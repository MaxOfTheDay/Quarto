/**
 * Verifies the production build behaves as an installable, offline-capable app
 * when served from a repository subdirectory, the way GitHub Pages serves it.
 *
 * Needs Playwright (see scripts/e2e.mjs for why it is not a dependency):
 *
 *   npm i -D playwright && npx playwright install chromium
 *   npm run build && npm run verify:pwa
 */
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { cp, readFile, rm, writeFile } from 'node:fs/promises'
import { createReadStream, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('../', import.meta.url))
const PORT = 4321

// Read the base out of the build rather than assuming one, so this also covers
// a renamed repository or a user site served from the domain root.
const builtHtml = await readFile(join(root, 'dist/index.html'), 'utf8')
const BASE = builtHtml.match(/<link rel="manifest" href="([^"]*)manifest\.webmanifest"/)?.[1] || '/'
console.log(`serving dist/ under ${BASE}\n`)

const failures = []
const check = (ok, message, detail = '') => {
  if (!ok) failures.push(`${message}${detail ? ` — ${detail}` : ''}`)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${message}${ok || !detail ? '' : ` (${detail})`}`)
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
}

// Served directory is swapped mid-run to stand in for a redeploy.
let servedDir = join(root, 'dist')

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(404).end('not found')
    return
  }
  let rel = url.pathname.slice(BASE.length) || 'index.html'
  if (rel.endsWith('/')) rel += 'index.html'
  const file = join(servedDir, normalize(rel).replace(/^(\.\.[/\\])+/, ''))
  try {
    if (!statSync(file).isFile()) throw new Error('not a file')
  } catch {
    res.writeHead(404).end('not found')
    return
  }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    // GitHub Pages caches aggressively; anything that only works without this
    // header is not actually going to work in production.
    'Cache-Control': 'max-age=600',
  })
  createReadStream(file).pipe(res)
})

await new Promise((resolve) => server.listen(PORT, resolve))
const URL_BASE = `http://localhost:${PORT}${BASE}`

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH
const browser = await chromium.launch(executablePath ? { executablePath } : {})
const context = await browser.newContext({ viewport: { width: 412, height: 915 } })
const page = await context.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))

/* ── First visit ─────────────────────────────────────────────────────────── */

await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.setup__title', { timeout: 15000 })
check(true, 'app renders from the repository subdirectory')

const failedRequests = []
page.on('requestfailed', (r) => failedRequests.push(r.url()))
await page.evaluate(() => document.fonts.ready)

const swInfo = await page.evaluate(async () => {
  const registration = await navigator.serviceWorker.ready
  return {
    scope: registration.scope,
    state: registration.active?.state ?? null,
    controlled: Boolean(navigator.serviceWorker.controller),
  }
})
check(swInfo.state === 'activated', 'service worker activates', `state ${swInfo.state}`)
check(swInfo.scope.endsWith(BASE), 'service worker scope is the repository path', swInfo.scope)

/* ── Manifest ────────────────────────────────────────────────────────────── */

const manifestHref = await page.getAttribute('link[rel=manifest]', 'href')
check(manifestHref === `${BASE}manifest.webmanifest`, 'manifest link carries the base', String(manifestHref))

const manifestResponse = await page.request.get(new URL(manifestHref, URL_BASE).href)
check(manifestResponse.ok(), 'manifest is reachable', `status ${manifestResponse.status()}`)
const manifest = await manifestResponse.json()
check(manifest.name === 'Quarto' && manifest.short_name === 'Quarto', 'manifest names the app')
check(manifest.display === 'standalone', 'manifest asks for a standalone window')

const resolved = (value) => new URL(value, new URL(manifestHref, URL_BASE)).pathname
check(resolved(manifest.start_url) === BASE, 'start_url resolves to the app root', resolved(manifest.start_url))
check(resolved(manifest.scope) === BASE, 'scope resolves to the app root', resolved(manifest.scope))

for (const icon of manifest.icons) {
  const response = await page.request.get(new URL(icon.src, new URL(manifestHref, URL_BASE)).href)
  check(response.ok(), `icon ${icon.src} is reachable`, `status ${response.status()}`)
}

const cdp = await context.newCDPSession(page)
const appManifest = await cdp.send('Page.getAppManifest')
check((appManifest.errors ?? []).length === 0, 'Chrome parses the manifest without errors',
  (appManifest.errors ?? []).map((e) => e.message).join('; '))

// Chrome's own installability bar: name, standalone display, a 192 and a 512
// icon, an in-scope start_url, and a service worker with a fetch handler.
const sizes = manifest.icons.map((i) => i.sizes)
check(sizes.includes('192x192') && sizes.includes('512x512'), 'icon sizes meet the install requirement')
check(manifest.icons.some((i) => i.purpose === 'maskable'), 'a maskable icon is offered for Android')

/* ── Offline ─────────────────────────────────────────────────────────────── */

await context.setOffline(true)
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('.setup__title', { timeout: 15000 })
check(true, 'app starts with no network at all')

await page.getByRole('radio', { name: 'Two players', exact: true }).click()
await page.getByRole('button', { name: 'Begin' }).click()
await page.waitForSelector('.board__slab', { timeout: 10000 })
await page.locator('[data-piece="3"]').click()
await page.waitForTimeout(500)
await page.locator('[data-cell="5"]').click()
await page.waitForTimeout(500)
check((await page.locator('[data-cell="5"] .cell__piece').count()) === 1, 'the game is playable offline')

// The AI runs in a separate worker chunk, which has to be cached as well.
await page.getByRole('button', { name: 'New game', exact: true }).first().click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: 'New game', exact: true }).last().click()
await page.waitForSelector('.setup__title', { timeout: 10000 })
await page.getByRole('radio', { name: 'Vs computer', exact: true }).click()
await page.getByRole('button', { name: 'Begin' }).click()
await page.waitForSelector('.board__slab', { timeout: 10000 })
await page.locator('[data-piece="3"]').click()
await page.waitForTimeout(3000)
check((await page.locator('.cell__piece').count()) >= 1, 'the computer plays offline (worker chunk is cached)')

await context.setOffline(false)

/* ── Redeploy ────────────────────────────────────────────────────────────── */

const next = join(root, 'dist-next')
await rm(next, { recursive: true, force: true })
await cp(join(root, 'dist'), next, { recursive: true })
const html = await readFile(join(next, 'index.html'), 'utf8')
await writeFile(
  join(next, 'index.html'),
  html.replace('<title>Quarto</title>', '<title>Quarto</title><meta name="build-marker" content="v2" />'),
)
execFileSync('node', [join(root, 'scripts/build-sw.mjs'), 'dist-next'], { cwd: root, stdio: 'ignore' })
servedDir = next

await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('.setup__title', { timeout: 15000 })

// The update applies itself and reloads, so polling has to survive the
// navigation it is waiting for.
const marked = async () => {
  try {
    return await page.evaluate(() => Boolean(document.querySelector('meta[name="build-marker"]')))
  } catch {
    return false
  }
}
let updated = false
for (let i = 0; i < 60 && !updated; i++) {
  updated = await marked()
  if (!updated) await page.waitForTimeout(500)
}
check(updated, 'a redeploy reaches an already-installed client')

if (updated) {
  await page.waitForLoadState('domcontentloaded')
  const caches = await page.evaluate(() => window.caches.keys())
  check(caches.length === 1, 'the previous version\'s cache is cleaned up', caches.join(', '))
  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.setup__title', { timeout: 15000 })
  const stillNew = await page.evaluate(() => Boolean(document.querySelector('meta[name="build-marker"]')))
  check(stillNew, 'the updated version is the one cached for offline use')
  await context.setOffline(false)
}

check(pageErrors.length === 0, 'no page errors throughout', pageErrors.join('; '))
check(failedRequests.length === 0, 'no failed asset requests while online', failedRequests.join(', '))

await rm(next, { recursive: true, force: true })
await browser.close()
await new Promise((resolve) => server.close(resolve))

console.log(failures.length === 0 ? '\nALL PWA CHECKS PASSED' : `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}`)
process.exit(failures.length === 0 ? 0 : 1)
