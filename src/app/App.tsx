import { BrowserRouter, Routes, Route } from 'react-router'
import { ParticipantIdentityContext } from '../application'
import { NetworkProvider } from './NetworkProvider'
import { getOrCreateParticipantId } from '../adapters/storage/participantIdentity'
import { ROUTES } from '../shared/lib/routes'
import { Header } from './Header'
import { ModeSelect } from '../pages/mode-select'
import { Workspace } from '../pages/workspace'
import { SessionSummary } from '../pages/session-summary'
import { SessionHistory } from '../pages/session-history'
import { JoinSession } from '../pages/join-session'
import { ParticipantEstimateView } from '../pages/participant-estimate'

// Composition point: the one place that wires an adapter to an application-owned port.
const participantIdentity = { getOrCreateParticipantId }

function App() {
  return (
    <BrowserRouter>
      <ParticipantIdentityContext.Provider value={participantIdentity}>
        <NetworkProvider>
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <Header />
          {/* tabIndex={-1}: a plain <main> isn't focusable, so activating the skip
            link above wouldn't move keyboard focus here in Firefox/Safari without it. */}
          <main id="main-content" tabIndex={-1}>
            <Routes>
              <Route path={ROUTES.modeSelect} element={<ModeSelect />} />
              <Route path={ROUTES.join} element={<JoinSession />} />
              <Route path={ROUTES.estimate} element={<ParticipantEstimateView />} />
              <Route path={ROUTES.workspace} element={<Workspace />} />
              <Route path={ROUTES.summary} element={<SessionSummary />} />
              <Route path={ROUTES.history} element={<SessionHistory />} />
            </Routes>
          </main>
        </NetworkProvider>
      </ParticipantIdentityContext.Provider>
    </BrowserRouter>
  )
}

export default App
