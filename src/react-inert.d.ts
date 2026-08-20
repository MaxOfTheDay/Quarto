import 'react'

declare module 'react' {
  // `inert` ships in every current browser but is not in React 18's typings.
  interface HTMLAttributes<T> {
    inert?: '' | undefined
  }
}
