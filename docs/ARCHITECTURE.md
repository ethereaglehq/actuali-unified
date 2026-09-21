# Architecture

## Design rule

Actuali Unified has one financial model and several presentation shells. Platform code may change density, navigation, and input affordances; it must not create a second balance calculation, transaction mutation, or sync queue.

## Runtime layers

```text
Mobile web / Capacitor      Desktop web / Electron       Native SwiftUI iOS
          │                            │                         │
          └────────────── platform read/write surfaces ─────────┘
                                      │
                shared queries, spreadsheet bindings, mutations
                                      │
              local database + CRDT message queue + sync client
                                      │
                         self-hosted Actual sync server
```

### Shared financial layer

- `packages/loot-core` owns the database schema, calculations, rules, schedules, imports, reports, and mutation contracts.
- `packages/crdt` owns causal ordering, merge behavior, and wire messages.
- `packages/sync-server` stores and exchanges encrypted or plaintext sync payloads without becoming the source of truth for UI state.

### Web and desktop layer

- `packages/desktop-client/src/components/mobile` owns narrow layouts and touch-first flows.
- `packages/desktop-client/src/components/desktop` owns wide layouts and keyboard-friendly review flows.
- `packages/desktop-client/src/components/responsive` maps the same route intent to the appropriate surface.
- `packages/desktop-client/src/components/home/useHomeData.ts` is the shared home read model. It reads existing queries and spreadsheet bindings so CRDT-applied changes naturally re-render.
- `packages/mobile-client` packages the web client for iOS and Android through Capacitor.

### Native iOS layer

`apps/ios` is a native SwiftUI client with its own local SQLite store and a Swift implementation of the compatible Actual sync protocol. It owns iOS-specific capabilities such as widgets, Shortcuts, background refresh, and FinanceKit import. It must remain wire-compatible with `packages/crdt` and must not invent a competing budget format.

## Feature implementation flow

1. **Model:** define or reuse the shared entity, calculation, and mutation in `packages/loot-core`.
2. **Sync:** add CRDT or server coverage when the serialized shape or merge behavior changes.
3. **Read model:** expose the smallest query/binding needed by both platform surfaces.
4. **Mobile:** implement the narrow interaction in `components/mobile` with loading, empty, error, and offline states.
5. **Desktop:** implement the wide interaction in `components/desktop` with keyboard and dense review affordances.
6. **Native:** add the iOS view and persistence bridge only when the capability is genuinely native.
7. **Docs:** update the platform contract and roadmap when behavior or support changes.

## State and failure handling

Every synced screen should make these states explicit:

- **Loading:** show stable skeleton or progress content without shifting the primary action.
- **Online:** show that local changes are syncing and the last known data is current.
- **Offline:** allow local reads and writes; make persistence clear without blocking entry.
- **Local-only:** explain that another device will not see changes until a server is configured.
- **Empty:** explain what action creates the first useful record.
- **Error:** preserve entered data and provide a retry or recovery path.

## Review checklist

- Does the change use an existing core mutation or add one with tests?
- Does an offline write remain visible after reload?
- Does a second client receive the change after reconnect?
- Do narrow and wide routes reach the same domain action?
- Are financial values formatted with the shared typography helpers?
- Are user-facing strings translatable with `Trans` or an existing translation key?
- Does the screen remain usable with keyboard navigation and reduced motion?
