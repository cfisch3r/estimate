# Live Collaboration Mode — Technical Concept

## Overview

EstiMate has two session modes. **Manual mode (Mode B)** is single-user, in-memory, and
already built. **Live mode (Mode A)** lets named participants join a facilitator's session
over a serverless peer-to-peer mesh (Trystero over WebRTC, Nostr relays for signaling only)
and submit private three-point estimates that are revealed together. There is **no backend** —
every peer runs the same code and computes aggregates locally.

This document covers the join flow (#6, updated for the #34 mode-select / Workspace
entry-flow rebuild), the participant estimate round (#7), the `announce` action that
carries participant display names (#40), and the facilitator reveal / retry round (#8) —
Workspace states 1c (waiting for estimates) → 1d (revealed), carried over the wire by the
`reveal` and `roundReset` actions.

## Component view

Level-3 (component) view. Each box carries its `[type]`; responsibilities are in the table
below. Lanes are the source directories. Lines: **solid** = synchronous call,
**dotted** = asynchronous callback / event / read, `<-->` = bidirectional.

```mermaid
flowchart TD
  subgraph screens["🖼️ &nbsp; UI LANE &nbsp;·&nbsp; src/screens"]
    direction LR
    MS["ModeSelect<br/>[React Component]"]
    JS["JoinSession<br/>[React Component]"]
    PEV["ParticipantEstimateView<br/>[React Component]"]
    WS["Workspace<br/>[React Component]"]
  end

  subgraph statelane["🗄️ &nbsp; STATE LANE"]
    Store["useSessionStore<br/>[Zustand Store]"]
  end

  subgraph bridge["🔌 &nbsp; BRIDGE LANE &nbsp;·&nbsp; src/network (React)"]
    direction LR
    NP["NetworkProvider<br/>[React Context Provider]"]
    Hook["useNetworkSession<br/>[React Hook]"]
  end

  subgraph core["📡 &nbsp; P2P CORE LANE &nbsp;·&nbsp; src/network (framework-free)"]
    direction LR
    JSN["joinSession<br/>[Factory Function]"]
    Act["typed actions<br/>[Module]"]
    Conn["connection tracker<br/>[Module]"]
    Code["generateSessionCode<br/>[Function]"]
  end

  subgraph purelane["🧮 &nbsp; PURE LANE"]
    Calc["calc<br/>[Pure Module]"]
  end

  Trystero["trystero / nostr<br/>[External Library — WebRTC mesh + Nostr signalling]"]

  %% --- synchronous calls (solid) ---
  MS -->|"startSingleUser / startCollaborative"| Store
  JS -->|"joinLiveSession"| Store
  MS -->|"connect()"| Hook
  JS -->|"connect()"| Hook
  MS -.->|"reads code"| Code
  NP -->|"owns, provides"| Hook
  Hook -->|"joinSession(code)"| JSN
  PEV -->|"sendEstimate() (own submission)"| Hook
  WS -->|"revealRound / retryRound / finalizeLiveItem"| Store
  WS -->|"sendReveal / sendRoundReset"| Hook
  JSN -->|"creates"| Act
  JSN -->|"creates"| Conn
  Act <-->|"P2P messages (encrypted)"| Trystero
  Act -.->|"validate inbound"| Calc

  %% --- asynchronous events / reads (dotted) ---
  Conn -.->|"onConnectionStateChange"| Hook
  Act -.->|"onEstimate / onSyncState / onReveal / onRoundReset / onAnnounce"| NP
  Hook -.->|"setConnectionStatus / setPeerCount"| Store
  NP -.->|"applySyncState / applyRemoteEstimate / applyReveal / applyRoundReset / applyParticipantName"| Store
  NP -.->|"reads items/activeItem (facilitator syncState); reads own name/id (announce)"| Store
  Store -.->|"state (read)"| screens

  %% --- lane + node colours ---
  classDef ui     fill:#DDD6FE,stroke:#7C3AED,color:#2E1065
  classDef state  fill:#FDE68A,stroke:#D97706,color:#3F2D0B
  classDef br     fill:#99F6E4,stroke:#0D9488,color:#042F2A
  classDef pcore  fill:#BFDBFE,stroke:#2563EB,color:#0B2545
  classDef pure   fill:#E2E8F0,stroke:#64748B,color:#0F172A
  classDef ext    fill:#FFEDD5,stroke:#EA580C,color:#3F1D0B,stroke-dasharray:5 4

  class MS,JS,PEV,WS ui
  class Store state
  class NP,Hook br
  class JSN,Act,Conn,Code pcore
  class Calc pure
  class Trystero ext

  style screens   fill:#F5F3FF,stroke:#7C3AED,stroke-width:2px
  style statelane fill:#FFFBEB,stroke:#D97706,stroke-width:2px
  style bridge    fill:#F0FDFA,stroke:#0D9488,stroke-width:2px
  style core      fill:#EFF6FF,stroke:#2563EB,stroke-width:2px
  style purelane  fill:#F8FAFC,stroke:#64748B,stroke-width:2px
```

### Component responsibilities

| Component | Type | Responsibilities |
|---|---|---|
| **ModeSelect** | React Component | The entry screen: three rows — start single-user, start collaborative, join. On "start collaborative": reads a code from `generateSessionCode`, calls `startCollaborative(code)` (which sets `mode` / `role` / `sessionId` and routes to the Workspace), then `connect()`. "Join" routes to the Join screen. |
| **JoinSession** | React Component | Collects session code + participant name (name required — no anonymous peers). Calls `joinLiveSession()` then `connect()`. Renders connecting / connected / disconnected states from `store.connectionStatus`, including the failure banner + Retry. |
| **ParticipantEstimateView** | React Component | The participant's whole round (#7), driven by `store.liveRound`: a lobby before the facilitator picks an item, then the Best/Likely/Worst form with live bias guards (5c), a waiting state showing the submitted values with a revise affordance (5d), and a revealed state with the aggregated range bar + per-participant list (5e). No finalize/retry — those are facilitator-only. Submitting calls `store.submitEstimate()` then broadcasts the validated estimate via `useNetworkSession().sendEstimate`. |
| **Workspace** | React Component | The single working screen for both modes: session-name / unit / item-list sidebar plus the active item's estimate panel (or an empty state). In Live mode additionally renders the session-code strip (with copy button), the "N participants connected" count, and a connection-status `Tag`. For a **facilitator** in Live mode the manual B/L/W inputs are replaced by the reveal panel: state 1c lists each participant as `Submitted` / `Waiting` and gates a **Reveal estimates** button on `submissions.length >= 1`; state 1d shows the aggregated range bar + per-participant values with **Finalize item** (`finalizeLiveItem`) and **Retry — start new round** (`retryRound` + `sendRoundReset`). Reveal calls `revealRound` + `sendReveal`. |
| **useSessionStore** | Zustand Store | Single source of truth for session state: `mode`, `role`, `sessionId`, `myName`, `participantId`, `connectionStatus`, `peerCount`, items, current screen. **Participant** clients hold `liveRound` (the facilitator's current item + received submissions + revealed flag + own submission), updated by `applySyncState` / `applyRemoteEstimate` / `applyReveal` / `applyRoundReset` / `submitEstimate`; `applySyncState` additionally adopts `snapshot.unit` into `store.unit`. **Facilitator** clients instead accumulate each round on the `Item` itself — `applyRemoteEstimate` upserts inbound submissions onto `items[activeItemId].submissions` (ignored once the item is `revealed` or finalized), `revealRound` / `retryRound` flip `items[].revealed`, and `finalizeLiveItem` aggregates `items[].submissions` into `finalResult`. Type-only import of `SessionSnapshot` from `src/network/actions`; no runtime `src/network` import. |
| **NetworkProvider** | React Context Provider | Wraps `<App>`. Owns the one `NetworkSession` instance for the app's lifetime and exposes it via `useNetworkSession`; tears it down on unmount. On `connect` it also dispatches inbound `onEstimate` / `onSyncState` / `onReveal` / `onRoundReset` / `onAnnounce` into the store, and (facilitator only) subscribes to the store to broadcast a `syncState` whenever the active item, estimation unit, or finalized set changes. It also broadcasts the local client's own `announce` on connect and re-announces on every peer join, and applies inbound announces via `applyParticipantName`. The `NetworkSessionApi` it provides adds `sendReveal(itemId)` / `sendRoundReset(itemId)` alongside `sendEstimate`. |
| **useNetworkSession** | React Hook | The only code that touches both the store and the P2P core. `connect(sessionId)` calls `joinSession()` and subscribes to its events; `disconnect()` calls `leave()`; `sendEstimate(estimate)` forwards a participant's submission to the room; `sendReveal(itemId)` / `sendRoundReset(itemId)` broadcast the facilitator's reveal / new-round signals. Mirrors `onConnectionStateChange` and peer join/leave into the store. (The participant name is put in the store by `joinLiveSession()` before `connect()` runs.) |
| **joinSession** | Factory Function | Entry point of the P2P core (from PR #25). Opens the Trystero room (`roomId = sessionId`), wires up the connection tracker and typed actions, returns a `NetworkSession` of `send*` / `on*` methods. |
| **typed actions** | Module | Defines the five wire actions (`submitEstimate`, `syncState`, `reveal`, `roundReset`, `announce`), serialises outbound messages, and validates every inbound message (through `calc` for estimates; shape checks for the rest — `reveal` and `roundReset` payloads must be strings) before surfacing it. `announce` carries a `participantId -> display name` pair, kept off the pure `Estimate` type. |
| **connection tracker** | Module | State machine over peer join/leave and join errors → `idle` / `connecting` / `connected` / `disconnected` plus the peer list; notifies subscribers on change. |
| **generateSessionCode** | Function | Returns a 6-char Crockford-base32 code (crypto RNG, ambiguous characters removed), used as both the shareable code and the Trystero room id. |
| **calc** | Pure Module | Existing framework-free math (`createEstimate`, `aggregateEstimates`, `computeCI90`, guards). Used here only to validate inbound peer estimates. |
| **trystero/nostr** | Library (external) | Third-party. Establishes the WebRTC peer mesh and uses Nostr relays for signalling only — no session data is stored on any relay. |

## Join sequence (#6)

```mermaid
sequenceDiagram
  participant F as Facilitator (tab A)
  participant R as Trystero room (P2P)
  participant P as Participant (tab B)

  F->>F: pick "Start collaborative estimation"
  F->>F: generateSessionCode() → "K7F9Q2"
  F->>R: joinSession("K7F9Q2")
  Note over F: connectionStatus = connecting
  F-->>F: Workspace shows code "K7F9Q2"

  P->>P: Join screen — enter code + name
  P->>R: joinSession("K7F9Q2")
  R-->>F: onPeerJoin(p)
  R-->>P: onPeerJoin(f)
  Note over F,P: connectionStatus = connected
  P->>R: sendAnnounce({ participantId, name })
  F->>R: sendAnnounce({ participantId: "facilitator", name })
  Note over F,P: each client also re-announces on every later onPeerJoin (no history replay)
  R-->>F: onAnnounce → store.participantNames[p] = name
  R-->>P: onAnnounce → store.participantNames["facilitator"] = name
  F-->>F: "1 participant connected"
  P-->>P: route to ParticipantEstimateView (lobby until the facilitator picks an item)
```

## Estimate round (#7)

```mermaid
sequenceDiagram
  participant F as Facilitator (tab A)
  participant R as Trystero room (P2P)
  participant P as Participant (tab B)

  F->>F: select an item in the Workspace
  F->>R: sendSyncState({ currentItem, unit })
  R-->>P: onSyncState → store.applySyncState → liveRound + unit set
  P-->>P: ParticipantEstimateView shows the Best/Likely/Worst form (5c), labelled in the facilitator's unit (#39)
  P->>P: fill values → store.submitEstimate() validates via createEstimate
  P->>R: sendEstimate(estimate)
  R-->>F: onEstimate → applyRemoteEstimate → items[activeItemId].submissions (Workspace 1c)
  P-->>P: waiting state with revise affordance (5d)
  F->>F: Reveal estimates (enabled once ≥1 submission) → revealRound(itemId)
  F->>R: sendReveal(itemId)
  R-->>P: onReveal → store.applyReveal → revealed = true
  F-->>F: Workspace 1d — aggregated range bar + per-participant values
  P-->>P: revealed state: aggregated range bar + participant list (5e)
  Note over F: then either Finalize item (finalizeLiveItem aggregates submissions)…
  F->>R: …or Retry — start new round → retryRound(itemId) + sendRoundReset(itemId)
  R-->>P: onRoundReset → store.applyRoundReset → back to the 5c form
```

## Screen flow

```mermaid
stateDiagram-v2
  [*] --> mode_select
  mode_select --> workspace : "Start collaborative" · mode=live · role=facilitator
  mode_select --> workspace : "Start single-user" · mode=manual
  mode_select --> join : "Join a collaborative session"
  join --> estimate : Join · role=participant
  estimate --> mode_select : Leave
  workspace --> summary : Summary
  summary --> workspace : Back to item
  summary --> history : View session history
```

`ScreenId` is `mode-select | workspace | join | estimate | summary | history` (the #34
redesign replaced `create` / `session` with `mode-select` / `workspace`; reveal is no
longer a screen — it's Workspace states 1c/1d, #8). The diagram writes ids as
`mode_select` / `workspace` because Mermaid state ids can't contain `-`.

## Connection state machine

Mirrored from `src/network`'s connection tracker into `store.connectionStatus`:

```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> connecting : connect(code)
  connecting --> connected : first peer joins
  connected --> connecting : last peer leaves
  connecting --> disconnected : onJoinError (relay unreachable)
  disconnected --> connecting : Retry
```

`disconnected` drives the Join screen's plain-language failure banner + guidance
(retry / VPN / facilitator switches to Manual) per PRD §4.1 step 8. The full
connection-fallback UX is #9.

## Store additions

| Field | Purpose |
|---|---|
| `mode: 'manual' \| 'live'` | set by the mode-selection screen; selects the flow |
| `role: 'facilitator' \| 'participant'` | defaults to `facilitator`; Join flips it to `participant` |
| `sessionId: string \| null` | the shared 6-char code = Trystero room id |
| `myName: string` | participant display name (named, never anonymous) |
| `participantId: string` | stable per-join id (`crypto.randomUUID()`), the submission key |
| `connectionStatus` | `idle \| connecting \| connected \| disconnected` |
| `peerCount: number` | connected peers, for the facilitator strip |
| `liveRound: LiveRound \| null` | participant-only: current item + received `submissions` + `revealed` flag + own `mySubmission`; written by `applySyncState` / `applyRemoteEstimate` / `applyReveal` / `applyRoundReset` / `submitEstimate` |
| `Item.submissions: Estimate[]` | facilitator-only: submissions received for the current round on that item, upserted by `applyRemoteEstimate`, cleared by `retryRound` (#8). Always empty in single-user mode. |
| `Item.revealed: boolean` | facilitator-only: whether the round on that item is revealed (Workspace 1c → 1d). Set by `revealRound`, cleared by `retryRound` (#8). |
| `participantNames: Record<string, string>` | `participantId -> display name` for every announced client (own entry seeded on join / start; peers filled in by `applyParticipantName` from inbound `announce`). Lets the participant reveal list and the facilitator's 1c/1d roster show real names instead of "Teammate N". Reset on leave. |
| `unit` (participant) | on every `applySyncState` the participant's `store.unit` is overwritten with the facilitator's `snapshot.unit`, so its estimate form and bars label values in the session's unit (#39) |

## Trust boundary

Every inbound peer message crossing `trystero/nostr → src/network/actions` is untrusted:
`submitEstimate` re-runs `createEstimate` (drop on failure), `syncState` is shape-checked
(including `unit` against the known set — an unknown/missing unit drops the whole snapshot)
and each submission re-validated, `reveal` and `roundReset` must each be a string, `announce` must be an object
with a non-empty `participantId` string and a `name` string that is non-empty after
trimming (the name is trimmed before it reaches the store). The UI only ever sees validated
`Estimate` values.

## Known MVP gaps (accepted)

- No TURN server — participants behind symmetric NAT can't connect; Manual mode is the
  fallback.
- Facilitator disconnect mid-session stalls the session (no facilitator re-election).
- Mode is fixed at creation — no mid-session switch.
- Estimation unit is broadcast and re-broadcast on change (#39), but a mid-round change
  only re-labels values — already-submitted numbers are not converted and participants are
  not prompted to re-enter. Treat unit as a set-once-per-session choice.
- Late-joiner snapshot uses `syncState` broadcast (hits all peers), wired in #7.
- No `/join/<id>` deep links yet — code is shared out of band.
- No peer-identity binding: `submitEstimate` and `announce` are both keyed purely on the
  `participantId` in the payload, not on the sending peer, so a hostile peer could submit
  or rename under someone else's id. Trystero encryption keeps outsiders out; there's no
  defence against a malicious participant inside the room. Inbound names are shape-checked
  and length-capped (`MAX_ANNOUNCE_NAME_LENGTH`), not authenticated.
