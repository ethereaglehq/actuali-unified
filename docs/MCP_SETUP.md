# Actuali MCP server

`@actual-app/mcp-server` exposes a local, read-only Model Context Protocol (MCP) server for an Actual budget. It is designed for MCP-capable clients such as desktop assistants, coding agents, and other tools that can launch a command over stdio.

The server speaks MCP JSON-RPC over stdin/stdout. It does not write JSON-RPC logs to stdout; startup and failures go to stderr so the transport remains valid. The implementation supports the MCP initialize, tools/list, and tools/call methods described in the [official MCP TypeScript SDK documentation](https://github.com/modelcontextprotocol/typescript-sdk). The repository does not currently vendor that SDK, so this small host keeps the supported wire surface dependency-free and avoids adding an MCP SDK dependency to the lockfile for consumers that only use the web or mobile apps. It does not claim compatibility with methods outside that supported surface.

## Build and launch

From the repository root:

```sh
yarn install
yarn workspace @actual-app/mcp-server build
ACTUAL_DATA_DIR=/absolute/path/to/actual-data \
  ACTUAL_BUDGET_ID=my-budget \
  node packages/mcp-server/dist/src/bin.js
```

`ACTUAL_DATA_DIR` is optional when the process should use the current working directory. Set `ACTUAL_SERVER_URL` to connect to a sync server. Use exactly one of `ACTUAL_SERVER_PASSWORD` or `ACTUAL_SESSION_TOKEN` when the server requires authentication. For an encrypted remote file, select it with `ACTUAL_SYNC_FILE_ID` (or `ACTUAL_BUDGET_ID`) and provide `ACTUAL_BUDGET_ENCRYPTION_PASSWORD`.

A client configuration uses an absolute path:

```json
{
  "mcpServers": {
    "actuali": {
      "command": "node",
      "args": [
        "/absolute/path/to/actuali-unified/packages/mcp-server/dist/src/bin.js"
      ],
      "env": {
        "ACTUAL_DATA_DIR": "/absolute/path/to/actual-data",
        "ACTUAL_BUDGET_ID": "my-budget"
      }
    }
  }
}
```

Keep credentials in the client’s secret/environment facility. Do not commit them to a client config file. The server never prints passwords, tokens, encryption keys, transaction notes, or tool arguments.

## Tools and safety

| Tool                          | Purpose                                                                                                     | Side effects                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `actuali.get_accounts`        | Accounts with current balances                                                                              | Read-only                                              |
| `actuali.get_categories`      | Visible and hidden categories                                                                               | Read-only                                              |
| `actuali.search_transactions` | Transactions for an explicit `startDate` and `endDate` (`YYYY-MM-DD`), optional account/query, max 100 rows | Read-only                                              |
| `actuali.sync`                | Requests a sync against the configured server                                                               | Network access; no budget mutation through this server |

Every data tool is advertised with `readOnlyHint: true` and `destructiveHint: false`; sync is explicitly annotated as a network action even though it exposes no budget mutation parameters. There are no create, update, delete, import, export, or rule mutation tools. Transaction search requires a date range to prevent accidental full-history extraction, validates calendar dates, and caps results. The MCP server is an access boundary, not an AI provider: the calling client remains responsible for model permissions, retention, and user confirmation.

## Local smoke test

The protocol and adapter tests use a fake API and never need a real budget:

```sh
yarn vitest --run --config ./packages/mcp-server/vitest.config.ts
```

The package currently has no live sync-server fixture. Before connecting a production budget, test with a disposable copy, confirm the client’s tool permission UI, and verify that `actuali.sync` is explicitly allowed because it contacts the network.
