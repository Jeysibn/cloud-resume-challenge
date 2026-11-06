# Deploy the live frontend

This guide publishes frontend files to the existing V2 website. It does not create or change AWS infrastructure. The public site is [https://jeysibn.dev](https://jeysibn.dev), served by CloudFront distribution [d1ezqc8d2heo4m.cloudfront.net](https://d1ezqc8d2heo4m.cloudfront.net/). Keep the ACM DNS validation records at Name.com so AWS Certificate Manager can renew the domain certificate. Continue monitoring AWS billing for the hosting and distribution costs.

## Before deploying

1. Make and review your frontend change on a branch.
2. Open a pull request to `main`. GitHub Actions runs the frontend checks; the AWS deploy job is skipped for pull requests.
3. Merge the pull request only after its checks pass.

For a visitor-counter API change, first back up/recoverably record the existing table/state and aggregate count. Review the Terraform plan and deploy the compatible backend before the frontend. `GET /visits` returns `{ count, registrationSupported: true }`; enhanced clients send `POST /visits` with `{ "visitorId": "<UUID v4>" }` only after consent and capability detection, receiving `{ counted, count, returning }`. Older clients can keep displaying the aggregate: their bodyless POST receives `{ counted: false, count }` without registration. Enhanced clients talking to an older backend use GET only because the capability flag is absent. Both mixed-version cases have a temporary registration gap and never silently fall back to IP-derived tracking on the enhanced backend/client.

## Start a deployment

1. Open the repository’s **Actions** tab on GitHub.
2. Select **V2 Portfolio CI/CD**.
3. Select **Run workflow**, choose branch `main`, and start the run.
4. Watch both jobs. `build-and-test` must pass before `Deploy V2 to AWS` starts.

The workflow builds the site with the V2 API URL, passes the tested files as an artifact, and uses GitHub OIDC to get temporary access to AWS account `665514296439`. It uploads hashed assets first and `index.html` last, then requests a CloudFront cache invalidation. It does not use `--delete`, so it does not remove existing bucket objects. It does not run Terraform.

## Check the deployment

Wait for both workflow jobs to pass. Then open the [live site](https://jeysibn.dev) and check the page, images, resume link, and browser console. The visitor counter’s read-only API check is:

```bash
curl -i https://kfpwu0cd7k.execute-api.ap-southeast-2.amazonaws.com/visits
```

Expect HTTP 200 and JSON containing a numeric `count`. This GET does not change the count. Do not send a production POST as a smoke test; it can change the real aggregate. Use the consent flow on the live site only when authorized to do so.

CloudFront invalidation can take time to finish propagating after the workflow succeeds. If the page still looks old, check the invalidation and wait before starting another deployment.

## If a deployment fails

- If `build-and-test` fails, read the failing step and fix the source before merging or deploying again.
- If `Deploy V2 to AWS` fails, inspect the failed step and current workflow run. Do not run `terraform destroy` or retry blindly; asset uploads may have partly completed.
- To roll back a broken frontend, revert the frontend change through Git, merge the revert to `main`, then manually run the workflow again. The workflow uploads new assets and replaces `index.html` last; it does not delete old hashed assets.
- Keep the enhanced backend during frontend rollback. A legacy backend may treat an opted-in UUID POST as an IP-derived registration if a capability GET was completed before rollback or an older page sends a request later. Cached/open pages can outlive a rollout, so waiting for them to drain is not a complete guarantee. No registration-disable switch exists. Roll back the frontend first and retain the enhanced backend; consider legacy-backend restoration only as an explicitly approved privacy and counting behavior change. Keep all visitor records and the historical aggregate.

Terraform infrastructure changes use a separate reviewed Terraform plan and are not part of this frontend deployment workflow.

For backend/frontend rollback ordering and the effect of rolling back only one side, see [backend CI and deployment](backend-cicd.md#rollback).

## Version 1

The old manual V1 deployment guide is retired. V1’s AWS project is closed; do not use old bucket, API, or CloudFront values or reuse V1 Terraform state.
