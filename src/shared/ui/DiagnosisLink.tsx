import { ROUTES } from '../lib/routes'
import { VisuallyHidden } from './VisuallyHidden'

/** "Show diagnosis": opens the connection diagnosis from a problem notice. In a
 *  new tab, so the screen the problem showed on (and a running session) stays
 *  where it is; the diagnosis reads browser storage, which every tab shares. */
export function DiagnosisLink() {
  return (
    <a href={ROUTES.diagnosis} target="_blank" rel="noopener noreferrer">
      Show diagnosis <VisuallyHidden>(opens in a new tab)</VisuallyHidden>
    </a>
  )
}
