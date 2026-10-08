import type { ActionResult, Estimate } from '../../domain/estimate'
import { finalResultFor } from '../../domain/finalResult'
import { useRoundStore } from '../stores'

/** Aggregate `submissions` into item `id`'s final result and record it. The one
 *  finalize step shared by the live (collected submissions) and single-user (own
 *  estimate) flows. Reads the store at call time. */
export function finalizeWith(id: string, submissions: Estimate[]): ActionResult {
  const result = finalResultFor(submissions)
  if (!result.ok) return result
  useRoundStore.getState().finalizeItem(id, result.value)
  return { ok: true }
}
