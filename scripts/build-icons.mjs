/**
 * Rasterises the app icons. The PNGs are committed, so this only needs running
 * when the icon design changes:
 *
 *   npm i -D playwright && npx playwright install chromium
 *   node scripts/build-icons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { iconSvg } from './icon.mjs'

const OUT = new URL('../public/icons/', import.meta.url)
await mkdir(OUT, { recursive: true })

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH
const browser = await chromium.launch(executablePath ? { executablePath } : {})

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-192.png', size: 192, maskable: true },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  // iOS crops to its own shape and ignores transparency, so no corner radius.
  { file: 'apple-touch-icon.png', size: 180, maskable: false, radius: 0 },
]


for (const { file, size, maskable, radius } of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  const svg = iconSvg({ size, maskable, radius })
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}</style>${svg}`,
    { waitUntil: 'load' },
  )
  await page.screenshot({ path: new URL(file, OUT).pathname, omitBackground: true })
  await page.close()
  console.log(`${file}  ${size}x${size}${maskable ? '  (maskable)' : ''}`)
}

// The favicon stays vector — it is the same drawing, just not rasterised.
await writeFile(new URL('../public/favicon.svg', import.meta.url), iconSvg({ size: 512, radius: 64 }) + '\n')
console.log('favicon.svg')

await browser.close()
