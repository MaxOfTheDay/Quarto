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
  await p.getByRole('button', { name: /^(Begin|Start new game)$/ }).click()
  await p.waitForSelector('.board__slab')
  await p.waitForTimeout(400)
}

/** Undo names what it will undo, so match either half of the turn. */
const undoButton = (p) => p.getByRole('button', { name: /^(Undo placement|Undo choice|Take back)$/ })

/** The secondary controls are spelled out on a wide screen and behind one
 *  control on a phone. */
async function openMenu(p, name) {
  const wide = p.locator('.topbar__wide').getByRole('button', { name, exact: true })
  if (await wide.isVisible().catch(() => false)) {
    await wide.click()
    return
  }
  await p.locator('.menu__trigger').click()
  await p.getByRole('menuitem', { name, exact: true }).click()
}

// ── Undo ────────────────────────────────────────────────────────────────────
{
  const { p, ctx, errors } = await open()
  await begin(p)
  check('undo disabled at game start', await undoButton(p).isDisabled())

  await p.locator('[data-piece="3"]').click()
  await p.waitForTimeout(400)
  await p.locator('[data-cell="5"]').click()
  await p.waitForTimeout(500)
  check('piece landed on the board', (await p.locator('[data-cell="5"] .cell__piece').count()) === 1)
  check('pool lost the played piece', (await p.locator('[data-piece="3"] .slot__piece').count()) === 0)

  await undoButton(p).click()
  await p.waitForTimeout(300)
  check('undo removes the placement', (await p.locator('[data-cell="5"] .cell__piece').count()) === 0)
  await undoButton(p).click()
  await p.waitForTimeout(300)
  check('undo returns the piece to the pool', (await p.locator('[data-piece="3"] .slot__piece').count()) === 1)
  check('undo back to start disables itself', await undoButton(p).isDisabled())
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
  // Scoped to the shelf: a clone of the piece is in the air on its way there.
  check('keyboard selects a piece', (await p.locator('.tray .tray__piece').count()) === 1)

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
  check('keeping the game keeps the position', (await p.locator('.tray .tray__piece').count()) === 1)
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
  check('a full board with no line is a draw', (await p.locator('.status').innerText()) === 'Draw')
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

  await openMenu(p, 'Settings')
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
  await p.getByRole('button', { name: /^(Begin|Start new game)$/ }).click()
  await p.waitForSelector('.board__slab')
  await p.getByRole('button', { name: 'Sound on', exact: true }).click()
  await p.waitForTimeout(200)
  await p.reload({ waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.setup__title')
  check('difficulty persists', await p.getByRole('radio', { name: 'Hard', exact: true }).getAttribute('aria-checked') === 'true')
  check('mute persists', (await p.getByRole('button', { name: 'Sound off' }).getAttribute('aria-pressed')) === 'false')
  check('intro is not shown twice', (await p.locator('.primer').count()) === 0)
  await ctx.close()
}

// ── A full game against Hard, with the main thread under watch ──────────────
{
  const { p, ctx, errors } = await open()
  await p.getByRole('radio', { name: 'Vs computer', exact: true }).click()
  await p.getByRole('radio', { name: 'Hard', exact: true }).click()
  await p.getByRole('button', { name: /^(Begin|Start new game)$/ }).click()
  await p.waitForSelector('.board__slab')

  // The search runs in a worker, so animation frames should keep arriving even
  // while the computer is thinking. A blocked main thread shows up as a gap.
  await p.evaluate(() => {
    window.__maxGap = 0
    let last = performance.now()
    const tick = (t) => {
      window.__maxGap = Math.max(window.__maxGap, t - last)
      last = t
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  // Only ever touch controls the UI has actually enabled.
  const readable = () =>
    p.evaluate(() => ({
      over: !!document.querySelector('.status[data-outcome="true"]'),
      headline: document.querySelector('.status[data-outcome="true"]')?.textContent ?? null,
      cells: [...document.querySelectorAll('.cell[data-target="true"]:not([disabled])')].map((el) => el.dataset.cell),
      slots: [...document.querySelectorAll('.pool[data-active="true"] .slot:not([disabled])')].map((el) => el.dataset.piece),
    }))

  let finished = null
  for (let i = 0; i < 400; i++) {
    const s = await readable()
    if (s.over) {
      finished = s.headline
      break
    }
    const cell = s.cells.length ? s.cells[Math.floor(Math.random() * s.cells.length)] : null
    const slot = s.slots.length ? s.slots[Math.floor(Math.random() * s.slots.length)] : null
    if (!cell && !slot) {
      await p.waitForTimeout(120)
      continue
    }
    try {
      await p.locator(cell ? `[data-cell="${cell}"]` : `[data-piece="${slot}"]`).click({ timeout: 2000 })
    } catch {
      // The turn flipped between reading and clicking; look again.
    }
    await p.waitForTimeout(110)
  }

  const maxGap = await p.evaluate(() => window.__maxGap)
  check('a full game against Hard reaches a result', finished !== null, `ended: ${finished}`)
  check('the board stays responsive while Hard thinks', maxGap < 250, `longest frame gap ${maxGap.toFixed(0)}ms`)
  check('no console errors across a full Hard game', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ── A phone in portrait must not need scrolling to play ─────────────────────
// Choosing a piece means reading the board and the pool together, so if they
// cannot share a screen the game becomes a scrolling exercise.
for (const [width, height] of [[360, 800], [390, 844], [412, 915]]) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const p = await ctx.newPage()
  await p.goto(URL, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.setup__title')
  await p.getByRole('radio', { name: 'Two players', exact: true }).click()
  await p.getByRole('button', { name: /^(Begin|Start new game)$/ }).click()
  await p.waitForSelector('.board__slab')
  await p.waitForTimeout(400)

  const overflow = () =>
    p.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)

  check(`${width}x${height}: choosing fits on one screen`, (await overflow()) <= 0, `${await overflow()}px over`)

  await p.locator('[data-piece="12"]').click() // longest attribute reading
  await p.waitForTimeout(600)
  check(`${width}x${height}: placing fits on one screen`, (await overflow()) <= 0, `${await overflow()}px over`)

  // The fit was originally bought by shrinking the pool pieces too far. Both
  // constraints have to hold at once, so both are asserted.
  const pool = await p.evaluate(() => {
    const slot = document.querySelector('.slot').getBoundingClientRect()
    const piece = document.querySelector('.slot__piece .piece').getBoundingClientRect()
    return { slot: Math.round(slot.width), piece: Math.round(piece.width) }
  })
  check(`${width}x${height}: pool pieces stay legible`, pool.piece >= 38, `${pool.piece}px wide`)
  check(`${width}x${height}: pool slots stay tappable`, pool.slot >= 42, `${pool.slot}px wide`)

  /*
   * Counted as line boxes rather than inferred from the element's height: the
   * row aligns the description to the piece's baseline with padding, which
   * makes the box taller than its text without the text having wrapped.
   */
  const attrLines = await p.evaluate(() => {
    const el = document.querySelector('.tray__attrs')
    const range = document.createRange()
    range.selectNodeContents(el)
    const line = parseFloat(getComputedStyle(el).lineHeight) || 14
    // A flex item's own box and the text inside it can differ by a fraction of
    // a pixel, so tops are grouped by the line they belong to rather than
    // counted exactly — two rects a pixel apart are one line, not two.
    const tops = [...range.getClientRects()].filter((r) => r.height > 0).map((r) => r.top)
    return tops.reduce((rows, top) => {
      if (!rows.some((r) => Math.abs(r - top) < line / 2)) rows.push(top)
      return rows
    }, []).length
  })
  check(`${width}x${height}: the piece's attributes stay on one line`, attrLines <= 1, `${attrLines} lines`)
  await ctx.close()
}

// ── Nothing may move underfoot between the two phases ───────────────────────
// Anything whose height depends on the phase pushes the board and the pool
// around on every half-move, which reads as the whole screen reformatting.
for (const [width, height] of [[390, 844], [1280, 900], [844, 390]]) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const p = await ctx.newPage()
  await p.goto(URL, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.setup__title')
  await p.getByRole('radio', { name: 'Two players', exact: true }).click()
  await p.getByRole('button', { name: /^(Begin|Start new game)$/ }).click()
  await p.waitForSelector('.board__slab')
  await p.waitForTimeout(400)

  // Document-relative, so a scroll is not mistaken for a layout shift.
  const anchors = () =>
    p.evaluate(() => ({
      board: Math.round(document.querySelector('.board__slab').getBoundingClientRect().top + window.scrollY),
      pool: Math.round(document.querySelector('.pool').getBoundingClientRect().top + window.scrollY),
    }))

  const start = await anchors()
  await p.locator('[data-piece="3"]').click()
  await p.waitForTimeout(700)
  const afterChoose = await anchors()
  await p.locator('[data-cell="5"]').click()
  await p.waitForTimeout(700)
  const afterPlace = await anchors()

  const moved = Math.max(
    Math.abs(start.board - afterChoose.board),
    Math.abs(afterChoose.board - afterPlace.board),
    Math.abs(start.pool - afterChoose.pool),
    Math.abs(afterChoose.pool - afterPlace.pool),
  )
  check(`${width}x${height}: board and pool hold still across a turn`, moved === 0, `moved ${moved}px`)
  await ctx.close()
}

// ── The turn state must never leave the screen ──────────────────────────────
// Whose turn it is, and whether to place or to choose, is the one thing a
// player has to be able to see at all times. It used to scroll away on short
// screens and on any phone held sideways.
/*
 * The heights matter as much as the widths. 561-700px at a desktop width is
 * the gap between the sideways-phone breakpoint and the height at which the
 * rail genuinely fits, and it used to run the pool off the bottom of the
 * screen with no scrollbar to find it.
 */
for (const [width, height] of [
  [360, 640],
  [320, 568],
  [844, 390],
  [740, 360],
  [667, 375],
  [932, 430],
  [1280, 580],
  [1280, 600],
  [1280, 640],
  [1366, 648],
  [1024, 600],
  [834, 1112],
]) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const p = await ctx.newPage()
  await p.goto(URL, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.setup__title')
  await p.getByRole('radio', { name: 'Two players', exact: true }).click()
  await p.getByRole('button', { name: /^(Begin|Start new game)$/ }).click()
  await p.waitForSelector('.board__slab')
  await p.waitForTimeout(400)

  const visible = () =>
    p.evaluate(() => {
      const r = document.querySelector('.status').getBoundingClientRect()
      const stage = document.querySelector('.stage')
      return {
        onScreen: r.top >= 0 && r.bottom <= window.innerHeight,
        pageScroll: document.documentElement.scrollHeight - window.innerHeight,
        stageScroll: stage.scrollHeight - stage.clientHeight,
        poolBottom: document.querySelector('.pool').getBoundingClientRect().bottom,
      }
    })

  const before = await visible()
  await p.locator('[data-piece="12"]').click()
  await p.waitForTimeout(650)
  const after = await visible()

  check(`${width}x${height}: the turn stays on screen while choosing`, before.onScreen)
  check(`${width}x${height}: the turn stays on screen while placing`, after.onScreen)
  check(`${width}x${height}: the page never scrolls`, after.pageScroll <= 0, `${after.pageScroll}px over`)
  check(`${width}x${height}: the stage never scrolls`, after.stageScroll <= 0, `${after.stageScroll}px over`)
  check(`${width}x${height}: the pool is fully on screen`, after.poolBottom <= height + 1)

  // A slot shorter than the piece standing in it is sliced by the tray's own
  // edge, which is how sixteen pieces once lost their tops in landscape.
  const sliced = await p.evaluate(() =>
    [...document.querySelectorAll('.slot')].filter((slot) => {
      const glyph = slot.querySelector('.slot__piece')
      if (!glyph) return false
      const g = glyph.getBoundingClientRect()
      const s = slot.getBoundingClientRect()
      return g.top < s.top - 0.6 || g.bottom > s.bottom + 0.6
    }).length,
  )
  check(`${width}x${height}: no piece is clipped by its slot`, sliced === 0, `${sliced} sliced`)

  const square = await p.evaluate(() => {
    const b = document.querySelector('.board__slab').getBoundingClientRect()
    return Math.abs(b.width - b.height)
  })
  check(`${width}x${height}: the board stays square`, square <= 1.5, `${square.toFixed(1)}px out`)
  await ctx.close()
}

// ── The keyboard keeps its place ────────────────────────────────────────────
// Acting on a cell or a piece disables it, and the browser then drops focus to
// the body. Focus has to land on whatever the player must do next instead.
{
  const { p, ctx, errors } = await open()
  await begin(p)
  await p.locator('[data-piece="0"]').focus()
  await p.keyboard.press('Enter')
  await p.waitForTimeout(650)
  const afterChoose = await p.evaluate(() => document.activeElement?.dataset?.cell ?? null)
  check('choosing hands focus to an open cell', afterChoose !== null, `focus went to ${afterChoose}`)

  await p.keyboard.press('Enter')
  await p.waitForTimeout(650)
  const afterPlace = await p.evaluate(() => document.activeElement?.dataset?.piece ?? null)
  check('placing hands focus back to the pool', afterPlace !== null, `focus went to ${afterPlace}`)
  check('no console errors while following focus', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ── The top bar and the game share one left edge ────────────────────────────
for (const [width, height] of [[1440, 900], [1024, 768], [834, 1112], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const p = await ctx.newPage()
  await p.goto(URL, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.setup__title')
  await p.getByRole('button', { name: /^(Begin|Start new game)$/ }).click()
  await p.waitForSelector('.board__slab')
  await p.waitForTimeout(300)
  const edges = await p.evaluate(() => {
    const bar = document.querySelector('.topbar').getBoundingClientRect()
    const status = document.querySelector('.stage__status').getBoundingClientRect()
    const board = document.querySelector('.board__slab').getBoundingClientRect()
    return {
      left: Math.round(status.left - bar.left),
      right: Math.round(status.right - bar.right),
      boardLeft: Math.round(board.left - bar.left),
    }
  })
  check(`${width}x${height}: status shares the bar's edges`, edges.left === 0 && edges.right === 0, JSON.stringify(edges))
  check(`${width}x${height}: the board starts on that edge`, edges.boardLeft === 0, `${edges.boardLeft}px off`)
  await ctx.close()
}

// ── Pool pieces keep their tone ─────────────────────────────────────────────
// Tone is one of the four attributes a player has to read to plan a move, so
// the pool may not wash it out while it is the other phase's turn.
{
  const { p, ctx } = await open()
  await begin(p)
  const dormant = await p.evaluate(() => getComputedStyle(document.querySelector('.slot__piece')).opacity)
  await p.locator('[data-piece="3"]').click()
  await p.waitForTimeout(500)
  const waiting = await p.evaluate(() => ({
    opacity: +getComputedStyle(document.querySelector('.slot__piece')).opacity,
    filter: getComputedStyle(document.querySelector('.slot__piece')).filter,
  }))
  check('the pool stays legible between turns', waiting.opacity >= 0.8, `opacity ${waiting.opacity}`)
  check('the pool pieces are never desaturated', waiting.filter === 'none', waiting.filter)
  check('the live pool is at full strength', +dormant === 1, `opacity ${dormant}`)
  await ctx.close()
}

// ── Acting on the surface that is not yours ─────────────────────────────────
// Half of every turn belongs to the board and half to the pool. Touching the
// wrong one used to do nothing at all, which reads as a broken app.
{
  const { p, ctx, errors } = await open()
  await begin(p)
  await p.locator('[data-cell="5"]').click({ force: true })
  await p.waitForTimeout(150)
  const nudge = await p.locator('.status__next[data-nudge="true"]').textContent().catch(() => null)
  check('a board tap while choosing says which way round the turn is', /choose a piece/i.test(nudge ?? ''), String(nudge))
  check('the live surface answers', (await p.locator('.stage[data-refuse="true"]').count()) === 1)
  await p.waitForTimeout(900)
  check('the nudge clears itself', (await p.locator('.status__next[data-nudge="true"]').count()) === 0)

  await p.locator('[data-piece="3"]').click()
  await p.waitForTimeout(600)
  await p.locator('[data-piece="6"]').click({ force: true })
  await p.waitForTimeout(150)
  const back = await p.locator('.status__next[data-nudge="true"]').textContent().catch(() => null)
  check('a pool tap while placing says the same', /place the piece/i.test(back ?? ''), String(back))
  check('no console errors while refusing', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ── Both surfaces stay readable to assistive tech ───────────────────────────
// Which pieces are left, and what is already on the board, is what a player
// plans with — including in the half of the turn they cannot act in.
{
  const { p, ctx } = await open()
  await begin(p)
  check(
    'board cells are never truly disabled',
    await p.evaluate(() => [...document.querySelectorAll('.cell')].every((c) => !c.disabled)),
  )
  await p.locator('[data-piece="3"]').click()
  await p.waitForTimeout(600)
  check(
    'pool slots are never truly disabled',
    await p.evaluate(() => [...document.querySelectorAll('.slot')].every((s) => !s.disabled)),
  )
  const stops = await p.evaluate(() =>
    [...document.querySelectorAll('.cell,.slot')].filter((e) => e.tabIndex === 0).map((e) => e.className),
  )
  check('only the live surface is a tab stop', stops.length === 1 && stops[0] === 'cell', JSON.stringify(stops))
  check('the game screen has exactly one h1', (await p.locator('h1').count()) === 1)
  await ctx.close()
}

// ── A game in progress survives being closed ────────────────────────────────
{
  const { p, ctx } = await open()
  await begin(p)
  await p.locator('[data-piece="3"]').click()
  await p.waitForTimeout(400)
  await p.locator('[data-cell="5"]').click()
  await p.waitForTimeout(600)
  await p.locator('[data-piece="6"]').click()
  await p.waitForTimeout(600)
  const before = await p.evaluate(() => ({
    status: document.querySelector('.status').textContent,
    pool: document.querySelectorAll('.slot[data-state="available"]').length,
    board: document.querySelectorAll('.cell__piece').length,
  }))

  await p.reload({ waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(700)
  check('an unfinished game simply opens again', (await p.locator('.setup__title').count()) === 0)
  await p.waitForSelector('.board__slab')
  await p.waitForTimeout(600)
  const after = await p.evaluate(() => ({
    status: document.querySelector('.status').textContent,
    pool: document.querySelectorAll('.slot[data-state="available"]').length,
    board: document.querySelectorAll('.cell__piece').length,
  }))
  check('resuming restores the turn', before.status === after.status, `${before.status} vs ${after.status}`)
  check('resuming restores the pool', before.pool === after.pool, `${before.pool} vs ${after.pool}`)
  check('resuming restores the board', before.board === after.board, `${before.board} vs ${after.board}`)
  await ctx.close()
}

// ── A home-screen shortcut goes straight into a game ────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const p = await ctx.newPage()
  await p.goto(`${URL}?new=computer`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1200)
  check('a shortcut skips the start screen', (await p.locator('.setup__title').count()) === 0)
  check('a shortcut picks its mode', (await p.locator('.topbar__mode').textContent()).includes('Vs computer'))
  check('a shortcut cleans the URL behind it', !p.url().includes('new='), p.url())
  await ctx.close()
}

// ── A finger goes straight to the move ──────────────────────────────────────
// The shelf preview is a hover affordance and a touch screen has no hover: a
// tap fires pointerenter and focus on its way to the click, so the piece used
// to flash onto the shelf for a frame and then fly there anyway.
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true })
  const p = await ctx.newPage()
  await p.goto(URL, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.setup__title')
  await p.getByRole('radio', { name: 'Two players', exact: true }).click()
  await p.getByRole('button', { name: /^(Begin|Start new game)$/ }).click()
  await p.waitForSelector('.board__slab')
  await p.waitForTimeout(600)

  await p.evaluate(() => {
    window.__ghost = 0
    window.__n = 0
    const tick = () => {
      const el = document.querySelector('.tray .tray__piece')
      if (el?.dataset.ghost === 'true') window.__ghost++
      if (++window.__n < 70) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await p.locator('[data-piece="9"]').tap()
  await p.waitForTimeout(1200)
  check('a tap shows no preview on its way to the move', (await p.evaluate(() => window.__ghost)) === 0)
  check('the tap made the move', (await p.locator('.tray .tray__piece').count()) === 1)

  // The hand is one short row on a phone, with no dashed placeholder standing
  // in for the piece that is not there.
  const tray = await p.evaluate(() => {
    const t = document.querySelector('.tray')
    return {
      h: Math.round(t.getBoundingClientRect().height),
      label: getComputedStyle(document.querySelector('.tray__label')).display,
    }
  })
  check('the phone hand row stays compact', tray.h <= 70, `${tray.h}px`)
  check('the phone hand row drops the label the status already carries', tray.label === 'none')
  await ctx.close()
}

// A mouse still gets the preview it is for.
{
  const { p, ctx } = await open()
  await begin(p)
  await p.locator('[data-piece="6"]').hover()
  await p.waitForTimeout(400)
  const shelf = await p.evaluate(() => document.querySelector('.tray .tray__piece')?.dataset.ghost)
  check('a mouse hover still previews on the shelf', shelf === 'true', String(shelf))
  await ctx.close()
}

// ── Giving a piece away must not look like being given one ──────────────────
// Both used to be the same arc onto the same shelf with the same four
// attributes spelled out, and the computer took its piece back off the shelf
// about 90ms after it landed — so handing one over read as a flicker.
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true })
  const p = await ctx.newPage()
  await p.goto(URL, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.setup__title')
  await p.getByRole('radio', { name: 'Vs computer', exact: true }).click()
  await p.getByRole('button', { name: /^(Begin|Start new game)$/ }).click()
  await p.waitForSelector('.board__slab')
  await p.waitForTimeout(700)

  /*
   * Sampled across the whole exchange rather than at a guessed instant: the
   * window this is about is half a second long and the assertions are about
   * what was on screen during it, not about what happens to be there when a
   * timeout fires.
   */
  await p.evaluate(() => {
    window.__seen = { rest: 0, text: '', dim: 1, away: false }
    window.__t0 = performance.now()
    const tick = () => {
      const tray = document.querySelector('.tray')
      const piece = document.querySelector('.tray .tray__piece')
      if (tray?.dataset.away === 'true' && piece && piece.dataset.hidden !== 'true') {
        window.__seen.rest++
        window.__seen.away = true
        window.__seen.text = document.querySelector('.tray__attrs')?.textContent ?? ''
        window.__seen.dim = +getComputedStyle(piece.querySelector('.piece') ?? piece).opacity
      }
      if (performance.now() - window.__t0 < 4000) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await p.locator('[data-piece="3"]').tap()
  await p.waitForTimeout(4100)
  const away = await p.evaluate(() => window.__seen)
  check('a handed-over piece is marked as the opponent\'s', away.away, JSON.stringify(away))
  check('it names the owner rather than the piece', /places/i.test(away.text), away.text)
  check('it is drawn back from full strength', away.dim < 0.8, String(away.dim))
  // ~500ms of rest at 60fps is about 30 frames; anything under 12 is a flash.
  check('it rests long enough to be seen', away.rest >= 12, `${away.rest} frames`)

  await p.waitForSelector('.tray[data-armed="true"]', { timeout: 15000 })
  const mine = await p.evaluate(() => ({
    away: document.querySelector('.tray')?.dataset.away,
    text: document.querySelector('.tray__attrs')?.textContent ?? '',
    dim: +getComputedStyle(document.querySelector('.tray .tray__piece .piece')).opacity,
  }))
  check('a piece handed to you is not marked as theirs', mine.away === undefined)
  // Your own piece needs no caption: the drawing says what it is, and the
  // status line above says what to do with it.
  check('yours says nothing the drawing already shows', mine.text.trim() === '', mine.text)
  check('yours is at full strength', mine.dim === 1, String(mine.dim))
  await ctx.close()
}

// ── Horizontal overflow at common widths ────────────────────────────────────
for (const width of [320, 360, 390, 414, 768, 1024, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 } })
  const p = await ctx.newPage()
  await p.goto(URL, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.setup__title')
  await p.getByRole('button', { name: /^(Begin|Start new game)$/ }).click()
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
