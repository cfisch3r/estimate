import { BrowserRouter, Navigate, Routes, Route } from 'react-router'
import {
  ClipboardContext,
  DiagnosticsLogContext,
  FileDownloadContext,
  ParticipantIdentityContext,
} from '../application/composition'
import { LiveSessionProvider } from './LiveSessionProvider'
import { getOrCreateParticipantId } from '../adapters/storage/participantIdentity'
import { downloadTextFile } from '../adapters/file/fileDownload'
import { createDiagnosticsLog } from '../adapters/storage/diagnosticsLog'
import { writeClipboardText } from '../adapters/clipboard/clipboard'
import { ROUTES } from '../shared/lib/routes'
import { Header } from './Header'
import { useWarnBeforeUnload } from '../features/session-persistence'
import { ModeSelect } from '../pages/mode-select'
import { Workspace } from '../pages/workspace'
import { SessionSummary } from '../pages/session-summary'
import { JoinSession } from '../pages/join-session'
import { ParticipantEstimateView } from '../pages/participant-estimate'
import { Diagnosis } from '../pages/diagnosis'

// Composition point: the one place that wires an adapter to an application-owned port.
const participantIdentity = { getOrCreateParticipantId }
const fileDownload = { download: downloadTextFile }
// One log per tab, shared by the live session (recording) and the diagnosis
// page (reading).
const diagnosticsLog = createDiagnosticsLog()
const clipboard = { writeText: writeClipboardText }

function App() {
  useWarnBeforeUnload()

  return (
    <BrowserRouter>
      <ParticipantIdentityContext.Provider value={participantIdentity}>
        <FileDownloadContext.Provider value={fileDownload}>
          <DiagnosticsLogContext.Provider value={diagnosticsLog}>
            <ClipboardContext.Provider value={clipboard}>
              <LiveSessionProvider diagnostics={diagnosticsLog}>
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
                    <Route path={ROUTES.diagnosis} element={<Diagnosis />} />
                    {/* Anything else — an old bookmark such as the removed /history
                    page, or a mistyped path — starts over at mode selection. */}
                    <Route
                      path="*"
                      element={<Navigate to={ROUTES.modeSelect} replace />}
                    />
                  </Routes>
                </main>
              </LiveSessionProvider>
            </ClipboardContext.Provider>
          </DiagnosticsLogContext.Provider>
        </FileDownloadContext.Provider>
      </ParticipantIdentityContext.Provider>
    </BrowserRouter>
  )
}

export default App
