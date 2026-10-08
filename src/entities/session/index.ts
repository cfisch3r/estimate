export type {
  ActionResult,
  Estimate,
  EstimateField,
  EstimateValues,
  EstimateValuesError,
  EstimationUnit,
  GuardResult,
  UncertaintyGuidance,
  UncertaintyLevel,
} from '../../domain/estimate'
export {
  aggregateEstimates,
  checkFalsePrecision,
  checkSymmetricRange,
  computeCI90,
  createEstimate,
  DEFAULT_UNCERTAINTY_INDEX,
  findOrderViolation,
  UNCERTAINTY_GUIDANCE,
  UNCERTAINTY_LEVELS,
  UNIT_GRANULARITY,
  UNIT_SUFFIX,
  uncertaintyGuidance,
  validateEstimateValues,
} from '../../domain/estimate'

export { useSessionStore } from '../../application/stores/session'
export { useConnectionStore, useRoundStore } from '../../application/stores/publicStores'
export type {
  Item,
  LiveRound,
  LiveConnectionStatus,
  SessionMode,
  SessionRole,
} from '../../domain/types'

export { isFinalized } from '../../domain/item'
export { roundMemberIds } from '../../domain/roster'
export { finalResultFor } from '../../domain/finalResult'
export { FACILITATOR_PARTICIPANT_ID } from '../../domain/participantId'
export { participantLabels } from '../../domain/participantLabel'

export { generateSessionCode } from '../../application/lib/sessionCode'
export { NetworkProvider } from '../../application/NetworkProvider'
export { useNetworkSession } from '../../application/ports/useNetworkSession'
export {
  ParticipantIdentityContext,
  useParticipantIdentity,
} from '../../application/ports/participantIdentityContext'
export type { ParticipantIdentityApi } from '../../application/ports/participantIdentityContext'

export { ItemDetailShell } from './ui/ItemDetailShell'
export { EstimateTriple } from './ui/estimate/EstimateTriple'
export { RangeBar } from './ui/estimate/RangeBar'
