import { test } from '../fixtures'
import {
  createCollaborativeSession,
  joinSessionAsParticipant,
  addItem,
  expectNoA11yViolations,
} from '../helpers'

// Real-browser axe scans of the app's main screens — this is what actually
// covers color-contrast and other layout-dependent WCAG rules: the jest-axe
// scans on individual components (jsdom) explicitly disable those rules
// because jsdom doesn't do real layout. See docs/adr/002-testing-strategy.md.
test.describe('accessibility', () => {
  test('mode-select screen has no violations', async ({ facilitator: page }) => {
    await page.goto('/')
    await expectNoA11yViolations(page)
  })

  test('join-session screen has no violations', async ({ facilitator: page }) => {
    await page.goto('/join')
    await expectNoA11yViolations(page)
  })

  test('single-user workspace has no violations, with and without an info popover open', async ({
    facilitator: page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Start single-user mode' }).click()
    await addItem(page, 'Checkout redesign')
    await expectNoA11yViolations(page)

    await page.getByRole('button', { name: 'About phase' }).click()
    await expectNoA11yViolations(page)
  })

  test('collaborative workspace and participant estimate screens have no violations', async ({
    facilitator,
    participant,
  }) => {
    const code = await createCollaborativeSession(facilitator)
    await addItem(facilitator, 'Checkout redesign') // first item: auto-selected
    await expectNoA11yViolations(facilitator)

    await joinSessionAsParticipant(participant, code, 'Sam Rivera')
    await expectNoA11yViolations(participant)
  })
})
