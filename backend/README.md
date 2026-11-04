# Backend guide

The live V2 visitor counter uses a Python Lambda function and DynamoDB. The handler source is [`lambda-v2/lambda_function.py`](lambda-v2/lambda_function.py); Terraform configures the Lambda, its execution role, and the table TTL.

## What the handler does

API Gateway sends HTTP API events to `lambda_function.lambda_handler`.

- `GET /visits` reads `id = visitors` consistently and returns `{"count": n}`. It does not change the count.
- `POST /visits` reads the source IP supplied by API Gateway, validates it, and stores only an HMAC-SHA256 digest. IPv6 addresses are grouped by `/64`.
- One DynamoDB transaction writes the digest item with its expiry and increments the existing counter. Its condition checks `expires_at` against the current time, so a delayed DynamoDB TTL deletion does not block a later visit.
- A repeat request from the same IP (or IPv6 `/64`) during the window returns `{"counted": false, "count": n}`. A newly counted IP returns `{"counted": true, "count": n}`. The default window is 24 hours.
- The counter item is initialized separately from Terraform. If it is missing, GET and POST return 404; the transaction cannot leave an IP record behind when the counter update fails.
- Missing or invalid API Gateway `sourceIp` returns 400. Other methods return 405. Unexpected AWS SDK errors propagate to API Gateway.

The table name is supplied by `TABLE_NAME`. `IP_HASH_SECRET` is required at Lambda startup and must remain the same across deployments; Terraform state and Lambda configuration contain it. `VISIT_TTL_SECONDS` is a positive integer and defaults to `86400`. Terraform enables TTL on `expires_at`; DynamoDB removes expired records asynchronously, usually within 24–48 hours, while the request condition enforces the configured window immediately.

## Counting limits and privacy

This is an approximate portfolio metric. People behind shared NAT or carrier-grade NAT may be counted as one visitor. VPN changes and mobile IP rotation can count one person more than once. Bots and crawlers that run JavaScript can be counted. The API remains public and unauthenticated, so it is not abuse protection.

Raw IP addresses are not stored or logged by this handler. HMAC hashing reduces exposure but does not remove privacy concerns: hashed IPs may still be personal data under some regimes. DynamoDB TTL removes the digest records after expiry, with deletion commonly delayed by 24–48 hours.

## Run tests and rebuild the ZIP

From the repository root:

```bash
python3 -m unittest discover -s backend/tests -v
python3 -m py_compile backend/lambda-v2/lambda_function.py backend/lambda-v2/package.py
python3 backend/lambda-v2/package.py
```

The V2 tests mock boto3, so they do not need AWS credentials or contact AWS. The packaging script creates `backend/lambda-v2/function.zip` with `lambda_function.py` at the archive root and verifies the ZIP. The ZIP is generated locally and ignored by Git. Rebuild it after editing the handler and before Terraform plan or apply.

## Version 1 source history

`lambda/lambda_function.py` is the recovered handler from the retired V1 deployment. It remains here as historical source; V2 uses the separate `lambda-v2/` handler. The V1 source and ZIP provenance are recorded in [`source-provenance.json`](source-provenance.json). The old AWS project is closed, and this source is not the deployed V2 Lambda.
