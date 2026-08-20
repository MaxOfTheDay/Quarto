import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  createGame,
  describePiece,
  isGameStarted,
  otherPlayer,
  phaseOf,
  placePiece,
  selectPiece,
  type GameState,
  type Phase,
  type PieceId,
  type PlayerId,
} from '../game'
import { AiClient } from '../game/ai/bridge'
import type { Difficulty } from '../game/ai'
import { flyClone, prefersReducedMotion } from '../lib/flight'
import { useMediaQuery } from '../lib/useMediaQuery'
import { resolveOpener, usePrefs, type Mode } from '../lib/prefs'
import { usePwa } from '../lib/pwa'
import { play, setSoundEnabled } from '../lib/sound'
import { Board } from './Board'
import { HandTray } from './HandTray'
import { Modal } from './Modal'
import { PieceDefs } from './PieceGlyph'
import { Pool } from './Pool'
import { ResultPanel } from './ResultPanel'
import { RulesSheet } from './RulesSheet'
import { Setup } from './Setup'

/** How long the computer pauses before acting, so its moves stay readable. */
const THINK_FLOOR = 420
const PASS_DELAY = 340

interface Session {
  mode: Mode
  difficulty: Difficulty
  /** The side the person at the keyboard controls; null when both are human. */
  human: PlayerId | null
  names: [string, string]
  possessives: [string, string]
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function App() {
  const [prefs, setPrefs] = usePrefs()
  const [session, setSession] = useState<Session | null>(null)
  const [history, setHistory] = useState<GameState[]>(() => [createGame(0)])
  const [showSetup, setShowSetup] = useState(true)
  const [showRules, setShowRules] = useState(false)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [trayHidden, setTrayHidden] = useState(false)
  const { canInstall, updateReady, install, update } = usePwa()

  const state = history[history.length - 1]
  const phase = phaseOf(state)

  const ai = useRef<AiClient | null>(null)
  const plannedGift = useRef<number>(-1)
  const trayRef = useRef<HTMLSpanElement>(null)
  const slotEls = useRef(new Map<PieceId, HTMLElement>())
  const pendingPass = useRef<DOMRect | null>(null)
  const trayAreaRef = useRef<HTMLDivElement>(null)
  const poolAreaRef = useRef<HTMLDivElement>(null)

  if (!ai.current) ai.current = new AiClient()
  useEffect(() => () => ai.current?.dispose(), [])

  useEffect(() => setSoundEnabled(prefs.sound), [prefs.sound])
  useEffect(() => {
    document.documentElement.dataset.motion = prefs.reducedEffects ? 'reduced' : 'full'
  }, [prefs.reducedEffects])

  const isAiTurn =
    session !== null && session.human !== null && !state.outcome && state.turn !== session.human
  const localTurn = !showSetup && !state.outcome && !isAiTurn

  /* ── Moves ────────────────────────────────────────────────────────────── */

  const commitPlace = useCallback((cell: number) => {
    setHistory((h) => {
      const next = placePiece(h[h.length - 1], cell)
      return next === h[h.length - 1] ? h : [...h, next]
    })
  }, [])

  const commitSelect = useCallback((piece: PieceId) => {
    setHistory((h) => {
      const next = selectPiece(h[h.length - 1], piece)
      return next === h[h.length - 1] ? h : [...h, next]
    })
  }, [])

  const onPlace = useCallback(
    (cell: number) => {
      if (!localTurn || phase !== 'place') return
      play('place')
      commitPlace(cell)
    },
    [localTurn, phase, commitPlace],
  )

  const onSelect = useCallback(
    (piece: PieceId) => {
      if (!localTurn || phase !== 'select') return
      const source = slotEls.current.get(piece)
      pendingPass.current = source?.getBoundingClientRect() ?? null
      play('select')
      commitSelect(piece)
    },
    [localTurn, phase, commitSelect],
  )

  /* ── The computer ─────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!isAiTurn || !session || showSetup) return
    let cancelled = false

    const run = async () => {
      const request = {
        cells: state.board.map((c) => (c === null ? -1 : c)),
        hand: state.hand ?? -1,
        avail: state.pool.reduce((mask, p) => mask | (1 << p), 0),
        difficulty: session.difficulty,
      }

      if (state.hand !== null) {
        setThinking(true)
        const started = performance.now()
        const move = await ai.current!.think(request)
        await sleep(Math.max(0, THINK_FLOOR - (performance.now() - started)))
        if (cancelled) return
        setThinking(false)
        plannedGift.current = move.gift
        play('place')
        // The search always returns a legal cell; falling back to the first
        // empty one means a surprise can never leave the game stuck mid-turn.
        commitPlace(move.cell >= 0 ? move.cell : state.board.findIndex((c) => c === null))
        return
      }

      // The placement search already picked the reply piece; reuse it.
      let gift = plannedGift.current
      plannedGift.current = -1
      if (gift < 0 || !state.pool.includes(gift)) {
        setThinking(true)
        const move = await ai.current!.think(request)
        if (cancelled) return
        gift = move.gift
      }
      await sleep(PASS_DELAY)
      if (cancelled) return
      setThinking(false)
      if (gift < 0) gift = state.pool[0] ?? -1
      if (gift >= 0) {
        pendingPass.current = slotEls.current.get(gift)?.getBoundingClientRect() ?? null
        play('select')
        commitSelect(gift)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [isAiTurn, session, showSetup, state, commitPlace, commitSelect])

  /* ── Passing a piece across the table ─────────────────────────────────── */

  useLayoutEffect(() => {
    const from = pendingPass.current
    pendingPass.current = null
    if (!from || !trayRef.current || prefersReducedMotion()) return
    setTrayHidden(true)
    void flyClone(from, trayRef.current, { duration: 340, lift: 30 }).then(() => setTrayHidden(false))
  }, [state.ply])

  /* ── Following the turn on a small screen ─────────────────────────────── */

  // Must match the stacked layout's condition in rail.css: in landscape the
  // board and pool are side by side, so there is nothing to scroll between.
  const stacked = useMediaQuery('(max-width: 900px) and (min-height: 561px), (max-width: 619px)')
  // null means "not positioned yet", so the opening turn scrolls too — a game
  // starts in the choosing phase with the pool below the fold.
  const lastPhase = useRef<Phase | null>(null)

  useEffect(() => {
    if (!stacked || showSetup || !localTurn) return
    const changed = lastPhase.current !== phase
    lastPhase.current = phase
    if (!changed) return
    // Stacked on a phone, the piece pool and the board cannot both be in view;
    // move to whichever one the player now has to act on.
    const target = phase === 'select' ? poolAreaRef.current : trayAreaRef.current
    target?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: phase === 'select' ? 'nearest' : 'start',
    })
  }, [phase, stacked, showSetup, localTurn])

  /* ── Outcome ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!state.outcome) return
    play(state.outcome.kind === 'win' ? 'win' : 'draw')
  }, [state.outcome])

  /* ── Game lifecycle ───────────────────────────────────────────────────── */

  const startGame = useCallback(() => {
    const opener = resolveOpener(prefs.opener)
    const vsComputer = prefs.mode === 'computer'
    setSession({
      mode: prefs.mode,
      difficulty: prefs.difficulty,
      human: vsComputer ? 0 : null,
      names: vsComputer ? ['You', 'Computer'] : ['Player 1', 'Player 2'],
      possessives: vsComputer ? ['your', 'the computer\u2019s'] : ['Player 1\u2019s', 'Player 2\u2019s'],
    })
    plannedGift.current = -1
    lastPhase.current = null
    setThinking(false)
    setHistory([createGame(opener)])
    setShowSetup(false)
    setPrefs({ seenIntro: true })
  }, [prefs, setPrefs])

  const rematch = useCallback(() => {
    plannedGift.current = -1
    lastPhase.current = null
    setThinking(false)
    setHistory([createGame(resolveOpener(prefs.opener))])
  }, [prefs.opener])

  const requestNewGame = useCallback(() => {
    if (!state.outcome && isGameStarted(state)) setConfirmRestart(true)
    else setShowSetup(true)
  }, [state])

  const canUndo = history.length > 1 && !thinking && !isAiTurn && !showSetup

  const undo = useCallback(() => {
    if (!canUndo) return
    setHistory((h) => {
      if (h.length < 2) return h
      const next = h.slice(0, -1)
      // Against the computer, rewind to the last decision that was actually yours.
      if (session?.human !== null && session !== null) {
        while (next.length > 1 && next[next.length - 1].turn !== session.human) next.pop()
      }
      return next
    })
    plannedGift.current = -1
    play('undo')
  }, [canUndo, session])

  /* ── New builds ───────────────────────────────────────────────────────── */

  useEffect(() => {
    // On the setup screen there is no position to lose, so a waiting build is
    // taken silently. Mid-game it waits behind a quiet control instead — which
    // together means nobody can end up stranded on an old version.
    if (updateReady && showSetup) update()
  }, [updateReady, showSetup, update])

  /* ── Keyboard ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return

      const key = event.key.toLowerCase()
      if (key === '?' || (key === '/' && event.shiftKey)) {
        event.preventDefault()
        setShowRules((v) => !v)
      } else if (key === 'm') {
        setPrefs({ sound: !prefs.sound })
      } else if (key === 'u' && canUndo) {
        event.preventDefault()
        undo()
      } else if (key === 'n' && !showRules) {
        event.preventDefault()
        requestNewGame()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prefs.sound, setPrefs, canUndo, undo, requestNewGame, showRules])

  /* ── Copy ─────────────────────────────────────────────────────────────── */

  const names = session?.names ?? ['Player 1', 'Player 2']
  const possessives = session?.possessives ?? ['Player 1\u2019s', 'Player 2\u2019s']
  const opponent = otherPlayer(state.turn)

  const status = useMemo(() => {
    if (state.outcome) {
      return state.outcome.kind === 'win'
        ? { actor: names[state.outcome.player], action: 'wins' }
        : { actor: 'Draw', action: 'the board is full' }
    }
    if (isAiTurn) {
      return { actor: names[state.turn], action: thinking ? 'is thinking' : 'is playing' }
    }
    return {
      actor: names[state.turn],
      action: phase === 'place' ? 'place this piece' : `choose ${possessives[opponent]} piece`,
    }
  }, [state.outcome, state.turn, isAiTurn, thinking, phase, names, possessives, opponent])

  const announcement = useMemo(() => {
    if (state.outcome) {
      return state.outcome.kind === 'win'
        ? `${names[state.outcome.player]} wins.`
        : 'The board is full. The game is a draw.'
    }
    const who = names[state.turn]
    if (state.hand !== null) return `${who} to place the ${describePiece(state.hand)} piece.`
    return `${who} to choose a piece for ${names[opponent]}.`
  }, [state.outcome, state.turn, state.hand, names, opponent])

  const modeLabel =
    session === null
      ? ''
      : session.mode === 'computer'
        ? `Vs computer · ${session.difficulty[0].toUpperCase()}${session.difficulty.slice(1)}`
        : 'Two players'

  // While the setup screen covers the game, `inert` keeps everything behind it
  // out of the tab order and the accessibility tree — aria-hidden alone would
  // still let a keyboard reach the controls.
  const covered = showSetup ? ({ inert: '' } as const) : {}

  return (
    <div className="app">
      <PieceDefs />

      <div className="app__shell" {...covered}>
      <header className="topbar">
        <div className="topbar__left">
          <span className="wordmark">Quarto</span>
          {modeLabel && <span className="topbar__mode">{modeLabel}</span>}
        </div>
        <div className="topbar__right">
          {updateReady && !showSetup && (
            <button type="button" className="btn btn--quiet topbar__update" onClick={update}>
              Update ready
            </button>
          )}
          {canInstall && (
            <button type="button" className="btn btn--quiet topbar__install" onClick={install}>
              Install
            </button>
          )}
          <button type="button" className="btn btn--quiet" onClick={() => setShowRules(true)}>
            Rules
          </button>
          <button
            type="button"
            className="btn btn--quiet"
            aria-label="Sound"
            aria-pressed={prefs.sound}
            onClick={() => setPrefs({ sound: !prefs.sound })}
          >
            {prefs.sound ? 'Sound' : 'Muted'}
          </button>
          <button type="button" className="btn" onClick={requestNewGame}>
            New game
          </button>
        </div>
      </header>

      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>

      <main className="stage" data-over={state.outcome ? 'true' : undefined}>
        <div className="stage__status">
          <p className="status" data-live={localTurn ? 'true' : undefined}>
            <span className="status__actor">{status.actor}</span>
            <span className="status__action">{status.action}</span>
            {isAiTurn && thinking && <span className="status__pulse" aria-hidden="true" />}
          </p>
          {!state.outcome && (
          <ol className="phases" aria-hidden="true">
            <li className="phases__step" data-on={phase === 'place' ? 'true' : undefined}>
              <span className="phases__rule" />
              <span className="phases__label">1 Place</span>
            </li>
            <li className="phases__step" data-on={phase === 'select' ? 'true' : undefined}>
              <span className="phases__rule" />
              <span className="phases__label">2 Choose</span>
            </li>
          </ol>
          )}
        </div>

        {!state.outcome && (
        <div className="stage__tray" ref={trayAreaRef}>
          <HandTray
            ref={trayRef}
            piece={state.hand}
            label="In hand"
            description={
              state.hand === null
                ? 'No piece in hand'
                : `In hand: piece for ${names[state.turn]} to place`
            }
            hidden={trayHidden}
            armed={localTurn && phase === 'place'}
          />
        </div>
        )}

        <div className="stage__board">
          <Board
            board={state.board}
            placing={localTurn && phase === 'place'}
            lastPlaced={state.lastPlaced}
            win={state.outcome?.kind === 'win' ? state.outcome.line : null}
            onPlace={onPlace}
          />
          <div className="board-foot">
            <button type="button" className="btn btn--quiet" onClick={undo} disabled={!canUndo}>
              Undo
            </button>
          </div>
        </div>

        <div className="stage__pool" ref={poolAreaRef}>
          {state.outcome && session ? (
            <ResultPanel
              outcome={state.outcome}
              board={state.board}
              names={names}
              onRematch={rematch}
              onNewGame={() => setShowSetup(true)}
            />
          ) : (
            <section className="rail-section">
              <div className="rail-section__head">
                <p className="eyebrow" data-accent={localTurn && phase === 'select' ? 'true' : undefined}>
                  {localTurn && phase === 'select' ? 'Hand one over' : 'Remaining'}
                </p>
                <p className="eyebrow rail-section__count">{state.pool.length}</p>
              </div>
              <Pool
                pool={state.pool}
                selecting={localTurn && phase === 'select'}
                onSelect={onSelect}
                slotRef={(piece, el) => {
                  if (el) slotEls.current.set(piece, el)
                  else slotEls.current.delete(piece)
                }}
              />
            </section>
          )}
        </div>
      </main>

      </div>

      {showSetup && (
        <Setup
          prefs={prefs}
          onChange={setPrefs}
          onStart={startGame}
          onRules={() => setShowRules(true)}
          onInstall={canInstall ? install : undefined}
          onDismiss={session ? () => setShowSetup(false) : undefined}
        />
      )}

      {showRules && (
        <RulesSheet prefs={prefs} onChange={setPrefs} onClose={() => setShowRules(false)} />
      )}

      {confirmRestart && (
        <Modal title="Start a new game?" onClose={() => setConfirmRestart(false)} variant="confirm">
          <h2 className="sheet__title">Abandon this game?</h2>
          <p className="sheet__text">The current position will be lost.</p>
          <div className="sheet__actions">
            <button type="button" className="btn" onClick={() => setConfirmRestart(false)}>
              Keep playing
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setConfirmRestart(false)
                setShowSetup(true)
              }}
            >
              New game
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
