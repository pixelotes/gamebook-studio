# 1. Use Socket.IO for Real-Time Multiplayer Communication

Date: 2026-06-27

## Status

Accepted

## Context

Gamebook Studio requires real-time, bi-directional communication between clients and the server to facilitate multiplayer tabletop game sessions. Features like shared PDF navigation, synchronized character sheets, live dice rolls, and real-time cursor tracking require low latency and high reliability. We need a solution that supports broadcasting, room-based isolation (sessions), and automatic reconnections in case of network instability.

## Decision

We will use **Socket.IO** over raw WebSockets. 

## Consequences

### Positive
- **Rooms/Namespaces:** Socket.IO's built-in room concept maps perfectly to our "Game Sessions". It provides a native `io.to(sessionId).emit()` API which drastically simplifies broadcasting events to specific groups of users.
- **Reliability:** Built-in heartbeats, auto-reconnection logic, and fallback polling (if WebSockets fail) ensure a smoother experience for clients on unstable connections.
- **Ease of Use:** Event-based APIs (`socket.on`, `socket.emit`) make it trivial to handle distinct actions (e.g., `dice-roll`, `pointer-event`, `update-layers`) without having to parse a raw WebSocket message string and build our own routing layer.

### Negative
- **Overhead:** Socket.IO adds a slight metadata overhead to every message compared to raw WebSockets.
- **Scaling Complexity:** If the application scales to multiple Node.js instances, we will be required to introduce a Pub/Sub adapter (like the Redis adapter) to route Socket.IO messages across server nodes.
