# Project documentation

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — package boundaries, data flow, and platform ownership.
- [`PLATFORM_SYNC.md`](PLATFORM_SYNC.md) — the one-budget/many-clients contract and sync acceptance criteria.
- [`QUALITY.md`](QUALITY.md) — validation commands, release gates, and known test limits.
- [`AI_AND_MCP.md`](AI_AND_MCP.md) — Ask Actuali provider boundaries, privacy controls, and MCP tools.
- [`MCP_SETUP.md`](MCP_SETUP.md) — read-only stdio MCP host setup and safety contract.
- [`ROADMAP.md`](ROADMAP.md) — feature priorities derived from the existing Actual and Actuali surfaces.

When a feature changes data, update the shared core and its sync coverage first. When it changes interaction, add the narrow and wide surfaces independently while preserving the same route intent and mutation.

- [`IMPORT_EXPORT.md`](IMPORT_EXPORT.md) — selective JSON transfer for payees, rules, tags, schedules, and saved reports.
