# 6. Use Debouncing for High-Frequency Inputs

Date: 2026-06-27

## Status

Accepted

## Context

Certain user interactions, such as resizing a window, dragging an element, or rapidly typing in a character sheet, trigger hundreds of events per second. If every single one of these keystrokes or pixel movements emitted a WebSocket message to the server, it would overwhelm the network, spam the server, and cause significant lag for all connected clients due to the sheer volume of delta diffs being calculated and broadcast.

## Decision

We will implement **Debouncing** (and selectively Throttling) on the client side for high-frequency input streams.

- For text inputs (e.g., updating notes or character names), we will debounce the `update-game-state` emission. The client will wait for a short period of inactivity (e.g., 300ms - 500ms) after the last keystroke before sending the final state to the server.
- For continuous actions (if they mutate state), they will be throttled or debounced to ensure we only persist the final resting state rather than every micro-movement.

## Consequences

### Positive
- **Network Optimization:** Drastically reduces the number of WebSocket messages sent and processed.
- **Server Load:** Prevents the server from computing hundreds of micro-deltas for a single logical user action (like typing a word).
- **Client Performance:** Prevents the UI from locking up while trying to process incoming state patches for ongoing local actions.

### Negative
- **Perceived Latency:** Other players will not see character-by-character typing; they will see the text update in "chunks" after the user pauses typing. This is an acceptable tradeoff for a tabletop environment.
