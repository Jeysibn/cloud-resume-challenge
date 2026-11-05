# AWS Cloud Resume Challenge

**A Serverless Portfolio Website Built with AWS**

**Project:** [GitHub Repository](https://github.com/Jeysibn/cloud-resume-challenge)

**Live Website:** [jeysibn.dev](https://jeysibn.dev)

## 1. Project Overview

I built and deployed a personal portfolio website using AWS to gain hands-on experience with cloud infrastructure, serverless applications, and basic DevOps practices.

The website displays my portfolio and automatically registers an approximate IP-based visitor count when the visitor-counter component loads.

I divided the project into two versions. In Version 1, I manually configured AWS resources through the Management Console to understand how the services work. In Version 2, I recreated the infrastructure using Terraform and introduced GitHub Actions for automated code testing and frontend deployment.

## 2. AWS Architecture

The application uses a simple serverless architecture.

**Frontend — Amazon S3 and CloudFront**

I used Amazon S3 to store the frontend files and CloudFront to deliver the website over HTTPS.

The S3 bucket is private, meaning users cannot directly access its files over the public internet. Instead, CloudFront uses Origin Access Control (OAC) to securely retrieve the files.

Users access the website at [jeysibn.dev](https://jeysibn.dev). CloudFront is the underlying distribution that serves this custom domain; its distribution endpoint is [d1ezqc8d2heo4m.cloudfront.net](https://d1ezqc8d2heo4m.cloudfront.net/).

**Backend — API Gateway and AWS Lambda**

I used AWS Lambda with Python to handle visitor counter requests without managing a traditional server.

API Gateway exposes two endpoints:

- `GET /visits` — retrieves the current count and serves as a fallback if registration fails.
- `POST /visits` — automatically registers when the visitor-counter component mounts. Lambda derives an HMAC-SHA256 digest from the source IPv4 address or IPv6 `/64` prefix; a DynamoDB transaction records the digest and increments the existing count only if the identifier has not been registered within the configured 24-hour window.

Both API routes connect to the same Lambda function.

I configured API Gateway CORS to allow the portfolio's custom domain (and the CloudFront distribution origin) to call the API using GET and POST requests.

**Database — Amazon DynamoDB**

I used DynamoDB to store the visitor counter value and temporary IP-derived digest records. TTL expires the digest records, while the existing total preserves historical counts from the previous implementation.

Terraform gives the Lambda role scoped `GetItem`, `PutItem`, and `UpdateItem` access to the visitor table. DynamoDB checks those item permissions for the corresponding reads and writes inside a transaction.

This allows the visitor count to remain saved even when the website is refreshed.

**Monitoring — Amazon CloudWatch**

I used CloudWatch to inspect logs and verify that Lambda processed API requests.

## 3. Infrastructure as Code — Terraform

For Version 2, I used Terraform to provision and manage the AWS infrastructure.

Instead of manually recreating resources in the AWS Console, I defined the resources in Terraform configuration files.

I learned how to use `terraform init`, `terraform plan`, and `terraform apply` to initialize, review, and provision infrastructure.

This helped me understand Infrastructure as Code and why it is useful for managing cloud environments consistently.

## 4. CI/CD — GitHub Actions

I used GitHub Actions to automate frontend and backend code validation.

The frontend workflow checks TypeScript, runs linting and tests, and builds the React application.

The backend workflow runs Python unit tests, checks Python syntax, and validates the Lambda deployment ZIP.

For frontend deployment, I manually trigger GitHub Actions after merging changes into the main branch. The workflow uploads the frontend files to S3 and requests a CloudFront invalidation.

I also implemented GitHub OIDC authentication, allowing GitHub Actions to use temporary AWS credentials instead of storing permanent access keys.

For backend changes, I run tests and manually deploy the updated Lambda package using Terraform.

## 5. End-to-end testing

Historical live testing checked the previous button-based counter. It confirmed that a POST changed the DynamoDB count and produced a CloudWatch record, but it does not verify the current automatic registration or IP-based deduplication.

The current counter registers when its component loads and counts an IP-derived identifier at most once within a 24-hour window. This estimates visitors, not individual people. Shared networks can combine visitors, while changing addresses can count one person more than once. The aggregate retains the previous counter total.

See the [validation record](validation.md#live-aws-evidence-from-november-1-2026) for the dated results and screenshots.

## 6. Challenges and lessons learned

One of the key learning areas was understanding how different AWS services communicate.

Building Version 1 manually helped me understand the purpose of each service before introducing automation.

Moving to Terraform in Version 2 helped me understand how infrastructure can be managed through code.

I also learned the difference between Continuous Integration, which automatically checks code changes, and deployment, which releases those changes to AWS.

The project gave me practical experience with IAM permissions, serverless applications, API integration, Git version control, Terraform, GitHub Actions, and basic monitoring.

## 7. Conclusion

Through the AWS Cloud Resume Challenge, I gained practical experience building and deploying a serverless web application.

The project strengthened my understanding of AWS architecture, Infrastructure as Code, and basic CI/CD practices.

More importantly, I now have a working AWS project that I can use to demonstrate my technical knowledge and continue practicing cloud engineering fundamentals.
