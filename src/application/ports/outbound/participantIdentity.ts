// The port through which the join use case obtains this client's stable id
// (ADR-003). The application layer owns this interface; `adapters/storage`
// implements it and `app/` provides it (ADR-009). No React here, so adapters and
// specs may import it.

export interface ParticipantIdentityApi {
  getOrCreateParticipantId: () => string
}
