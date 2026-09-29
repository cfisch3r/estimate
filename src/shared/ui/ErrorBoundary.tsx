import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './Button'
import { GuardNote } from './GuardNote'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div
        style={{
          maxWidth: 480,
          margin: 'var(--space-8) auto',
          padding: 'var(--space-4)',
          display: 'grid',
          gap: 'var(--space-4)',
        }}
      >
        <GuardNote variant="banner" headline="Something went wrong">
          This preview build hit an unexpected error. Reloading usually clears it.
        </GuardNote>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <details className="card-meta">
          <summary>Error details</summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>
        </details>
      </div>
    )
  }
}
