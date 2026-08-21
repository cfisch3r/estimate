import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design/nocturne.css'
import './design/radio-tile.css'
import './design/range-bar.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
