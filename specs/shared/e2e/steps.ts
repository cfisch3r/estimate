import { joinSessionAsParticipant } from '../../../e2e/helpers'
import { Given, When, requireState } from './world'
import type { Actor, ScenarioState } from './world'

/** Steps more than one concept's e2e specs use. Every `*-bdd` project in
 *  `playwright.config.ts` loads this file next to its own steps. */

/** Shared by the "has joined the session" (Given) and "joins the session"
 *  (When) step texts — same action, phrased differently for an
 *  already-present participant vs. a late joiner. */
async function joinSession(actor: Actor, state: ScenarioState, name: string) {
  await joinSessionAsParticipant(
    await actor(name),
    requireState(state, 'sessionCode'),
    name,
  )
}

Given('{word} has joined the session', async ({ actor, state }, name: string) => {
  await joinSession(actor, state, name)
})

When('{word} joins the session', async ({ actor, state }, name: string) => {
  await joinSession(actor, state, name)
})
