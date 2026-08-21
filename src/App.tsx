import { useSessionStore } from './state/store'
import { Header } from './components'
import { CreateSession } from './screens/CreateSession'
import { SessionView } from './screens/SessionView'
import { SessionSummary } from './screens/SessionSummary'
import { SessionHistory } from './screens/SessionHistory'

function App() {
  const currentScreen = useSessionStore((s) => s.currentScreen)

  return (
    <>
      <Header />
      {currentScreen === 'create' ? (
        <CreateSession />
      ) : currentScreen === 'session' ? (
        <SessionView />
      ) : currentScreen === 'summary' ? (
        <SessionSummary />
      ) : (
        <SessionHistory />
      )}
    </>
  )
}

export default App
