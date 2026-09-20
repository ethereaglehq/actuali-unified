# Actuali Unified

A local-first Actual Budget experience with platform-specific surfaces in one repository.

Actuali Unified keeps the same Actual Budget data model and CRDT sync protocol across:

- **Mobile web / iOS / Android:** a touch-first Capacitor client with a focused home surface, quick transaction entry, offline-safe writes, and clear sync health.
- **Desktop web / Electron:** a denser home surface with recent activity, account totals, and fast links into budgets, reports, and account review.
- **Native iOS companion:** the inspected Actuali SwiftUI client lives under `apps/ios` and remains compatible with the same self-hosted Actual server.

The project preserves Actual’s privacy model: your budget stays local, sync is optional, and server sync uses Actual’s existing CRDT protocol. New surfaces read the same query and spreadsheet bindings as the existing budget, accounts, schedules, rules, and reports features, so changes remain visible and mergeable on every client.

## Development

This repository is based on the MIT-licensed Actual Budget monorepo. The main browser and Capacitor client runs from the root:

```bash
yarn install
yarn start
```

The browser preview defaults to port `3001`. To build the production web client:

```bash
yarn workspace @actual-app/web build:browser
```

The Capacitor wrapper is in `packages/mobile-client`:

```bash
yarn workspace mobile-client sync:ios
yarn workspace mobile-client sync:android
```

The native SwiftUI companion is in `apps/ios/Actuali/Actuali.xcodeproj` and follows the build instructions in [`apps/ios/AGENTS.md`](apps/ios/AGENTS.md).

## Product direction

Actuali Unified is intentionally mobile-first while giving desktop its own information density and keyboard-friendly layout. The shared data layer handles offline-first reads, optimistic local writes, and CRDT synchronization; the platform shells decide navigation, spacing, and interaction patterns for their device class.

Near-term priorities are transaction capture under 30 seconds, accessible review flows, recurring calendar and linked schedule context, goals and debt planning, saved report views, household permissions, multi-currency support, and optional privacy-preserving assistance. Any feature that changes financial data must use the existing core mutations and sync contracts.
