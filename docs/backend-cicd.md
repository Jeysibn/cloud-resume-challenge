# Backend CI and manual Lambda deployment (V2)

This is an entry-level learning project. GitHub checks backend changes on pull requests; backend deployment remains a manual Terraform operation.

## The flow

```text
Edit Python code → Open pull request → GitHub runs backend tests
       → Merge to main → Set IP_HASH_SECRET → Build Lambda ZIP
       → Review Terraform plan → Manually apply → Deploy frontend
```

The `Backend CI (Python 3.14)` job in `.github/workflows/deploy-v2.yml` runs Python tests without AWS, checks syntax, and builds the Lambda ZIP. The frontend continues to use its separate manual S3/CloudFront workflow.

Run the backend checks locally from the repository root:

```bash
python3 -m unittest discover -s backend/tests -v
python3 -m py_compile backend/lambda-v2/lambda_function.py backend/lambda-v2/package.py
python3 backend/lambda-v2/package.py
```

## Manual deployment order

Use this after merging the tested backend code into `main`. Use a clean local checkout, an authorized AWS identity for account `665514296439`, and region `ap-southeast-2`.

1. Confirm the branch and AWS identity:

   ```bash
   git status
   git branch --show-current
   aws sts get-caller-identity
   ```

2. Provide a stable secret to Terraform. For the first deployment only, generate it with OpenSSL and export it as the Terraform variable:

   ```bash
   export TF_VAR_ip_hash_secret="$(openssl rand -hex 32)"
   ```

   Save the generated value in an approved password manager before closing the shell. For every later deployment, restore that exact value as `TF_VAR_ip_hash_secret`; do not generate a new secret. Changing it makes existing IP digest keys unreachable until TTL removes them and lets those IPs be counted again.

   Do not commit the value or put it in a frontend `VITE_*` variable. Terraform's `sensitive = true` redacts routine CLI output; it does not remove the value from Terraform state or Lambda configuration. The configured S3 backend enables encryption and state locking, but access to the state bucket and Lambda configuration must still be restricted because authorized readers can retrieve the secret.

3. Run tests and build the deployment ZIP:

   ```bash
   python3 -m unittest discover -s backend/tests -v
   python3 -m py_compile backend/lambda-v2/lambda_function.py backend/lambda-v2/package.py
   python3 backend/lambda-v2/package.py
   ```

4. Review the Terraform plan:

   ```bash
   cd infra/terraform
   terraform init -reconfigure
   terraform plan -out=.terraform/lambda.tfplan
   terraform show .terraform/lambda.tfplan
   ```

   Expect only in-place changes to `aws_dynamodb_table.visitors` (enabling TTL for `expires_at`), `aws_iam_role_policy.lambda` (adding `dynamodb:PutItem`), and `aws_lambda_function.visitor` (environment variables and code ZIP). The existing `visitors` counter item is preserved. Stop if the plan proposes deleting, replacing, or changing unrelated resources.

5. Apply the reviewed plan:

   ```bash
   terraform apply .terraform/lambda.tfplan
   ```

6. Deploy the frontend after the backend using the manual V2 frontend workflow in the [deployment runbook](deployment-runbook.md).

7. From the same machine, send two POST requests to `https://kfpwu0cd7k.execute-api.ap-southeast-2.amazonaws.com/visits`. The first should return `counted: true`; the second should return `counted: false` with the same count. Confirm DynamoDB has an `ip#...` item with numeric `expires_at`. These requests change the live counter only once for that IP during the TTL window.

8. The read-only GET smoke check is:

   ```bash
   curl https://kfpwu0cd7k.execute-api.ap-southeast-2.amazonaws.com/visits
   ```

   It should return JSON with a `count` value. Check CloudWatch logs if the Lambda returns an error.

## Why Terraform updates Lambda

The `aws_lambda_function.visitor` resource in `infra/terraform/main.tf` points to the generated ZIP:

```hcl
filename         = "${path.module}/../../backend/lambda-v2/function.zip"
source_code_hash = filebase64sha256("${path.module}/../../backend/lambda-v2/function.zip")
```

Terraform updates the existing Lambda when the ZIP hash or environment changes. It does not need to rebuild API Gateway for this handler change.

## If something fails

- **GitHub CI fails:** Read the failed step and run its command locally.
- **`terraform init` or `plan` fails:** Verify AWS identity, access to the V2 state bucket, region, and `TF_VAR_ip_hash_secret`.
- **Terraform shows unexpected infrastructure changes:** Stop and investigate before applying.
- **API returns an error:** Check CloudWatch logs and confirm the deployed Lambda environment variables.

The API is public and unauthenticated. IP-based counts are approximate: shared NAT/CGNAT may undercount, VPN or mobile IP rotation may overcount, and bots that run JavaScript may be counted. HMAC hashing avoids storing raw IPs but hashed values may still be personal data under some regimes. DynamoDB TTL deletes the hash records after expiry, generally within 24–48 hours.
