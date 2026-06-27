# 5. Distinguish Between Ephemeral and Persistent Events

Date: 2026-06-27

## Status

Accepted

## Context

The multiplayer server must handle a variety of real-time actions. Some actions, like adding a note or updating a character's stats, represent permanent changes to the game state. Other actions, such as moving a mouse cursor across the screen, live-updating a drag operation, or broadcasting a dice roll animation, are fleeting. Treating all events equally and routing them through the `jsondiffpatch` delta engine would cause severe performance bottlenecks, unnecessarily bloating the state history and wasting CPU cycles on diffing transient data.

## Decision

We will implement a two-tiered event handling architecture separating **Persistent** and **Ephemeral** events.

1.  **Persistent Events (`update-game-state`):** These mutate the core `GameSession` object. They are routed through the state diffing engine, generate a new version, are saved to Redis, and are broadcasted as a delta.
2.  **Ephemeral Events (`pointer-event`, `real-time-update`, `dice-roll`):** These bypass the state engine entirely. The server acts as a simple relay, immediately forwarding the payload to other clients in the room using `socket.to(sessionId).emit()`.

## Consequences

### Positive
- **Performance:** Bypassing the diffing engine for 60FPS cursor updates prevents CPU spikes on both the server and clients.
- **State Cleanliness:** The state history remains clean, containing only meaningful, permanent changes to the game world.

### Negative
- **Client Logic Complexity:** Clients must manage two separate streams of data: applying state patches for permanent changes, and handling immediate transient UI updates for ephemeral events.
