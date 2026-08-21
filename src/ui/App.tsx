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
  type PieceId,
  type PlayerId,
} from '../game'
import { AiClient } from '../game/ai/bridge'
import type { Difficulty } from '../game/ai'
import { flyClone, prefersReducedMotion } from '../lib/flight'
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
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Speaker with waves, or speaker with a slash. The state is in the shape. */
function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" strokeLinejoin="round" />
      {on ? (
        <>
          <path d="M15 9.5a3.5 3.5 0 0 1 0 5" strokeLinecap="round" />
          <path d="M17.8 6.8a7 7 0 0 1 0 10.4" strokeLinecap="round" />
        </>
      ) : (
        <path d="m16 9.5 5 5m0-5-5 5" strokeLinecap="round" />
      )}
    </svg>
  )
}

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
  const stageRef = useRef<HTMLElement>(null)
  /** Set when a move is made from the keyboard, so focus can be handed on. */
  const followFocus = useRef(false)

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
      followFocus.current = stageRef.current?.contains(document.activeElement) ?? false
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
      followFocus.current = stageRef.current?.contains(document.activeElement) ?? false
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

  /* ── Following the turn with the keyboard ─────────────────────────────── */

  /*
   * Acting on a cell or a piece disables it, and the browser drops focus to the
   * body when that happens — which leaves a keyboard player tabbing in from the
   * top of the page after every half-move. Focus is only ever *restored*, never
   * taken: if it has landed somewhere real, this does nothing.
   */
  useEffect(() => {
    if (!followFocus.current || !localTurn || showSetup || showRules || confirmRestart) return
    const active = document.activeElement
    if (active && active !== document.body && active !== document.documentElement) return
    const target = stageRef.current?.querySelector<HTMLElement>(
      phase === 'place' ? '.cell[data-target]' : '.slot:not([disabled])',
    )
    if (!target) return
    followFocus.current = false
    target.focus({ preventScroll: true })
  }, [state.ply, localTurn, phase, showSetup, showRules, confirmRestart])

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
    })
    plannedGift.current = -1
    setThinking(false)
    setHistory([createGame(opener)])
    setShowSetup(false)
    setPrefs({ seenIntro: true })
  }, [prefs, setPrefs])

  const rematch = useCallback(() => {
    plannedGift.current = -1
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
    // On the start screen there is no position to lose, so a waiting build is
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
  const opponent = otherPlayer(state.turn)
  /** "Your" for the person at the keyboard, "Computer’s" or "Player 1’s" otherwise. */
  const possessive = (player: PlayerId) =>
    session?.human === player ? 'Your' : `${names[player]}’s`

  /**
   * One line for the whole turn: who is acting, what they must do, and what
   * happens straight afterwards — the question Quarto's split turn keeps
   * raising, answered where the answer is needed rather than in a tutorial.
   */
  const status = useMemo(() => {
    if (state.outcome) {
      return state.outcome.kind === 'win'
        ? { actor: names[state.outcome.player], action: 'wins', next: '' }
        : { actor: 'Draw', action: '', next: '' }
    }
    if (isAiTurn) {
      return {
        actor: names[state.turn],
        action: thinking ? 'is thinking' : 'is playing',
        next: '',
      }
    }
    const actor = session?.human === state.turn ? 'Your turn' : names[state.turn]
    return phase === 'place'
      ? { actor, action: 'to place', next: `Then choose a piece for ${names[opponent]}.` }
      : { actor, action: 'to choose', next: `${names[opponent]} places it next.` }
  }, [state.outcome, state.turn, isAiTurn, thinking, phase, names, opponent, session])

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

  // While the start screen covers the game, `inert` keeps everything behind it
  // out of the tab order and the accessibility tree — aria-hidden alone would
  // still let a keyboard reach the controls.
  const covered = showSetup ? ({ inert: '' } as const) : {}

  const choosing = phase === 'select'

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
              className="btn btn--quiet btn--icon"
              aria-label={prefs.sound ? 'Sound on' : 'Sound off'}
              aria-pressed={prefs.sound}
              title={prefs.sound ? 'Sound on' : 'Sound off'}
              onClick={() => setPrefs({ sound: !prefs.sound })}
            >
              <SoundIcon on={prefs.sound} />
            </button>
            <button type="button" className="btn" onClick={requestNewGame}>
              New game
            </button>
          </div>
        </header>

        <p className="visually-hidden" role="status" aria-live="polite">
          {announcement}
        </p>

        <main className="stage" ref={stageRef} data-over={state.outcome ? 'true' : undefined}>
          <div className="stage__status">
            <p
              className="status"
              data-live={localTurn ? 'true' : undefined}
              data-outcome={state.outcome ? 'true' : undefined}
            >
              <span className="status__line">
                <span className="status__actor">{status.actor}</span>
                {status.action && <span className="status__action">{status.action}</span>}
                {isAiTurn && thinking && <span className="status__pulse" aria-hidden="true" />}
              </span>
              <span className="status__next">{status.next}</span>
            </p>

            <button type="button" className="btn btn--quiet undo" onClick={undo} disabled={!canUndo}>
              Undo
            </button>
          </div>

          <div className="stage__board">
            <Board
              board={state.board}
              placing={localTurn && phase === 'place'}
              lastPlaced={state.lastPlaced}
              win={state.outcome?.kind === 'win' ? state.outcome.line : null}
              onPlace={onPlace}
            />
          </div>

          <div className="stage__rail">
            {!state.outcome && (
              <div className="stage__tray">
                <HandTray
                  ref={trayRef}
                  piece={state.hand}
                  label={choosing ? `For ${names[opponent]}` : `${possessive(state.turn)} piece`}
                  description={
                    choosing
                      ? `Empty. The piece chosen now goes to ${names[opponent]}.`
                      : `In play: the ${describePiece(state.hand!)} piece, for ${names[state.turn]} to place`
                  }
                  hidden={trayHidden}
                  armed={localTurn && phase === 'place'}
                />
              </div>
            )}

            <div className="stage__pool">
              {state.outcome && session ? (
                <ResultPanel
                  outcome={state.outcome}
                  onRematch={rematch}
                  onNewGame={() => setShowSetup(true)}
                />
              ) : (
                <section
                  className="rail-section"
                  data-armed={localTurn && choosing ? 'true' : undefined}
                >
                  <div className="rail-section__head">
                    <p className="eyebrow" data-accent={localTurn && choosing ? 'true' : undefined}>
                      Remaining
                    </p>
                    <p className="eyebrow rail-section__count">{state.pool.length}</p>
                  </div>
                  <Pool
                    pool={state.pool}
                    selecting={localTurn && choosing}
                    onSelect={onSelect}
                    slotRef={(piece, el) => {
                      if (el) slotEls.current.set(piece, el)
                      else slotEls.current.delete(piece)
                    }}
                  />
                </section>
              )}
            </div>
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
          <h2 className="sheet__title">Start a new game?</h2>
          <p className="sheet__text">This game will be lost.</p>
          <div className="sheet__actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setConfirmRestart(false)
                setShowSetup(true)
              }}
            >
              New game
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setConfirmRestart(false)}>
              Keep playing
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
