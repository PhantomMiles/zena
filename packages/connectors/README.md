# @zena/connectors

## What it does

Adapters that connect external logistics systems (TMS, ERP, WMS, telematics) to the Zena network. Each connector maps an external format into `@zena/sdk` types, and optionally pushes Zena events back out in the format the external system expects.

Planned connectors (Phase 2):

| Connector        | Format            | Direction      |
| ---------------- | ----------------- | -------------- |
| Webhook receiver | HTTP POST + HMAC  | Inbound        |
| EPCIS 2.0        | GS1 XML / JSON-LD | Bi-directional |
| Telematics       | MQTT              | Inbound        |
| EDI              | X12 / EDIFACT     | Bi-directional |

## Security

All external input is treated as untrusted (rule 20): validated against `@zena/sdk` Zod schemas, size-limited, and sanitised before any further processing.

## Test

```bash
pnpm --filter @zena/connectors test
```
