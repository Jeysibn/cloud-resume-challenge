# Validation and current status

This page distinguishes historical checks from current local checks and live AWS operations. The visitor analytics enhancement is locally validated; no production deployment, production POST, Terraform apply, or resource modification has been performed.

## Local checks for the current source

The following checks passed locally on November 4, 2026:

```bash
python3 -m unittest discover -s backend/tests -v
python3 -m py_compile backend/lambda-v2/lambda_function.py backend/lambda-v2/package.py
python3 backend/lambda-v2/package.py
cd frontend/app
npm run typecheck
npm run lint
npm test -- --run
npm run build
cd ../../infra/terraform
terraform fmt -check
terraform validate
```

| Check | Result |
| --- | --- |
| `python3 -m unittest discover -s backend/tests -v` | Passed: 27 tests, including V1 source tests; AWS calls are mocked |
| Python compilation and Lambda ZIP packaging | Passed; ZIP contains `lambda_function.py` at the root |
| Frontend typecheck and lint | Passed |
| `npm test -- --run` | Passed: 73 tests in 16 files |
| Frontend production build | Passed |
| `terraform fmt -check` and `terraform validate` | Passed |

Backend and frontend tests use mocks and do not modify AWS or the live counter. Terraform validation checks configuration; it does not deploy anything. The unique-IP implementation has not been smoke-tested against AWS yet.

## Previous live validation (historical behavior)

The following evidence predates the browser-ID enhancement and validated the former **Record My Visit** button flow. It does not prove the current opt-in registration, rolling window, logical retention reset, or TTL behavior.

### Mission 9.1 — Previous Visitor Counter End-to-End Test

**Date:** November 1, 2026

**Environment:** AWS V2 (`ap-southeast-2`, Sydney)

**Result:** PASS for the button-click counter then deployed

The earlier test clicked **Record My Visit**, observed the count increase by one, confirmed the DynamoDB count, and refreshed the page. Those results describe the old behavior only and are not a procedure for testing the browser-ID implementation.

Screenshots from the prior live test:

![Portfolio footer showing one recorded visit](images/testing/visitor-counter-frontend.jpg)

![CloudWatch record for the successful POST /visits request](images/testing/api-post-visit-response.png)

![DynamoDB visitor counter item with count 1](images/testing/dynamodb-visitor-count.png)

The old live checks reported the homepage and GET endpoint working and had no production POST during the initial deployment. The November 1 button test later sent a production POST. No live API check has been performed for the browser-ID enhancement.

### Custom domain and follow-up counter check

**Date:** November 1, 2026

**Environment:** AWS V2 (`ap-southeast-2`, Sydney)

**Result:** PASS for the prior button-click implementation

The portfolio was opened successfully at [https://jeysibn.dev](https://jeysibn.dev). A follow-up live test clicked **Record My Visit** and increased the count from 1 to 2. This is historical production evidence for the prior implementation, not validation of the unique-IP behavior.

The CloudFront distribution remains the delivery layer behind the custom domain.

### Custom domain and follow-up counter check

**Date:** November 1, 2026

**Environment:** AWS V2 (`ap-southeast-2`, Sydney)

**Result:** PASS

The portfolio was opened successfully at [https://jeysibn.dev](https://jeysibn.dev). In a follow-up live test, clicking **Record My Visit** increased the counter from 1 to 2. This is a live production counter update reported after the original Mission 9.1 test; it is not an automated CI test.

The CloudFront distribution remains the delivery layer behind the custom domain. The custom domain is the URL to share publicly.

## Dependency audit

The latest recorded `npm audit` on 2026-11-01 found 12 moderate issues in development tooling; `npm audit --omit=dev` found none in production dependencies. See the [dependency security check](../frontend/app/DEPENDENCY-SECURITY-REVIEW.md) for details and recheck commands. This audit is separate from the build and test results above.

## Visitor analytics enhancement checks on November 6, 2026

The feature branch was validated locally. No production POST, Terraform plan, Terraform apply, or AWS resource modification was performed.

| Command | Result |
| --- | --- |
| `/tmp/crc-visitor-venv/bin/python -m unittest discover -s backend/tests -v` | Passed: 26 tests, including V1 source-provenance checks and V2 rolling-window, TTL, transaction, error, and concurrency tests. |
| `/tmp/crc-visitor-venv/bin/python -m py_compile backend/lambda-v2/lambda_function.py backend/lambda-v2/package.py` | Passed. |
| `/tmp/crc-visitor-venv/bin/python backend/lambda-v2/package.py` | Passed; verified the generated Lambda ZIP. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed. |
| `npm test -- --run` | Passed: 78 tests across 16 files. |
| `npm run build` | Passed. |
| `npm run test:metadata` | Passed. |
| `npm run perf:budget` | Passed. |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4184 npm run test:ui -- --workers=2` | Passed: 67 passed, 23 skipped. Includes the 1440, 1024, 768, 390, and 320px counter layout checks, keyboard/accessibility checks, and the updated visual snapshot. |
| `terraform fmt -check -recursive .` and `terraform validate -no-color` | Passed. |

The aggregate `npm run validate:ci` command initially reused an unrelated portfolio preview already listening on its default port 4173; that caused false browser failures against the wrong site. The browser suite was rerun against this checkout's built frontend on a dedicated local port and passed. These checks do not establish live AWS behavior; use the gated rollout in [backend-cicd.md](backend-cicd.md) after owner approval.

## Compatibility and final hardening checks on November 7, 2026

The final pass added version negotiation for mixed frontend/backend rollout, read-only handling for legacy bodyless POST requests, monotonic active-visit timestamps, and idempotency tokens on transactional retries. The aggregate remains initialized outside Terraform and tests confirm its historical value is preserved. No production POST, deployment, Terraform apply, or AWS resource modification was performed.

| Command | Result |
| --- | --- |
| `/tmp/crc-visitor-venv/bin/python -m unittest discover -s backend/tests -v` | Passed: 29 backend/V1 tests, including legacy POST compatibility, strict UUID validation, 24-hour boundary, late requests, concurrency, DynamoDB failures, and historical count preservation. |
| `/tmp/crc-visitor-venv/bin/python -m py_compile backend/lambda-v2/lambda_function.py backend/lambda-v2/package.py` | Passed. |
| `/tmp/crc-visitor-venv/bin/python backend/lambda-v2/package.py` | Passed; package contains the current handler. |
| `npm run typecheck`, `npm run lint`, `npm test -- --run`, `npm run build`, `npm run test:metadata`, `npm run perf:budget` | Passed; 82 frontend unit tests across 16 files. |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4184 npm run test:ui -- --workers=2` | Passed: 67 passed, 23 skipped. The preview ran from this checkout; hero visibility, counter consent, API compatibility, accessibility, reduced motion, and 1440/1024/768/390/320px layout checks were exercised. |
| `terraform fmt -check -recursive .`, `terraform validate -no-color` | Passed. |
| Read-only `aws sts get-caller-identity` | Passed. |
| Read-only Terraform plan to a `/tmp` output path | Not produced: the required `ip_hash_secret` Terraform input was unavailable. No AWS session-expiry error was reported and no plan was applied. |

The two pre-existing untracked plan artifacts under `infra/terraform/` were kept untouched and excluded from staging. Terraform validation does not prove the production plan is safe. Before release, provide the existing secret through the approved secure mechanism, generate a fresh plan in a private temporary path, and review every action as described in [backend-cicd.md](backend-cicd.md).

## PR #14 remediation checks on November 7, 2026

The logical-retention reset, consent failure handling, registration-cache changes, and current-`main` integration were checked locally. Tests use isolated mocks or a local preview. No AWS request, Terraform plan, apply, or production resource modification was performed for this remediation.

| Command | Result |
| --- | --- |
| `/tmp/crc-visitor-venv/bin/python -m unittest discover -s backend/tests -v` | Passed: 34 tests, including V1 source-provenance checks and V2 rolling-window, logical retention reset, TTL deletion races, transaction conflicts, concurrency, compatibility, and serialization checks. |
| `/tmp/crc-visitor-venv/bin/python -m py_compile backend/lambda-v2/lambda_function.py backend/lambda-v2/package.py` | Passed. |
| `/tmp/crc-visitor-venv/bin/python backend/lambda-v2/package.py` | Passed; verified the current Lambda ZIP. |
| `npm run typecheck` and `npm run lint` | Passed. |
| `npm test -- --run` | Passed: 90 frontend tests across 16 files. |
| `npm run build` | Passed. |
| `npm run test:metadata` and `npm run perf:budget` | Passed. |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4184 npm run test:ui -- --workers=2` | Passed: 67 passed, 23 skipped. The suite used this checkout's preview on isolated port 4184 and covered the hero, consent, keyboard/accessibility, reduced motion, and representative responsive widths. |
| `terraform fmt -check -recursive` from `infra/terraform` | Passed. |
| `terraform validate -no-color` from `infra/terraform` | Passed. |

The browser suite first detected the intentional privacy-notice text change against the old 1920px snapshot. The rendered result was inspected, the snapshot was refreshed, and the complete browser suite then passed. The PR Actions run after pushing the remediation is the remaining CI check; Terraform planning and authorized production verification remain release gates.

## Version 1 history

V1 was manually deployed in an older AWS project that is now closed. Its 2026-10-30 tests and observations are historical; they are not proof of current V2 behavior. See [architecture](architecture.md) for the current system and V1 distinction.
