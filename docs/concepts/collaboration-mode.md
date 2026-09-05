# Live Collaboration Mode — Technical Concept

## Overview

EstiMate has two session modes. **Manual (Mode B)** is single-user, in-memory, and already
built. **Live (Mode A)** lets named participants join a facilitator's session over a
serverless peer-to-peer mesh (Trystero over WebRTC, Nostr relays for signaling only) and
submit private three-point estimates that are revealed together. There is **no backend** —
every peer runs the same code and computes aggregates locally.

This document covers the foundation delivered with issue #6 (join flow + wiring); the
estimate round (#7) and reveal (#8) build on the same structures.

## Component view

Level-3 (component) view. Each box carries its `[type]`; responsibilities are in the table
below. Lanes are the source directories. Lines: **solid** = synchronous call,
**dotted** = asynchronous callback / event / read, `<-->` = bidirectional.

```mermaid
flowchart TD
  subgraph screens["🖼️ &nbsp; UI LANE &nbsp;·&nbsp; src/screens"]
    direction LR
    CS["CreateSession<br/>[React Component]"]
    JS["JoinSession<br/>[React Component]"]
    PEV["ParticipantEstimateView<br/>[React Component]"]
    SV["SessionView<br/>[React Component]"]
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
  CS -->|"setMode / createSession"| Store
  JS -->|"joinLiveSession"| Store
  CS -->|"connect()"| Hook
  JS -->|"connect()"| Hook
  CS -.->|"reads code"| Code
  NP -->|"owns, provides"| Hook
  Hook -->|"joinSession(code)"| JSN
  JSN -->|"creates"| Act
  JSN -->|"creates"| Conn
  Act <-->|"P2P messages (encrypted)"| Trystero
  Act -.->|"validate inbound"| Calc

  %% --- asynchronous events / reads (dotted) ---
  Conn -.->|"onConnectionStateChange"| Hook
  Hook -.->|"setConnectionStatus / setPeerCount"| Store
  Store -.->|"state (read)"| screens

  %% --- lane + node colours ---
  classDef ui     fill:#DDD6FE,stroke:#7C3AED,color:#2E1065
  classDef state  fill:#FDE68A,stroke:#D97706,color:#3F2D0B
  classDef br     fill:#99F6E4,stroke:#0D9488,color:#042F2A
  classDef pcore  fill:#BFDBFE,stroke:#2563EB,color:#0B2545
  classDef pure   fill:#E2E8F0,stroke:#64748B,color:#0F172A
  classDef ext    fill:#FFEDD5,stroke:#EA580C,color:#3F1D0B,stroke-dasharray:5 4

  class CS,JS,PEV,SV ui
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
| **CreateSession** | React Component | Renders the new-session form and the Manual/Live mode picker (`RadioTile` ×2). On Live create: reads a code from `generateSessionCode`, sets `mode` / `role` / `sessionId` in the store, calls `connect()`. Offers the "Join a live session" link. |
| **JoinSession** | React Component | Collects session code + participant name (name required — no anonymous peers). Calls `joinLiveSession()` then `connect()`. Renders connecting / connected / disconnected states from `store.connectionStatus`, including the failure banner + Retry. |
| **ParticipantEstimateView** | React Component | #6 placeholder: shows "waiting for the facilitator", connection status, and Leave. Replaced by the real three-input estimate form in #7. |
| **SessionView** | React Component | Existing facilitator / Manual-mode screen. In Live mode additionally renders the session-code strip (with copy button), the "N participants connected" count, and a connection-status `Tag`. |
| **useSessionStore** | Zustand Store | Single source of truth for session state: `mode`, `role`, `sessionId`, `myName`, `connectionStatus`, `peerCount`, items, current screen. Never imports `src/network`. |
| **NetworkProvider** | React Context Provider | Wraps `<App>`. Owns the one `NetworkSession` instance for the app's lifetime and exposes it via `useNetworkSession`; tears it down on unmount. |
| **useNetworkSession** | React Hook | The only code that touches both the store and the P2P core. `connect(code, name)` calls `joinSession()` and subscribes to its events; `disconnect()` calls `leave()`. Mirrors `onConnectionStateChange` and peer join/leave into the store. |
| **joinSession** | Factory Function | Entry point of the P2P core (from PR #25). Opens the Trystero room (`roomId = sessionId`), wires up the connection tracker and typed actions, returns a `NetworkSession` of `send*` / `on*` methods. |
| **typed actions** | Module | Defines the three wire actions (`submitEstimate`, `syncState`, `reveal`), serialises outbound messages, and validates every inbound message through `calc` before surfacing it. |
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

  F->>F: pick "Live collaborative", Create
  F->>F: generateSessionCode() → "K7F9Q2"
  F->>R: joinSession("K7F9Q2")
  Note over F: connectionStatus = connecting
  F-->>F: SessionView shows code "K7F9Q2"

  P->>P: Join screen — enter code + name
  P->>R: joinSession("K7F9Q2")
  R-->>F: onPeerJoin(p)
  R-->>P: onPeerJoin(f)
  Note over F,P: connectionStatus = connected
  F-->>F: "1 participant connected"
  P-->>P: route to placeholder (waiting for facilitator)
```

## Screen flow

```mermaid
stateDiagram-v2
  [*] --> create
  create --> session : Create · mode=live · role=facilitator
  create --> join : "Join a live session"
  join --> estimate : Join · role=participant
  estimate --> create : Leave
  session --> summary : (existing Mode B path)
```

`ScreenId` gains `join` and `estimate` (not `reveal` until #8).

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
(retry / VPN / facilitator switches to Manual) per PRD §4.1.8.

## Store additions (foundation)

| Field | Purpose |
|---|---|
| `mode: 'manual' \| 'live'` | set by the picker; selects the flow |
| `role: 'facilitator' \| 'participant'` | defaults to `facilitator`; Join flips it to `participant` |
| `sessionId: string \| null` | the shared 6-char code = Trystero room id |
| `myName: string` | participant display name (named, never anonymous) |
| `connectionStatus` | `idle \| connecting \| connected \| disconnected` |
| `peerCount: number` | connected peers, for the facilitator strip |

Deferred: `submissions` / rounds (#7), `revealedItemIds` + per-participant view (#8).

## Trust boundary

Every inbound peer message crossing `trystero/nostr → src/network/actions` is untrusted:
`submitEstimate` re-runs `createEstimate` (drop on failure), `syncState` is shape-checked and
each submission re-validated, `reveal` must be a string. The UI only ever sees validated
`Estimate` values.

## Known MVP gaps (accepted)

- No TURN server — participants behind symmetric NAT can't connect; Manual mode is the
  fallback.
- Facilitator disconnect mid-session stalls the session (no host re-election).
- Mode is fixed at creation — no mid-session switch.
- Late-joiner snapshot uses `syncState` broadcast (hits all peers), wired in #7.
- No `/join/<id>` deep links yet — code is shared out of band.
