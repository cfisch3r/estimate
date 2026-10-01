import { test, expect } from '../fixtures'
import {
  createCollaborativeSession,
  joinSessionAsParticipant,
  addItem,
  submitEstimate,
} from '../helpers'

// Exercises requestSnapshot/onRequestSnapshot (ADR-003, "Snapshot delivery:
// pull on arrival"): a peer joining mid-round should land on the current
// state instead of a blank lobby, and see the round already in progress.
test('a peer joining mid-round pulls the current snapshot instead of starting blank', async ({
  facilitator,
  participant,
  lateJoiner,
}) => {
  const code = await createCollaborativeSession(facilitator)
  await addItem(facilitator, 'Checkout redesign') // first item: auto-selected
  await joinSessionAsParticipant(participant, code, 'Sam Rivera')
  await submitEstimate(participant, { best: 2, likely: 3, worst: 5 })

  await expect(
    facilitator.getByRole('button', { name: 'Reveal estimates (1 submitted)' }),
  ).toBeEnabled()

  await joinSessionAsParticipant(lateJoiner, code, 'Jordan Lee')

  await expect(lateJoiner.getByText('Checkout redesign')).toBeVisible()
  await expect(
    lateJoiner.getByText('1 of 2 teammates has submitted so far.'),
  ).toBeVisible()
})
