# Deploy the live frontend

This guide publishes frontend files to the existing V2 website. It does not create or change AWS infrastructure. The live site is [https://d1ezqc8d2heo4m.cloudfront.net/](https://d1ezqc8d2heo4m.cloudfront.net/).

## Before deploying

1. Make and review your frontend change on a branch.
2. Open a pull request to `main`. GitHub Actions runs the frontend checks; the AWS deploy job is skipped for pull requests.
3. Merge the pull request only after its checks pass.

## Start a deployment

1. Open the repository’s **Actions** tab on GitHub.
2. Select **V2 Portfolio CI/CD**.
3. Select **Run workflow**, choose branch `main`, and start the run.
4. Watch both jobs. `build-and-test` must pass before `Deploy V2 to AWS` starts.

The workflow builds the site with the V2 API URL, passes the tested files as an artifact, and uses GitHub OIDC to get temporary access to AWS account `665514296439`. It uploads hashed assets first and `index.html` last, then requests a CloudFront cache invalidation. It does not use `--delete`, so it does not remove existing bucket objects. It does not run Terraform.

## Check the deployment

Wait for both workflow jobs to pass. Then open the [live site](https://d1ezqc8d2heo4m.cloudfront.net/) and check the page, images, resume link, and browser console. The visitor counter’s read-only API check is:

```bash
curl -i https://kfpwu0cd7k.execute-api.ap-southeast-2.amazonaws.com/visits
```

Expect HTTP 200 and JSON containing a numeric `count`. This GET does not change the count. A POST increments the real counter; do not send one just to test deployment.

CloudFront invalidation can take time to finish propagating after the workflow succeeds. If the page still looks old, check the invalidation and wait before starting another deployment.

## If a deployment fails

- If `build-and-test` fails, read the failing step and fix the source before merging or deploying again.
- If `Deploy V2 to AWS` fails, inspect the failed step and current workflow run. Do not run `terraform destroy` or retry blindly; asset uploads may have partly completed.
- To roll back a broken frontend, revert the frontend change through Git, merge the revert to `main`, then manually run the workflow again. The workflow uploads new assets and replaces `index.html` last; it does not delete old hashed assets.

Terraform infrastructure changes use a separate reviewed Terraform plan and are not part of this frontend deployment workflow.

## Version 1

The old manual V1 deployment guide is retired. V1’s AWS project is closed; do not use old bucket, API, or CloudFront values or reuse V1 Terraform state.
