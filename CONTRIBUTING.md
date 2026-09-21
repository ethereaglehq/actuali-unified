# Contributing to Actuali Unified

Thanks for helping improve Actuali Unified. Start with the repository map in [`README.md`](README.md), then read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/PLATFORM_SYNC.md`](docs/PLATFORM_SYNC.md) before changing synced behavior.

## Development

```bash
yarn install
yarn start
```

Use the demo budget from the setup screen for manual checks. Run commands from the repository root; use `yarn workspace <name> <command>` for a package-specific task.

## Before opening a change

- Keep domain logic in the shared core and use existing mutations where possible.
- Keep mobile and desktop views separate when their information density or input model differs.
- Use `Trans` or existing translation keys for user-facing strings.
- Preserve local-first behavior and make offline, loading, empty, and error states intentional.
- Add or update tests when data shapes, calculations, or sync behavior change.
- Update the relevant docs when platform support or sync guarantees change.

Run the checks that match the change. The complete release gates are in [`docs/QUALITY.md`](docs/QUALITY.md).

## Commits and pull requests

Pull request titles must start with `[AI]`. Keep commits focused, explain user-visible behavior in the description, and include the commands used for validation. Never include budget files, credentials, signing profiles, or generated build output.

## Attribution

This project builds on [Actual Budget](https://github.com/actualbudget/actual) and the community [Actuali](https://github.com/MattFaz/actuali) client. Preserve their license and attribution notices when porting code.
