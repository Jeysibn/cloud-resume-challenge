# Backend CI and manual Lambda deployment (V2)

Backend deployment is a separate, manual operation that can change live AWS resources. No deployment is performed by this repository's backend CI job.

## Checks

Pull requests run `Backend CI (Python 3.14)` from `.github/workflows/deploy-v2.yml`. It runs backend unit tests, syntax compilation, and Lambda ZIP validation without AWS credentials. Run the same checks from the repository root:

```bash
python3 -m pip install -r backend/requirements-test.txt
python3 -m unittest discover -s backend/tests -v
python3 -m py_compile backend/lambda-v2/lambda_function.py backend/lambda-v2/package.py
python3 backend/lambda-v2/package.py
```

## Safe rollout sequence

The enhanced backend advertises `registrationSupported: true` in `GET /visits`. The enhanced frontend reads that capability before sending a UUID registration. An older backend does not advertise the capability, so the enhanced frontend displays its count through GET and sends no POST. The enhanced backend accepts only a validated UUID v4 for registration. A legacy bodyless POST receives the current count with `counted: false`; it creates no browser history and performs no IP-derived tracking. This lets already-open legacy pages keep displaying the count during rollout, with a temporary registration gap for those clients.

### Stage A — Preparation

1. Review the implementation PR and CI evidence. Before any release, confirm the exact production AWS account and region with an authorized identity:

   ```bash
   git status --short --branch
   aws sts get-caller-identity
   ```

2. Confirm an owner-approved backup/recovery path for the existing DynamoDB table and Terraform state. Read `visitors.count` with AWS tooling and record its current value privately. Confirm the currently deployed frontend and backend contracts with read-only inspection. Do not reset the count.

3. Supply the existing `TF_VAR_ip_hash_secret` through the approved secure mechanism and preserve its current value. Terraform reuses this existing secret as `VISITOR_ID_HMAC_SECRET`; it does not rotate the production secret. Terraform state and Lambda configuration contain secrets despite sensitive output redaction. Never commit or expose them to frontend build variables.

4. Build the package and initialize Terraform against the existing V2 state only:

   ```bash
   python3 backend/lambda-v2/package.py
   cd infra/terraform
   terraform init -reconfigure
   umask 077
   PLAN_FILE=$(mktemp /tmp/cloud-resume-visitor-analytics.XXXXXX.tfplan)
   terraform plan -input=false -out="$PLAN_FILE"
   terraform show "$PLAN_FILE"
   ```

   Treat the saved plan as sensitive. Keep it owner-readable only, out of Git, and delete that newly created temporary plan after review or apply. Never touch the two unrelated pre-existing `infra/terraform/tfplan*` artifacts.

5. Review every plan action before applying. Expected changes are limited to the existing Lambda code/environment and perhaps metadata; the existing table-scoped IAM permissions (`GetItem`, `PutItem`, and `UpdateItem`) cover the one-item actions used within transactions. The table, its TTL, API routes, CORS, throttling, and the pre-existing `visitors` item must remain. Stop if the plan proposes table replacement/deletion, counter reset, V1 state, legacy secret rotation, or unrelated changes. The Lambda role has no scan permission.

### Stage B — Backend compatibility

6. After explicit owner authorization, apply only the reviewed saved plan:

   ```bash
   terraform apply "$PLAN_FILE"
   ```

7. Verify with read-only checks first. `GET /visits` must return the existing count and `registrationSupported: true`. Inspect Lambda environment names and table TTL configuration through AWS tooling. Do not use a production POST unless separately authorized. Confirm legacy pages still display the count, that their bodyless POST returns `counted: false`, and that no record or count is changed. During this stage, those old pages have a documented temporary registration gap.

### Stage C — Frontend enhancement

8. After backend compatibility is verified and the change is approved/merged, deploy the frontend from `main` using **V2 Portfolio CI/CD** as described in the [frontend runbook](deployment-runbook.md). Verify consent defaults to off, the count loads, opt-out removes the local identifier, and the counter appears in the hero. The enhanced frontend sends registration only after affirmative opt-in and the backend capability check.

### Stage D — Production verification

9. Only with explicit authorization, perform controlled smoke tests using a consenting test browser. Verify valid registration, aggregate update, the HMAC-only visitor record, `first_seen_at`, monotonic `last_seen_at`, `page_loads`, `counted_visits`, and `expires_at`. Verify repeat activity without waiting 24 real hours by using local tests or a controlled non-production fixture; do not alter production timestamps to simulate the window. Never inspect or log raw browser IDs. Confirm old bodyless clients do not create history or increment the aggregate.

The frontend workflow uploads files and invalidates CloudFront only; it does not run Terraform. Terraform state is stored under the V2 backend and must never be replaced with V1 state.

## Stage E — Rollback

- **Frontend only:** republish the previous frontend. Its bodyless POST receives the enhanced backend's read-only `{counted:false,count}` compatibility response, so count display works but registration pauses. The visitor records and aggregate remain intact.
- **Backend only:** a backend rollback to the legacy IP-based handler is incompatible with an enhanced frontend: the legacy handler ignores the UUID and may use IP-derived tracking for opted-in POSTs. Avoid this rollback while enhanced clients remain cached/open. Roll back the frontend first and allow old tabs/cache to drain; if immediate backend rollback is unavoidable, disable registration safely or accept and explicitly disclose the privacy/counting behavior change. Do not claim the capability check closes a race during emergency backend rollback.
- **Contract behavior:** enhanced frontend + legacy backend is GET-only because the legacy backend lacks `registrationSupported`; enhanced backend + legacy frontend displays the aggregate but does not count bodyless POSTs. These combinations are deliberately safe but have a temporary counting gap.
- **Never** destroy/recreate the table, reset `visitors.count`, run an unreviewed plan, or use retired V1 state.

Do not use production POST requests for health checks. The API is public and unauthenticated; throttling, HMAC pseudonymization, and strict payload validation reduce accidental or simple abusive traffic but do not stop automated callers from fabricating UUIDs.
