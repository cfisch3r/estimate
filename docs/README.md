# EstiMate documentation

| Doc | What it covers |
|---|---|
| [prd.md](prd.md) | Product requirements — problem, goals, session modes, calculations, bias guards, screens, data model, phased roadmap. |
| [architecture.md](architecture.md) | Technical architecture — stack, module structure, the `/calc` engine, the P2P network layer, persistence approach, hosting. |
| [adr/001-live-collaboration-architecture.md](adr/001-live-collaboration-architecture.md) | Accepted decision: peer-to-peer WebRTC for Live mode, with Manual mode as a first-class fallback. |
| [adr/002-testing-strategy.md](adr/002-testing-strategy.md) | Accepted decision: layered tests — unit + component now, Playwright deferred until real browser-only behaviour exists (real WebRTC peer connect/drop, real persistence); see the doc's 2026-09-07 update. |
| [adr/003-session-reliability-model.md](adr/003-session-reliability-model.md) | Accepted decision: facilitator-authoritative round state, versioned rounds, a values-free submission roster pulled on (re)connect, acknowledged submissions, stable client identity, role-asymmetric link state. The design anchor for #9, #60, #61, #62, #63 — stable client identity (#50), versioned rounds (#51), single owner (#60), and acknowledged submissions (#61) have landed; **role-asymmetric link state (#62) remains decision only, not built**. |
| [concepts/collaboration-mode.md](concepts/collaboration-mode.md) | Live mode (Mode A) technical concept, diagram-driven: the Trystero network layer, join flow, connection state machine, the participant estimate round, the facilitator reveal / retry-round flow, and the screen/store wiring shipped so far. |

Design references (dated snapshots, not living docs) live in `../design_handoff_estimate_app/` and `../design_handoffs/`.
