import type { LocalDate } from '../../application/ports/outbound/sessionFiles'

/** The fallback slug for a session whose name has no usable characters. */
const UNNAMED = 'estimate-session'

/**
 * The download name for a saved session: the slugified session name plus the
 * save date, ending in `.estimate.json` — so saved files in one downloads
 * folder stay apart and sort by date per session.
 */
export function sessionFileName(sessionName: string, savedOn: LocalDate): string {
  const slug =
    sessionName
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || UNNAMED
  const two = (n: number) => String(n).padStart(2, '0')
  return `${slug}-${savedOn.year}-${two(savedOn.month)}-${two(savedOn.day)}.estimate.json`
}
