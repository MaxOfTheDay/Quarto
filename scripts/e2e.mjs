/**
 * End-to-end checks against a production build.
 *
 * Playwright is not a dependency of this project — installing it would pull
 * browser binaries on every `npm install` for a game that does not need them.
 * To run these:
 *
 *   npm i -D playwright && npx playwright install chromium
 *   npm run test:e2e
 *
 * Set PLAYWRIGHT_CHROMIUM_PATH to use a Chromium you already have.
 */
import { preview } from 'vite'
import { chromium } from 'playwright'

// No strictPort: a preview server the developer already has running should not
// make the checks fail with a port-in-use error.
const server = await preview({ preview: { port: 4173 } })
const URL = server.resolvedUrls.local[0]
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH
const browser = await chromium.launch(executablePath ? { executablePath } : {})
const failures = []
const check = (name, ok, detail = '') => {
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` (${detail})`}`)
}

async function open(width = 1280, height = 900) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await p.goto(URL, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.setup__title')
  await p.evaluate(() => document.fonts.ready)
  return { p, ctx, errors }
}

async function begin(p, mode = 'Two players') {
  await p.getByRole('radio', { name: mode, exact: true }).click()
  await p.getByRole('button', { name: 'Begin' }).click()
  await p.waitForSelector('.board__slab')
  await p.waitForTimeout(400)
}

// ── Undo ────────────────────────────────────────────────────────────────────
{
  const { p, ctx, errors } = await open()
  await begin(p)
  check('undo disabled at game start', await p.getByRole('button', { name: 'Undo' }).isDisabled())

  await p.locator('[data-piece="3"]').click()
  await p.waitForTimeout(400)
  await p.locator('[data-cell="5"]').click()
  await p.waitForTimeout(500)
  check('piece landed on the board', (await p.locator('[data-cell="5"] .cell__piece').count()) === 1)
  check('pool lost the played piece', (await p.locator('[data-piece="3"] .slot__piece').count()) === 0)

  await p.getByRole('button', { name: 'Undo' }).click()
  await p.waitForTimeout(300)
  check('undo removes the placement', (await p.locator('[data-cell="5"] .cell__piece').count()) === 0)
  await p.getByRole('button', { name: 'Undo' }).click()
  await p.waitForTimeout(300)
  check('undo returns the piece to the pool', (await p.locator('[data-piece="3"] .slot__piece').count()) === 1)
  check('undo back to start disables itself', await p.getByRole('button', { name: 'Undo' }).isDisabled())
  check('no console errors during undo', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ── Keyboard play ───────────────────────────────────────────────────────────
{
  const { p, ctx, errors } = await open()
  await begin(p)
  await p.locator('[data-piece="0"]').focus()
  await p.keyboard.press('Enter')
  await p.waitForTimeout(450)
  check('keyboard selects a piece', (await p.locator('.tray__piece').count()) === 1)

  await p.locator('[data-cell="0"]').focus()
  await p.keyboard.press('ArrowRight')
  await p.keyboard.press('ArrowDown')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(450)
  check('arrow keys move the board cursor then place', (await p.locator('[data-cell="5"] .cell__piece').count()) === 1)

  await p.keyboard.press('u')
  await p.waitForTimeout(250)
  check('U undoes', (await p.locator('[data-cell="5"] .cell__piece').count()) === 0)
  await p.keyboard.press('?')
  await p.waitForTimeout(350)
  check('? opens the rules', (await p.locator('[role="dialog"]').count()) === 1)
  await p.keyboard.press('Escape')
  await p.waitForTimeout(300)
  check('Escape closes the rules', (await p.locator('[role="dialog"]').count()) === 0)
  check('no console errors on keyboard play', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ── Restart confirmation ────────────────────────────────────────────────────
{
  const { p, ctx } = await open()
  await begin(p)
  await p.locator('[data-piece="3"]').click()
  await p.waitForTimeout(400)
  await p.getByRole('button', { name: 'New game', exact: true }).first().click()
  await p.waitForTimeout(350)
  check('mid-game restart asks first', (await p.getByRole('dialog').count()) === 1)
  await p.getByRole('button', { name: 'Keep playing' }).click()
  await p.waitForTimeout(300)
  check('keeping the game keeps the position', (await p.locator('.tray__piece').count()) === 1)
  await ctx.close()
}

// ── Draw ────────────────────────────────────────────────────────────────────
{
  const { p, ctx, errors } = await open()
  await begin(p)
  // A known filling of all sixteen cells that never completes a line.
  const order = [0, 7, 9, 14, 11, 12, 2, 5, 6, 1, 15, 8, 13, 10, 4, 3]
  for (let i = 0; i < order.length; i++) {
    await p.locator(`[data-piece="${order[i]}"]`).click()
    await p.waitForTimeout(90)
    await p.locator(`[data-cell="${i}"]`).click()
    await p.waitForTimeout(90)
  }
  await p.waitForTimeout(900)
  check('a full board with no line is a draw', (await p.locator('.result__headline').innerText()) === 'Draw')
  check('no console errors through a full game', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ── Sound and reduced motion actually take effect ───────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))
  await p.goto(URL, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.setup__title')
  // Count AudioContexts the page creates, to prove cues reach the audio graph.
  await p.evaluate(() => {
    window.__ctxCount = 0
    const Real = window.AudioContext
    window.AudioContext = class extends Real {
      constructor(...args) {
        super(...args)
        window.__ctxCount++
      }
    }
  })
  await begin(p)
  await p.locator('[data-piece="3"]').click()
  await p.waitForTimeout(400)
  await p.locator('[data-cell="5"]').click()
  await p.waitForTimeout(400)
  check('playing a move opens an audio context', (await p.evaluate(() => window.__ctxCount)) >= 1)
  check('no audio errors', errors.length === 0, errors.join('; '))

  await p.getByRole('button', { name: 'Rules' }).click()
  await p.waitForTimeout(300)
  await p.getByRole('switch', { name: /Reduced motion/ }).click()
  await p.waitForTimeout(200)
  check('reduced motion sets the document flag', (await p.evaluate(() => document.documentElement.dataset.motion)) === 'reduced')
  const dur = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dur').trim())
  check('reduced motion collapses durations', dur === '1ms', `--dur is ${dur}`)
  await ctx.close()
}

// ── Preferences survive a reload ────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const p = await ctx.newPage()
  await p.goto(URL, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.setup__title')
  await p.getByRole('radio', { name: 'Hard', exact: true }).click()
  await p.getByRole('button', { name: 'Begin' }).click()
  await p.waitForSelector('.board__slab')
  await p.getByRole('button', { name: 'Sound', exact: true }).click()
  await p.waitForTimeout(200)
  await p.reload({ waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.setup__title')
  check('difficulty persists', await p.getByRole('radio', { name: 'Hard', exact: true }).getAttribute('aria-checked') === 'true')
  check('mute persists', (await p.getByRole('button', { name: 'Sound' }).getAttribute('aria-pressed')) === 'false')
  check('mute shows its state in the label', (await p.getByRole('button', { name: 'Sound' }).innerText()) === 'Muted')
  check('intro is not shown twice', (await p.locator('.primer').count()) === 0)
  await ctx.close()
}

// ── Horizontal overflow at common widths ────────────────────────────────────
for (const width of [320, 360, 390, 414, 768, 1024, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 } })
  const p = await ctx.newPage()
  await p.goto(URL, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.setup__title')
  await p.getByRole('button', { name: 'Begin' }).click()
  await p.waitForSelector('.board__slab')
  await p.waitForTimeout(300)
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(`no horizontal scroll at ${width}px`, overflow <= 0, `overflow ${overflow}px`)
  await ctx.close()
}

await browser.close()
await server.close()
console.log(failures.length === 0 ? '\nALL CHECKS PASSED' : `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}`)
process.exit(failures.length === 0 ? 0 : 1)
