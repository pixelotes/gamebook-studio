# 2. Use Delta State Synchronization for Game State

Date: 2026-06-27

## Status

Accepted

## Context

A tabletop game session maintains a complex, deeply nested JSON `gameState` object containing characters, notes, active PDFs, and various counters. If multiple players are making changes simultaneously, broadcasting the entire JSON state object on every change would consume significant bandwidth, increase latency, and create severe race conditions (last-write-wins overwriting other players' concurrent changes).

## Decision

We will implement a **Delta State Synchronization** architecture using `jsondiffpatch`.

When a client makes a change:
1. The server applies the update.
2. The server computes a diff (delta) against the previous state.
3. The server broadcasts only the delta, alongside an incremented `version` number and a `crc32` checksum of the new state.
4. Clients use `jsondiffpatch.patch()` to apply the delta.
5. Clients verify the operation using the provided CRC32 checksum.

If a client falls behind, they can invoke a `request-missing-updates` event to fetch historical deltas from the server's in-memory `stateHistory`.

## Consequences

### Positive
- **Bandwidth Efficiency:** Network traffic is kept to an absolute minimum, as only modified properties (e.g., a single character's HP) are sent over the wire.
- **Data Integrity:** The CRC32 check ensures clients never silently desynchronize. If the CRC fails, the client knows they must request a full state refresh.
- **Conflict Reduction:** Because `jsondiffpatch` applies surgical updates to specific branches of the JSON tree, changes to unrelated parts of the state by different clients are merged cleanly.

### Negative
- **CPU Overhead:** Computing diffs and patching them costs more CPU cycles on both the server and client than simply replacing the entire object.
- **Memory Overhead:** The server must keep a history array of the last N versions (currently 500) in memory to allow clients to resync missed packets.
