import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * GitHub Pages serves a project site from /<repository>/, so asset URLs, the
 * manifest scope and the service worker scope all have to carry that prefix.
 * The deploy workflow passes it in from the Pages configuration (which knows
 * whether this is a project site or a user site); the default matches this
 * repository, so a plain `npm run build` is already deployable.
 *
 * Dev uses the same base on purpose — a service worker registered at a
 * different scope in development would hide exactly the bugs it should catch.
 */
function resolveBase(): string {
  const trimmed = (process.env.BASE_PATH ?? '/Quarto/').replace(/^\/+|\/+$/g, '')
  return trimmed === '' ? '/' : `/${trimmed}/`
}

export default defineConfig({
  base: resolveBase(),
  plugins: [react()],
  build: { target: 'es2020' },
  worker: { format: 'es' },
})
