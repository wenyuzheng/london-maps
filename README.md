# DO App Kit

A starter for creating DO custom applications.

This starter repo is built with Vite+.

## Runtime Context Note (Top-Level vs Iframe)

Data Observatory deployments may render an app either:

- as a top-level document, or
- inside one or more iframes (for multi-screen orchestration/simulation).

This matters for graphics-heavy features: iframe-based deployments can increase pressure on
browser/GPU context limits (especially with WebGL). For that reason, this example includes
runtime-aware rendering decisions and fallback strategies so behavior remains stable in both modes.

## Stack Used In This Example

The example app in `apps/website` focuses on three package groups:

- `@tanstack/react-router`: file-based routing and route-level app structure (`/`, `/control`, `/screen`, `/bus`).
- `@tanstack/pacer`: throttling of high-frequency control events before broadcast (for example slider updates).
- Mapping stack:
  `maplibre-gl`, `@vis.gl/react-maplibre`, `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/react`.
  These are used to render the map, draw animated paths/markers, and support both richer and iframe-safe rendering paths. We strongly recommend the use of Deck.GL with MapLibre as the DO natively supports them.
- `vite-plus` (`vp`): monorepo task runner/repo manager used for project commands (`vp run dev`, `vp run build -r`, etc.).

## Development

- Check everything is ready:

```bash
vp run ready
```

- Run the tests:

```bash
vp run test -r
```

- Build the monorepo:

```bash
vp run build -r
```

- Run the development server:

```bash
vp run dev
```
