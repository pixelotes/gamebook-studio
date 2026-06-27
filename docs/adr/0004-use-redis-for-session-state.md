# 4. Use Redis for Session State Persistence

Date: 2026-06-27

## Status

Accepted

## Context

While Socket.IO manages connections in memory, the actual `GameSession` (containing the game state, player list, and history) cannot exist purely in the Node.js process memory. If the server crashes, restarts, or we attempt to scale out horizontally to multiple processes, in-memory state would be lost or fragmented. We need a fast, centralized key-value store to persist session data.

## Decision

We will use **Redis** (via the `ioredis` client) to persist `GameSession` objects. 

When a session is modified, the server will serialize the session object and write it to Redis. We will utilize Redis's TTL (Time To Live) feature to set an `EX` expiry of 86,400 seconds (24 hours). 

## Consequences

### Positive
- **Stateless Backend:** The Node.js server can be restarted without losing active game states. Any server node can retrieve any game session.
- **Automatic Garbage Collection:** The 24-hour TTL ensures that abandoned game sessions are automatically purged from the database without requiring cron jobs or manual cleanup logic.
- **Speed:** Redis operates entirely in memory, meaning the latency of retrieving (`getSession`) and storing (`saveSession`) the game state during fast-paced socket events is negligible.

### Negative
- **Infrastructure Dependency:** The application now has a hard dependency on a Redis server to function.
- **Race Conditions:** Currently, operations follow a "Get -> Update -> Set" pattern. If two rapid requests hit the server concurrently, the second update might overwrite the first before it can save to Redis, since there is no explicit locking mechanism (e.g., Redlock) applied during the `updateGameState` cycle.
