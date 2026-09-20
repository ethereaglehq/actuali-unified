# Platform and sync contract

## One budget, many clients

Every client opens the same Actual Budget file format and talks to the same self-hosted sync server. The browser/Electron client uses `packages/crdt` and `packages/loot-core`; the Capacitor mobile client ships the same web bundle; the native SwiftUI companion keeps a compatible port of the CRDT protocol in `apps/ios/Actuali/Actuali/Services/Sync`.

The home surfaces deliberately depend on existing spreadsheet bindings and query hooks instead of maintaining a second balance cache. That means a transaction created on a phone, desktop, or native iOS client flows through the same local database, CRDT message queue, and server merge path.

## UX guarantees

- Local reads remain available without a network connection.
- New writes land in the local database first and sync in the background.
- The home surface states whether the client is online, offline, or local-only.
- Account and transaction views continue to use the existing sync-aware queries.
- Mobile and desktop layouts may differ, but they never fork the underlying financial rules or calculations.

## Adding a new synced feature

1. Add the domain behavior to the shared core or existing mutation layer.
2. Add a sync fixture or behavior test where the data shape changes.
3. Render the feature through platform-specific mobile and desktop components.
4. Verify an offline write, a reconnect, and a second-client read before release.
