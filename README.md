# AWS Cloud Resume Challenge

**Version 2 is the active deployment.** It runs in AWS account `665514296439` in `ap-southeast-2` and is managed with Terraform. The portfolio is live at [d1ezqc8d2heo4m.cloudfront.net](https://d1ezqc8d2heo4m.cloudfront.net/).

Version 1 was provisioned manually in an older AWS project. That project was closed; Version 1 is historical and is not the live environment.

## Architecture

```text
Visitor browser
  ├── HTTPS ── CloudFront ── OAC ── private S3 bucket (React build)
  └── HTTPS ── API Gateway HTTP API ── Python Lambda ── DynamoDB
```

CloudFront serves the static frontend from a private S3 origin using Origin Access Control (OAC). The browser calls the HTTP API directly: `GET /visits` reads the counter and the user’s explicit **Record My Visit** action sends `POST /visits` to increment it. The count represents recorded actions, not unique visitors. Terraform provisions the website bucket, CloudFront distribution, API, Lambda, DynamoDB table, IAM roles and policies, and CloudWatch log groups. The DynamoDB counter item is initialized separately from Terraform.

| Component | V2 deployment |
| --- | --- |
| Account and region | `665514296439`, `ap-southeast-2` |
| Portfolio | [https://d1ezqc8d2heo4m.cloudfront.net/](https://d1ezqc8d2heo4m.cloudfront.net/) |
| Website bucket | `cloud-resume-v2-website-665514296439-ap-southeast-2` (private) |
| Visitor API | `https://kfpwu0cd7k.execute-api.ap-southeast-2.amazonaws.com` |
| Visitor table | `cloud-resume-v2-visitor-counter` |
| Infrastructure state | S3 bucket `cloud-resume-tfstate-665514296439-ap-southeast-2`, key `cloud-resume-challenge/v2/terraform.tfstate` |

The frontend’s `VITE_API_BASE_URL` is public configuration embedded at build time; it must never contain AWS credentials or secrets.

## Technology

- **Frontend:** React, TypeScript, Vite, CSS, and Vitest.
- **Static hosting:** private Amazon S3, CloudFront, and OAC.
- **Backend:** API Gateway HTTP API, Python 3.14 Lambda, and DynamoDB.
- **Infrastructure:** Terraform with the AWS provider pinned to `6.71.0` in the provider lockfile.
- **Delivery:** GitHub Actions runs checks on pull requests. A manual dispatch on `main` builds the frontend, then deploys the artifact using GitHub OIDC and a restricted IAM role. No long-lived AWS keys are stored in GitHub.

## Repository map

- `frontend/app/` — React portfolio, tests, build scripts, and public API configuration.
- `backend/lambda-v2/lambda_function.py` — V2 Lambda handler.
- `backend/lambda-v2/package.py` — deterministic local builder for the ignored Lambda ZIP.
- `backend/tests/test_lambda_v2.py` — V2 handler contract tests using mocked DynamoDB access.
- `infra/terraform/` — V2 backend, provider, resources, outputs, and GitHub Actions IAM role.
- `infra/terraform/.terraform.lock.hcl` — tracked provider version and checksums; keep this file in source control.
- `.github/workflows/deploy-v2.yml` — pull request CI and manually triggered V2 frontend deployment.
- `docs/architecture.md` — current V2 architecture and historical V1 record.
- `docs/deployment-runbook.md` — archived manual V1 procedure; not the current deployment path.
- `docs/validation.md` — historical V1 validation record and its limits.

## Local development and validation

```bash
cd frontend/app
npm ci
cp .env.example .env.local
```

Set the public V2 API base URL in the ignored `.env.local` file:

```dotenv
VITE_API_BASE_URL=https://kfpwu0cd7k.execute-api.ap-southeast-2.amazonaws.com
```

Run the frontend checks and build:

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm run test:metadata
npm run perf:budget
```

Run the V2 Lambda contract tests from the repository root:

```bash
python3 -m unittest discover -s backend/tests -v
```

The Lambda ZIP is generated locally and is intentionally ignored by Git. Rebuild it from the V2 handler before Terraform planning or deployment:

```bash
python3 backend/lambda-v2/package.py
```

The packager writes `backend/lambda-v2/function.zip` with the handler at the ZIP root and verifies the archive contents and checksum. Do not commit the ZIP, caches, state, or saved plans.

## Terraform workflow

Terraform uses a separate S3 state key for V2. It must never be initialized with, migrated from, or reused for the closed Version 1 account’s state. Use a non-root profile for account `665514296439` and verify its identity before planning.

```bash
cd infra/terraform
export AWS_PROFILE=cloud-resume-admin
export AWS_DEFAULT_REGION=ap-southeast-2
aws sts get-caller-identity

cd ../..
python3 backend/lambda-v2/package.py
cd infra/terraform
terraform init -reconfigure
terraform fmt -check
terraform validate
terraform plan -input=false -out=.terraform/v2.tfplan
terraform show -no-color .terraform/v2.tfplan
```

Review every plan before applying it. `.gitignore` excludes Terraform working directories, state, plans, variable files, and crash logs. Keep `.terraform.lock.hcl` tracked so provider selection remains reproducible.

## GitHub Actions deployment

The workflow at `.github/workflows/deploy-v2.yml` runs TypeScript checks, lint, unit tests, and a production build for pull requests to `main`; its AWS deployment job is skipped for pull requests. To deploy, manually dispatch the workflow on `main`. It passes the tested build between jobs as an artifact and assumes `cloud-resume-v2-github-actions-deploy` through OIDC. That role is restricted to the repository’s `main` branch and permits listing/uploading objects only in the V2 website bucket plus invalidating the V2 CloudFront distribution. Deployment uploads assets first, uploads `index.html` last, and invalidates CloudFront. It does not use `--delete`.

The successful first OIDC deployment was GitHub Actions run [41213992608](https://github.com/Jeysibn/cloud-resume-challenge/actions/runs/41213992608).

## Project history and learning

Version 1 was manually provisioned in an earlier AWS Builder ID project to learn the AWS services and application data flow. That account has been closed. Version 2 recreates the portfolio architecture in the current standalone account using Terraform, with a dedicated remote state key and account guard. The V2 Lambda remains independently tested, while GitHub Actions now builds and deploys the static frontend using short-lived OIDC credentials.

This progression covers manual AWS resource setup, serverless API design, stateful DynamoDB operations, infrastructure as code, isolated Terraform state, least-privilege IAM, OIDC federation, CI checks, artifact handoff, and controlled frontend releases. Azure project descriptions in the portfolio refer to separate historical work.

## Further documentation

- [V2 architecture and V1 history](docs/architecture.md)
- [Validation record](docs/validation.md)
- [Historical V1 manual deployment runbook](docs/deployment-runbook.md)
- [V1 recovered backend notes](backend/README.md)
