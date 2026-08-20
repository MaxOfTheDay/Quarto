import { useCallback, useEffect, useState } from 'react'
import type { Difficulty } from '../game/ai'
import type { PlayerId } from '../game'

export type Mode = 'local' | 'computer'
/** Who hands over the opening piece; 'random' is resolved when a game starts. */
export type Opener = 'p1' | 'p2' | 'random'

export interface Prefs {
  mode: Mode
  difficulty: Difficulty
  opener: Opener
  sound: boolean
  reducedEffects: boolean
  seenIntro: boolean
}

const DEFAULTS: Prefs = {
  mode: 'computer',
  difficulty: 'medium',
  opener: 'p1',
  sound: true,
  reducedEffects: false,
  seenIntro: false,
}

const KEY = 'quarto.prefs.v1'

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

/** Turns the stored preference into the concrete player who opens. */
export function resolveOpener(opener: Opener): PlayerId {
  if (opener === 'random') return Math.random() < 0.5 ? 0 : 1
  return opener === 'p1' ? 0 : 1
}
