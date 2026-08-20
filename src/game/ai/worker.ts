/// <reference lib="webworker" />
import { chooseMove, type AiMove, type AiRequest } from './index'

export interface WorkerRequest extends AiRequest {
  id: number
}
export interface WorkerResponse extends AiMove {
  id: number
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { id, ...req } = event.data
  const move = chooseMove(req)
  ;(self as unknown as Worker).postMessage({ id, ...move } satisfies WorkerResponse)
})
