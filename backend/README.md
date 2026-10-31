# Backend guide

The live V2 visitor counter uses a Python Lambda function and DynamoDB. The handler source is [`lambda-v2/lambda_function.py`](lambda-v2/lambda_function.py); Terraform creates the Lambda and its execution role.

## What the handler does

API Gateway sends HTTP API events to `lambda_function.lambda_handler`.

- `GET /visits` reads the item whose key is `id = visitors` and returns its count. It does not change the count.
- `POST /visits` adds one to the existing count in a single DynamoDB update, so simultaneous clicks do not overwrite each other's increments. It returns the new count.
- If the item is missing, GET returns 404. POST only updates an existing item; it does not create one.
- Other methods return 405. AWS SDK or bad-data errors are allowed to reach API Gateway; the handler does not create its own 500 response.

The table name comes from the Lambda environment variable `TABLE_NAME`. Terraform sets it to `cloud-resume-v2-visitor-counter`. The counter item is initialized separately from Terraform.

## Run tests and rebuild the ZIP

From the repository root:

```bash
python3 -m unittest discover -s backend/tests -v
python3 backend/lambda-v2/package.py
```

The 4 V2 tests mock boto3, so they do not need AWS credentials or contact AWS. The packaging script creates `backend/lambda-v2/function.zip` with `lambda_function.py` at the archive root and verifies the ZIP. The ZIP is generated locally and ignored by Git. Rebuild it after editing the handler and before running Terraform plan or apply.

## Version 1 source history

`lambda/lambda_function.py` is the recovered handler from the retired V1 deployment. It remains here as historical source; V2 uses the separate `lambda-v2/` handler. The V1 source and ZIP provenance are recorded in [`source-provenance.json`](source-provenance.json). The old AWS project is closed, and this source is not the deployed V2 Lambda.
