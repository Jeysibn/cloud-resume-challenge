# Visitor counter integration

The V2 website calls an API Gateway HTTP API directly. The build-time setting `VITE_API_BASE_URL` contains the API base address, without `/visits`:

```text
https://kfpwu0cd7k.execute-api.ap-southeast-2.amazonaws.com
```

Vite embeds this value in the built JavaScript. For local development, copy `.env.example` to `.env.local` and set the value there. For production, the GitHub Actions workflow supplies it during the build.

## How the counter behaves

- On page load, the website sends `GET /visits` to read the current count.
- It sends `POST /visits` only after the visitor clicks **Record My Visit**.
- A successful POST is followed by GET so the page displays the latest count.
- Failed reads can be retried. POST is not retried automatically because the server may already have incremented the count.

The counter counts recorded clicks, not unique visitors. The click lock helps prevent accidental repeated clicks in one page view; it is not authentication or abuse protection.

## Local checks

From `frontend/app`:

```bash
npm ci
cp .env.example .env.local
# Set VITE_API_BASE_URL in .env.local.
npm run typecheck
npm run lint
npm test -- --run
```

Unit tests mock API responses. They check the frontend's behavior but do not call AWS. A browser GET check against the live API is read-only; a POST changes the real DynamoDB count.

API Gateway is configured to allow the live CloudFront site and GET/POST. CORS tells browsers which site origins may read responses; it does not protect the public API from scripts or other non-browser callers. Never put AWS keys, tokens, or other secrets in `VITE_*` variables.

To publish frontend changes, use the manual GitHub Actions process in the [deployment guide](../../docs/deployment-runbook.md). The retired V1 API and AWS project are not used by this integration.
