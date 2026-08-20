import { chooseMove, type AiMove, type AiRequest } from './index'
import type { WorkerRequest, WorkerResponse } from './worker'

/**
 * Runs the search off the main thread so the board keeps responding while the
 * computer thinks. Falls back to an inline call if workers are unavailable.
 */
export class AiClient {
  private worker: Worker | null = null
  private seq = 0
  private pending = new Map<number, (move: AiMove) => void>()

  private ensure(): Worker | null {
    if (this.worker) return this.worker
    if (typeof Worker === 'undefined') return null
    try {
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
      worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
        const { id, ...move } = event.data
        this.pending.get(id)?.(move)
        this.pending.delete(id)
      })
      worker.addEventListener('error', () => this.dispose())
      this.worker = worker
      return worker
    } catch {
      return null
    }
  }

  think(req: AiRequest): Promise<AiMove> {
    const worker = this.ensure()
    if (!worker) return Promise.resolve(chooseMove(req))

    const id = ++this.seq
    return new Promise<AiMove>((resolve) => {
      this.pending.set(id, resolve)
      worker.postMessage({ id, ...req } satisfies WorkerRequest)
    })
  }

  dispose() {
    this.worker?.terminate()
    this.worker = null
    this.pending.clear()
  }
}
