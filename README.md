# AWS Cloud Resume Challenge

**Version 1: live, manually deployed AWS portfolio.** This project migrates a React + TypeScript portfolio to AWS and adds a serverless, persistent, click-to-record visitor counter.

**Live website:** https://d31yy7ezo2w9ph.cloudfront.net/

## Architecture

```text
Browser ── HTTPS ── CloudFront ── OAC ── private S3 (React build)
   │
   └── HTTPS GET /visits; explicit POST /visits
           │
       API Gateway (HTTP API)
           │
       Python Lambda
           │
       DynamoDB (recorded visits)
```

The React app is built with Vite and deployed from `frontend/app/dist/` to the **root** of `cloud-resume-lab-jeysibn`, with CloudFront cache invalidation performed manually. API calls use the public, build-time `VITE_API_BASE_URL` value. The serverless counter stores recorded actions, **not unique people**. Opening the homepage only reads the count; clicking **Record My Visit** explicitly requests a single increment.

## What is complete

- Manual provisioning of a private S3 origin behind CloudFront OAC, with HTTPS delivery.
- API Gateway routes `GET /visits` and `POST /visits`, backed by Python Lambda and DynamoDB.
- React portfolio synced from the original portfolio's `main`, including the portfolio content, project dialogs, architecture diagrams and resume PDF.
- Frontend integration with AWS counter, error handling, read-only retry and explicit POST.
- Local API checks, a controlled local POST (observed count 7 → 8), and user-reported production functional/network smoke tests.
- Local automated frontend tests, performance budget, metadata verification, and dependency security review.
- Manual build, S3 upload, CloudFront invalidation and rollback preparation.

**Version 1 does not include AWS Terraform infrastructure as code or GitHub Actions deployment automation.** Those are planned for Version 2. Azure descriptions in the portfolio are clearly marked as history for a separate earlier system.

## Repository

- `frontend/app/` — React/TypeScript/Vite frontend; see `AWS-INTEGRATION.md` for application integration.
- `backend/lambda/lambda_function.py` — original recovered Python handler.
- `backend/README.md` — runtime, configuration, mocked tests and manual deployment.
- `backend/source-provenance.json` — supplied ZIP and source hashes; live equivalence limits.
- `content/portfolio.json` — portfolio content.
- `docs/architecture.md` — AWS components, data flow, trust boundaries and unverified Console settings.
- `docs/deployment-runbook.md` — manual build, upload, invalidation, verification and rollback.
- `docs/validation.md` — test evidence and its limitations.
- `frontend/app/DEPENDENCY-SECURITY-REVIEW.md` — point-in-time npm audit and fixes.

## Local development

```bash
cd frontend/app
npm ci
cp .env.example .env.local
# Fill in VITE_API_BASE_URL with the existing API Gateway invoke URL, excluding /visits.
npm run dev
```

Example base URL for this project:

```dotenv
VITE_API_BASE_URL=https://10lm4byr49.execute-api.ap-southeast-2.amazonaws.com
```

The URL is public. **Never store AWS credentials in Vite frontend environment variables.** A production build requires the same setting before running `npm run build`.

For validation:

```bash
npm run validate:ci
npm run test:metadata
npm audit
npm audit --omit=dev
```

The browser suite may need Playwright browser dependencies installed. `test:metadata` reads `dist/index.html`, so run it after the production build.

## Manual deployment

1. Confirm a restorable backup of the previously published website and current privacy/OAC settings.
2. Build locally with the correct API URL; verify `dist/index.html` and required assets.
3. Upload the contents of `dist/` to the **bucket root**: assets first and `index.html` last. Never make S3 public.
4. Invalidate `/*` in the existing CloudFront distribution, then perform browser/network smoke tests.
5. Preserve previous release assets and the deployment evidence for rollback.

See the detailed [deployment runbook](docs/deployment-runbook.md).

## Status and evidence

On 2026-10-30 the owner reported a working live React site, successful asset requests, CloudFront-origin GET and all six functional smoke tests. The deliberate POST/DynamoDB increment was verified earlier from the local React app; the live CloudFront site was not used to send a new deliberate POST during smoke testing. Codex reported 58 unit tests and 46 browser checks passing, with 14 viewport-specific skips. Detailed limits are documented in [validation](docs/validation.md).

## Next

1. Record unverified AWS Console settings in the documentation (without exposing secrets).
2. Review and merge the Version 1 migration/documentation branch after approval.
3. Begin Version 2 by implementing Terraform and CI/CD as separate, reviewable changes while keeping the manually deployed Version 1 site working.

## Recovered backend source

The owner-supplied Lambda ZIP was recovered byte-for-byte into
[backend/lambda/lambda_function.py](backend/lambda/lambda_function.py), preserving
GET, explicit POST, DynamoDB calls and existing error behavior. Python 3.14 is
owner-confirmed. See the [backend guide](backend/README.md) for the exact API
contract and provenance limits: the owner subsequently confirmed that API Gateway invokes `$LATEST` and its AWS
`CodeSha256` exactly matched the supplied ZIP fingerprint on 2026-10-30. This is
owner-reported proof of package equality at the time of verification; AWS config
was not independently accessed.

Run offline tests from the repository root:

```sh
python3 -m unittest discover -s backend/tests -v
```

All 13 backend tests and 58 frontend tests passed during recovery. No live API
request, AWS update or deployment was performed for this recovery milestone.
