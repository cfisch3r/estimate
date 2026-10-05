import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
