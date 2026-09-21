# Actuali Unified

Actuali Unified is a mobile-first, local-first personal finance workspace built on the Actual Budget data model and sync protocol. It keeps the financial engine and sync behavior shared while giving mobile and desktop their own interaction models.

## Platform surfaces

| Surface                              | Location                                                | Product intent                                                                       |
| ------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Mobile web and Capacitor iOS/Android | `packages/desktop-client` + `packages/mobile-client`    | Fast capture, thumb-friendly navigation, offline confidence                          |
| Desktop web and Electron             | `packages/desktop-client` + `packages/desktop-electron` | Dense review, keyboard-friendly workflows, reporting                                 |
| Native iOS companion                 | `apps/ios`                                              | SwiftUI experience with local SQLite, widgets, Shortcuts, and the same sync protocol |
| Shared financial engine              | `packages/loot-core`, `packages/crdt`                   | Calculations, mutations, file format, conflict-free sync                             |
| Sync server                          | `packages/sync-server`                                  | Self-hosted synchronization and encrypted budget transport                           |

The home surface is intentionally different on narrow and wide screens. Both read the same query and spreadsheet bindings, so a transaction entered on any client is reflected everywhere after the normal local-first sync cycle.

## Quick start

Requirements: Node.js `>=22.18`, Yarn `4.9.1+`, and (for native builds) Xcode or Android Studio.

```bash
yarn install
yarn start
```

The browser app runs on port `3001`. Use the demo budget from the setup screen for a realistic local preview.

### Build and validate

```bash
# Production browser bundle
yarn workspace @actual-app/web build:browser

# Focused sync coverage
yarn workspace @actual-app/crdt test
yarn workspace @actual-app/core test:node src/server/sync/sync.test.ts
yarn workspace @actual-app/sync-server test
yarn workspace @actual-app/ai-bridge test

# Format, lint, and typecheck
yarn lint
yarn typecheck
```

### Mobile shells

The Capacitor shell reuses the web client and is kept in sync with the browser bundle:

```bash
yarn workspace mobile-client sync:ios
yarn workspace mobile-client sync:android
yarn workspace mobile-client build:ios
yarn workspace mobile-client build:android
```

The native SwiftUI client can be opened at `apps/ios/Actuali/Actuali.xcodeproj`. Its build and signing notes are in [`apps/ios/AGENTS.md`](apps/ios/AGENTS.md).

## Repository map

- `packages/desktop-client/src/components/mobile` — narrow/mobile screens and navigation.
- `packages/desktop-client/src/components/desktop` — wide/desktop screens and navigation.
- `packages/desktop-client/src/components/home/useHomeData.ts` — shared home read model; keep platform components data-light.
- `packages/mobile-client` — Capacitor iOS and Android shells.
- `apps/ios` — native SwiftUI Actuali client and widgets.
- `packages/loot-core` — shared database, calculations, mutations, and sync orchestration.
- `packages/crdt` — conflict-free replication implementation.
- `packages/sync-server` — self-hosted sync server.
- `packages/ai-bridge` — provider-neutral Ask Actuali and guarded MCP tools.
- `docs` — platform contract, architecture, quality gates, and roadmap.

## Sync and privacy model

Budget data is local-first. Reads come from the local database, writes are committed locally before network work, and CRDT messages merge changes from other clients. The server is optional for a single device and required only for multi-device synchronization. End-to-end encrypted budgets continue to use Actual's existing encryption flow.

The detailed cross-platform contract is in [`docs/PLATFORM_SYNC.md`](docs/PLATFORM_SYNC.md). The architecture, AI/MCP boundary, and release checks are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/AI_AND_MCP.md`](docs/AI_AND_MCP.md), and [`docs/QUALITY.md`](docs/QUALITY.md).

## Product direction

The next product milestones prioritize the workflows users return to most: transaction capture under 30 seconds, reconciliation, recurring schedules, goals and debt planning, saved reports, tags and search, household permissions, multi-currency support, widgets, and privacy-preserving assistance. New work must keep the shared financial rules and sync protocol as the source of truth.

## License and upstream

Actuali Unified is MIT licensed. It builds on the open-source [Actual Budget](https://actualbudget.org/) project and the community [Actuali](https://github.com/MattFaz/actuali) native client. See [`LICENSE.txt`](LICENSE.txt) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for attribution and integration boundaries.
