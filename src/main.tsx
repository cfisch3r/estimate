import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design/nocturne.css'
import './design/radio-tile.css'
import './design/range-bar.css'
import './design/phase-picker.css'
import './design/session-sidebar.css'
import './design/markdown.css'
import './design/header.css'
import './design/workspace.css'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
