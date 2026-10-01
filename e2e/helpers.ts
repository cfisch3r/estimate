import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/** Fails the test with axe-core's own violation report (rule, impact, and
 *  every matching node) if the current page has any accessibility
 *  violations. Runs in a real browser — unlike the jsdom-based jest-axe
 *  scans on individual components, this one can actually evaluate
 *  color-contrast and other layout-dependent rules against real rendering.
 *
 *  color-contrast is disabled: Nocturne's `.text-muted` token measures
 *  4.49:1 against the app background, just under AA's 4.5:1, and it's used
 *  throughout the app — but `nocturne.css` is a verbatim design-system port
 *  this codebase doesn't patch locally (see AGENTS.md). Tracked in #123;
 *  remove this exclusion once the token itself is fixed upstream. */
export async function expectNoA11yViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .disableRules(['color-contrast'])
    .analyze()
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
}

/** `generateSessionCode()`'s alphabet (`entities/session/api/sessionCode.ts`):
 *  Crockford base32 minus the ambiguous 0/O/1/I/L/U. */
const SESSION_CODE = /^[2-9A-HJKMNP-TV-Z]{6}$/

/** Facilitator: ModeSelect → "Start collaborative estimation" → captures the
 *  generated session code shown in the workspace's LiveSessionStrip
 *  (`src/features/reveal-results/ui/LiveSessionStrip.tsx`). */
export async function createCollaborativeSession(page: Page): Promise<string> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start collaborative estimation' }).click()
  const codeLocator = page.getByText(SESSION_CODE)
  await expect(codeLocator).toBeVisible()
  return (await codeLocator.textContent())!.trim()
}

/** Participant: JoinSession → fills code + name → "Join" → waits for the
 *  navigation to /estimate, which only fires once connectionStatus reaches
 *  'connected' (see `JoinSession.tsx`'s effect). */
export async function joinSessionAsParticipant(
  page: Page,
  sessionCode: string,
  name: string,
): Promise<void> {
  await page.goto('/join')
  await page.getByLabel('Session code').fill(sessionCode)
  await page.getByLabel('Your name').fill(name)
  await page.getByRole('button', { name: 'Join' }).click()
  await page.waitForURL('**/estimate')
}

/** Facilitator: adds an item via the sidebar's "Add an item" input. The
 *  first item added to an empty workspace is auto-selected
 *  (`entities/session/model/session.ts`'s `addItem`); a second+ item is not. */
export async function addItem(page: Page, title: string): Promise<void> {
  await page.getByPlaceholder('Add an item').fill(title)
  await page.getByRole('button', { name: 'Add item' }).click()
}

/** Facilitator: selects an already-added item by clicking its row in the
 *  items sidebar (an `<aside>`, i.e. the `complementary` landmark). */
export async function selectItem(page: Page, title: string): Promise<void> {
  await page.getByRole('complementary').getByText(title, { exact: true }).click()
}

/** Participant: fills and submits the three-point estimate form
 *  (`ThreePointEstimateFields`). Labels carry the active unit
 *  ("Best case (days)" etc.), so match by prefix only. */
export async function submitEstimate(
  page: Page,
  values: { best: number; likely: number; worst: number },
): Promise<void> {
  await page.getByLabel(/^Best case/).fill(String(values.best))
  await page.getByLabel(/^Most likely/).fill(String(values.likely))
  await page.getByLabel(/^Worst case/).fill(String(values.worst))
  await page.getByRole('button', { name: 'Submit estimate' }).click()
}
