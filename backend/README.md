# Backend guide

V2 uses one Python Lambda handler and one DynamoDB table for a public aggregate count and private anonymous-browser activity. The retired V1 handler in `backend/lambda/` is historical source and is not changed by this enhancement.

## API contract

- `GET /visits` returns `{"count": 42, "registrationSupported": true}`. Older backends may return only `count`; enhanced frontends treat a missing marker as read-only compatibility mode.
- `POST /visits` requires a JSON body containing only `visitorId`, a canonical lowercase UUID v4. It returns `{"counted": true, "count": 43, "returning": false}` for a new or newly eligible visit; repeat registrations return `counted: false` and `returning: true`.
- A legacy bodyless POST returns `{"counted": false, "count": 42}` from the enhanced backend without creating visitor history or changing the aggregate. This small read-only compatibility path is deliberately maintained; revisit it only with a planned breaking API change after legacy clients are no longer supported. Malformed nonempty payloads still return 400.
- Invalid methods return 405, malformed identifiers or payloads return 400, a missing pre-initialized aggregate returns 404, and DynamoDB failures return 503 without claiming success. Responses use `Cache-Control: no-store`.
- Visitor digests and individual history are never returned by public routes. Both routes remain public and unauthenticated; API Gateway CORS and throttling do not authenticate callers.

## Rolling activity and DynamoDB record

`backend/lambda-v2/lambda_function.py` validates the UUID, HMAC-SHA256 hashes it with `VISITOR_ID_HMAC_SECRET`, and addresses the record as `visitor#<digest>`. It never stores/logs the raw identifier, source IP, or request body.

Records store `first_seen_at`, `last_seen_at`, `active_until`, `page_loads`, `counted_visits`, `is_returning`, and `expires_at`. Timestamp values are UTC Unix seconds. Every accepted registration updates `last_seen_at`, refreshes `active_until` by `VISIT_WINDOW_SECONDS` (default 86,400), increments `page_loads`, and refreshes `expires_at` by `VISITOR_RETENTION_SECONDS` (default 7,776,000 seconds/90 days). A repeat visit increments the aggregate only when `active_until <= now`, including at the exact 24-hour boundary.

`active_until` controls 24-hour counting eligibility. `expires_at` controls the separate 90-day logical retention period and DynamoDB's eventual TTL cleanup. When a request finds `expires_at <= now`, it conditionally replaces the visitor record with a fresh history and transactionally increments the aggregate, even if TTL has not physically deleted the old item. A request at exactly the retention deadline starts a new history period. If TTL deletes the item between the read and transaction, the conditional transaction fails and the handler rereads and creates a new record. Physical DynamoDB deletion remains asynchronous and may occur later than the logical deadline.

The new-visitor and expired-visitor paths transact the visitor write with the aggregate update. Each transaction call includes a random `ClientRequestToken` so SDK retries after an uncertain response are idempotent; a fresh token is used for a new conditional-conflict attempt. Active-window visits use a compare-and-update condition. Conflicts are reread/retried, preventing concurrent requests from counting the same eligible visit twice and keeping timestamps monotonic. Existing `id = visitors` count is preserved and initialized outside Terraform; no scan is performed by public requests.

The current Lambda environment takes `TABLE_NAME`, `VISITOR_ID_HMAC_SECRET`, `VISIT_WINDOW_SECONDS`, and `VISITOR_RETENTION_SECONDS`. The existing sensitive Terraform variable `ip_hash_secret` retains its existing value and is passed as `VISITOR_ID_HMAC_SECRET`; this avoids rotating the production secret during rollout. Terraform state and Lambda configuration contain that secret, so access must be restricted.

For rollout compatibility, legacy frontends can still read the count, but their bodyless POST is read-only. Enhanced frontends require the GET capability marker before automatically sending UUID registrations. Thus mixed versions do not fall back to IP-based tracking and may temporarily leave visits unregistered. See the staged release and rollback requirements in [backend-cicd.md](../docs/backend-cicd.md).

## Private review, retention, and limits

Authorized AWS operators can inspect `visitor#` items directly in the DynamoDB console or with the read-only, potentially paginated `scan` example in [architecture.md](../docs/architecture.md#dynamodb-records-and-retention). No index was added; ad hoc operator review is the only scan use. Keep IAM access to visitor records restricted. A record's old history is logically discarded at its 90-day deadline on the next registration; DynamoDB TTL eventually removes an inactive item and physical deletion may lag that deadline. Lambda access is table-scoped to `GetItem`, `PutItem`, and `UpdateItem`; DynamoDB authorizes each `TransactWriteItems` member using its corresponding item action, as described in the [DynamoDB transaction IAM guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis-iam.html). The policy grants no `DeleteItem`, explicit `ConditionCheckItem`, or scan access.

The browser identifier is a random token, not a person identity. It can be cleared, copied, blocked, or spoofed; callers can fabricate IDs; the API is not bot protection. `page_loads` and `counted_visits` describe a retained browser record, while the aggregate is historical recorded visits spanning the previous IP-based and new browser-based methods. It is not a historical total of unique browsers.

Enhanced frontend builds automatically register a browser when the backend advertises support and localStorage is available. Without browser storage, the public count remains readable and registration is skipped. Automatic UUID creation and use still require review of applicable notice, legal basis, consent, and retention duties; see the sources and privacy design note in [architecture.md](../docs/architecture.md#privacy-and-interpretation).

## Local checks and package

From the repository root, use Python 3.14 and run:

```bash
python3 -m pip install -r backend/requirements-test.txt
python3 -m unittest discover -s backend/tests -v
python3 -m py_compile backend/lambda-v2/lambda_function.py backend/lambda-v2/package.py
python3 backend/lambda-v2/package.py
```

Tests use mocks, a locked in-memory atomic DynamoDB fake, and botocore `Stubber` for request-shape validation; they do not contact AWS. Packaging creates the ignored `backend/lambda-v2/function.zip` with `lambda_function.py` at the ZIP root and verifies the archive. Rebuild it before a reviewed Terraform plan.

## Version 1 source history

`lambda/lambda_function.py` is the recovered handler from the retired V1 deployment. It remains historical source; V2 uses the separate `lambda-v2/` handler. The V1 source and ZIP provenance are recorded in [`source-provenance.json`](source-provenance.json). The old AWS project is closed, and this source is not the deployed V2 Lambda.
