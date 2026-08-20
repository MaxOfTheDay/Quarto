import { isDark, isHollow, isSquare, isTall, type PieceId } from '../game'

/**
 * One coordinate system for all sixteen pieces so they share a baseline and a
 * footprint, exactly like a real set. Only the four attributes change:
 * height, material, cross-section, and whether the top is open.
 */
const VIEW_W = 100
const VIEW_H = 108
const CX = 50
const RX = 36 // half-width — identical for every piece
const RY = 12.4 // foreshortening of the top face
const BASE_Y = 93 // where the piece meets the board
const H_TALL = 54
const H_SHORT = 22
const WELL = 0.5 // opening radius as a fraction of the top face
/** Inset of the cropped viewBox; leaves a little air above the tallest piece. */
const CROP_X = 10
const CROP_Y = 16

export interface PieceGlyphProps {
  piece: PieceId
  className?: string
  /**
   * Crops the drawing to the solid itself. The coordinate system leaves room
   * around every piece so they share a baseline and footprint, which is right
   * on a board cell and wasteful in a pool slot a third of the size.
   */
  crop?: boolean
}

export function PieceGlyph({ piece, className, crop }: PieceGlyphProps) {
  const tall = isTall(piece)
  const dark = isDark(piece)
  const square = isSquare(piece)
  const hollow = isHollow(piece)

  const t = dark ? 'd' : 'l'
  const topY = BASE_Y - (tall ? H_TALL : H_SHORT)
  const bodyBottom = BASE_Y + RY
  const left = CX - RX
  const right = CX + RX

  // Both solids are seen from slightly above. A cylinder's top reads as an
  // ellipse; a prism's reads as a trapezoid whose back edge is foreshortened.
  const backInset = RX * 0.15
  const frontY = topY + RY
  const backY = topY - RY

  const body = square
    ? `M ${left} ${frontY} H ${right} V ${bodyBottom} H ${left} Z`
    : `M ${left} ${topY} V ${BASE_Y} A ${RX} ${RY} 0 0 0 ${right} ${BASE_Y} V ${topY} Z`

  const topFace = `M ${left} ${frontY} H ${right} L ${right - backInset} ${backY} H ${left + backInset} Z`

  const wellRx = RX * WELL
  const wellRy = RY * WELL
  // The opening is the top face scaled towards its centre.
  const well = `M ${CX - wellRx} ${topY + wellRy} H ${CX + wellRx} L ${
    CX + (RX - backInset) * WELL
  } ${topY - wellRy} H ${CX - (RX - backInset) * WELL} Z`

  return (
    <svg
      className={className}
      viewBox={crop ? `${CROP_X} ${CROP_Y} ${VIEW_W - 2 * CROP_X} ${VIEW_H - CROP_Y}` : `0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      {/* Contact shadow — grounds the piece without a blur filter. */}
      <ellipse cx={CX} cy={bodyBottom - 1} rx={RX * 1.1} ry={RY * 0.85} fill="url(#pg-cast)" />

      <g className="pg__body">
        <path d={body} fill={`url(#pg-body-${t})`} />
        <path d={body} fill={square ? 'url(#pg-facet)' : 'url(#pg-sheen)'} />
        <path
          d={body}
          fill="none"
          stroke={dark ? 'rgba(255,252,244,0.13)' : 'rgba(84,63,36,0.34)'}
          strokeWidth="0.7"
        />
      </g>

      {/* Top face: an ellipse reads round, a rectangle reads square, instantly. */}
      {square ? (
        <path
          d={topFace}
          fill={`url(#pg-top-${t})`}
          stroke={dark ? 'rgba(255,252,244,0.2)' : 'rgba(84,63,36,0.3)'}
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
      ) : (
        <ellipse
          cx={CX}
          cy={topY}
          rx={RX}
          ry={RY}
          fill={`url(#pg-top-${t})`}
          stroke={dark ? 'rgba(255,252,244,0.2)' : 'rgba(84,63,36,0.3)'}
          strokeWidth="0.7"
        />
      )}

      {/* Hollow pieces are bored out — a visible well, not a printed ring. */}
      {hollow &&
        (square ? (
          <>
            <path d={well} fill={`url(#pg-well-${t})`} strokeLinejoin="round" />
            <path
              d={`M ${CX - wellRx} ${topY + wellRy} H ${CX + wellRx}`}
              stroke={dark ? 'rgba(255,252,244,0.22)' : 'rgba(255,250,236,0.6)'}
              strokeWidth="0.8"
              fill="none"
            />
          </>
        ) : (
          <>
            <ellipse cx={CX} cy={topY} rx={wellRx} ry={wellRy} fill={`url(#pg-well-${t})`} />
            <path
              d={`M ${CX - wellRx} ${topY} A ${wellRx} ${wellRy} 0 0 0 ${CX + wellRx} ${topY}`}
              stroke={dark ? 'rgba(255,252,244,0.22)' : 'rgba(255,250,236,0.6)'}
              strokeWidth="0.8"
              fill="none"
            />
          </>
        ))}
    </svg>
  )
}

/**
 * Every gradient the pieces use, defined once for the whole app. Sixteen
 * pieces on screen at a time would otherwise mean sixteen copies of each.
 */
export function PieceDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <defs>
        {/* Bone / maple */}
        <linearGradient id="pg-body-l" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbf4e3" />
          <stop offset="30%" stopColor="#f2e7ce" />
          <stop offset="64%" stopColor="#dfcba5" />
          <stop offset="100%" stopColor="#b89f79" />
        </linearGradient>
        <linearGradient id="pg-top-l" x1="0.14" y1="0" x2="0.82" y2="1">
          <stop offset="0%" stopColor="#fffdf7" />
          <stop offset="52%" stopColor="#f7efdd" />
          <stop offset="100%" stopColor="#e2d3b3" />
        </linearGradient>
        <linearGradient id="pg-well-l" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bda787" />
          <stop offset="45%" stopColor="#816c51" />
          <stop offset="100%" stopColor="#544632" />
        </linearGradient>

        {/* Blackened steel */}
        <linearGradient id="pg-body-d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6a727a" />
          <stop offset="28%" stopColor="#4a525a" />
          <stop offset="64%" stopColor="#2b3238" />
          <stop offset="100%" stopColor="#12161a" />
        </linearGradient>
        <linearGradient id="pg-top-d" x1="0.14" y1="0" x2="0.82" y2="1">
          <stop offset="0%" stopColor="#949ca4" />
          <stop offset="52%" stopColor="#767e86" />
          <stop offset="100%" stopColor="#545c63" />
        </linearGradient>
        <linearGradient id="pg-well-d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5e666d" />
          <stop offset="45%" stopColor="#333a40" />
          <stop offset="100%" stopColor="#171b1f" />
        </linearGradient>

        {/* A curved highlight says cylinder; a flat one says prism. */}
        <linearGradient id="pg-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="16%" stopColor="rgba(255,255,255,0.3)" />
          <stop offset="33%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="68%" stopColor="rgba(0,0,0,0)" />
          <stop offset="88%" stopColor="rgba(0,0,0,0.11)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.26)" />
        </linearGradient>
        <linearGradient id="pg-facet" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
          <stop offset="9%" stopColor="rgba(255,255,255,0.13)" />
          <stop offset="52%" stopColor="rgba(255,255,255,0.01)" />
          <stop offset="90%" stopColor="rgba(0,0,0,0.1)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.24)" />
        </linearGradient>

        <radialGradient id="pg-cast" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="rgba(0,0,0,0.45)" />
          <stop offset="55%" stopColor="rgba(0,0,0,0.2)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>
    </svg>
  )
}
