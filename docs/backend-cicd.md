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

2. Confirm an owner-approved backup/recovery path for the existing DynamoDB table and V2 Terraform state. Read `visitors.count` with AWS tooling and record its current value privately. For example, this returns only the count value:

   ```bash
   aws dynamodb get-item \
     --table-name cloud-resume-v2-visitor-counter \
     --key '{"id":{"S":"visitors"}}' \
     --consistent-read \
     --projection-expression '#count' \
     --expression-attribute-names '{"#count":"count"}' \
     --query 'Item.count.N' --output text
   ```

   Open the live site with browser developer tools, do not opt in, and confirm the hero count displays using GET without a registration POST. Capture the currently deployed Lambda metadata without printing environment values:

   ```bash
   aws lambda get-function-configuration \
     --function-name cloud-resume-v2-visitor-function \
     --query '{State:State,LastModified:LastModified,Runtime:Runtime,VariableNames:keys(Environment.Variables)}'
   ```

   Note the recent Lambda `Errors`/`Throttles` and API Gateway 5xx metrics in CloudWatch as the baseline. Confirm the currently deployed frontend and backend contracts with read-only inspection. Do not reset the count.

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

7. Verify with read-only checks first:

   ```bash
   curl -fsS https://kfpwu0cd7k.execute-api.ap-southeast-2.amazonaws.com/visits
   aws lambda get-function-configuration \
     --function-name cloud-resume-v2-visitor-function \
     --query '{State:State,LastModified:LastModified,Runtime:Runtime,VariableNames:keys(Environment.Variables)}'
   ```

   `GET /visits` must return the preserved count and `registrationSupported: true`. Confirm the table still has TTL enabled on `expires_at` through read-only AWS tooling, and check CloudWatch Lambda `Errors` plus API 5xx/4xx metrics for new failures. Do not print or share Lambda environment values or raw visitor IDs. A bodyless legacy POST is read-only in the enhanced handler, but do not send even that production POST without separate explicit authorization. Local tests already verify `{counted:false,count}` and no visitor write; the old frontend continues to display the count during the temporary registration gap.

### Stage C — Frontend enhancement

8. After backend compatibility and the production privacy review are complete and the change is approved/merged, deploy the frontend from `main` using **V2 Portfolio CI/CD** as described in the [frontend runbook](deployment-runbook.md). Confirm which policy is built: default automatic recognition, or `VITE_VISITOR_RECOGNITION_POLICY=opt-in` if prior affirmative consent is required. Verify aggregate GET works independently, Privacy Settings is in the footer, prior declines remain honored, disabling removes the local UUID when possible, storage errors remain display-only, and the hero counter layout remains correct. In opt-in mode, verify no UUID or POST occurs until affirmative enablement.

### Stage D — Production verification

9. Only with explicit authorization, use one consenting test browser for this small smoke sequence. Record the aggregate privately immediately before the test.

   1. Open the deployed page and verify behavior matches the privacy-approved build policy. In opt-in mode, confirm GET displays the total before consent and no UUID or POST exists until affirmative enablement. In automatic mode, confirm the owner has approved that behavior after privacy review.
   2. If applicable under the selected policy, enable recognition in footer Privacy Settings. Confirm one UUID registration succeeds, the aggregate increases once, and DynamoDB has one `visitor#<HMAC digest>` record with `first_seen_at`, `last_seen_at`, `active_until`, `page_loads`, `counted_visits`, `is_returning`, and `expires_at`. Inspect only the digest and fields; never expose the browser UUID.
   3. Reload the page within 24 hours. Confirm `counted:false`, `returning:true`, updated activity/deadline fields, and no aggregate increment. A public GET continues to return the aggregate and does not modify it.
   4. Disable recognition in footer Privacy Settings. Confirm the page stops future registration attempts; a request already sent may complete. Confirm local UUID removal when browser storage permits, and that the global aggregate remains unchanged by disabling. Server-side visitor records are retained until the 90-day inactivity deadline and asynchronous TTL cleanup; there is no public record-deletion endpoint.
   5. Check CloudWatch Lambda `Errors` and API Gateway 5xx metrics for the test period. Compare the count against the private baseline plus the single expected registration.

   Do not wait 24 hours or modify production timestamps to test expiry. Verify exactly-at-boundary counting and 90-day logical retention reset using local tests or a controlled non-production fixture. Verify legacy bodyless POST behavior locally; only test it against production after separate explicit authorization. Never inspect or log raw browser IDs.

The frontend workflow uploads files and invalidates CloudFront only; it does not run Terraform. Terraform state is stored under the V2 backend and must never be replaced with V1 state.

## Stage E — Rollback

- **Frontend only:** republish the previous frontend. Its bodyless POST receives the enhanced backend's read-only `{counted:false,count}` compatibility response, so count display works but registration pauses. The visitor records and aggregate remain intact.
- **Default rollback:** keep the enhanced backend deployed and roll back the frontend first. The legacy frontend can read the count; its bodyless POST receives the enhanced backend's read-only `{counted:false,count}` response. Registration pauses, but no legacy IP-derived tracking resumes.
- **Backend-only rollback:** do not treat this as a privacy-safe operation. The enhanced frontend checks `registrationSupported` with GET and sends its UUID in a later POST; a rollback can occur between those requests, and the legacy handler may ignore the UUID and track by IP. Already-open or cached pages can also make requests after a deployment. Waiting for tabs or caches to drain cannot guarantee that no request remains. No registration kill switch is implemented. If an emergency requires restoring the legacy handler, treat it as an explicit privacy and counting behavior change and obtain owner approval before doing so.
- **Contract behavior:** enhanced frontend + legacy backend is GET-only when the enhanced frontend's capability check reaches the legacy backend; enhanced backend + legacy frontend keeps displaying the aggregate but its bodyless POST does not register. These rollout combinations preserve count display but create a temporary registration gap. Retain the enhanced backend as the default rollback target.
- **Never** destroy/recreate the table, reset `visitors.count`, run an unreviewed plan, or use retired V1 state.

Do not use production POST requests for health checks. The API is public and unauthenticated; throttling, HMAC pseudonymization, and strict payload validation reduce accidental or simple abusive traffic but do not stop automated callers from fabricating UUIDs.
