# Visitor counter behavior and privacy

The portfolio reads the public aggregate with `GET /visits`. When the enhanced backend advertises browser registration and localStorage is available, the frontend automatically creates or reuses a random UUID v4 and sends it to `POST /visits`. Legacy consent preference values are ignored. The backend uses a keyed HMAC digest as its DynamoDB key and stores limited timestamps and counters. The UUID recognizes a browser token, not a person. The aggregate is recorded eligible visits, not unique people.

There is no visitor-facing enable/disable control or opt-in build policy. If browser storage is blocked, the aggregate still loads and registration is skipped. Existing backend records have a 90-day inactivity deadline, with asynchronous DynamoDB TTL cleanup. The global aggregate is retained.

**Production privacy review:** automatic UUID creation and use must be assessed for applicable notice, lawful basis, consent, and retention requirements before release. First-party storage and HMAC pseudonymization do not by themselves resolve those requirements. See the [architecture privacy checkpoint](../../docs/architecture.md#privacy-and-interpretation).

## Retention and counting

A new recognized UUID increments the existing aggregate in an atomic DynamoDB transaction. A recognized visit while the activity window is open does not increment; it refreshes `active_until` to current time plus 86,400 seconds. A visit after 24 continuous hours of inactivity increments again. The separate `expires_at` is a 90-day inactivity retention deadline. Lambda compares deadlines explicitly; DynamoDB TTL is only asynchronous cleanup. Conditional writes and transactions prevent concurrent eligible requests from incrementing twice.

The existing table, API Gateway HTTP API, Python Lambda, HMAC secret, and Terraform-managed permissions are reused. No new endpoint or infrastructure is introduced.

## API behavior

- `GET /visits` returns `count` and, on the enhanced backend, `registrationSupported: true`. A legacy backend without the capability marker is display-only.
- `POST /visits` sends `{"visitorId":"<canonical UUID v4>"}` and returns `counted`, `count`, and `returning`.
- A successful GET count remains visible if registration fails. An initial GET failure offers a read-only retry; it does not trigger a registration retry.
- StrictMode effect replay shares in-flight registration work. A later page load/remount registers again to refresh the inactivity deadline.
- The aggregate contains historical IP-derived counts and newer browser-token counts, so it is not a historical unique-browser or human count.

## Local checks

From `frontend/app`:

```bash
npm ci
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm run test:ui
```

Tests use mocks and do not update AWS. Do not load the live website as a smoke test unless a production registration is authorized: page load automatically attempts a POST. For rollout and rollback steps, see the [deployment runbook](../../docs/deployment-runbook.md) and [backend deployment guide](../../docs/backend-cicd.md).
