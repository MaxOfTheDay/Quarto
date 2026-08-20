/**
 * The app icon: a corner of the board itself — four milled pockets in smoked
 * oak, two of them holding pieces that disagree on every axis. A lone piece
 * reads as an object; the pockets say board game.
 *
 * `maskable` shrinks the grid into the middle 80% circle that survives
 * Android's icon mask, since the pieces sit on the diagonal that a mask crops.
 */

const S = 512

/** One solid, using the same proportions as src/ui/PieceGlyph.tsx. */
function piece({ cx, baseY, k, tall, dark, square, hollow }) {
  const rx = 36 * k
  const ry = 12.4 * k
  const h = (tall ? 54 : 22) * k
  const topY = baseY - h
  const left = cx - rx
  const right = cx + rx
  const bottom = baseY + ry
  const backInset = rx * 0.15
  const frontY = topY + ry
  const backY = topY - ry
  const t = dark ? 'd' : 'l'
  const stroke = dark ? '#fffcf4' : '#543f24'
  const strokeOpacity = dark ? 0.13 : 0.34
  const w = rx * 0.5
  const wy = ry * 0.5

  const body = square
    ? `M ${left} ${frontY} H ${right} V ${bottom} H ${left} Z`
    : `M ${left} ${topY} V ${baseY} A ${rx} ${ry} 0 0 0 ${right} ${baseY} V ${topY} Z`

  const top = square
    ? `<path d="M ${left} ${frontY} H ${right} L ${right - backInset} ${backY} H ${left + backInset} Z"
             fill="url(#top-${t})" stroke="${stroke}" stroke-opacity="${dark ? 0.2 : 0.3}"
             stroke-width="${k * 0.7}" stroke-linejoin="round"/>`
    : `<ellipse cx="${cx}" cy="${topY}" rx="${rx}" ry="${ry}" fill="url(#top-${t})"
                stroke="${stroke}" stroke-opacity="${dark ? 0.2 : 0.3}" stroke-width="${k * 0.7}"/>`

  const well = !hollow
    ? ''
    : square
      ? `<path d="M ${cx - w} ${topY + wy} H ${cx + w} L ${cx + (rx - backInset) * 0.5} ${topY - wy} H ${cx - (rx - backInset) * 0.5} Z" fill="url(#well-${t})"/>`
      : `<ellipse cx="${cx}" cy="${topY}" rx="${w}" ry="${wy}" fill="url(#well-${t})"/>
         <path d="M ${cx - w} ${topY} A ${w} ${wy} 0 0 0 ${cx + w} ${topY}" fill="none"
               stroke="#fffaec" stroke-opacity="0.6" stroke-width="${k * 0.8}"/>`

  return `
  <ellipse cx="${cx}" cy="${bottom - k}" rx="${rx * 1.12}" ry="${ry * 0.9}" fill="url(#cast)"/>
  <path d="${body}" fill="url(#body-${t})"/>
  <path d="${body}" fill="url(#${square ? 'facet' : 'sheen'})"/>
  <path d="${body}" fill="none" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${k * 0.7}"/>
  ${top}
  ${well}`
}

export function iconSvg({ size = 512, maskable = false, radius = null } = {}) {
  const corner = radius ?? (maskable ? 0 : 96)

  // A maskable icon only keeps the middle 80% circle, and the pieces sit on the
  // grid's diagonal, so the whole grid has to fit inside that circle.
  const grid = maskable ? 284 : 396
  const gap = grid * 0.045
  const cell = (grid - gap) / 2
  const gx = (S - grid) / 2
  const gy = (S - grid) / 2

  // Pieces are scaled up relative to a real board cell — at icon sizes they
  // have to carry the whole drawing — but still stand clear inside the pocket.
  const k = (cell * 1.05) / 108

  const at = (col, row) => ({
    cx: gx + col * (cell + gap) + cell / 2,
    baseY: gy + row * (cell + gap) + cell * 0.9 - 12.4 * k,
  })

  const pocket = (col, row) => {
    const x = gx + col * (cell + gap)
    const y = gy + row * (cell + gap)
    return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="${cell * 0.09}" fill="url(#socket)"/>
    <rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="${cell * 0.09}" fill="url(#socketTop)"/>
    <rect x="${x}" y="${y + cell * 0.014}" width="${cell}" height="${cell}" rx="${cell * 0.09}"
          fill="none" stroke="#ffe4bc" stroke-opacity="0.1" stroke-width="${S * 0.005}"/>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="oak" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#443729"/>
      <stop offset="52%" stop-color="#32281e"/>
      <stop offset="100%" stop-color="#231b13"/>
    </linearGradient>
    <radialGradient id="lamp" cx="0.3" cy="0.02" r="0.9">
      <stop offset="0%" stop-color="#ffe4bc" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#ffe4bc" stop-opacity="0"/>
    </radialGradient>

    <linearGradient id="body-l" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fbf4e3"/><stop offset="30%" stop-color="#f2e7ce"/>
      <stop offset="64%" stop-color="#dfcba5"/><stop offset="100%" stop-color="#b89f79"/>
    </linearGradient>
    <linearGradient id="top-l" x1="0.14" y1="0" x2="0.82" y2="1">
      <stop offset="0%" stop-color="#fffdf7"/><stop offset="52%" stop-color="#f7efdd"/>
      <stop offset="100%" stop-color="#e2d3b3"/>
    </linearGradient>
    <linearGradient id="well-l" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#bda787"/><stop offset="45%" stop-color="#816c51"/>
      <stop offset="100%" stop-color="#544632"/>
    </linearGradient>

    <linearGradient id="body-d" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6a727a"/><stop offset="28%" stop-color="#4a525a"/>
      <stop offset="64%" stop-color="#2b3238"/><stop offset="100%" stop-color="#12161a"/>
    </linearGradient>
    <linearGradient id="top-d" x1="0.14" y1="0" x2="0.82" y2="1">
      <stop offset="0%" stop-color="#949ca4"/><stop offset="52%" stop-color="#767e86"/>
      <stop offset="100%" stop-color="#545c63"/>
    </linearGradient>
    <linearGradient id="well-d" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5e666d"/><stop offset="45%" stop-color="#333a40"/>
      <stop offset="100%" stop-color="#171b1f"/>
    </linearGradient>

    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="16%" stop-color="#ffffff" stop-opacity="0.3"/>
      <stop offset="33%" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="68%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="88%" stop-color="#000000" stop-opacity="0.11"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.26"/>
    </linearGradient>
    <linearGradient id="facet" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="9%" stop-color="#ffffff" stop-opacity="0.13"/>
      <stop offset="52%" stop-color="#ffffff" stop-opacity="0.01"/>
      <stop offset="90%" stop-color="#000000" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.24"/>
    </linearGradient>
    <radialGradient id="cast" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.55"/>
      <stop offset="55%" stop-color="#000000" stop-opacity="0.24"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="socket" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#221a11"/><stop offset="42%" stop-color="#31261a"/>
      <stop offset="100%" stop-color="#3b2e1e"/>
    </linearGradient>
    <linearGradient id="socketTop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.45"/>
      <stop offset="34%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${S}" height="${S}" rx="${corner}" fill="url(#oak)"/>
  <rect width="${S}" height="${S}" rx="${corner}" fill="url(#lamp)"/>
  ${pocket(0, 0)}
  ${pocket(1, 0)}
  ${pocket(0, 1)}
  ${pocket(1, 1)}
${piece({ ...at(0, 0), k, tall: true, dark: false, square: false, hollow: true })}
${piece({ ...at(1, 1), k, tall: false, dark: true, square: true, hollow: false })}
</svg>`
}
