/** Single source of truth for the app's route paths — every `<Route path>` in
 *  `App.tsx` and every `navigate(...)` call site should reference this instead
 *  of a repeated string literal. */
export const ROUTES = {
  modeSelect: '/',
  join: '/join',
  estimate: '/estimate',
  workspace: '/workspace',
  summary: '/summary',
  /** The connection diagnosis: a technical page outside the screen flow, opened
   *  from the problem notices' "Show diagnosis" link or by URL. */
  diagnosis: '/diagnosis',
} as const
