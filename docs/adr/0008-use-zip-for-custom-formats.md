# 8. Use ZIP Archives for Custom File Formats (.gbs and .gbtk)

Date: 2026-06-27

## Status

Accepted

## Context

Gamebook Studio needs a way for users to save and share their game sessions (including PDFs, annotations, and character sheets) and distribute custom token packs (images and metadata). 

We needed a file format strategy that could encapsulate both structured data (like JSON game states and manifests) and binary assets (PDFs, PNGs, SVGs) into a single, portable file. Creating a proprietary binary format from scratch would be complex, error-prone, and difficult to debug. Alternatively, asking users to share folders of files is poor UX and prone to corruption if a user forgets to copy a specific subfolder.

## Decision

We will use standard **ZIP compression** as the underlying technology for our custom file formats, but distribute them with proprietary extensions to associate them with our application:

1.  **`.gbs` (Gamebook Studio Session):** A ZIP archive containing `game.json` (metadata), `session.json` (the core game state), and a `pdfs/` folder housing the actual PDF documents.
2.  **`.gbtk` (Gamebook Tokens):** A simplified ZIP archive containing `pack.json` (token metadata) and a `tokens/` folder housing the image assets (PNG, SVG, JPG).

The application will use standard ZIP libraries (e.g., `jszip` on the client) to unpackage these files in memory when imported, and zip them up when exported.

## Consequences

### Positive
- **Simplicity & Tooling:** Because they are just ZIP files under the hood, developers (and power users) can easily inspect, debug, or manually edit the contents of a `.gbs` or `.gbtk` file simply by renaming the extension to `.zip` and extracting it.
- **Portability:** A single file download/upload provides a massive UX improvement over handling raw directories.
- **Compression:** Text-heavy JSON files and unoptimized SVGs benefit from ZIP compression, reducing the file size of exports.

### Negative
- **Memory Overhead:** When a client imports a large `.gbs` file containing multiple heavy PDFs, the entire ZIP archive must be loaded and decompressed in the browser's memory, which could cause out-of-memory crashes on very low-end devices.
- **Security:** We must rigorously validate the unzipped contents (especially checking for path traversal attacks in the ZIP entries) before loading them into the application state.
