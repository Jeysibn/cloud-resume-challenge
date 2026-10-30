# Version 1 — Manual deployment runbook

**Scope:** Deploy the built React frontend to the *existing* private S3 bucket and CloudFront distribution. This procedure does not create AWS resources, modify Lambda/DynamoDB, or merge Git branches. It documents the successful 2026-10-30 manual rollout reported by the owner.

## Pre-flight

- Use the checked-out `feat/aws-react-migration` branch of `Jeysibn/cloud-resume-challenge`, based on the audited `c4be030` security commit or a subsequently validated commit.
- Keep a restorable copy of the currently published files/build **before** replacing them. Initial deployment retained the original static-site backups. For later deployments, also retain the full current React release artifact (HTML and matching hashed assets); restoring only an old `index.html` can break references to missing files.
- Confirm CloudFront points to `cloud-resume-lab-jeysibn` as the private S3 origin with OAC and Block Public Access still enabled. Confirm its default root object is `index.html`.
- Confirm `GET /visits` works when invoked by a browser opened from the live CloudFront origin. Do not send a POST merely to validate readiness.
- Confirm the real API Gateway base address is `https://10lm4byr49.execute-api.ap-southeast-2.amazonaws.com`. **Do not append `/visits`** to the build-time variable.

## Build locally

From the repository root:

```bash
git switch feat/aws-react-migration
git pull --ff-only origin feat/aws-react-migration
cd frontend/app
npm ci
```

Create or verify the ignored `.env.local` file:

```dotenv
VITE_API_BASE_URL=https://10lm4byr49.execute-api.ap-southeast-2.amazonaws.com
```

This is a public endpoint. **Never** put AWS access keys, IAM credentials or other secrets in `VITE_*` variables.

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm run test:metadata
npm run perf:budget
```

Playwright checks can be run locally as configured in `package.json` and may require the Chromium browser dependencies. Run them before changing the production bucket, or record why they could not run. The documented release validation was 58 unit tests and 46 browser checks with 14 viewport-specific skips.

Confirm `dist/index.html`, `dist/assets/`, `dist/resume.pdf` and `dist/social-preview.png` exist. Inspect the generated bundle to ensure the intended API base is embedded. The `dist/` directory is the **deployment artifact**; do not upload the source `src/` tree or local `.env.local` file.

## Upload using the AWS Console

1. Open **S3 → Buckets → `cloud-resume-lab-jeysibn` → Objects** and navigate to the **bucket root**.
2. Upload the **contents** of `frontend/app/dist/`, not a parent folder named `dist`. Preserve paths including `assets/` and `architecture/`.
3. Upload new versioned/hash-named JS/CSS assets and all other generated assets **first**. Never delete the prior assets while they may still be referenced by cached HTML.
4. Upload `index.html` **last**, replacing the root object. Do not remove Block Public Access, change bucket ACLs, or make files public.
5. Check each object's content type: HTML as `text/html`, CSS as `text/css`, JS as `text/javascript` or `application/javascript`, and PDF as `application/pdf`.

Recommended cache headers (subject to actual CloudFront cache-policy behavior): use `no-cache, max-age=0, must-revalidate` on `index.html`; use `public, max-age=31536000, immutable` only on content-hashed static assets; use conservative caching on unversioned files such as `resume.pdf` and social images. Record the **actual** cache policy when inspected in the Console.

## Invalidate CloudFront

1. Open **CloudFront → Distributions**, select the existing distribution for `d31yy7ezo2w9ph.cloudfront.net`.
2. Under **Invalidations**, create a one-time invalidation for `/*` (suitable for the first full migration).
3. Confirm the invalidation reaches **Completed** before judging the public result.

Invalidation requests cannot be canceled. For routine future releases, consider narrower paths and versioned asset filenames rather than automatically invalidating everything.

## Production verification

Using a browser and DevTools Network/Console on `https://d31yy7ezo2w9ph.cloudfront.net/`:

- Homepage and assets (HTML, JS, CSS), resume PDF, and project architecture diagrams load without unexpected 403/404 errors or MIME-type failures.
- Navigation, theme, dialogs, download and direct query link `/?project=monikey` work.
- `GET https://10lm4byr49.execute-api.ap-southeast-2.amazonaws.com/visits` returns HTTP 200 and valid `{"count": number}` without a CORS error.
- A homepage refresh does **not** automatically send `POST /visits`.
- Source page metadata resolves to the CloudFront canonical URL and social image.
- In AWS Console, confirm S3 remains private and CloudFront's OAC is intact.

Do **not** repeatedly test POST just to see a changing number: it alters real DynamoDB data. The single controlled POST test was already performed from local React and increased the count 7 → 8.

## Rollback

If the new release is blank, lacks assets or breaks critical interactions:

1. Preserve the failing request URLs, Console errors, affected commit and deployment time.
2. Re-upload the saved **previous matching release** files, including its `index.html` and all JS/CSS assets referenced by that HTML. If rolling back to the initial three-file static website, use that complete backup instead. S3 versioning status is not yet documented; do not assume version recovery is enabled.
3. Keep required old assets available; avoid indiscriminate deletion.
4. In CloudFront, invalidate `/*` and verify the restored homepage, assets and read-only counter.
5. Record the incident and fix in Git before trying another deployment.

## Unverified settings to record in Console

S3 versioning; CloudFront distribution ID, origin/cache policies and response headers; API Gateway exact authorization/throttling; Lambda memory/timeout/runtime/IAM; DynamoDB billing mode; current CloudWatch retention/alarms; cost alert notification. Do not fill these values with assumptions.

See [architecture](architecture.md) and [validation record](validation.md).
