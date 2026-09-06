# EstiMate documentation

| Doc | What it covers |
|---|---|
| [prd.md](prd.md) | Product requirements — problem, goals, session modes, calculations, bias guards, screens, data model, phased roadmap. |
| [architecture.md](architecture.md) | Technical architecture — stack, module structure, the `/calc` engine, the P2P network layer, persistence approach, hosting. |
| [adr/001-live-collaboration-architecture.md](adr/001-live-collaboration-architecture.md) | Accepted decision: peer-to-peer WebRTC for Live mode, with Manual mode as a first-class fallback. |
| [adr/002-testing-strategy.md](adr/002-testing-strategy.md) | Accepted decision: layered tests — unit + component now, Playwright deferred until `src/network/` or `src/persistence/` gain real implementations. |
| [concepts/collaboration-mode.md](concepts/collaboration-mode.md) | Live mode (Mode A) technical concept, diagram-driven: the Trystero network layer, join flow, connection state machine, and the screen/store wiring shipped so far. |

Design references (dated snapshots, not living docs) live in `../design_handoff_estimate_app/` and `../design_handoffs/`.
