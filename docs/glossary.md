# Glossary

The words we use for architecture in this repo, and what they mean here. It is not a
general dictionary: where a word has several meanings in the wider world (layer, entity,
model), this page says which one we use. When you meet a new word in a discussion or a
doc, add it here instead of guessing.

## Structure

| Term | Meaning in this repo | Avoid |
|---|---|---|
| **Layer** | A horizontal level of the code in which dependencies point only one way. In the target architecture ([ADR-009](adr/009-architecture-style-fsd-vs-hexagonal-core.md)): UI, application, domain, adapters. Say **FSD layer** when you mean one of Feature-Sliced Design's (`app`, `pages`, `widgets`, `features`, `entities`, `shared`; [ADR-004](adr/004-feature-sliced-design-architecture.md)). | "lane" (except for a Mermaid subgraph, see below) |
| **Domain** | The innermost layer: pure rules and types, with no React, no I/O and no packages. Lives in `src/domain/` (ADR-009 stage 1); since stage 3b-1 it also holds the state-transition rules the stores call; the rule that it imports nothing outside itself is enforced by oxlint. | |
| **Application layer** | The use cases and the state stores. Lives in `src/application/` (ADR-009 stage 3a); oxlint lets it import only the domain and itself. It owns the ports. Not stateless, unlike textbook hexagonal architecture (ADR-009, "Where state lives"). | |
| **Adapter** | Code that connects the application to something outside it. Lives in `src/adapters/` (`network/`, `storage/`; ADR-009 stage 2); oxlint keeps it free of React, Zustand and the UI layers. | |
| **Inbound adapter** | An adapter that calls into the application, such as an incoming peer message. It needs no port. | "driving adapter" |
| **Outbound adapter** | An adapter the application calls out to, such as the peer transport or storage. It implements a port. | "driven adapter" |
| **Port** | An interface owned by the application layer. The peer transport (`src/application/ports/outbound/networkTransport.ts`) is implemented by an outbound adapter, and so is the participant-identity port. Ports exist only at external boundaries. | "port" for an interface between two parts of the application (see Handle) |
| **Handle** | An interface the application passes between its own parts. `LiveSessionApi` (`connect`, `disconnect`, `sendEstimate`; `useCases/liveSessionContext.ts`) is the live-session controller's face for the use-case hooks. The composition root creates the controller and fills a React context, and the hooks read it through `useLiveSession`, because a hook cannot import an object that only exists at runtime. Unlike a port it implements nothing outside the application. | "port" |
| **Live-session controller** | A framework-free function, `createLiveSessionController(deps)` in `src/application/useCases`, that owns the live peer session: connect, disconnect, sendEstimate and all per-connection state. It receives the transport as a parameter and is tested with a fake. `app/LiveSessionProvider.tsx` is the thin React shell around it. | |
| **Composition time** | The moment the app is wired together (ADR-009): the place that picks which adapter implements which port. Not runtime logic. | |
| **Use case** | One user or peer intent run end to end (submit, reveal, retry, finalize, join, leave). Straight-line code: read state, call a domain decision, write state, trigger an effect. Rules belong in pure domain functions. | |
| **State store** | A Zustand store that holds the current in-process state (session, round, connection). Its actions only change that store's own state, usually by calling a pure domain rule (`set(state => rule(state, input))`). | |
| **Store action vs use case** | The test: does the code reach outside one store? If it reads or writes another store, calls a port, or triggers an effect (network, id generation), it is a use case; stores do not reach into each other; the one sanctioned exception is the round store writing the session's items through `patchItem` (ADR-005). If it only transforms its own store's state, it is a store action that calls a domain rule. The UI may call a few trivial field setters on the store directly; everything else goes through a use case. | |
| **Layer view** / **component view** | The two kinds of diagram in ADR-009: layers and their dependencies, and the boxes inside each layer. | |
| **Lane** | Only the name of a Mermaid subgraph in our diagram convention (AGENTS.md). Never used for architecture itself. | |

## Feature-Sliced Design

These words belong to FSD only. They do not describe the target layers above.

| Term | Meaning |
|---|---|
| **Slice** | A folder inside an FSD layer that groups one business concept (for example `entities/estimate`). |
| **Segment** | A purpose-named folder inside a slice: `model`, `api`, `lib`, `ui`. Note that FSD's `model` segment is not "the domain model" in the DDD sense. |
| **Public API** | The barrel file (`index.ts`) of a slice; the only thing other slices may import. |

[ADR-004](adr/004-feature-sliced-design-architecture.md) and ADR-005 are accepted history
and use "lane" and "slice" in their own sense. They are not rewritten.

## Domain concepts

| Term | Meaning |
|---|---|
| **Type** | A TypeScript type or interface in the code. In new architecture prose we say "type" for code-level things and avoid "shape" and "model" (FSD's `model` segment name is exempt; older docs such as ADR-005 still say "shape"). |
| **Aggregate** | A cluster of data changed together as one unit, with one root. Here: the **session** is the aggregate root. It contains the items, the rounds, the submissions and the final results. |
| **Entity** | In the DDD sense: something with its own identity that changes over time, such as an item or a round. Say **FSD entities layer** for the folder `src/entities`. |
| **Value object** | A value with no identity, compared by content and validated on creation. `Estimate` is one (`createEstimate`). |
| **Session** | One estimation meeting. Live (peer to peer) or manual. |
| **Round** | One pass of everyone estimating one item; the facilitator can retry it. |
| **Submission** | One participant's estimate for the current round. |
| **Roster** | The values-free list of who has submitted, sent in the snapshot ([ADR-003](adr/003-session-reliability-model.md)). |
| **Snapshot** | A derived, read-only copy of the facilitator's round state that participants hold (applied via `applyRoundSnapshot` to a `LiveRound`). The facilitator stays the authority. |
| **Connection state** | The status of the peer link. It describes the link, not the estimate, so it is outside the aggregate. |
| **Participant identity** | A participant's stable client id. Also outside the aggregate. |

## Working rule

- Use the other person's term when they have one. Say a new word only after defining it
  here or inline on first use.
- If a word means two things (layer, entity, model), qualify it: "FSD layer", "FSD entities
  layer".
