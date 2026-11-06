# Visitor counter and privacy preferences

The portfolio always reads the public aggregate with `GET /visits`; this does not create a browser identifier. When persistent browser recognition is enabled, the frontend stores a random UUID v4 in first-party `localStorage` and sends it to `POST /visits`. The backend uses a keyed HMAC digest as its DynamoDB key and stores limited timestamps and counters. The UUID recognizes a browser token, not a person. The aggregate is recorded eligible visits, not unique people.

## Privacy Settings

The **Privacy Settings** disclosure is in the site footer, outside the hero. It lets visitors enable or disable persistent browser recognition. Disabling writes the existing `jeysibn.visitor-counting-consent.v1=declined` preference, stops future requests on the current page, aborts local in-flight requests where possible, and removes the local UUID when storage permits. A request already sent may complete. Disabling does not delete backend records; those records expire after 90 days of inactivity, while DynamoDB TTL deletion is asynchronous. The global aggregate count is never reset by preference changes.

Prior declines are preserved and remain display-only. A previously accepted UUID remains active under the default automatic-recognition policy, but visitors can disable it in Privacy Settings. New visitors are automatically recognized under the proposed product behavior. This behavior has not been legally cleared.

## Policy requiring affirmative opt-in

For a jurisdiction or product policy requiring affirmative opt-in, set the GitHub Actions repository variable `VITE_VISITOR_RECOGNITION_POLICY=opt-in` before building the frontend. The workflow passes this public build-time policy into Vite; an empty/unset value selects the proposed automatic mode. The aggregate count continues to load, while UUID creation and POST registration stay off until the visitor enables recognition through Privacy Settings. A prior decline continues to disable recognition until changed there. This is a technical gate, not a substitute for determining the applicable legal basis, notice, consent withdrawal, or other requirements. Do not deploy automatic mode until the privacy review checkpoint in [the architecture note](../../docs/architecture.md#privacy-and-interpretation) is complete.

If browser storage is blocked, counting remains display-only. Preference changes are applied in the current page even when storage fails; the setting may not persist across reloads. Legacy `declined` values are never overwritten on page load. No server-side deletion API exists. A future deletion mechanism would need authenticated or otherwise abuse-resistant proof of control over an identifier, careful treatment of shared devices, rate limiting, audit and retention rules, and must never alter the aggregate count.

## Retention and counting

A new recognized UUID increments the existing aggregate in an atomic DynamoDB transaction. A recognized visit while the activity window is open does not increment; it refreshes `active_until` to current time plus 86,400 seconds. A visit after 24 continuous hours of inactivity increments again. The separate `expires_at` is a 90-day inactivity retention deadline. Lambda compares deadlines explicitly; DynamoDB TTL is only asynchronous cleanup. Conditional writes and transactions prevent concurrent eligible requests from incrementing twice.

The existing table, API Gateway HTTP API, Python Lambda, HMAC secret, and Terraform-managed permissions are reused. No new endpoint or infrastructure is introduced.

## API behavior

- `GET /visits` returns `count` and, on the enhanced backend, `registrationSupported: true`. A legacy backend without the capability marker is display-only.
- `POST /visits` sends `{"visitorId":"<canonical UUID v4>"}` and returns `counted`, `count`, and `returning`.
- A successful GET count remains visible if registration fails. An initial GET failure offers a read-only retry; it does not trigger registration.
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

Tests use mocks and do not update AWS. Do not send a production POST as a smoke test. For rollout and rollback steps, see the [deployment runbook](../../docs/deployment-runbook.md) and [backend deployment guide](../../docs/backend-cicd.md).
