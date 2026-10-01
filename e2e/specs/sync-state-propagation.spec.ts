import { test, expect } from '../fixtures'
import {
  createCollaborativeSession,
  joinSessionAsParticipant,
  addItem,
  selectItem,
} from '../helpers'

// Exercises the facilitator -> participant syncState broadcast independent of
// estimate submission: active-item changes and unit changes should reach an
// already-connected participant with no manual reload.
test('facilitator state changes propagate live to a connected participant', async ({
  facilitator,
  participant,
}) => {
  const code = await createCollaborativeSession(facilitator)
  await addItem(facilitator, 'Item A') // first item: auto-selected
  await joinSessionAsParticipant(participant, code, 'Sam Rivera')
  await expect(participant.getByText('Item A')).toBeVisible()

  await addItem(facilitator, 'Item B')
  await selectItem(facilitator, 'Item B')
  await expect(participant.getByText('Item B')).toBeVisible()

  await facilitator.getByLabel('Estimation unit').selectOption('hours')
  await expect(participant.getByLabel(/^Best case \(hours\)/)).toBeVisible()
})
