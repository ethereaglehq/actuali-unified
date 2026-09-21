# Ask Actuali and MCP

Ask Actuali is a provider-neutral assistance layer. The UI gives people one place to ask questions about their budget. It can call a user-selected OpenAI-compatible endpoint directly with an in-memory key, or a host can register an adapter and keep credentials and transport outside the financial client.

## Provider boundary

`packages/ai-bridge` exposes `AskActuali`. An application registers an adapter with `register(provider)`, then calls `ask(...)` with a local financial snapshot. The bridge:

- strips control characters and rejects common prompt-injection instructions;
- defaults to privacy mode and redacts account names, payees, categories, and notes before a provider sees context;
- treats all financial fields as untrusted data and tells providers not to follow instructions found in those fields;
- clamps prompt and response sizes;
- returns provider and model metadata without storing a provider key.

The repository does not ship OpenAI, Anthropic, Gemini, Mistral, or local-model credentials. The Ask Actuali screen makes the endpoint, model, label-redaction, privacy, and send action explicit; it sends nothing until the user submits. Local snapshot summaries remain on-device, while a deployment can supply an adapter or MCP host and choose where data is allowed to go.

## MCP boundary

`createActualiMcpRegistry(adapter)` exposes four tools:

- `actuali.get_snapshot` — read-only balances, accounts, and recent activity;
- `actuali.search_transactions` — read-only, capped at 50 results;
- `actuali.propose_mutation` — validates a small allowlisted mutation, creates a host-side proposal record, and changes nothing;
- `actuali.apply_approved_mutation` — accepts only a proposal ID after the authenticated host's separate approval callback returns true.

`createMcpRequestHandler` handles the JSON-RPC method envelope for `initialize`, `tools/list`, and `tools/call`. HTTP, stdio, and embedded transports can provide authentication, session creation, origin checks, rate limits, and the `McpToolContext`. The handler never trusts a model-supplied identity, and writes are disabled unless the transport explicitly grants `canWrite`.

Proposal IDs are bound to a session, expire after five minutes, are single-use, and hash nested mutation arguments in a stable order. Possessing a proposal ID never approves a write; the trusted host must confirm the exact proposal outside model-controlled tool arguments. Privacy mode also redacts free-form search results for common identity-bearing fields. The current mutation allowlist covers creating a transaction and setting a transaction category with integer minor units, ISO dates, bounded notes, and strict identifiers. The adapter remains responsible for applying the final mutation through the shared Actual mutation API; the MCP layer is an approval and transport boundary, not a second financial engine.

## Adding a provider

1. Implement `AiProvider.complete` in the host application.
2. For a host adapter, keep credentials in the host secret store, never in the budget database or browser bundle. The built-in browser connection holds an optional key in memory only and clears it when the page is left.
3. Register the provider at runtime and pass a snapshot assembled from the shared query layer.
4. Keep privacy mode enabled unless the user makes an explicit choice for a particular request.
5. Add tests for prompt injection, redaction, output limits, and provider failure.

The bridge tests live in `packages/ai-bridge/tests`; the read-only stdio host tests live in `packages/mcp-server/tests`. The UI includes a bounded local snapshot summary and remains usable before an external provider is configured, without coupling the financial engine to a specific AI vendor.
