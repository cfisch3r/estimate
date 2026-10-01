import { test, expect } from '../fixtures'
import { createCollaborativeSession, joinSessionAsParticipant } from '../helpers'

// Base connectivity: a facilitator's generated session code actually lets a
// second real browser reach it over WebRTC. Everything else in this suite
// builds on this working. See ADR-007 for the local-relay signaling this
// runs against by default.
test('facilitator creates a session and a participant joins it', async ({
  facilitator,
  participant,
}) => {
  const code = await createCollaborativeSession(facilitator)
  await joinSessionAsParticipant(participant, code, 'Sam Rivera')

  await expect(participant).toHaveURL(/\/estimate$/)
  await expect(facilitator.getByText('1 participant connected')).toBeVisible()
})
