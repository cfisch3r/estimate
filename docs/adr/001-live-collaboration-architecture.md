# ADR-001: Peer-to-Peer Live Collaboration with Manual Entry as a First-Class Fallback Mode

**Status:** Accepted
**Date:** 2026-08-10
**Related:** [../prd.md](../prd.md) §4 (Session modes), §9 (Non-functional requirements)

## Context

EstiMate needs to support teams estimating together live (planning-poker-style), producing three-point estimates (Best/Likely/Worst → min/expected/CI90/max per item).

A hard product constraint: **the app must not require the operator to run or maintain a central server for session communication.**

We evaluated four architectures for the real-time sync between participants:

1. **Facilitator-hosted server** (e.g., a Docker image the facilitator runs locally) — rejected. Works only when all participants share a reachable network (LAN); fails for remote/external participants without port forwarding, TLS setup, or a tunnel, none of which are reasonable to ask of a session facilitator.
2. **Peer-to-peer via WebRTC**, with NAT traversal via public STUN servers and serverless signaling (e.g., Trystero-style, over public trackers/relays) — no server operated by us, browsers connect directly.
3. **Third-party managed realtime backend** (Supabase Realtime, Firebase, PartyKit) — not self-hosted, but still a centralized relay operated by a vendor; all traffic passes through their infrastructure.
4. **Platform-hosted collaboration** (e.g., Microsoft Teams Live Share / Azure Fluid Relay) — zero-ops and firewall-proof, but ties the product to the Teams ecosystem and requires participants to be in a Teams meeting.

Our target usage pattern (confirmed with the product owner): participants are **usually on the same company network or VPN**, not fully distributed across arbitrary external networks.

## Decision

**We will use option 2: peer-to-peer WebRTC connections between participants' browsers, with public STUN servers for NAT traversal and a serverless signaling mechanism.** No backend will be operated by us for live session communication.

**In addition, we will ship a second, first-class session mode — Manual Entry — where a single facilitator types in the team's already-discussed Best/Likely/Worst values directly, with no network connection between participants at all.** This is not merely a fallback UI state; it is a fully supported mode selectable at session creation, sharing the same calculation engine, bias guards, and report format as the live mode.

## Rationale

**Why P2P over the alternatives:**
- Satisfies the "no server we operate" constraint directly and completely, unlike options 1, 3, and 4 (all of which involve either us or a vendor running always-on infrastructure)
- STUN-based NAT traversal (plain UDP hole punching) is well suited to our actual usage pattern: same-office and VPN-based participants are the easy case for this technique, since these networks typically use endpoint-independent NAT mapping (see supporting research below)
- Costs nothing to operate — public STUN servers and serverless signaling channels are free, unlike TURN relays or managed backends at scale
- Keeps the product distributable as a plain web link, unlike the Teams-locked option

**Why P2P still has a known gap, and why that's acceptable:**
- A minority of networks (symmetric NAT, common on stricter corporate firewalls) will not connect via STUN alone. Fixing this fully requires a TURN relay, which reintroduces a server-like cost (bandwidth-metered relay) — directly against the stated constraint.
- We are explicitly **not** building a TURN fallback for MVP. Given the target usage pattern (VPN/same office), we expect this gap to affect a small minority of sessions. If usage data later shows this is a frequent blocker, a bring-your-own-relay option (facilitator supplies their own free-tier Supabase/Firebase project) is the preferred next step over us operating a TURN server ourselves — it preserves the "we don't run infrastructure" principle while giving affected teams an opt-in escape hatch.

**Why Manual Entry as a first-class mode, not just an error state:**
- It directly covers the P2P connection-failure case: if peers can't connect, the facilitator can immediately fall back without losing the session
- It also covers a distinct, valid use case on its own: facilitators who ran the actual estimation discussion elsewhere (in person, on a call, in Slack) and just want the calculation engine and bias guards applied to the numbers the team already agreed on — this isn't a degraded experience for them, it's the intended workflow
- Sharing the same data model, calculation logic, and report format between modes (see PRD §4.2, §8) keeps this cheap to build and keeps session history/exports consistent regardless of which mode was used

## Consequences

**Positive**
- No server operating cost or ops burden for the app's core feature
- Product remains a plain shareable web link — no meeting-platform lock-in
- Manual Entry mode gives every session a reliable fallback and serves a real standalone use case, so a P2P connection failure is never a dead end
- Architecture matches the actual target usage pattern (VPN/office), minimizing the practical impact of the known gap

**Negative / accepted trade-offs**
- A minority of sessions with participants on strict/symmetric-NAT networks will fail to connect peer-to-peer and must fall back to Manual Entry, losing the per-participant live discussion view for that session
- No built-in TURN relay means this gap is not solved for MVP, only worked around
- Peer-to-peer mesh topology means connection overhead grows with participant count; acceptable for typical estimation session sizes (a handful of people) but would need revisiting if session sizes grow much larger

**Follow-ups**
- Monitor connection-failure rates (facilitator falling back to Manual Entry mid-session) as a signal for whether a bring-your-own-relay TURN option is worth building
- Revisit if usage patterns shift toward more fully-external/distributed participants than the VPN/office pattern this decision assumes

## Alternatives considered (summary)

| Option | Rejected because |
|---|---|
| Facilitator-hosted Docker server | Fails for any participant outside the facilitator's local network without manual tunneling/port-forwarding |
| Third-party managed backend (Supabase/Firebase/PartyKit) | Still a centralized, vendor-operated relay; contradicts the "no central server" constraint even though we don't run it ourselves |
| MS Teams Live Share | Zero-ops and firewall-proof, but locks the product into the Teams ecosystem and meeting context rather than being a standalone web app |
