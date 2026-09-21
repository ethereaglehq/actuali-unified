# Quality gates

A release is ready only when the relevant gates pass and the remaining limits are documented.

## Automated gates

Run from the repository root:

```bash
# Formatting and linting
yarn lint

# Browser production bundle
yarn workspace @actual-app/web build:browser

# CRDT and sync behavior
yarn workspace @actual-app/crdt test
yarn workspace @actual-app/core test:node src/server/sync/sync.test.ts
yarn workspace @actual-app/sync-server test

# Ask Actuali provider/MCP security tests
yarn workspace @actual-app/ai-bridge test
yarn workspace @actual-app/ai-bridge typecheck

# Full project typecheck
yarn typecheck
```

For a UI-only change, also run the Impeccable detector and a manual browser pass at narrow and wide breakpoints. For native changes, build the affected Xcode or Gradle target and run its unit/UI tests.

## Sync acceptance test

Use two clients pointed at the same self-hosted server:

1. Open the same budget on mobile and desktop.
2. Create a transaction offline on mobile.
3. Confirm it is visible immediately in the local mobile database.
4. Reconnect mobile and wait for the sync indicator to settle.
5. Refresh desktop and confirm the transaction, balance, payee, and category agree.
6. Edit the same record from the other client and verify the CRDT merge leaves both clients consistent.
7. Repeat with a delete, a split, and a scheduled transaction when those flows are touched.

Automated sync-server tests prove protocol and server behavior; they do not replace this two-client check against the deployment a user will run.

## Current verification record

The unified home and Ask Actuali surfaces have been checked with the browser production build, focused CRDT tests, core sync integration tests, the sync-server suite, the AI/MCP security tests, focused formatting/linting, and the Impeccable detector. Physical iOS/Android devices, an external sync server, and a full visual regression matrix still require an environment with those targets available.
