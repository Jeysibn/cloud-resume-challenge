# Version 1 — Validation record

**Release validation date:** 2026-10-30. This is a record of user-reported hands-on checkpoints and Codex-reported local tests, not a repeat of those tests by this documentation commit.

## Frontend and dependency checks

- Release source: `feat/aws-react-migration`, security-reviewed commit `c4be030` prior to these documentation changes.
- Frontend was synchronized from `Jeysibn/portfolio:main` at `80c616efcec37027671f30849ec28245058dd9ab`, with Azure-specific runtime features replaced by AWS visitor integration.
- Codex reported: clean `npm ci`, typecheck, lint, 58 unit tests, successful production build, built HTML metadata check, performance budget, and 46 passing Playwright browser checks (14 viewport-specific skips).
- Audit report: `frontend/app/DEPENDENCY-SECURITY-REVIEW.md`. Codex reported 7 development-tool package entries before patching and zero after; `npm audit --omit=dev` also reported zero before/after. An audit is point-in-time, not a guarantee of no vulnerabilities.
- `VITE_API_BASE_URL` was configured locally as `https://10lm4byr49.execute-api.ap-southeast-2.amazonaws.com`; it is a public URL, not a credential.
- The frontend's social, canonical and structured-data metadata were updated for the CloudFront domain. The historical Azure project remains explicitly historical.

## User-reported real AWS integration checks

| Checkpoint | Reported result | Limitation |
| --- | --- | --- |
| API Gateway routes | `GET /visits` and `POST /visits` exist | Route settings/IAM not independently audited |
| Direct GET | HTTP 200, `{"count":7}` | Snapshot; count can change |
| Local React with CORS | Successful read of the count | Confirms local browser origin, not all possible origins |
| Controlled local POST | 2xx; count 7 → 8; DynamoDB item confirmed as 8 | One deliberate action; not concurrency/abuse testing |
| CloudFront-origin GET | HTTP 200 with count JSON | No deliberate POST from production CloudFront origin |
| Manual upload | S3 upload successful; CloudFront `/*` invalidation completed | No AWS deployment automation |
| Public React site | New React app loads from CloudFront | Confirmation reported by user |
| Production smoke checks | 6/6: homepage/design, navigation/theme/dialogs, MoniKey diagrams, PDF download, `/?project=monikey`, browser Console | User-reported result |
| Network smoke checks | HTML, JS, CSS, resume and API GET HTTP 200 | User-reported result |
| Origin protection | Private S3, OAC, default root object and rollback backup confirmed | Actual policy documents not stored in repo |
| Live backend source provenance | Owner confirmed API Gateway invokes unqualified Lambda / `$LATEST` and AWS `CodeSha256` exactly equals the recovered deployment ZIP SHA256 (Base64) on 2026-10-30 | AWS control-plane output not independently fetched; fingerprint only establishes package at time checked |

The user explicitly reported **no deliberate production POST** during deployment smoke testing. Live GET and local POST tests were separate. Do not claim unique-visitor detection, load testing, automatic release delivery, end-to-end authorization verification, or production POST verification.

## Re-run after changing application files

From `frontend/app`:

```bash
npm ci
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm run test:metadata
npm run perf:budget
npm run test:ui
npm audit
npm audit --omit=dev
```

Browser checks require Playwright prerequisites and a correctly configured local test setup; see `package.json`. Tests that mock `/visits` do **not** verify live API behavior.

## Operational follow-up

- Capture actual Console screenshots or redacted configuration notes for S3 versioning, OAC policy, cache policy, API authorization/throttling, Lambda runtime and execution role, DynamoDB billing mode, CloudWatch retention, and billing alerts.
- Confirm CloudWatch log inspection and alert routing; the current record does not establish they were checked during the final deployment.
- Keep the previous build for rollback.
- Release documentation should be reviewed and merged into `main` only after the user approves. Terraform and automated deployment are **Version 2**, not yet implemented.

See [architecture](architecture.md), [manual deployment runbook](deployment-runbook.md), and [security report](../frontend/app/DEPENDENCY-SECURITY-REVIEW.md).
