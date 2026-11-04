# Visitor counter integration

The V2 website calls an API Gateway HTTP API directly. The build-time setting `VITE_API_BASE_URL` contains the API base address, without `/visits`:

```text
https://kfpwu0cd7k.execute-api.ap-southeast-2.amazonaws.com
```

Vite embeds this value in the built JavaScript. For local development, copy `.env.example` to `.env.local` and set the value there. For production, the GitHub Actions workflow supplies it during the build.

## How the counter behaves

- On page load, the website sends one `POST /visits` and displays the returned count. React StrictMode effect replay shares the same in-flight registration.
- Lambda counts the source IP once per 24-hour window. It groups IPv6 addresses by `/64`, stores only an HMAC-SHA256 digest, and returns whether this request incremented the total.
- If POST fails, the website falls back to `GET /visits` to display the current count. **Retry** only repeats this GET.
- The POST is idempotent per IP and TTL window, so clients may safely retry it. The frontend does not automatically retry it.

This approximates unique public IPs per 24-hour window, not people. Shared NAT/CGNAT can undercount, while VPN or mobile IP rotation can overcount. Bots and crawlers that run JavaScript can be counted. The API remains public and unauthenticated, so it is not abuse protection.

The handler does not store or log raw IPs. HMAC hashes still raise privacy concerns and may remain personal data under some regimes. DynamoDB TTL deletes digest records after expiry, typically within 24–48 hours; the transaction checks `expires_at` so late TTL cleanup does not delay recounting.

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
