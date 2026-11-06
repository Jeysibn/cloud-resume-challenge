# Visitor counter integration

The V2 website calls the API Gateway HTTP API at `VITE_API_BASE_URL` without `/visits`. This is public configuration; never put AWS keys or private secrets in `VITE_*` variables.

## Consent and browser storage

The portfolio reads the public aggregate with `GET /visits`. Anonymous registration remains off until a visitor selects the explicit enable control. After opt-in, the browser creates a cryptographically random UUID v4 using `crypto.randomUUID()` and saves it in first-party `localStorage`. It sends the UUID only to `POST /visits`; Lambda stores a server-derived HMAC digest instead. The browser ID remains in local storage until opt-out or site-data clearing. Opt-out saves a declined preference and attempts to remove the ID. If storage blocks either operation, tracking stops for the current page but the preference may not survive reload; the control displays an accessible warning.

If consent is not given, tracking is disabled, browser storage is blocked, or the identifier was cleared, the page still reads and displays the aggregate count but does not create or send an ID. Clearing site data may cause the same browser to be counted as new next time. A browser ID does not identify a person and can be copied or spoofed.

The short notice beside the control explains the purpose (recording aggregate page activity), random ID, HMAC storage, and 90-day inactivity retention. After that logical deadline, a returning registration starts a new record history even if DynamoDB TTL has not physically removed the old item; physical cleanup can be delayed. This opt-in is a privacy-conservative design decision, not a claim that one consent rule applies everywhere. The Philippines DPA requires transparent, lawful and proportionate processing, and consent cannot be assumed if relied on; browser storage may also fall under ePrivacy rules in some jurisdictions. See the [National Privacy Commission](https://privacy.gov.ph/data-privacy-act/), its [advisories and circulars](https://privacy.gov.ph/pips-and-pics/advisories-circulars/), and the [European Data Protection Board guidance](https://www.edpb.europa.eu/documents/guideline/guidelines-22023-on-technical-scope-of-art-53-of-eprivacy-directive_en). Requirements depend on context and location.

## API behavior

- `GET /visits` returns `{"count": number, "registrationSupported": true}` on the enhanced backend and does not change the aggregate. A legacy backend returns only `count`; the frontend treats the missing capability marker as read-only mode.
- `POST /visits` sends `{"visitorId":"<canonical UUID v4>"}` and returns `{"counted": boolean, "count": number, "returning": boolean}`. Responses are not cacheable.
- The enhanced backend answers legacy bodyless POSTs with `{"counted": false, "count": number}` without tracking or incrementing. This compatibility response is deliberately maintained until a planned breaking API change after legacy clients are no longer supported.
- On registration failure the page falls back to GET to show the current aggregate. Retry repeats the read only; it does not create another registration request.
- The component deduplicates registration across StrictMode effect replay. The backend also makes retries/concurrent requests safe using conditional updates and transactions.
- A new browser increments the aggregate. Later requests refresh `active_until` by 24 hours and `expires_at` by the configured 90-day retention. A request at or after `active_until` increments the aggregate. At or after `expires_at`, it also resets that browser's retained history and returning status, even if DynamoDB TTL has not deleted the item yet.
- Existing API Gateway throttling remains enabled. CORS allows only configured portfolio origins but does not authenticate API callers.

The `visitors` aggregate includes older counts recorded with IP-derived keys, so the number is historical recorded visits across two counting methods. It is not a historical count of unique browsers or people. Private visitor history is available only through restricted DynamoDB/AWS access; no public history endpoint exists.

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

Unit and browser tests use mocked API responses and do not update AWS. Do not run a production POST as a smoke test without authorization. A `GET /visits` is read-only.

For rollout and rollback steps, see the [deployment runbook](../../docs/deployment-runbook.md) and [backend deployment guide](../../docs/backend-cicd.md).
