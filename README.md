# AWS Cloud Resume Challenge

This repository contains a React portfolio and the AWS services behind its visitor counter. The live site is [jeysibn.dev](https://jeysibn.dev). CloudFront serves the site from a private Amazon S3 bucket. API Gateway, Lambda, and DynamoDB store an approximate visitor count.

Version 2 (V2) is the live system. Terraform describes its AWS resources, and GitHub Actions checks code and deploys frontend changes. Version 1 (V1) is retired history. Its AWS project is closed, and its state must not be reused.

## Start here

If you are new to the project, follow these guides in order:

1. Read the [project guide](docs/README.md) for a map of the documentation and key terms.
2. Follow the local setup below to run the website on your computer.
3. Read the [architecture guide](docs/architecture.md) to see how requests move through AWS.

You do not need AWS credentials to run the website or its local tests. Deploying changes to AWS is a separate, advanced task.

## Run the website locally

You need Node.js 22 and npm. Commands in this section run from `frontend/app` unless a different directory is shown.

Install the packages and create your local environment file:

```bash
cd frontend/app
npm ci
cp .env.example .env.local
```

The example file sets the public visitor API URL. The counter reads the live aggregate, but registration stays off unless you explicitly opt in. If you opt in during local development, the live API may update the production count for that browser. Frontend unit tests mock the API and do not change the live count. Keep AWS keys and other secrets out of `VITE_*` variables because Vite includes them in the browser code.

Start the development server and open the local address printed by Vite, usually `http://localhost:5173`:

```bash
npm run dev
```

To stop the server, press `Ctrl+C` in that terminal.

## Check your changes

Run these frontend checks from `frontend/app`:

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm run test:metadata
npm run perf:budget
```

The optional browser test uses Playwright. Install its Chromium browser once, then run the test:

```bash
npx playwright install chromium
npm run test:ui
```

Run the backend tests from the repository root. They use AWS mocks and do not need credentials:

```bash
python3 -m pip install -r backend/requirements-test.txt
python3 -m unittest discover -s backend/tests -v
```

## Project map

| Path | What you will find |
| --- | --- |
| `frontend/app/` | React website, visitor-counter client, and frontend tests |
| `backend/lambda-v2/` | Live V2 Lambda handler and ZIP packaging script |
| `backend/lambda/` | Recovered V1 handler, kept as historical source |
| `backend/tests/` | Tests for the V1 and V2 Lambda handlers |
| `infra/terraform/` | Terraform configuration for V2 AWS resources |
| `.github/workflows/deploy-v2.yml` | Pull request checks and manual frontend deployment |
| `docs/` | Project guide, architecture, deployment, and validation records |

## Before changing AWS

Frontend deployment and infrastructure changes use different processes. The [frontend deployment guide](docs/deployment-runbook.md) explains how to publish the website. The [backend deployment guide](docs/backend-cicd.md) covers Lambda and Terraform changes.

Terraform changes can modify live cloud resources. Confirm the AWS account, create a plan, and read every proposed change before applying it. Never reuse V1 state. Terraform's V2 state is stored remotely in a separate S3 bucket and key.

## Current deployment

| Component | V2 value |
| --- | --- |
| Website | [jeysibn.dev](https://jeysibn.dev) |
| AWS account | `665514296439` |
| AWS region | `ap-southeast-2` (Sydney) |
| API base URL | `https://kfpwu0cd7k.execute-api.ap-southeast-2.amazonaws.com` |
| Website bucket | `cloud-resume-v2-website-665514296439-ap-southeast-2` |
| DynamoDB table | `cloud-resume-v2-visitor-counter` |

Tracking starts only after opt-in. The browser sends a random UUID v4, and Lambda stores a server-side HMAC digest. Each registration refreshes a rolling 24-hour inactivity deadline; only after that deadline does the aggregate increase. This estimates recorded visits, not individual people. The aggregate preserves the earlier IP-based history, so it is not a historical unique-browser count. See [how the visitor counter works](frontend/app/AWS-INTEGRATION.md) for limits and privacy details.

## More documentation

Start with the [documentation map](docs/README.md) to choose the right guide for your task.
