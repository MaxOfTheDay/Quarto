/**
 * Static checks on dist/ before it is published. These are the failures that
 * only show up once the app is live under a subdirectory — a missing manifest,
 * an asset URL that lost its base, a service worker that precaches a file that
 * is not there — so they are worth catching in CI rather than on a phone.
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const problems = []
const check = (ok, message) => {
  if (!ok) problems.push(message)
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${message}`)
}

const exists = async (path) => {
  try {
    await stat(join(dist, path))
    return true
  } catch {
    return false
  }
}

for (const file of ['index.html', 'manifest.webmanifest', 'sw.js', 'favicon.svg']) {
  check(await exists(file), `${file} is present`)
}

const html = await readFile(join(dist, 'index.html'), 'utf8')
const manifestHref = html.match(/<link rel="manifest" href="([^"]+)"/)?.[1]
check(Boolean(manifestHref), 'index.html links a manifest')

// Every root-relative URL the page asks for must exist in the artifact, which
// is what catches a base path that did not make it through the build.
const base = manifestHref ? manifestHref.replace(/manifest\.webmanifest$/, '') : '/'
const referenced = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1])
for (const url of referenced) {
  check(url.startsWith(base), `${url} is served from the deploy base ${base}`)
  check(await exists(url.slice(base.length)), `${url} exists in the build`)
}

const manifest = JSON.parse(await readFile(join(dist, 'manifest.webmanifest'), 'utf8'))
check(manifest.name === 'Quarto', 'manifest names the app')
check(manifest.display === 'standalone', 'manifest requests a standalone window')
// Relative start_url and scope resolve against the manifest's own URL, so they
// follow the repository path without the base being baked in.
check(!manifest.start_url.startsWith('/'), 'manifest start_url is relative to the manifest')
check(!manifest.scope.startsWith('/'), 'manifest scope is relative to the manifest')

const sizes = manifest.icons.map((icon) => `${icon.sizes}:${icon.purpose}`)
check(sizes.includes('192x192:any'), 'manifest has a 192px icon')
check(sizes.includes('512x512:any'), 'manifest has a 512px icon')
check(
  manifest.icons.some((icon) => icon.purpose === 'maskable' && icon.sizes === '512x512'),
  'manifest has a 512px maskable icon',
)
for (const icon of manifest.icons) {
  check(await exists(icon.src), `icon ${icon.src} exists in the build`)
}

const sw = await readFile(join(dist, 'sw.js'), 'utf8')
const entries = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\n\])/)?.[1] ?? '[]')
const assets = entries.map((entry) => entry.url)
check(assets.length > 0, 'service worker precaches the app shell')
check(assets.includes('index.html'), 'service worker precaches index.html')
for (const entry of entries) {
  check(await exists(entry.url), `precached ${entry.url} exists in the build`)
  // Anything Vite did not content-hash must carry a revision, or a new worker
  // could precache the previous deploy's copy straight out of the HTTP cache.
  const needsRevision = !entry.url.startsWith('assets/')
  check(
    needsRevision === Boolean(entry.revision),
    `precached ${entry.url} is ${needsRevision ? 'revisioned' : 'content-hashed'}`,
  )
}
check(!/__VERSION__|__ASSETS__/.test(sw), 'service worker template placeholders were filled in')

// Anything shipped but never precached would be missing offline.
const walk = async (dir, prefix = '') => {
  const entries = await readdir(join(dist, dir), { withFileTypes: true })
  const out = []
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...(await walk(join(dir, entry.name), rel)))
    else out.push(rel)
  }
  return out
}
const shipped = (await walk('.')).filter((f) => f !== 'sw.js' && f !== '.nojekyll')
const missing = shipped.filter((f) => !assets.includes(f))
check(missing.length === 0, `every shipped file is precached${missing.length ? `: missing ${missing.join(', ')}` : ''}`)

console.log(problems.length === 0 ? '\nBuild is deployable' : `\n${problems.length} problem(s)`)
process.exit(problems.length === 0 ? 0 : 1)
