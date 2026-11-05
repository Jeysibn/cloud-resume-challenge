# Validation record

This page records which checks passed and what they covered. Local checks below were recorded on November 4, 2026. They do not confirm that the current visitor-counter code works in live AWS.

## Local checks recorded on November 4, 2026

The checks ran from the repository root unless a command changes directories:

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

Recorded results:

| Check | Result |
| --- | --- |
| Backend unit tests | Passed: 27 tests, including V1 source tests; AWS calls were mocked |
| Python compilation and Lambda ZIP packaging | Passed; the ZIP contained `lambda_function.py` at its root |
| Frontend typecheck and lint | Passed |
| Frontend unit tests | Passed: 73 tests across 16 files |
| Frontend production build | Passed |
| Terraform format check and validation | Passed |

The frontend and backend tests used mocks and did not update AWS. Terraform validation checked the configuration but did not deploy it. These results are a dated snapshot, so rerun the checks for the current source before relying on them.

## Live AWS evidence from November 1, 2026

These live checks tested the previous button-based counter. They do not verify the current automatic registration, IP-based deduplication, or TTL behavior. The current counter change has not been smoke-tested against AWS in this record.

The historical test opened [jeysibn.dev](https://jeysibn.dev), clicked **Record My Visit**, observed the count increase from 1 to 2, and refreshed the page. The test also checked the DynamoDB item and CloudWatch request record. It changed the production counter and is evidence for the old behavior only.

![Portfolio footer showing a recorded visit](images/testing/visitor-counter-frontend.jpg)

![CloudWatch record for a successful POST /visits request](images/testing/api-post-visit-response.png)

![DynamoDB visitor counter item](images/testing/dynamodb-visitor-count.png)

## Dependency audit recorded on November 1, 2026

The recorded `npm audit` reported 12 moderate findings in development dependencies. `npm audit --omit=dev` reported none in production dependencies. Advisory data changes over time; see the [dependency security check](../frontend/app/DEPENDENCY-SECURITY-REVIEW.md) for commands to run a fresh audit.

## Version 1 history

V1 was manually deployed in an AWS project that is now closed. Its tests and observations are historical and do not describe the current V2 system. See the [architecture guide](architecture.md) for the distinction between V1 and V2.
