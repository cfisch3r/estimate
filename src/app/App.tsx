import { BrowserRouter, Routes, Route } from 'react-router'
import { NetworkProvider } from '../entities/session'
import { Header } from './Header'
import { ModeSelect } from '../pages/mode-select'
import { Workspace } from '../pages/workspace'
import { SessionSummary } from '../pages/session-summary'
import { SessionHistory } from '../pages/session-history'
import { JoinSession } from '../pages/join-session'
import { ParticipantEstimateView } from '../pages/participant-estimate'

function App() {
  return (
    <BrowserRouter>
      <NetworkProvider>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Header />
        {/* tabIndex={-1}: a plain <main> isn't focusable, so activating the skip
            link above wouldn't move keyboard focus here in Firefox/Safari without it. */}
        <main id="main-content" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<ModeSelect />} />
            <Route path="/join" element={<JoinSession />} />
            <Route path="/estimate" element={<ParticipantEstimateView />} />
            <Route path="/workspace" element={<Workspace />} />
            <Route path="/summary" element={<SessionSummary />} />
            <Route path="/history" element={<SessionHistory />} />
          </Routes>
        </main>
      </NetworkProvider>
    </BrowserRouter>
  )
}

export default App
