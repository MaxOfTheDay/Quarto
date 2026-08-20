import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { SIZE, describePiece, type Board as BoardModel, type WinLine } from '../game'
import { PieceGlyph } from './PieceGlyph'

export interface BoardProps {
  board: BoardModel
  /** True while the local player may drop the piece they are holding. */
  placing: boolean
  lastPlaced: number | null
  win: WinLine | null
  /** Cell whose piece is mid-flight and should not be painted yet. */
  hiddenCell: number | null
  onPlace: (cell: number) => void
  cellRef: (cell: number, el: HTMLElement | null) => void
}

export function Board({ board, placing, lastPlaced, win, hiddenCell, onPlace, cellRef }: BoardProps) {
  const [cursor, setCursor] = useState(0)
  const gridRef = useRef<HTMLDivElement>(null)
  const winCells = win ? win.cells : null

  // Keep the roving tab stop on a cell the player can actually use.
  useEffect(() => {
    if (!placing) return
    if (board[cursor] === null) return
    const next = board.findIndex((c) => c === null)
    if (next >= 0) setCursor(next)
  }, [placing, board, cursor])

  const move = (from: number, dx: number, dy: number) => {
    const x = from % SIZE
    const y = Math.floor(from / SIZE)
    const nx = Math.min(SIZE - 1, Math.max(0, x + dx))
    const ny = Math.min(SIZE - 1, Math.max(0, y + dy))
    const next = ny * SIZE + nx
    setCursor(next)
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-cell="${next}"]`)
    el?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent, cell: number) => {
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }
    const delta = deltas[event.key]
    if (delta) {
      event.preventDefault()
      move(cell, delta[0], delta[1])
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      move(cell, event.key === 'Home' ? -SIZE : SIZE, 0)
    }
  }

  return (
    <div className="board">
      <div className="board__slab">
        <div
          ref={gridRef}
          className="board__grid"
          role="grid"
          aria-label="Quarto board, 4 rows by 4 columns"
        >
          {win && <WinStroke win={win} />}
          {Array.from({ length: SIZE }, (_, row) => (
            <div className="board__row" role="row" key={row}>
              {Array.from({ length: SIZE }, (_, col) => {
                const cell = row * SIZE + col
                const piece = board[cell]
                const isWinner = winCells?.includes(cell) ?? false
                const open = piece === null
                const targetable = placing && open
                const style = {
                  '--win-index': winCells ? winCells.indexOf(cell) : 0,
                } as CSSProperties

                return (
                  <div
                    className="board__cellwrap"
                    role="gridcell"
                    key={cell}
                    data-won={isWinner ? 'true' : undefined}
                    style={style}
                  >
                    <button
                      type="button"
                      data-cell={cell}
                      className="cell"
                      data-state={isWinner ? 'won' : open ? 'open' : 'filled'}
                      data-target={targetable ? 'true' : undefined}
                      data-dim={win && !isWinner && !open ? 'true' : undefined}
                      disabled={!targetable}
                      tabIndex={cell === cursor ? 0 : -1}
                      onFocus={() => setCursor(cell)}
                      onKeyDown={(e) => onKeyDown(e, cell)}
                      onClick={() => targetable && onPlace(cell)}
                      aria-label={
                        piece === null
                          ? `Row ${row + 1}, column ${col + 1}, empty`
                          : `Row ${row + 1}, column ${col + 1}, ${describePiece(piece)}`
                      }
                    >
                      <span className="cell__socket" aria-hidden="true" />
                      <span className="cell__target" aria-hidden="true" />
                      {piece !== null && (
                        <span
                          ref={(el) => cellRef(cell, el)}
                          className="cell__piece"
                          data-drop={cell === lastPlaced ? 'true' : undefined}
                          data-hidden={cell === hiddenCell ? 'true' : undefined}
                          key={piece}
                        >
                          <PieceGlyph piece={piece} className="piece" />
                        </span>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Must match --cell-gap in board.css so the stroke lands on the piece centres. */
const GAP = 2.4
const CELL = (100 - (SIZE - 1) * GAP) / SIZE

/** A single stroke drawn through the four winning cells, in board coordinates. */
function WinStroke({ win }: { win: WinLine }) {
  const centre = (cell: number) => {
    const col = cell % SIZE
    const row = Math.floor(cell / SIZE)
    // Low in the cell: the line reads as painted on the board, where the
    // pieces actually stand, rather than floating across their midriffs.
    return [col * (CELL + GAP) + CELL / 2, row * (CELL + GAP) + CELL * 0.78] as const
  }
  const [x1, y1] = centre(win.cells[0])
  const [x2, y2] = centre(win.cells[3])

  return (
    <svg className="board__winline" viewBox="0 0 100 100" aria-hidden="true">
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="board__winline-under" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="board__winline-main" />
    </svg>
  )
}
