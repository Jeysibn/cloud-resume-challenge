# AWS visitor counter: Mission 5.3.1

This milestone changes only the frontend. No AWS resources were provisioned, changed, or deployed.

## Contract to confirm before deployment

The user supplied GET /visits (read only) and POST /visits (atomic increment).
Recovered source is now version-controlled in `../../backend/lambda/lambda_function.py`.
It confirms GET returns JSON `{ "count": 42 }` and POST does not require a body.
POST success returns `{ "message": "Visitor counter incremented", "count": 43 }`;
the client ignores that body and refreshes with GET. The frontend requires a
nonnegative safe integer. The backend converts with int() but does not enforce
that range, so valid stored count data remains a requirement. See
[backend recovery and provenance](../../backend/README.md). Live deployment
matching, gateway/CORS behavior and actual stored values remain unverified.

The counter counts recorded actions, not unique visitors. There is no POST on mount.
One POST attempt is allowed per mounted counter, including after failure. Reloading
allows another action; this is accidental double-click protection, not uniqueness
or abuse protection. Failed POSTs are never retried automatically. Retry only reads.
Aborting a POST on unmount does not undo an increment already processed by Lambda.

## Manual configuration and verification (later, by the owner)

1. In AWS Console, open API Gateway, select the existing HTTP API, and inspect
   Routes. Confirm GET /visits and POST /visits target the existing Lambda integration.
   Do not create replacement infrastructure for this milestone.
2. Open Stages and copy the real invoke URL. Include a named stage if used; a
   $default stage has no stage path. Do not append /visits to the environment value.
3. In the API's CORS settings, allow the exact frontend origin (scheme and hostname,
   no path), including the CloudFront hostname and custom hostname actually used.
   Allow GET and POST. For local integration testing, add the actual localhost
   origin temporarily. This client sends no credentials or custom headers. API
   Gateway handles preflight automatically when HTTP API CORS is configured.
   If a $default route has authorization, check AWS's OPTIONS guidance below.
4. Confirm the deployed stage contains the routes (deploy manually if auto-deploy
   is disabled). Confirm public browser access is intended; frontend environment
   variables cannot securely hold API keys, tokens, or AWS credentials.
5. Locally copy `.env.example` to `.env.local`, set VITE_API_BASE_URL to that invoke
   URL, then run `npm run build` in frontend/app. Vite embeds this public setting
   at build time; changing AWS settings alone cannot update an existing bundle.
6. Before publishing, open the app against the real API. Verify initial GET leaves
   the stored count unchanged. Click Record My Visit once and verify one POST and
   a GET refresh. Check CORS and errors in browser Network tools and existing
   CloudWatch logs. A lost POST response must never cause an automatic retry.
7. When separately authorized to publish, upload the contents of frontend/app/dist
   to the existing private S3 origin through the Console. Preserve OAC and public
   access blocking. Use index.html with short/no cache and hashed assets with long
   cache. In CloudFront, invalidate /index.html (and / if cached) after uploading.
   No upload or invalidation was performed in this milestone.

AWS CORS reference: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html

## Remaining information and content review

The invoke URL has been supplied in ignored local configuration. Still unverified:
allowed frontend origins, authorization requirements, actual counter data,
source-to-live deployment matching, and live integration behavior. GET JSON and
body-free POST support are confirmed against the recovered source.
No real API calls were made. The production build without configuration intentionally
shows an unavailable state.

Canonical content/portfolio.json now follows portfolio main at the source commit
below. The cloud-portfolio case study is explicitly labeled as historical Azure
work; its original infrastructure descriptions and diagrams remain project history.
AWS Terraform and CI/CD are explicitly not implemented. Other personal facts and
project histories follow the supplied source of truth.

## Changed implementation

- src/api.ts: public configurable URL, GET validation, explicit POST, controlled errors.
- src/components/VisitorCounter.tsx: independent state, GET retry, POST lock, cancellation.
- App.tsx and SiteChrome.tsx: remove assistant and health UI; preserve navigation/theme.
- styles.css: small footer layout adjustment and disabled-button styling.
- Unit/UI tests: replace obsolete assistant request checks with removal and counter checks.
- .env.example: public build-time API configuration only.

## Local validation

- npm ci: passed; audit reported 7 existing dependency vulnerabilities (2 moderate,
  5 high). Dependency upgrades were not included in this milestone.
- Typecheck, lint, 54 unit tests, production build, and bundle budget passed.
- Browser suite runs against this build on isolated port 4187. The default 4173
  port had an unrelated existing server; its initial results were discarded.
- The repository shipped without the hero screenshot baseline. A baseline was
  generated from this build, visually inspected, and committed for future runs.
- Desktop hero and mobile footer were visually inspected; the counter button uses
  independent styles so the header's mobile icon-only rule cannot hide its text.
- No AWS integration, deployment, or CloudWatch validation was performed.
- Final browser run: 40 passed, 14 existing viewport-specific skips, zero failures.

## Corrected frontend source

Source: Jeysibn/portfolio main, commit 80c616efcec37027671f30849ec28245058dd9ab.
Imported by file comparison, without merging repository histories. Synced sections,
Contact layout, direct resume PDF links, legacy-anchor handling, dialog history fix,
canonical MoniKey content, application/database/GitOps SVGs, related tests and source
hero baseline. Public resume and other unchanged assets match the source already.
The obsolete MoniKey system/delivery SVGs were removed to match source main.

The AWS api.ts, VisitorCounter.tsx, their unit tests and .env.example remain byte-for-byte
identical to c81e541. Source Azure assistant, health UI, API configuration and publish
script were excluded. The ignored local .env.local is preserved. No live POST was
sent during validation; browser tests intercept /visits with a fixture.

Correction validation: typecheck, lint, 55 unit tests, production build and performance
budget passed (79.3 KiB gzip JavaScript against 180 KiB). Public assets were compared
byte-for-byte against source main. Mobile light and desktop dark Contact/footer
were visually inspected. The source hero baseline changed only to remove the
unavailable assistant; the screenshot comparison was rerun afterward.
Final browser suite: 46 passed, 14 existing viewport-specific skips, zero failures.

## Release verification update — 2026-10-30

The owner reported successful live `GET /visits` (local and CloudFront-origin browser), one deliberate successful local `POST /visits` incrementing DynamoDB from 7 to 8, and a production read-only smoke test. They also reported API Gateway's unqualified `$LATEST` Lambda target and an exact deployed `CodeSha256` match with the recovered ZIP. This establishes the backend source package at the time of inspection based on owner-supplied AWS evidence; no new production POST was performed and AWS settings were not independently accessed in this repository review. This section supersedes earlier milestone statements that live integration and package matching were not yet tested.
