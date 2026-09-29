import type { ComponentType } from 'react'
import { useSessionStore, NetworkProvider, type ScreenId } from '../entities/session'
import { Header } from './Header'
import { ModeSelect } from '../pages/mode-select'
import { Workspace } from '../pages/workspace'
import { SessionSummary } from '../pages/session-summary'
import { SessionHistory } from '../pages/session-history'
import { JoinSession } from '../pages/join-session'
import { ParticipantEstimateView } from '../pages/participant-estimate'

const SCREENS: Record<ScreenId, ComponentType> = {
  'mode-select': ModeSelect,
  workspace: Workspace,
  summary: SessionSummary,
  history: SessionHistory,
  join: JoinSession,
  estimate: ParticipantEstimateView,
}

function App() {
  const currentScreen = useSessionStore((s) => s.currentScreen)
  const Screen = SCREENS[currentScreen]

  return (
    <NetworkProvider>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Header />
      {/* tabIndex={-1}: a plain <main> isn't focusable, so activating the skip
          link above wouldn't move keyboard focus here in Firefox/Safari without it. */}
      <main id="main-content" tabIndex={-1}>
        <Screen />
      </main>
    </NetworkProvider>
  )
}

export default App
