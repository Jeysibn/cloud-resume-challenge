# Project guide

This page helps you find the right guide and understand the project vocabulary. If you are new here, start with local setup in the [root README](../README.md), then read the architecture guide.

## Choose a guide

| If you want to… | Read… |
| --- | --- |
| Understand the system and its request flows | [Architecture](architecture.md) |
| Learn how the visitor counter works in the browser | [Frontend and API integration](../frontend/app/AWS-INTEGRATION.md) |
| Read or test the Python Lambda function | [Backend guide](../backend/README.md) |
| Deploy a frontend change | [Frontend deployment guide](deployment-runbook.md) |
| Change the Lambda function or Terraform resources | [Backend deployment guide](backend-cicd.md) |
| See what was checked and what remains unverified | [Validation record](validation.md) |
| Review this project as a portfolio case study | [Project case study](project-case-study.md) |
| Recheck frontend package advisories | [Dependency security check](../frontend/app/DEPENDENCY-SECURITY-REVIEW.md) |

## Read in this order

1. **Run the website:** install frontend dependencies and start Vite using the [root README](../README.md).
2. **Trace a request:** follow the browser, API, Lambda, and DynamoDB steps in [architecture](architecture.md).
3. **Explore the code:** use the project map in the root README to find the frontend, backend, tests, and Terraform files.
4. **Make a change:** run the local checks in the relevant guide before opening a pull request.
5. **Deploy:** use the frontend guide for website files. Use the backend guide for Lambda or AWS infrastructure changes.

## Terms used in the guides

- **API:** a defined way for one program to request data or an action from another. This site uses `GET /visits` to read the count and `POST /visits` to register a visit.
- **AWS Lambda:** a service that runs the Python handler when API Gateway receives a request. You do not manage a server for this function.
- **Amazon DynamoDB:** a database that stores the visitor count and temporary visitor digests.
- **Terraform:** a tool that describes AWS resources in files. A plan previews changes before Terraform applies them.
- **GitHub Actions:** GitHub's automation service. It checks pull requests and can deploy the frontend when manually started on `main`.
- **OIDC:** OpenID Connect, a way for GitHub Actions to request temporary AWS credentials without storing long-lived AWS keys in the repository.
- **TTL:** time to live. DynamoDB removes expired digest records asynchronously; the handler checks their expiry time directly so delayed cleanup does not extend the counting window.
- **V1 and V2:** V1 is the retired deployment. V2 is the current live system. Do not reuse V1 AWS resources or Terraform state.

## Safety when learning

Local tests use mocks and do not change AWS. A `GET /visits` request reads the live count. A `POST /visits` request can change the live count, so use it only when you intend to test production behavior. Terraform plans can include destructive changes; review the plan before applying it.
