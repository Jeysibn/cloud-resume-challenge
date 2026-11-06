# Architecture

## Live system: V2

The live portfolio runs in AWS account `665514296439`, region `ap-southeast-2`. CloudFront serves [jeysibn.dev](https://jeysibn.dev) from a private S3 bucket. The visitor API is an API Gateway HTTP API backed by Python Lambda and DynamoDB.

```mermaid
flowchart LR
    B[Visitor browser]
    C[Explicit tracking choice and first-party UUID]
    CF[CloudFront]
    S3[Private S3 website bucket]
    API[API Gateway HTTP API]
    L[Python Lambda]
    DB[(DynamoDB aggregate and HMAC visitor records)]
    GH[GitHub Actions on main]

    B -->|https://jeysibn.dev| CF
    CF -->|Private access through OAC| S3
    B --> C
    C -->|POST /visits with UUID after opt-in| API
    B -->|GET /visits for count or fallback| API
    API --> L
    L -->|Conditional updates and atomic transactions| DB
    GH -->|OIDC role uploads files| S3
    GH -->|Requests cache invalidation| CF
```

### Visitor registration and counting

1. The portfolio displays the aggregate count using `GET /visits`. Registration starts only after the visitor explicitly enables anonymous counting. If consent is declined, storage is unavailable, or tracking is disabled, the page still reads and displays the aggregate count without creating or sending a browser identifier.
2. On opt-in, the browser creates a cryptographically random UUID v4 with the Web Crypto API and stores it in first-party `localStorage`. Later visits reuse that ID. Opt-out immediately disables new registration attempts for the current page, stores a declined preference, and best-effort removes the browser ID. A request already sent before opt-out may still complete. If storage blocks saving the preference or removing the ID, the interface warns that the choice may not persist across reloads.
3. `POST /visits` sends `{ "visitorId": "<UUID v4>" }`. Lambda validates the shape, HMAC-SHA256 hashes it with the existing Terraform-managed secret, and uses `visitor#<digest>` as the DynamoDB key. Raw IDs are not stored or logged.
4. A new browser or one whose `active_until` is at or before the current UTC time increments the existing `visitors.count` in the same DynamoDB transaction that writes visitor state. A visit inside the active window updates its history and extends the deadline without changing the aggregate. Conditional writes resolve concurrent requests.
5. If POST fails, the page reads the aggregate with GET. Registration responses and GET responses use `Cache-Control: no-store`.

### DynamoDB records and retention

The existing table key is `id`. The `id = visitors` item and its historical count are preserved. Anonymous browser records use `id = visitor#<server-derived HMAC digest>` and store UTC Unix-second timestamps and counters:

| Attribute | Meaning |
| --- | --- |
| `first_seen_at` | First recorded visit in the current retained history period; reset when `expires_at <= now`, even if the item remains physically present. |
| `last_seen_at` | Most recent accepted registration. |
| `active_until` | Application eligibility deadline, set to the latest visit plus 86,400 seconds. This controls counting; DynamoDB TTL is not consulted. |
| `page_loads` | Total accepted registrations observed for this browser record. |
| `counted_visits` | Eligible visits that incremented the aggregate for this browser record. |
| `is_returning` | True after a repeat registration has been observed. |
| `expires_at` | Logical history-retention deadline and DynamoDB TTL deadline, refreshed to 90 days after the latest registration. |

UTC epoch seconds are convenient for comparisons; convert them to `Asia/Manila` when reviewing operational records. `active_until` determines whether a registration counts again after 24 hours. Independently, once `expires_at <= now`, the handler treats a still-present record as a new retained history period: it replaces `first_seen_at` and resets activity counters, returning status, and both deadlines while incrementing the aggregate atomically. A conditional write verifies the observed expiration so concurrent resets count once; if TTL deletes the item between read and transaction, the handler rereads and creates a first-visit record. DynamoDB physical TTL deletion remains asynchronous and can lag the logical deadline. There is no secondary index and no scan on public requests. Private operational review can scan the table; that is an off-path, potentially paginated read, not an analytics endpoint. Restrict AWS console and CLI permissions because records contain visit history and HMAC identifiers.

An authorized operator can inspect recent records without exposing them publicly:

```bash
aws dynamodb scan \
  --table-name cloud-resume-v2-visitor-counter \
  --filter-expression 'begins_with(#id, :prefix)' \
  --projection-expression '#id, first_seen_at, last_seen_at, active_until, page_loads, counted_visits, is_returning, expires_at' \
  --expression-attribute-names '{"#id":"id"}' \
  --expression-attribute-values '{":prefix":{"S":"visitor#"}}'
```

The command is read-only, may return several pages, and should be used sparingly. The HMAC key is in restricted Terraform state and Lambda configuration. The Lambda role is scoped to table `GetItem`, `PutItem`, and `UpdateItem`; API Gateway retains its existing 2 requests/second rate and burst 5 throttles.

### Privacy and interpretation

This is recognition of a browser-held random token, not identification of a person. Browser storage can be cleared, copied, blocked, or spoofed; a person can use multiple browsers, and several people can share a browser. A caller can invent IDs, and the public unauthenticated API is not bot protection. The counter is an estimate of recorded eligible visits, not unique people. The aggregate retains the previous IP-based count, so totals span two different methodologies and must not be described as historical unique-browser totals.

Tracking is off until affirmative opt-in. This is a conservative product choice: the Philippines Data Privacy Act requires transparency and a lawful basis, and NPC guidance says consent cannot be inferred when consent is the relied-on basis; EU ePrivacy rules may also cover browser storage depending on the facts and applicable national implementation. Requirements depend on visitor location and processing context. The site explains purpose and retention next to the opt-in control, offers opt-out, and allows aggregate display without registration. See the [NPC Data Privacy Act](https://privacy.gov.ph/data-privacy-act/), [NPC advisories and Circular 2023-04](https://privacy.gov.ph/pips-and-pics/advisories-circulars/), and [EDPB technical-scope guidelines](https://www.edpb.europa.eu/documents/guideline/guidelines-22023-on-technical-scope-of-art-53-of-eprivacy-directive_en). This implementation note is not a jurisdiction-specific legal determination.

### Migration and deployment

No data migration is required. The aggregate `visitors` item is not managed by Terraform and is not reset. Existing `ip#...` items are not mapped to browsers; TTL removes them eventually. The new handler writes `visitor#...` records. Enhanced `GET /visits` includes `registrationSupported: true`. The enhanced frontend checks this flag before sending an opted-in UUID registration. A legacy backend lacks this flag, so the enhanced frontend displays the aggregate with GET only and sends no POST. The enhanced backend accepts a legacy bodyless POST as a read-only compatibility request and returns `{ "counted": false, "count": n }`; it creates no record and performs no IP-derived tracking. Keep this low-risk compatibility path deliberately until a planned breaking API change after legacy clients are no longer supported. These mixed-version combinations preserve display but cause a temporary registration gap.

Deploy the compatible backend first, verify it, then deploy the frontend. Keep the enhanced backend in place for the default rollback and revert the frontend first. A backend-only rollback to the legacy implementation is privacy-sensitive: the capability GET and UUID POST are separate requests, so an enhanced page can POST after the rollback and the legacy backend may track by IP. Cached or already-open pages can continue to send requests; waiting for them to drain is not a complete guarantee. No registration-disable switch exists. These mixed-version releases also have a temporary registration gap for legacy clients. Never run an unreviewed Terraform plan or apply; the [backend runbook](backend-cicd.md) describes the gated release and rollback.

## Frontend deployment flow

Pull requests to `main` run frontend and backend checks. A maintainer separately reviews and applies any approved Terraform plan, then manually starts **V2 Portfolio CI/CD** on `main` to publish the frontend. The workflow uses GitHub OIDC, uploads assets before `index.html`, and requests a CloudFront invalidation. It does not apply Terraform.

## V1 history

V1 was manually provisioned in an older AWS project, which has since closed. Its source remains historical and its AWS state must not be reused.
