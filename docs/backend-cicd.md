# Backend CI and manual Lambda deployment (V2)

This is an **entry-level learning project**. Keep the process simple:
GitHub checks the Python code on pull requests, and you deploy Lambda **manually through Terraform** when you decide to release a change.

## The flow

```text
Edit Python code → Open pull request → GitHub runs backend tests
       → Merge to main → Build Lambda ZIP locally
       → Review Terraform plan → Manually apply → Test API
```

**CI (Continuous Integration)** checks proposed code automatically. **Deployment** makes the updated code live in AWS. This project does **not** automatically deploy backend changes from GitHub Actions.

## What GitHub checks automatically

The `Backend CI (Python 3.14)` job in `.github/workflows/deploy-v2.yml` runs when a pull request targets `main`. It:

1. Runs Python unit tests without connecting to AWS (the tests mock DynamoDB).
2. Checks the Lambda and packaging scripts for syntax errors.
3. Builds `backend/lambda-v2/function.zip` and checks the ZIP contains `lambda_function.py` with `lambda_handler`.

If a check fails, fix the code and update the pull request before merging. The existing frontend checks and its manual S3/CloudFront deployment remain unchanged.

To run the same backend checks locally from the repository root:

```bash
python3 -m unittest discover -s backend/tests -v
python3 -m py_compile backend/lambda-v2/lambda_function.py backend/lambda-v2/package.py
python3 backend/lambda-v2/package.py
```

## How to deploy a backend change (manual)

Use this only after merging the tested backend code into `main`. Run the commands from a **clean, up-to-date local checkout** with the AWS CLI and Terraform installed. You need an authorized AWS identity for the **current V2 account**, in region `ap-southeast-2`.

1. Confirm you are on the correct version of the code. Check your AWS identity:

   ```bash
   git status
   git branch --show-current
   aws sts get-caller-identity
   ```

   Verify the reported AWS account is **665514296439**. Do not continue if it is different.

2. Run tests and build the deployment ZIP:

   ```bash
   python3 -m unittest discover -s backend/tests -v
   python3 backend/lambda-v2/package.py
   ```

3. Review the proposed Terraform changes:

   ```bash
   cd infra/terraform
   terraform init -reconfigure
   terraform plan -out=.terraform/lambda.tfplan
   terraform show .terraform/lambda.tfplan
   ```

   For a backend-only release, expect an **in-place update** of `aws_lambda_function.visitor` (or no changes if the code is identical). **Stop** if the plan proposes deleting, replacing, or changing unrelated resources. Never apply a plan you do not understand.

4. When the plan is correct, deploy it manually:

   ```bash
   terraform apply .terraform/lambda.tfplan
   ```

5. Test the live API. For example, the read-only endpoint is:

   ```bash
   curl https://kfpwu0cd7k.execute-api.ap-southeast-2.amazonaws.com/visits
   ```

   It should return JSON with a `count` value. Check CloudWatch logs if your Lambda returns an error. `POST /visits` changes the counter, so only use it intentionally.

## Why Terraform updates Lambda

The `aws_lambda_function.visitor` resource in `infra/terraform/main.tf` points to the generated ZIP:

```hcl
filename         = "${path.module}/../../backend/lambda-v2/function.zip"
source_code_hash = filebase64sha256("${path.module}/../../backend/lambda-v2/function.zip")
```

`filename` tells Terraform which file to upload. `source_code_hash` helps it notice when the ZIP changes. Terraform can then update your **existing Lambda**, without needing to rebuild API Gateway or DynamoDB just for a Python code change.

## If something fails

- **GitHub CI fails:** Read the failed step, run its command locally, fix the code, and push a correction.
- **`terraform init` or `plan` fails:** Verify your AWS identity, access to the V2 state bucket, and region. Do not disable state locking as a shortcut.
- **Terraform shows unexpected infrastructure changes:** Stop and investigate before applying.
- **API returns an error:** Check Lambda's CloudWatch logs and confirm the correct code and environment variables are deployed.

**Remember:** Frontend = automatically tested + manually deployed via GitHub Actions. Backend = automatically tested + manually deployed via Terraform. That's enough for this learning milestone.
