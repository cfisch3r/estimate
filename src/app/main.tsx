import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// architecture-exception: default-layout — src/design holds the verbatim Nocturne stylesheet and its composed patterns, kept apart so nocturne.css stays a clean diff against its source
import '../design/nocturne.css'
import '../design/radio-tile.css'
import '../design/markdown.css'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from '../shared/ui'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
