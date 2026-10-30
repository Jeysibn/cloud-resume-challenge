# Recovered AWS visitor counter

`lambda/lambda_function.py` is the sole application file from the owner-supplied
`cloud-resume-visitor-function-e5069e4c-a19e-4f58-a58f-67be174ef055.zip`.
It was copied byte-for-byte, including whitespace; no production logic was edited.
Archive and source SHA-256 hashes are recorded in [source-provenance.json](source-provenance.json).
The ZIP, libraries, credentials and environment files are not committed.

## Runtime and dependencies

- Python **3.14**, confirmed by the repository owner. Local tests used Python 3.14.4.
- Handler: **`lambda_function.lambda_handler`**, derived from the source. The current
  AWS handler setting was not independently inspected.
- Standard-library `json` plus `boto3` for DynamoDB. The archive contains no SDK,
  dependency manifest or layer information. AWS Python runtimes include boto3;
  the actual deployed SDK version and any layers remain unverified.
- No dependency versions were invented or bundled during recovery. No pip install
  is necessary for the tests below. For real local execution, boto3 and AWS SDK
  region/credential resolution would be required; that is deliberately outside
  these mocked tests. Never commit AWS credentials.
- The source reads no application environment variables. The table name is
  hardcoded; do not assume a TABLE_NAME setting will override it. Region and
  credentials are resolved by boto3 through the Lambda runtime/execution role.

AWS documents the [runtime SDK and ZIP packaging](https://docs.aws.amazon.com/lambda/latest/dg/python-package.html)
and [module.function handler naming](https://docs.aws.amazon.com/lambda/latest/dg/python-handler.html).
Although AWS recommends packaging dependencies for version control of the SDK,
this recovery preserves the supplied package's dependency strategy. Changing it
requires a separate, tested change after confirming the deployed runtime/layers.

## Existing configuration requirements

These are requirements inferred from the source, not resources created here:

- DynamoDB table `cloud-resume-visitor-counter`, with string key `id`.
- Existing item `{ "id": "visitors", "count": <number> }`. GET returns 404 when
  absent; POST requires an existing item and numeric count, and does not initialize it.
- Execution role permits `dynamodb:GetItem` and `dynamodb:UpdateItem` on that table.
  Existing CloudWatch logging permissions/configuration are external to the ZIP.
- API Gateway HTTP API events with `requestContext.http.method` (payload v2 shape).
  The handler does not inspect the path; API Gateway owns routing GET/POST `/visits`.
- API Gateway CORS for the intended frontend origins. The Python responses contain
  no CORS or Content-Type headers; actual gateway response behavior is not encoded
  in this source. OPTIONS sent to this handler returns 405.
- Actual function name, AWS region, role ARN, timeout, memory, architecture, layers,
  gateway mappings and authorization must be confirmed from the existing Console
  configuration. The ZIP does not establish them.

## Exact handler contract

Bodies below are JSON strings inside the Lambda proxy response. No headers or
`isBase64Encoded` property are added by this handler.

| Method / condition | Status | Decoded body / behavior |
| --- | --- | --- |
| GET, item exists | 200 | `{ "count": 42 }` |
| GET, item missing | 404 | `{ "error": "Visitor counter not found" }` |
| POST, existing item updated | 200 | `{ "message": "Visitor counter incremented", "count": 43 }` |
| Other/missing method | 405 | `{ "error": "Method not allowed" }` |
| DynamoDB failure, including conditional update failure | No handler response | Exception propagates; gateway-visible error is external configuration |
| Missing/malformed count | No handler response | Conversion/key exception propagates |

GET calls `get_item` with `ConsistentRead=True` and never writes. POST calls
`update_item` once with `SET #counter = #counter + :inc`, `:inc = 1`,
`attribute_exists(#pk)` and `ReturnValues="UPDATED_NEW"`. Request body is unused.
There is no application retry; boto3's runtime retry configuration is not specified
here. The atomic expression is preserved, but mocks do not prove live DynamoDB
concurrency behavior. Visits are actions, not unique visitors.

Both success branches convert stored values with `int()`. The backend does not
validate a nonnegative JavaScript-safe integer: negative values could pass through
and fractional numeric values would be truncated. The frontend intentionally
rejects negative or unsafe counts. Correct stored numeric data remains a requirement;
no data was read or altered during this recovery.

## Local tests

From the repository root:

```sh
python3 -m unittest discover -s backend/tests -v
```

The 13 tests inject a mocked boto3 module **before importing** the handler, so its
module-level DynamoDB initialization cannot resolve credentials or contact AWS.
They cover consistent read-only GET, zero/missing counters, exact POST expression
and response, body-free POST, unsupported/missing methods, SDK error propagation,
and malformed/missing counts. Errors are tested as they exist; no new 500 format
or recovery behavior was introduced. Python 3.14.4: **13 passed**, including a source-integrity hash check.

Frontend validation: `npm test -- --run` in frontend/app verifies the existing API
client and explicit-action component. Its GET JSON assumption is now confirmed
against this recovered source; POST ignores its body and safely refreshes via GET.
Non-2xx responses map to the existing unavailable/retry behavior. No live request
is needed for this contract comparison.

## Manual deployment procedure — future reference only

Recovery does not require deployment, and no deployment was performed.

1. In the existing Lambda's Console Code tab, download the current deployment
   package again and retain it privately as a rollback copy. Record the current
   handler/runtime, layers, role and API Gateway integration target/version/alias.
2. Compare the fresh package's `lambda_function.py` bytes/hash with the provenance
   record. If comparing AWS `CodeSha256`, it uses base64-encoded ZIP SHA-256; a
   newly repackaged ZIP may have different bytes even when the source is identical.
3. Only when a future code deployment is separately authorized, make a ZIP outside
   the repository containing `lambda_function.py` at the archive root. Match the
   existing package/dependency strategy and Python 3.14 settings; exclude tests,
   caches, documentation, local environments and credentials.
4. Upload that ZIP through the existing function's Code → Upload from → .zip file
   flow. Keep `lambda_function.lambda_handler` and existing configuration. If the
   gateway targets a published version or alias, follow the existing version/alias
   release process; updating $LATEST alone does not establish what it invokes.
5. Validate with read-only GET and existing logs. Do not run a POST test against
   production without explicit authorization, because it changes the counter.

## What is established

The local source **matches the supplied ZIP byte-for-byte**. That does not prove it
matches the function serving production now: the ZIP has no signed export record,
function configuration, export timestamp or deployed CodeSha256. Runtime 3.14 is
owner-confirmed; source-to-live equivalence requires a fresh trusted download or
AWS code/configuration evidence for the exact function/version used by API Gateway.
No AWS SDK calls, live GET/POST requests or infrastructure changes were performed.

Recovery validation also passed all 58 existing frontend tests and frontend
TypeScript checking. No frontend runtime code, build configuration, assets,
canonical content or environment configuration changed. A new frontend build or
browser run was not needed for this backend-source/documentation-only change.
