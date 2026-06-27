# 7. Migrate from custom mock-canvas to FabricCanvas

Date: 2026-06-27

## Status

Accepted

## Context

Initially, the project utilized a custom, in-house canvas implementation (`mock-canvas`) to handle drawing, object manipulation, and layering over the tabletop and PDFs. As features were added, this custom implementation grew increasingly complex. Handling edge cases for zooming, panning, object selection, and serialization resulted in "spaghetti code." The custom canvas became a major maintenance burden, slowing down feature development and making bug fixing difficult.

## Decision

We will deprecate the custom `mock-canvas` implementation and migrate the drawing and object manipulation layer to **Fabric.js** (implemented as `FabricCanvas`).

Fabric.js is a robust, well-maintained HTML5 canvas library that provides built-in support for an interactive object model, SVG parsing, zooming, panning, and serialization.

## Consequences

### Positive
- **Maintainability:** Replaces thousands of lines of fragile, custom spaghetti code with a standardized, community-supported API.
- **Feature Velocity:** Adding new features like grouping, specific shape rendering, or text annotations becomes significantly easier out-of-the-box.
- **Serialization:** Fabric.js provides robust `toJSON()` and `loadFromJSON()` methods, simplifying the process of saving and restoring canvas states over the network.

### Negative
- **Bundle Size:** Fabric.js is a large dependency, which will increase the initial JavaScript payload for the client.
- **Migration Effort:** The migration requires a significant refactoring effort to translate our custom drawing logic, event listeners, and data structures into the Fabric.js paradigm.
