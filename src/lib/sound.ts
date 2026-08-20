/**
 * Small synthesised sound set — no audio files, no library. Everything is a
 * short envelope on a couple of oscillators, kept quiet enough to sit under
 * the interaction rather than announce it.
 */

type Cue = 'place' | 'select' | 'undo' | 'win' | 'draw'

let ctx: AudioContext | null = null
let master: GainNode | null = null

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0.22
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(
  ac: AudioContext,
  { freq, type = 'sine', at = 0, dur = 0.2, peak = 0.3, attack = 0.004, glide }: {
    freq: number
    type?: OscillatorType
    at?: number
    dur?: number
    peak?: number
    attack?: number
    glide?: number
  },
) {
  const t0 = ac.currentTime + at
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (glide !== undefined) osc.frequency.exponentialRampToValueAtTime(glide, t0 + dur)
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(peak, t0 + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain).connect(master!)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

/** A short burst of filtered noise — the wood in "wooden click". */
function knock(ac: AudioContext, { at = 0, dur = 0.09, peak = 0.22, cutoff = 1600 }) {
  const t0 = ac.currentTime + at
  const frames = Math.max(1, Math.floor(ac.sampleRate * dur))
  const buffer = ac.createBuffer(1, frames, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 3)
  }
  const src = ac.createBufferSource()
  src.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = cutoff
  const gain = ac.createGain()
  gain.gain.value = peak
  src.connect(filter).connect(gain).connect(master!)
  src.start(t0)
}

let enabled = true

/**
 * Never opens the audio graph on its own — the first `play` does that, and
 * every cue follows a click or a keypress, so the context is always created
 * inside a user gesture rather than sitting suspended from page load.
 */
export const setSoundEnabled = (on: boolean) => {
  enabled = on
  if (on && ctx?.state === 'suspended') void ctx.resume()
}

export function play(cue: Cue) {
  if (!enabled) return
  const ac = ensure()
  if (!ac || !master) return

  switch (cue) {
    case 'place':
      // A piece meeting the board: a low thud with a woody tick over it.
      knock(ac, { dur: 0.07, peak: 0.3, cutoff: 2200 })
      tone(ac, { freq: 168, type: 'sine', dur: 0.16, peak: 0.34, glide: 96 })
      break
    case 'select':
      // Lifting a piece out of the pool: lighter, shorter, higher.
      knock(ac, { dur: 0.035, peak: 0.14, cutoff: 3400 })
      tone(ac, { freq: 528, type: 'triangle', dur: 0.09, peak: 0.11 })
      break
    case 'undo':
      tone(ac, { freq: 300, type: 'sine', dur: 0.12, peak: 0.13, glide: 210 })
      break
    case 'win':
      // A warm open fifth resolving upward — three notes, no fanfare.
      tone(ac, { freq: 392.0, dur: 0.5, peak: 0.2 })
      tone(ac, { freq: 587.33, at: 0.1, dur: 0.5, peak: 0.17 })
      tone(ac, { freq: 783.99, at: 0.2, dur: 0.62, peak: 0.14 })
      break
    case 'draw':
      tone(ac, { freq: 349.23, dur: 0.34, peak: 0.15 })
      tone(ac, { freq: 329.63, at: 0.13, dur: 0.42, peak: 0.13 })
      break
  }
}
