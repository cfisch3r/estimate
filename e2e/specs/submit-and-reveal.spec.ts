import { test, expect } from '../fixtures'
import {
  createCollaborativeSession,
  joinSessionAsParticipant,
  addItem,
  submitEstimate,
} from '../helpers'

// Exercises sendEstimate/onEstimate (request/ack) and the facilitator's
// reveal broadcast end to end — the two wire actions `actions.test.ts` only
// covers against a fake ActionRoom.
test('a participant estimate round-trips through submit and reveal', async ({
  facilitator,
  participant,
}) => {
  const code = await createCollaborativeSession(facilitator)
  await addItem(facilitator, 'Checkout redesign') // first item: auto-selected
  await joinSessionAsParticipant(participant, code, 'Sam Rivera')

  // The live regions are the only announcement mechanism for these updates;
  // jsdom can't confirm a real browser exposes them (display: contents + role).
  await expect(
    participant.getByRole('status').filter({ hasText: /submitted so far/ }),
  ).toBeVisible()

  await submitEstimate(participant, { best: 2, likely: 3, worst: 5 })

  const revealButton = facilitator.getByRole('button', {
    name: 'Reveal estimates (1 submitted)',
  })
  await expect(revealButton).toBeEnabled()
  await revealButton.click()

  await expect(participant.getByText('2d / 3d / 5d')).toBeVisible()
  await expect(facilitator.getByText('Sam Rivera')).toBeVisible()
  await expect(facilitator.getByText('2d / 3d / 5d')).toBeVisible()
})
