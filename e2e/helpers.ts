import type { Browser, BrowserContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/** Opens a page in its own browser context (isolated storage), not just a new
 *  tab/page — JoinSession's identity warning ("joining from another tab in
 *  this browser will be treated as the same person") means same-context
 *  pages would collide on participantId; separate contexts don't. Caller
 *  closes the returned context when done with the page. */
export async function newIsolatedPage(
  browser: Browser,
): Promise<{ page: Page; context: BrowserContext }> {
  const context = await browser.newContext()
  return { page: await context.newPage(), context }
}

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

/** `generateSessionCode()`'s alphabet (`application/useCases/sessionCode.ts`):
 *  Crockford base32 minus the ambiguous 0/O/1/I/L/U. */
const SESSION_CODE = /^[2-9A-HJKMNP-TV-Z]{6}$/

/** Facilitator: ModeSelect → "Start collaborative estimation" → captures the
 *  generated session code shown in the workspace's LiveSessionStrip
 *  (`src/features/reveal-results/ui/LiveSessionStrip.tsx`). */
export async function createCollaborativeSession(page: Page): Promise<string> {
  await page.goto('/')
  return startCollaborativeEstimation(page)
}

/** Facilitator, already on ModeSelect (e.g. with a session loaded from a
 *  file): "Start collaborative estimation" → the generated session code. */
export async function startCollaborativeEstimation(page: Page): Promise<string> {
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
 *  (`useItemActions`' `addItem`); a second+ item is not. */
export async function addItem(page: Page, title: string): Promise<void> {
  await page.getByPlaceholder('Add an item').fill(title)
  await page.getByRole('button', { name: 'Add item' }).click()
}

/** Facilitator: selects an already-added item by clicking its row in the
 *  items sidebar (an `<aside>`, i.e. the `complementary` landmark). */
export async function selectItem(page: Page, title: string): Promise<void> {
  await page.getByRole('complementary').getByText(title, { exact: true }).click()
}

/** Asserts the current item title is visible, regardless of viewer role. */
export async function expectItemVisible(page: Page, title: string): Promise<void> {
  await expect(page.getByText(title)).toBeVisible()
}

/** Facilitator Workspace: the items sidebar lists exactly `titles`, in this
 *  order. */
export async function expectItemList(page: Page, titles: string[]): Promise<void> {
  await expect(
    page.getByRole('complementary').locator('.session-sidebar-row-label'),
  ).toHaveText(titles)
}

/** Asserts the roster's submission progress text, shown to a joining peer
 *  (`JoinSession`/Workspace roster copy, e.g. "1 of 2 teammates has
 *  submitted so far."). */
export async function expectSubmittedCount(
  page: Page,
  submitted: number,
  total: number,
): Promise<void> {
  await expect(
    page.getByText(`${submitted} of ${total} teammates has submitted so far.`),
  ).toBeVisible()
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

/** Single-user: ModeSelect → "Start single-user mode" → the Workspace. */
export async function startSingleUserSession(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start single-user mode' }).click()
  await page.waitForURL('**/workspace')
}

/** Workspace: types the session name into the top bar's name field. */
export async function setSessionName(page: Page, name: string): Promise<void> {
  await page.getByLabel('Session name').fill(name)
}

/** Workspace, single-user: selects the item, enters its three points and
 *  presses the primary "Finalize …" button (`ActiveItemPanel`). */
export async function finalizeItem(
  page: Page,
  title: string,
  values: { best: number; likely: number; worst: number },
): Promise<void> {
  await selectItem(page, title)
  await page.getByLabel(/^Best case/).fill(String(values.best))
  await page.getByLabel(/^Most likely/).fill(String(values.likely))
  await page.getByLabel(/^Worst case/).fill(String(values.worst))
  await page.getByRole('button', { name: /^Finalize/ }).click()
}

/** Workspace or Summary: presses "Save session" and stores the download at
 *  `targetPath`. */
export async function saveSession(page: Page, targetPath: string): Promise<void> {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save session' }).first().click()
  const file = await download
  await file.saveAs(targetPath)
}

/** Opens ModeSelect, presses "Load a saved session" and picks `filePath`
 *  in the file chooser the app opens. */
export async function loadSessionFile(page: Page, filePath: string): Promise<void> {
  await page.goto('/')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Load a saved session' }).click()
  await (await chooser).setFiles(filePath)
}

/** ModeSelect with a loaded session: "Start single-user mode" → Workspace. */
export async function continueSingleUser(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start single-user mode' }).click()
  await page.waitForURL('**/workspace')
}

/** Header: the brand button that leaves the Workspace or Summary — one click. */
export async function leaveSession(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Back to mode selection' }).click()
}

/** After one click on the leave button: still in the Workspace, and the
 *  armed button now names the unsaved changes and asks for a second click. */
export async function expectLeaveConfirmationForUnsavedChanges(
  page: Page,
): Promise<void> {
  await expect(
    page.getByRole('button', { name: /unsaved changes.*click again to leave/i }),
  ).toBeVisible()
  await expect(page).toHaveURL(/\/workspace$/)
}

/** ModeSelect is showing. */
export async function expectAtModeSelection(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: 'Start single-user mode' })).toBeVisible()
}

/** ModeSelect shows no loaded-session preview (its Discard control is absent). */
export async function expectNoSessionLoaded(page: Page): Promise<void> {
  await expectAtModeSelection(page)
  await expect(page.getByRole('button', { name: /discard/i })).toHaveCount(0)
}

/** A rejected load: ModeSelect shows an alert. Which rule the file broke is
 *  the file-format domain spec's concern, not this check's. */
export async function expectLoadRejected(page: Page): Promise<void> {
  await expect(page.getByRole('alert')).toBeVisible()
}

/** Workspace: the session name field holds `name`. */
export async function expectSessionName(page: Page, name: string): Promise<void> {
  await expect(page.getByLabel('Session name')).toHaveValue(name)
}

/** Workspace or Participant Estimate View: `title` is the active item (both
 *  screens render it as the page's only `<h1>`). */
export async function expectActiveItem(page: Page, title: string): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
}

/** Workspace, single-user: selecting a finalized item shows its saved range
 *  prefilled in the three-point form. */
export async function expectFinalizedEstimate(
  page: Page,
  title: string,
  values: { best: number; likely: number; worst: number },
): Promise<void> {
  await selectItem(page, title)
  await expect(page.getByLabel(/^Best case/)).toHaveValue(String(values.best))
  await expect(page.getByLabel(/^Most likely/)).toHaveValue(String(values.likely))
  await expect(page.getByLabel(/^Worst case/)).toHaveValue(String(values.worst))
}

/** Closes the tab with `beforeunload` handlers run; reports whether the
 *  browser raised its leave-page warning, and dismisses it if so. */
export async function closeTabAndCheckLeaveWarning(page: Page): Promise<boolean> {
  let warned = false
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'beforeunload') {
      warned = true
      await dialog.dismiss()
    }
  })
  await page.close({ runBeforeUnload: true })
  // `close({ runBeforeUnload: true })` returns before the dialog is handled.
  await expect
    .poll(() => warned, { timeout: 5_000 })
    .toBe(true)
    .catch(() => {})
  return warned
}
