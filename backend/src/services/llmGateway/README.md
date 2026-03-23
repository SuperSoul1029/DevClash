# LLM Gateway Onboarding Playbook

This directory is the protocol platform for all LLM-powered tools.

## Contract Checklist

Every new contract module under `contracts/` must export:

- `contractKey` with explicit version suffix (for example `tutor.answer.v1`)
- `outputType`
- `schemaVersion`
- `family`
- `description`
- `lifecycle` object
- `routing` object (`fast`, `balanced`, or `quality`)
- `payloadSchema` (Zod)
- `buildPrompts(input)`

## Lifecycle Rules

- Start new contracts at `lifecycle.stage = "active"`.
- For breaking changes, create a new versioned contract key instead of mutating old shape.
- Mark old contracts as `deprecated` with `supersededBy` when migration is complete.
- Optionally enforce hard blocks via `LLM_GATEWAY_ALLOW_DEPRECATED_CONTRACTS=false`.

## Routing Rules

- `fast`: low-latency tools (small adaptive generations).
- `balanced`: default planning and general tools.
- `quality`: larger outputs that need higher token budgets.

Use env overrides to pin route-tier model IDs:

- `LLM_GATEWAY_ROUTE_FAST_MODEL`
- `LLM_GATEWAY_ROUTE_BALANCED_MODEL`
- `LLM_GATEWAY_ROUTE_QUALITY_MODEL`

## Controller Integration Pattern

1. Build compact `input` data in controller.
2. Call `executeGatewayRequest({ contractKey, input, ... })`.
3. If `response.ok !== true`, throw with `response.debug.error` and keep deterministic fallback.
4. Normalize validated payload into domain models before DB writes.

## Reliability Expectations

- Treat model output as untrusted.
- Never bypass payload schema validation.
- Keep retries bounded (`LLM_GATEWAY_MAX_ATTEMPTS`).
- Keep repair optional and explicit (`LLM_GATEWAY_REPAIR_ENABLED`).
- Avoid retrying known rate-limit responses.

## Observability

- Gateway attempt telemetry is returned in `debug.attempts[]`.
- Health endpoint includes Gateway summary under `checks.llmGateway` and `llmGateway`.
- Frontend should render fallback/debug text from `generationDebug` without tool-specific parser logic.

## Test Coverage Strategy

- Registry tests: contract metadata shape, routing policy validity, lifecycle validity.
- API tests: fallback semantics and health diagnostics remain stable.
- Contract tests: add at least one success fixture per new contract input family.
