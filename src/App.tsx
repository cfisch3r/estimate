import type { ComponentType } from 'react'
import { useSessionStore } from './state/store'
import type { ScreenId } from './state/types'
import { Header } from './components'
import { NetworkProvider } from './network'
import { ModeSelect } from './screens/ModeSelect'
import { Workspace } from './screens/Workspace'
import { SessionSummary } from './screens/SessionSummary'
import { SessionHistory } from './screens/SessionHistory'
import { JoinSession } from './screens/JoinSession'
import { ParticipantEstimateView } from './screens/ParticipantEstimateView'

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
      <Header />
      <Screen />
    </NetworkProvider>
  )
}

export default App
