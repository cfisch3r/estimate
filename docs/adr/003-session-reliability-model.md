# ADR-003: Facilitator-Authoritative Session State and the Reconnect Model

**Status:** Accepted
**Implementation:** **none of this is built.** This records a decision, not shipped
behaviour — the Decision section below is written in the present tense for readability, but
`SessionSnapshot` has no `roster` and no `round`, `submitEstimate` is still an untargeted
broadcast, `participantId` is still minted per join, and connection state is still a single
aggregate.
**Date:** 2026-09-14 (drafted 2026-09-12)
**Related:** [001-live-collaboration-architecture.md](001-live-collaboration-architecture.md), [../concepts/collaboration-mode.md](../concepts/collaboration-mode.md) §"Why connections drop"

> For the current implementation plan and sequencing — which issues carry which element of
> this decision, in what order, and what's blocked on what — see the Epic-0010 sub-issue list
> on the project board, not this document. That ordering changes as work happens; this
> decision shouldn't need editing when it does.

## Context

ADR-001 decided *how peers reach each other* (P2P WebRTC, no server we operate). It never
decided *who owns session state once they are connected*. That question was answered
implicitly by the implementation, and the implicit answer is "nobody":

- Pre-reveal, each participant tallies other people's submissions locally from `onEstimate`;
  the facilitator separately accumulates onto `items[].submissions`. Nothing reconciles the two.
- Every wire action is an untargeted broadcast (`makeAction(...).send(data)`), fire-and-forget,
  with no delivery signal to the sender.
- Round transitions ride on one-shot events (`reveal`, `roundReset`). A peer offline at that
  instant misses them permanently.
- `participantId` is minted fresh per join, so the network layer cannot tell a rejoin from a
  new person.
- `connectionStatus` is a single aggregate over *all* peers, so it cannot express "I lost the
  one link that matters."

Symptoms already observed, all downstream of that one unmade decision:

| Symptom | Root cause |
|---|---|
| A mid-session drop went undetected, with no way back in (partially fixed since) | Aggregate-only connection state |
| A rejoin double-counts in the finalized aggregate; the roster never prunes a departure | Per-join identity, no `peerId ↔ participantId` map |
| An estimate from a pre-Retry round gets re-injected into the new round | Round has no identity; transitions are one-shot |
| No coherent fallback story for a failed or lost connection | No definition of what reconnect restores |

Three further defects surfaced while drafting this ADR, all from the same root:

- **Silent submission loss.** `submitEstimate` broadcasts to whatever direct links a peer
  holds, and Trystero does not relay between peers. A participant who loses *only* their link
  to the facilitator keeps `connectionStatus === 'connected'` (other participants still count)
  while their estimates never arrive and nothing says so.
- **Pre-reveal estimate leak.** `applyRemoteEstimate` stores every peer's full `Estimate` into
  each participant's `liveRound.submissions`; the UI merely declines to render it until reveal.
  Anyone with devtools open reads the group's numbers early — the exact anchoring the product
  exists to prevent.
- **Premature "You're in".** `connectionStatus` flips to `connected` on the first peer of any
  kind, so a participant whose first link happens to be to another *participant* is routed out
  of the join screen having never reached the facilitator. If that facilitator link then never
  establishes, they wait in the lobby indefinitely with no indication of a problem.

Relevant capability we are not currently using: Trystero 0.25 already provides targeted sends
(`send(data, {target})`), request/response actions (`makeAction(ns, {kind: 'request'})` →
`request(data, {target, timeoutMs}): Promise<R>`) whose rejections carry a discriminating
`error.kind` of `timeout | disconnected | aborted`, a per-peer liveness probe
(`room.ping(peerId)`), and direct access to each link's `RTCPeerConnection` (`room.getPeers()`).
We use only untargeted `makeAction(...).send`.

## Decision

**Live-session round state is owned by the facilitator. Participants hold a derived
projection, never an authoritative copy. Reconnect is defined as "re-obtain the facilitator's
current snapshot and discard local round state that disagrees with it."**

Five elements, referred to by name throughout the codebase:

### Single owner

The facilitator's `items[]` is the source of truth for submissions, reveal state, and
finalization. A participant's `liveRound` is a projection of the facilitator's snapshot plus
its own pending submission. Participants stop treating peer-observed submissions as
authoritative — and stop receiving them at all.

`SessionSnapshot` therefore carries a **values-free roster** for the current round:

```
roster: Array<{ participantId, submitted: boolean, connected: boolean }>
```

One definition, two renderings: the facilitator's 1c panel and the participant's status line
read the same structure. This replaces the local `peerCount` arithmetic that currently derives
the "N of M submitted" denominator — arithmetic that is only correct while the full mesh is
intact. It also closes the pre-reveal estimate leak: estimate *values* no longer reach
participants until the facilitator reveals.

Roster broadcasts coalesce within a tick, so a burst of submissions produces one message.

**How a snapshot is obtained: broadcast on change, pulled on arrival.** The facilitator
broadcasts a fresh snapshot whenever session state changes — that part is a genuine message to
everyone and stays. But a peer that has just connected or reconnected **requests** the snapshot
itself, using the same request/response action as a submission, rather than relying on the
facilitator's peer-join handler to push one.

The reason is where responsibility sits. A returning participant is the party that knows it was
away; the facilitator only infers it from a peer-join event. Making recovery depend on the other
side observing your return leaves a participant with a stale view and no way to prompt a fix if
that event is missed or arrives while the facilitator's tab is busy. A pull also inherits the
same typed failures and bounded retry as a submission (one recovery pattern, not two), serves a
first-time join identically, gives a participant a cheap way to confirm its own submission
landed, and costs one targeted message per arrival instead of a full-room broadcast per arrival
— which matters when several peers return together after a blip.

This replaces the existing peer-join re-broadcast in `NetworkProvider`. It is a single fetch on
connect, **not** polling: a participant that asks repeatedly would put the facilitator back in
the position of serving N clients on a timer.

### Versioned rounds

Each item carries a `round: number`, bumped by `retryRound` and included in `SessionSnapshot`.
Participants reset round-local state whenever `(itemId, round)` changes. State converges from
any snapshot with no dependence on having received a one-shot event, which allows `reveal` and
`roundReset` to be removed from the wire protocol entirely. Submission requests carry the round
they belong to, so a retry landing after a Retry is rejected as stale rather than recorded into
the new round.

### Acknowledged submissions

`submitEstimate` becomes a targeted request to the facilitator
(`request(data, {target: facilitatorPeerId, timeoutMs: 1000})`) rather than a broadcast.
Participants learn the facilitator's `peerId` from its `announce`.

The acknowledgement's purpose is **failure attribution**, not speed — the roster broadcast
travels the same two hops, so an ack is not meaningfully faster. What it provides is a typed
rejection that the retry policy keys on:

| `error.kind` | Meaning | Response |
|---|---|---|
| `disconnected` | No active peer, or the link died in flight | Do not retry — escalate to reconnect |
| `timeout` | Link alive, facilitator did not answer | Retry, at most twice (~500ms / ~1500ms backoff) |
| `aborted` | We cancelled | Do not retry |
| *(generic)* | Handler threw, or none registered after Trystero's 500ms buffer | Surface after one attempt |

Total retry budget stays under Trystero's 5-second ICE teardown, so a retry sequence can never
outlive the link it is retrying on. A dead link rejects immediately rather than waiting out the
timeout, so this costs nothing in the common failure case.

Correctness does not rest on the ack. The roster from Single owner is the convergence mechanism:
on every snapshot a participant checks whether it appears as `submitted` and re-sends if not.
This specifically recovers the case where the estimate arrived but the acknowledgement was lost
on the return path — a false "not delivered" that would otherwise tell the user to act when
nothing is wrong.

The participant's waiting view gains a delivery sub-state (*sending* / *submitted* / *not
delivered*). When the facilitator link is down, that banner owns the explanation and the
delivery state defers to it rather than stacking a second alarm.

### Stable client identity

`participantId` is persisted per browser (`localStorage`) and reused across joins. The
facilitator maintains a `peerId ↔ participantId` map from inbound `announce`, pruned on
`onPeerLeave`, so a rejoin replaces its predecessor rather than duplicating, and a departure
prunes the roster.

**Stable identity must land before acknowledged submissions' retry.** A retry is a duplicate
by design, and duplicates are harmless only because `upsertByParticipant` keys on
`participantId`. With per-join ids, a retry after a reconnect creates a second roster row and
double-counts in the finalized aggregate — the exact symptom this element exists to fix,
newly triggerable by our own retry logic if built first.

### Role-asymmetric link state

The two roles need different things, so `connectionStatus` stops being one aggregate:

- **Participant** — a single binary: is the link to the facilitator up? Loss of a
  participant↔participant link is recorded but never surfaced; under Single owner those links
  carry only `announce`, which the facilitator's snapshot can repair. There is an explicit
  *unknown* window at join, until the first facilitator `announce` arrives over a live link —
  a participant must not be told it is in the session before then.
- **Facilitator** — per-participant link state, folded into the existing roster as a third row
  state alongside `Submitted` and `Waiting`. A participant who drops after submitting keeps
  their estimate in the aggregate; one who drops before submitting is shown as gone, so the
  facilitator can reveal instead of waiting on someone who will never answer.

Link state is driven by `onPeerLeave` only. Trystero's 5-second ICE grace means that signal is
reliable but slightly late; reading `RTCPeerConnection.connectionState` would be ~5s earlier at
the cost of flapping on every transient blip, which is worse in front of someone entering
numbers. An early debounced "reconnecting…" hint on the facilitator's roster is possible later.

**Explicitly out of scope:** reachability — whether two peers can connect *at all* (symmetric
NAT, TURN, bring-your-own-relay). ADR-001 holds that position; revisiting it belongs there as a
dated update, not here.

## Rationale

- **The symptoms collapse into one change.** Fixing them individually means local patches to a
  model that keeps regenerating the same class of bug. Versioned facilitator-owned snapshots
  make double-counted rejoins, stale-round re-injection, and most of the fallback-UX question
  structural non-problems rather than handled cases.
- **Convergent state beats event replay.** Trystero has no history replay, so any design that
  depends on receiving a specific message at a specific moment is wrong under reconnection by
  construction. Independent analysis of the stale-round symptom reaches this conclusion too.
- **An authoritative owner already exists in the product.** The facilitator reveals, retries,
  and finalizes. Making that explicit in the data model matches the domain rather than imposing
  structure on it.
- **It improves privacy rather than trading it away.** Moving to a values-free roster stops
  estimates reaching participants before the reveal at all.
- **The cost is lower than it looks.** Targeted sends, typed request/ack, per-peer ping, and
  per-link `RTCPeerConnection` access are already in the dependency; this is mostly adopting API
  surface we have, not building transport machinery.
- **It does not reintroduce a server.** The facilitator is a peer, not infrastructure. The
  ADR-001 constraint is untouched.

## Consequences

**Positive**
- Reconnect has one definition and one code path, rather than per-symptom recovery
- Submission delivery becomes observable to the participant who made it
- Estimate values no longer reach participants before the reveal
- The wire protocol shrinks (`reveal` and `roundReset` removable)
- Targeted sends remove the post-reveal O(N²) broadcast storm noted in the concept doc
- Rejoins and departures stop corrupting the finalized aggregate
- The facilitator gets a truthful roster, so "is everyone in?" stops being answered wrongly

**Negative / accepted trade-offs**
- **The facilitator becomes a single point of failure by design.** Their disconnect already
  stalls the session (ADR-001 consequence); this makes the dependency explicit rather than
  reducing it. Facilitator re-election stays out of scope.
- Participants can no longer see a submission tally derived from peers alone — they see what
  the facilitator's snapshot reports. This is a behaviour change, and correct.
- Roster broadcasts add one message per submission where today there are none pre-reveal — a
  second O(N²) path alongside the post-reveal one. Negligible at real session sizes, and
  coalesced within a tick, but it is new traffic.
- Participants learn *who* has submitted, where today they see only a count. Conventional in
  planning poker and arguably desirable; the UI still renders the count only.
- Request/ack adds a round trip and a retry state machine per submission
- A stable `localStorage` id is a new persistence surface, and means two tabs in one browser
  share an identity unless explicitly handled
- Element 5 newly depends on `participantId: 'facilitator'` in `announce`, which is
  self-declared and unauthenticated (the "no peer-identity binding" gap already recorded in the
  concept doc). A malicious insider could make a participant track the wrong link. This does
  not worsen the gap but does promote it from cosmetic to affecting connection state.

**Follow-ups**
- Stable client identity has to land before any element that retries or resends, since a
  retry is only safe once a duplicate is distinguishable from a new person
- Revisit ADR-001's TURN position if connection-loss telemetry justifies it
- Consider moving `announce` into the snapshot, after which participant↔participant links
  carry nothing at all
- The pre-reveal estimate-value leak is resolved structurally by the single-owner element;
  if that slips, it's a product-integrity issue worth its own narrow fix in the meantime
  (recording only a submitter's id, not their values, until the full model lands)

## Alternatives considered (summary)

| Option | Rejected because |
|---|---|
| Keep fire-and-forget mesh; patch each symptom individually | Cheapest per symptom, but each fix is local; the underlying "no owner" model keeps producing new ones |
| Add acks and retry to submissions, leave state ownership diffuse | Fixes silent loss only; double-counted rejoins and stale-round re-injection each still need their own mechanism, and reconnect stays undefined |
| Full CRDT / operation-log replication between peers | Correct under arbitrary partition, but far beyond a handful of peers doing one round at a time; large complexity cost for a session that already has a natural owner |
| Elect a new authoritative peer when the facilitator drops | Solves the single-point-of-failure trade-off above, but requires consensus among peers with no server; disproportionate for MVP session sizes and lifetimes |
| Retry submissions for the life of the round | Rests on a false premise: a closed data channel rejects instantly with `disconnected` rather than absorbing retries, so the extra attempts can only ever target failures they cannot fix |
| Roster only, no acknowledgement | Roster absence carries no cause and no timing, so the kind-driven retry and escalation policy cannot be built on it |
| Acknowledgement only, no roster | Cannot recover a lost return receipt: the facilitator holds the estimate while the participant is told it failed |
| Surface every degraded link to every peer | Tells a participant about links they cannot act on and which, under Single owner, no longer affect correctness |
