import { useCallback, useEffect, useState } from 'react'
import type { Difficulty } from '../game/ai'
import type { PlayerId } from '../game'

export type Mode = 'local' | 'computer'
/** Who hands over the opening piece; 'random' is resolved when a game starts. */
export type Opener = 'p1' | 'p2' | 'random'
/** 'system' follows the device; the other two are an explicit override. */
export type Theme = 'system' | 'light' | 'dark'

export interface Prefs {
  mode: Mode
  difficulty: Difficulty
  opener: Opener
  sound: boolean
  reducedEffects: boolean
  theme: Theme
  /**
   * Shows what the engine already knows: where the piece in hand wins, which
   * pieces hand the game over, and a second look before handing one of those
   * over. On unless the player turns it off — see `coachingActive`.
   */
  coach: boolean
}

const DEFAULTS: Prefs = {
  mode: 'computer',
  difficulty: 'medium',
  opener: 'p1',
  sound: true,
  reducedEffects: false,
  theme: 'system',
  coach: true,
}

const KEY = 'quarto.prefs.v2'

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return { ...DEFAULTS, ...parsed }
  } catch {
    return DEFAULTS
  }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(read)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {
      /* private browsing, quota, or storage disabled — preferences stay in memory */
    }
  }, [prefs])

  const update = useCallback((patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch })), [])
  return [prefs, update] as const
}

/**
 * Coaching is on unless the player turns it off, and never on against Hard,
 * where the marks would be playing the game.
 *
 * It used to retire itself after three finished games on the theory that by
 * then it had been learned. What that actually produced was a switch that read
 * "On" while nothing happened — including the one part of coaching that is not
 * a lesson at all: the second look before handing over the piece that finishes
 * a line. Losing a game to a tap you did not mean is not a thing you stop
 * minding once you understand the rules, and a setting that turns itself off
 * behind the player's back is the wrong way to find that out.
 */
export function coachingActive(prefs: Prefs, difficulty: Difficulty, vsComputer: boolean): boolean {
  if (vsComputer && difficulty === 'hard') return false
  return prefs.coach
}

/** Turns the stored preference into the concrete player who opens. */
export function resolveOpener(opener: Opener): PlayerId {
  if (opener === 'random') return Math.random() < 0.5 ? 0 : 1
  return opener === 'p1' ? 0 : 1
}
