/** Single source of truth for the app's route paths — every `<Route path>` in
 *  `App.tsx` and every `navigate(...)` call site should reference this instead
 *  of a repeated string literal. */
export const ROUTES = {
  modeSelect: '/',
  join: '/join',
  estimate: '/estimate',
  workspace: '/workspace',
  summary: '/summary',
  history: '/history',
} as const
