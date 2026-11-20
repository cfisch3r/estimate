import { ROUTES } from '../../../shared/lib/routes'
import { NewTabLink } from '../../../shared/ui'

/** "Show diagnosis": opens the connection diagnosis from a problem notice. In a
 *  new tab, so the screen the problem showed on (and a running session) stays
 *  where it is; the diagnosis reads browser storage, which every tab shares. */
export function DiagnosisLink() {
  return <NewTabLink href={ROUTES.diagnosis}>Show diagnosis</NewTabLink>
}
