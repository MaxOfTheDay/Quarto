import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  createGame,
  describePiece,
  isGameStarted,
  isHotPiece,
  otherPlayer,
  phaseOf,
  placePiece,
  selectPiece,
  winningCellsFor,
  type GameState,
  type PieceId,
} from '../game'
import { AiClient } from '../game/ai/bridge'
import { flyClone, prefersReducedMotion } from '../lib/flight'
import { coachingActive, resolveOpener, usePrefs, type Mode } from '../lib/prefs'
import { usePwa } from '../lib/pwa'
import { clear as clearSave, load as loadSave, save as saveGame, type SavedGame, type Session } from '../lib/save'
import { play, setSoundEnabled } from '../lib/sound'
import { Board } from './Board'
import { HandTray } from './HandTray'
import { Menu } from './Menu'
import { Modal } from './Modal'
import { PieceDefs } from './PieceGlyph'
import { Pool } from './Pool'
import { ResultPanel } from './ResultPanel'
import { RulesSheet } from './RulesSheet'
import { SettingsSheet } from './SettingsSheet'
import { Setup } from './Setup'

/*
 * How long a piece takes to cross from the pool to the shelf, and how high it
 * arcs on the way.
 *
 * The arc is the clearest explanation of the split turn anywhere in the game,
 * so the very first pass of a very first game used to run at 620ms and the
 * rest at 340. That is one animation per install, seen by nobody who has
 * played before — and if it is worth watching once it is worth watching every
 * time. One pace, between the two.
 */
const PASS_FLIGHT = 450
const PASS_LIFT = 36

/**
 * How long the computer pauses before placing.
 *
 * It has to outlast the flight of the piece it was just handed, or the piece
 * arrives on the shelf and is removed in the same breath — which is what made
 * handing a piece over read as a flicker rather than as a move. The floor is
 * the flight plus long enough to see what changed hands.
 */
const THINK_FLOOR = PASS_FLIGHT + 520
const PASS_DELAY = 340
/** How long a nudge on the live surface lasts after a click on the inert one. */
const REFUSE_MS = 700

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function App() {
  const [prefs, setPrefs] = usePrefs()
  /*
   * A long-press on the home-screen icon asks for a specific game. Read once,
   * and stripped from the URL immediately so a reload does not silently throw
   * away whatever is being played by then. It is read before the saved game,
   * because asking for a new one has to beat reopening the old one.
   */
  const [shortcut] = useState<Mode | null>(() => {
    if (typeof window === 'undefined') return null
    const asked = new URLSearchParams(window.location.search).get('new')
    if (asked !== 'computer' && asked !== 'local') return null
    window.history.replaceState(null, '', window.location.pathname)
    return asked
  })

  /*
   * A game left unfinished simply opens again, the way a board left on a table
   * is still there in the morning. Asking "resume or not?" put a decision in
   * front of a player who came to play, made declining it cost two taps, and
   * described the position in metadata nobody chooses on. Starting something
   * else is one tap away in the menu, and the status line says where you are.
   */
  const [saved] = useState<SavedGame | null>(() => (shortcut ? null : loadSave()))
  const [session, setSession] = useState<Session | null>(() => saved?.session ?? null)
  const [history, setHistory] = useState<GameState[]>(() => saved?.history ?? [createGame(0)])
  const [showSetup, setShowSetup] = useState(() => saved === null)
  const [showRules, setShowRules] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [confirmHot, setConfirmHot] = useState<PieceId | null>(null)
  const [thinking, setThinking] = useState(false)
  const [trayHidden, setTrayHidden] = useState(false)
  const [preview, setPreview] = useState<PieceId | null>(null)
  const [refused, setRefused] = useState(false)
  const { canInstall, updateReady, install, update } = usePwa()

  const state = history[history.length - 1]
  const phase = phaseOf(state)

  const ai = useRef<AiClient | null>(null)
  const plannedGift = useRef<number>(-1)
  const trayRef = useRef<HTMLSpanElement>(null)
  const slotEls = useRef(new Map<PieceId, HTMLElement>())
  const pendingPass = useRef<DOMRect | null>(null)
  const stageRef = useRef<HTMLElement>(null)
  const refuseTimer = useRef<number | undefined>(undefined)
  /** Set when a move is made from the keyboard, so focus can be handed on. */
  const followFocus = useRef(false)

  if (!ai.current) ai.current = new AiClient()
  useEffect(() => () => ai.current?.dispose(), [])

  useEffect(() => setSoundEnabled(prefs.sound), [prefs.sound])
  useEffect(() => {
    document.documentElement.dataset.motion = prefs.reducedEffects ? 'reduced' : 'full'
  }, [prefs.reducedEffects])

  // An explicit choice stamps the root; 'system' leaves it to the media query.
  useEffect(() => {
    const root = document.documentElement
    if (prefs.theme === 'system') delete root.dataset.theme
    else root.dataset.theme = prefs.theme
  }, [prefs.theme])

  const isAiTurn =
    session !== null && session.human !== null && !state.outcome && state.turn !== session.human
  const localTurn = !showSetup && !state.outcome && !isAiTurn
  const choosing = phase === 'select'

  /* ── What the engine already knows ────────────────────────────────────── */

  /*
   * Quarto is lost by handing over a piece without noticing it finishes a line.
   * The rules module can see that; showing it is the difference between losing
   * repeatedly and learning something. It retires itself once it has been
   * learned, and never appears against Hard.
   */
  const coaching =
    session !== null &&
    localTurn &&
    coachingActive(prefs, session.difficulty, session.mode === 'computer')

  const winningCells = useMemo(
    () =>
      coaching && phase === 'place' && state.hand !== null
        ? winningCellsFor(state.board, state.hand)
        : [],
    [coaching, phase, state.board, state.hand],
  )

  const hotPieces = useMemo(
    () =>
      coaching && choosing ? state.pool.filter((piece) => isHotPiece(state.board, piece)) : [],
    [coaching, choosing, state.pool, state.board],
  )

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

  /*
   * Whether to hand focus on to the next surface. Clicking a button focuses it
   * too, so "focus is inside the stage" was true for mouse play as well — which
   * moved focus to the first open cell after every click and painted a ghost
   * piece there that nobody had pointed at. `:focus-visible` is exactly the
   * distinction the browser already draws: it matches when the focus came from
   * the keyboard, and not when it came from a pointer.
   */
  const keyboardPlay = () => {
    const active = document.activeElement
    if (!active || !stageRef.current?.contains(active)) return false
    try {
      return active.matches(':focus-visible')
    } catch {
      return false
    }
  }

  const onPlace = useCallback(
    (cell: number) => {
      if (!localTurn || phase !== 'place') return
      followFocus.current = keyboardPlay()
      play('place')
      commitPlace(cell)
    },
    [localTurn, phase, commitPlace],
  )

  const handOver = useCallback(
    (piece: PieceId) => {
      const source = slotEls.current.get(piece)
      pendingPass.current = source?.getBoundingClientRect() ?? null
      followFocus.current = keyboardPlay()
      setPreview(null)
      play('select')
      commitSelect(piece)
    },
    [commitSelect],
  )

  const onSelect = useCallback(
    (piece: PieceId) => {
      if (!localTurn || phase !== 'select') return
      // Handing over a winning piece is the one move worth a second look — but
      // only while the marks are on, and only for the piece that actually loses.
      if (hotPieces.includes(piece)) {
        setConfirmHot(piece)
        return
      }
      handOver(piece)
    },
    [localTurn, phase, hotPieces, handOver],
  )

  /*
   * Acting on the surface that is not yours this half-turn used to do nothing
   * at all, which reads as a broken app rather than as the wrong half of the
   * turn. The answer is to point at the surface that is live.
   */
  const onRefuse = useCallback(() => {
    if (!localTurn) return
    window.clearTimeout(refuseTimer.current)
    setRefused(true)
    refuseTimer.current = window.setTimeout(() => setRefused(false), REFUSE_MS)
  }, [localTurn])

  useEffect(() => () => window.clearTimeout(refuseTimer.current), [])

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
    // The shelf is only hidden while a clone is genuinely in the air; if the
    // animation cannot finish, it comes back rather than staying blank.
    let live = true
    const show = () => live && setTrayHidden(false)
    void flyClone(from, trayRef.current, { duration: PASS_FLIGHT, lift: PASS_LIFT }).then(show, show)
    const failsafe = window.setTimeout(show, 1400)
    return () => {
      live = false
      window.clearTimeout(failsafe)
      setTrayHidden(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ply])

  /* ── Following the turn with the keyboard ─────────────────────────────── */

  /*
   * Acting on a cell or a piece hands the turn to the other surface, and the
   * control that was just used stops being live — which leaves a keyboard
   * player stranded on a control that no longer does anything, or tabbing in
   * from the top of the page after every half-move. Focus is only ever moved
   * on from somewhere that has gone dead: if it has landed somewhere real,
   * this does nothing.
   */
  useEffect(() => {
    if (!followFocus.current || !localTurn || showSetup || showRules || confirmRestart) return
    const active = document.activeElement
    const stranded =
      !active ||
      active === document.body ||
      active === document.documentElement ||
      active.getAttribute('aria-disabled') === 'true'
    if (!stranded) return
    const target = stageRef.current?.querySelector<HTMLElement>(
      phase === 'place' ? '.cell[data-target]' : '.slot[tabindex="0"]',
    )
    if (!target) return
    followFocus.current = false
    target.focus({ preventScroll: true })
  }, [state.ply, localTurn, phase, showSetup, showRules, confirmRestart])

  /* ── Outcome ──────────────────────────────────────────────────────────── */

  const scored = useRef<GameState | null>(null)

  useEffect(() => {
    if (!state.outcome) return
    play(state.outcome.kind === 'win' ? 'win' : 'draw')
  }, [state.outcome])

  // A finished game is worth a point, exactly once — and an undo out of a
  // finished position takes it back.
  useEffect(() => {
    if (!state.outcome || !session) return
    if (scored.current === state) return
    scored.current = state
    setSession((s) => {
      if (!s) return s
      const tally: [number, number, number] = [...s.tally]
      if (state.outcome!.kind === 'win') tally[state.outcome!.player] += 1
      else tally[2] += 1
      return { ...s, tally }
    })
    clearSave()
  }, [state, session])

  /* ── Saving ───────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!session || showSetup) return
    if (state.outcome) return
    if (!isGameStarted(state)) return
    saveGame({ session, history })
  }, [session, history, state, showSetup])

  /* ── Game lifecycle ───────────────────────────────────────────────────── */

  const startGame = useCallback(
    (modeOverride?: Mode) => {
    const mode = modeOverride ?? prefs.mode
    const opener = resolveOpener(prefs.opener)
    const vsComputer = mode === 'computer'
    setSession({
      mode,
      difficulty: prefs.difficulty,
      human: vsComputer ? 0 : null,
      names: vsComputer ? ['You', 'Computer'] : ['Player 1', 'Player 2'],
      tally: [0, 0, 0],
    })
    plannedGift.current = -1
    scored.current = null
    setThinking(false)
    setHistory([createGame(opener)])
    setShowSetup(false)
    setPrefs({ mode })
    clearSave()
    },
    [prefs, setPrefs],
  )

  const startedFromShortcut = useRef(false)
  useEffect(() => {
    if (!shortcut || startedFromShortcut.current) return
    startedFromShortcut.current = true
    startGame(shortcut)
  }, [shortcut, startGame])

  const rematch = useCallback(() => {
    plannedGift.current = -1
    scored.current = null
    setThinking(false)
    setHistory([createGame(resolveOpener(prefs.opener))])
  }, [prefs.opener])

  const requestNewGame = useCallback(() => {
    if (!state.outcome && isGameStarted(state)) setConfirmRestart(true)
    else setShowSetup(true)
  }, [state])

  const openSetup = useCallback(() => setShowSetup(true), [])

  const canUndo = history.length > 1 && !thinking && !isAiTurn && !showSetup

  const undo = useCallback(() => {
    if (!canUndo) return
    scored.current = null
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
    /*
     * A waiting build used to be taken only on the start screen, because the
     * reload it causes would have thrown the game away. That rule relied on
     * every session beginning there — and a game left unfinished now reopens
     * straight into itself, so a player with a game on the go might never see
     * a start screen again and would sit on an old build indefinitely.
     *
     * The premise has changed: the position, its whole history and the running
     * tally are all saved, so a reload puts the player back exactly where they
     * were. The update is taken at the next quiet moment instead — the start
     * screen, or any point where the game is simply waiting on the person
     * playing it. It still never lands mid-flight or while the computer is
     * thinking, and the control in the top bar remains for the meantime.
     */
    if (!updateReady) return
    if (showSetup || (localTurn && !thinking)) update()
  }, [updateReady, showSetup, localTurn, thinking, update])

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

  /**
   * One line for the whole turn: who is acting, what they must do, and what
   * happens straight afterwards — the question Quarto's split turn keeps
   * raising, answered where the answer is needed rather than in a tutorial.
   */
  const status = useMemo(() => {
    if (state.outcome) {
      return state.outcome.kind === 'win'
        ? { actor: names[state.outcome.player], action: 'wins' }
        : { actor: 'Draw', action: '' }
    }
    // Who. What they must do is the line underneath, which never moves.
    if (isAiTurn) {
      return { actor: names[state.turn], action: thinking ? 'is thinking' : 'is playing' }
    }
    return session?.human === state.turn
      ? { actor: 'Your turn', action: '' }
      : { actor: `${names[state.turn]}’s turn`, action: '' }
  }, [state.outcome, state.turn, isAiTurn, thinking, names, session])

  /** The other player, as they are named inside a sentence about them. */
  const opponentName =
    session?.mode === 'computer' && session.human !== opponent ? 'the computer' : names[opponent]

  /*
   * The other half of the statement: what the player is to do, in the accent,
   * in the same place every turn.
   *
   * This line was here once and was taken out, for two reasons that were both
   * true. It said what the accent was already saying — and it was shown in a
   * player's first game only, so their first game was a different shape from
   * every game after it.
   *
   * What has changed is that the accent now means one thing. It marks the
   * surface to act on and nothing else, so the words and the light are two
   * halves of one signal rather than two signals saying the same thing; and the
   * line is here every turn of every game, so there is no first-game shape to
   * differ from. It also carries the one rule the screen has never stated
   * anywhere: the piece you pick is for the other player, by name.
   *
   * Empty while the move is not yours. Nothing is expected of you, and a line
   * that says so is a line that has to be read to find that out.
   */
  const direction = useMemo(() => {
    if (state.outcome || !localTurn) return ''
    return phase === 'place' ? 'Place this piece' : `Choose a piece for ${opponentName}`
  }, [state.outcome, localTurn, phase, opponentName])

  /*
   * The one thing the drawing cannot say, in the line that exists to say what
   * happens next — because that is exactly what this is. It used to live over
   * the pocket, where a phone gives it a column eighty pixels wide. Three
   * sentences can want this slot; they are told apart by their colour, and the
   * only one that is not the accent is this one.
   */
  const warning = preview !== null && hotPieces.includes(preview) ? 'Wins for your opponent' : ''

  /*
   * Answering a tap on the wrong surface, in the line that is already saying
   * what to do — the same sentence, put more firmly, while the surface that is
   * actually live flashes. Said every time rather than for the first three taps
   * of a session: the flash goes on happening for the whole game, and a signal
   * whose explanation has been withdrawn is worse than no signal.
   */
  const nudge =
    refused
      ? phase === 'place'
        ? 'Place your piece first.'
        : 'Choose a piece below.'
      : ''

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

  const undoLabel = state.outcome
    ? 'Take back'
    : phase === 'place'
      ? 'Undo choice'
      : 'Undo placement'

  return (
    <div className="app">
      <PieceDefs />

      <div className="app__shell" {...covered}>
        <header className="topbar">
          <div className="topbar__left">
            <h1 className="wordmark">Quarto</h1>
            {modeLabel && <span className="topbar__mode">{modeLabel}</span>}
          </div>
          <div className="topbar__right">
            {/*
              * Undo is app chrome, not turn state. Beside the status line it
              * was the only button in the game area and the only thing there
              * that looked pressable, next to the one line that most needed
              * reading; and being the rare, deliberate act it is, out of a
              * thumb's easy reach is where it belongs.
              */}
            {!showSetup && (
              <button
                type="button"
                className="btn btn--quiet undo"
                onClick={undo}
                disabled={!canUndo}
                title={
                  canUndo
                    ? phase === 'place'
                      ? 'Undo the last choice'
                      : 'Undo the last placement'
                    : undefined
                }
                /* Both labels are in the DOM and one of them is hidden, so the
                   accessible name is spelled out rather than left to whichever
                   the viewport happens to show. */
                aria-label={undoLabel}
              >
                <span className="undo__wide">{undoLabel}</span>
                {/* A label that changes width every half turn does not fit in a
                    phone's top bar beside the wordmark. */}
                <span className="undo__narrow">Undo</span>
              </button>
            )}
            {updateReady && !showSetup && (
              <button type="button" className="btn btn--quiet topbar__update" onClick={update}>
                Restart to update
              </button>
            )}
            {canInstall && (
              <button type="button" className="btn btn--quiet topbar__install" onClick={install}>
                Install
              </button>
            )}
            <Menu
              soundOn={prefs.sound}
              onToggleSound={() => setPrefs({ sound: !prefs.sound })}
              onRules={() => setShowRules(true)}
              onSettings={() => setShowSettings(true)}
              onNewGame={requestNewGame}
              showNewGame={!state.outcome}
            />
          </div>
        </header>

        <p className="visually-hidden" role="status" aria-live="polite">
          {announcement}
        </p>

        <main
          className="stage"
          ref={stageRef}
          data-over={state.outcome ? 'true' : undefined}
          data-draw={state.outcome?.kind === 'draw' ? 'true' : undefined}
          data-refuse={refused ? 'true' : undefined}
          data-phase={state.outcome ? 'over' : choosing ? 'select' : 'place'}
        >
          {/*
            * Who, and what they are to do — one statement, with the piece in
            * play beside it. The pocket is the other half of the sentence
            * "place this piece", which is why the two sit together and why the
            * pocket is not drawn at all when there is no piece to point at.
            */}
          <div className="stage__status">
            <p className="status" data-outcome={state.outcome ? 'true' : undefined}>
              <span className="status__line">
                <span className="status__actor">{status.actor}</span>
                {status.action && <span className="status__action">{status.action}</span>}
                {isAiTurn && thinking && <span className="status__thinking" aria-hidden="true" />}
              </span>
              <span
                className="status__next"
                data-nudge={nudge ? 'true' : undefined}
                data-warn={!nudge && warning ? 'true' : undefined}
              >
                {nudge || warning || direction}
              </span>
            </p>
          </div>

          <div className="stage__board">
            <Board
              board={state.board}
              placing={localTurn && phase === 'place'}
              hand={state.hand}
              lastPlaced={state.lastPlaced}
              win={state.outcome?.kind === 'win' ? state.outcome.line : null}
              winningCells={winningCells}
              onPlace={onPlace}
              onRefuse={onRefuse}
            />
          </div>

          <div className="stage__rail">
            {!state.outcome && (
              <div className="stage__tray">
                <HandTray
                  ref={trayRef}
                  piece={state.hand}
                  preview={localTurn && choosing ? preview : null}
                  description={
                    choosing
                      ? `No piece in play. The piece chosen now goes to ${names[opponent]}.`
                      : `In play: the ${describePiece(state.hand!)} piece, for ${names[state.turn]} to place`
                  }
                  hidden={trayHidden}
                  armed={localTurn && phase === 'place'}
                  warn={warning !== ''}
                />
              </div>
            )}

            <div className="stage__pool">
              {state.outcome && session ? (
                <ResultPanel
                  outcome={state.outcome}
                  session={session}
                  onRematch={rematch}
                  onNewGame={openSetup}
                />
              ) : (
                <section
                  className="rail-section"
                  data-armed={localTurn && choosing ? 'true' : undefined}
                >
                  {/*
                    * The count, and only the count. The heading used to swap to
                    * "Choose one" and take the accent, which said in words at
                    * the bottom of the screen what the line at the top now says
                    * — and it said it with the number stranded three hundred
                    * pixels away at the other end of the rule. Which surface is
                    * live stays the accent's job, on the rule under this.
                    */}
                  <div className="section__head">
                    <p className="state-label">{state.pool.length} left</p>
                  </div>
                  <Pool
                    pool={state.pool}
                    selecting={localTurn && choosing}
                    hot={hotPieces}
                    onSelect={onSelect}
                    onPreview={setPreview}
                    onRefuse={onRefuse}
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
          onStart={() => startGame()}
          onRules={() => setShowRules(true)}
          onInstall={canInstall ? install : undefined}
          onDismiss={session ? () => setShowSetup(false) : undefined}
        />
      )}

      {showRules && <RulesSheet onClose={() => setShowRules(false)} />}

      {showSettings && (
        <SettingsSheet prefs={prefs} onChange={setPrefs} onClose={() => setShowSettings(false)} />
      )}

      {confirmRestart && (
        <Modal
          title="Start a new game?"
          onClose={() => setConfirmRestart(false)}
          variant="confirm"
          closeLabel={null}
          actions={
            <>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setConfirmRestart(false)
                  openSetup()
                }}
              >
                Discard and start over
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setConfirmRestart(false)}
              >
                Keep playing
              </button>
            </>
          }
        >
          <p className="sheet__text">This game will be lost.</p>
        </Modal>
      )}

      {confirmHot !== null && (
        <Modal
          title="That piece wins"
          onClose={() => setConfirmHot(null)}
          variant="confirm"
          closeLabel={null}
          actions={
            <>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const piece = confirmHot
                  setConfirmHot(null)
                  handOver(piece)
                }}
              >
                Hand it over
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setConfirmHot(null)}
              >
                Choose another
              </button>
            </>
          }
        >
          <p className="sheet__text">
            {names[opponent]} can finish a line with the {describePiece(confirmHot)} piece.
          </p>
        </Modal>
      )}
    </div>
  )
}
