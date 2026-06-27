# 3. Compress Heavy Payloads using Pako (Zlib)

Date: 2026-06-27

## Status

Accepted

## Context

The application allows users to draw annotations on top of PDF documents (handled via the `update-layers` event). Drawing data often consists of large arrays of dense X/Y coordinates and stroke properties. Transmitting this raw JSON over WebSockets for every stroke update would quickly choke client bandwidth and cause noticeable lag. 

## Decision

We will compress heavy data payloads, specifically drawing layers, using `pako` (a zlib port for JavaScript). 

Clients will compress the drawing layer data before emitting it to the server. The server will decompress it to update the persistent game state, but it will directly forward the **raw compressed buffer** to the other clients in the session. Receiving clients will then decompress the payload to render the strokes.

## Consequences

### Positive
- **Massive Bandwidth Reduction:** Zlib compression is highly effective on repetitive data like coordinate arrays, shrinking payloads significantly and reducing transmission time.
- **Server Efficiency:** By broadcasting the compressed buffer directly to clients without re-compressing it, the server avoids CPU-intensive operations during the broadcast phase.

### Negative
- **Client CPU Usage:** Clients must bear the computational cost of both compressing outbound strokes and decompressing inbound strokes. For lower-end devices, heavy simultaneous drawing could impact frame rates.
- **Complexity:** The network layer is no longer purely readable JSON; debugging layer updates requires intercepting and inflating buffers.
