import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** Facilitator: ModeSelect → "Start collaborative estimation" → captures the
 *  generated session code from the workspace's LiveSessionStrip
 *  (`src/features/reveal-results/ui/LiveSessionStrip.tsx`). */
export async function createCollaborativeSession(page: Page): Promise<string> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start collaborative estimation' }).click()
  const codeLocator = page.locator('.workspace-strip strong')
  await expect(codeLocator).toHaveText(/^[A-Z0-9]{6}$/)
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

/** Facilitator: selects an already-added item by clicking its sidebar row. */
export async function selectItem(page: Page, title: string): Promise<void> {
  await page.locator('.session-sidebar-row', { hasText: title }).click()
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
