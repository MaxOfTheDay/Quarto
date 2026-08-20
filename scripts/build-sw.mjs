/**
 * Writes dist/sw.js after a build, with the real file list and a version hash
 * baked in. Run as part of `npm run build`.
 *
 * The version is derived from the contents of every precached file, so an
 * unchanged build produces an identical worker (no pointless update prompts)
 * and any change at all produces a different one (no stale installs).
 */
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// Defaults to dist/, but takes a directory so the PWA checks can build a
// second "deploy" to update from.
const dist = process.argv[2]
  ? fileURLToPath(new URL(`../${process.argv[2].replace(/\/*$/, '')}/`, import.meta.url))
  : fileURLToPath(new URL('../dist/', import.meta.url))
const template = fileURLToPath(new URL('./sw-template.js', import.meta.url))

/** Files that are served but must not be precached. */
const SKIP = new Set(['sw.js', '.nojekyll'])

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const full = join(dir, entry.name)
      return entry.isDirectory() ? walk(full) : [full]
    }),
  )
  return files.flat()
}

const found = await walk(dist)
const assets = found
  .map((file) => relative(dist, file).split('\\').join('/'))
  .filter((file) => !SKIP.has(file))
  .sort()

if (!assets.includes('index.html')) {
  throw new Error('dist/index.html is missing — run vite build first')
}

const digest = (buffer) => createHash('sha256').update(buffer).digest('hex')

const version = createHash('sha256')
const entries = []
for (const url of assets) {
  const body = await readFile(join(dist, url))
  version.update(url)
  version.update(body)
  // Vite already puts a content hash in every filename under assets/, so those
  // need no revision of their own; everything else keeps its name across
  // deploys and would otherwise be indistinguishable to the HTTP cache.
  const revision = url.startsWith('assets/') ? null : digest(body).slice(0, 10)
  entries.push({ url, revision })
}

const source = (await readFile(template, 'utf8'))
  .replace('__VERSION__', version.digest('hex').slice(0, 12))
  .replace('__ASSETS__', JSON.stringify(entries, null, 2))

await writeFile(join(dist, 'sw.js'), source)
const revisioned = entries.filter((entry) => entry.revision).length
console.log(
  `sw.js  ${entries.length} files precached (${revisioned} revisioned, ${entries.length - revisioned} content-hashed)`,
)
