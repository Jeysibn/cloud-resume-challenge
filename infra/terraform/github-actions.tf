
# Reuse the existing GitHub OIDC provider.
data "aws_iam_openid_connect_provider" "github" {
  arn = "arn:aws:iam::665514296439:oidc-provider/token.actions.githubusercontent.com"
}

# This role can be assumed by GitHub Actions,
# but only from our repository's main branch.
resource "aws_iam_role" "github_actions_v2" {
  name = "cloud-resume-v2-github-actions-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Federated = data.aws_iam_openid_connect_provider.github.arn
        }

        Action = "sts:AssumeRoleWithWebIdentity"

        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"

            "token.actions.githubusercontent.com:sub" = "repo:Jeysibn@184398348/cloud-resume-challenge@1438062067:ref:refs/heads/main"
          }
        }
      }
    ]
  })
}

# Only allow frontend deployment operations.
resource "aws_iam_role_policy" "github_actions_v2" {
  name = "cloud-resume-v2-frontend-deploy"
  role = aws_iam_role.github_actions_v2.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Sid      = "ListWebsiteBucket"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = "arn:aws:s3:::cloud-resume-v2-website-665514296439-ap-southeast-2"
      },
      {
        Sid      = "UploadWebsiteFiles"
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "arn:aws:s3:::cloud-resume-v2-website-665514296439-ap-southeast-2/*"
      },
      {
        Sid      = "InvalidateCloudFront"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = "arn:aws:cloudfront::665514296439:distribution/E2558FK1UWYLQG"
      }
    ]
  })
}
# Terraform refreshes all managed V2 resources for a normal plan. These actions
# are read-only. State and locking are limited to the V2 state key and lock file.
locals {
  backend_terraform_read_and_state_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadHttpApiConfiguration"
        Effect   = "Allow"
        Action   = ["apigateway:GET"]
        Resource = "arn:aws:apigateway:ap-southeast-2::/apis/*"
      },
      {
        Sid    = "ReadCloudFrontConfiguration"
        Effect = "Allow"
        Action = [
          "cloudfront:GetDistribution",
          "cloudfront:GetOriginAccessControl"
        ]
        Resource = [
          "arn:aws:cloudfront::665514296439:distribution/E2558FK1UWYLQG",
          "arn:aws:cloudfront::665514296439:origin-access-control/*"
        ]
      },
      {
        Sid      = "ReadManagedCachingOptimizedPolicy"
        Effect   = "Allow"
        Action   = ["cloudfront:GetCachePolicy"]
        Resource = "arn:aws:cloudfront::aws:cache-policy/658327ea-f89d-4fab-a63d-7e88639e58f6"
      },
      {
        Sid      = "ListCloudFrontManagedCachePolicies"
        Effect   = "Allow"
        Action   = ["cloudfront:ListCachePolicies"]
        Resource = "*"
      },
      {
        Sid      = "DescribeVisitorTable"
        Effect   = "Allow"
        Action   = ["dynamodb:DescribeTable"]
        Resource = "arn:aws:dynamodb:ap-southeast-2:665514296439:table/cloud-resume-v2-visitor-counter"
      },
      {
        Sid    = "ReadTerraformManagedIam"
        Effect = "Allow"
        Action = [
          "iam:GetOpenIDConnectProvider",
          "iam:GetPolicy",
          "iam:GetPolicyVersion",
          "iam:GetRole",
          "iam:GetRolePolicy",
          "iam:ListAttachedRolePolicies",
          "iam:ListRolePolicies",
          "iam:ListPolicyVersions"
        ]
        Resource = [
          "arn:aws:iam::665514296439:oidc-provider/token.actions.githubusercontent.com",
          "arn:aws:iam::665514296439:policy/cloud-resume-v2-backend-terraform-state-and-read",
          "arn:aws:iam::665514296439:role/cloud-resume-v2-backend-deploy",
          "arn:aws:iam::665514296439:role/cloud-resume-v2-backend-plan",
          "arn:aws:iam::665514296439:role/cloud-resume-v2-github-actions-deploy",
          "arn:aws:iam::665514296439:role/cloud-resume-v2-lambda-execution"
        ]
      },
      {
        Sid    = "ReadVisitorLambdaConfiguration"
        Effect = "Allow"
        Action = [
          "lambda:GetFunction",
          "lambda:GetFunctionConfiguration",
          "lambda:GetPolicy"
        ]
        Resource = "arn:aws:lambda:ap-southeast-2:665514296439:function:cloud-resume-v2-visitor-function"
      },
      {
        Sid      = "DescribeV2LogGroups"
        Effect   = "Allow"
        Action   = ["logs:DescribeLogGroups"]
        Resource = "*"
      },
      {
        Sid    = "ReadWebsiteBucketConfiguration"
        Effect = "Allow"
        Action = [
          "s3:GetBucketAcl",
          "s3:GetBucketCORS",
          "s3:GetBucketPolicy",
          "s3:GetBucketPublicAccessBlock",
          "s3:GetBucketOwnershipControls",
          "s3:GetBucketTagging",
          "s3:GetBucketVersioning",
          "s3:GetEncryptionConfiguration"
        ]
        Resource = "arn:aws:s3:::cloud-resume-v2-website-665514296439-ap-southeast-2"
      },
      {
        Sid      = "LocateTerraformStateBucket"
        Effect   = "Allow"
        Action   = ["s3:GetBucketLocation"]
        Resource = "arn:aws:s3:::cloud-resume-tfstate-665514296439-ap-southeast-2"
      },
      {
        Sid      = "ReadAndWriteTerraformState"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "arn:aws:s3:::cloud-resume-tfstate-665514296439-ap-southeast-2/cloud-resume-challenge/v2/terraform.tfstate"
      },
      {
        Sid      = "ManageTerraformStateLock"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "arn:aws:s3:::cloud-resume-tfstate-665514296439-ap-southeast-2/cloud-resume-challenge/v2/terraform.tfstate.tflock"
      },
      {
        Sid      = "ListTerraformStatePrefix"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = "arn:aws:s3:::cloud-resume-tfstate-665514296439-ap-southeast-2"
        Condition = {
          StringLike = {
            "s3:prefix" = [
              "cloud-resume-challenge/v2/terraform.tfstate",
              "cloud-resume-challenge/v2/terraform.tfstate.tflock"
            ]
          }
        }
      }
    ]
  })
}

resource "aws_iam_role" "github_actions_backend_plan" {
  name = "cloud-resume-v2-backend-plan"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = data.aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = { StringEquals = {
        "token.actions.githubusercontent.com:aud"        = "sts.amazonaws.com"
        "token.actions.githubusercontent.com:repository" = "Jeysibn/cloud-resume-challenge"
        "token.actions.githubusercontent.com:ref"        = "refs/heads/main"
        "token.actions.githubusercontent.com:sub"        = "repo:Jeysibn@184398348/cloud-resume-challenge@1438062067:ref:refs/heads/main"
        "token.actions.githubusercontent.com:workflow"   = "V2 Backend CI/CD"
      } }
    }]
  })
}

resource "aws_iam_role" "github_actions_backend_deploy" {
  name = "cloud-resume-v2-backend-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = data.aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = { StringEquals = {
        "token.actions.githubusercontent.com:aud"        = "sts.amazonaws.com"
        "token.actions.githubusercontent.com:repository" = "Jeysibn/cloud-resume-challenge"
        "token.actions.githubusercontent.com:ref"        = "refs/heads/main"
        "token.actions.githubusercontent.com:sub"        = "repo:Jeysibn@184398348/cloud-resume-challenge@1438062067:environment:production"
        "token.actions.githubusercontent.com:workflow"   = "V2 Backend CI/CD"
      } }
    }]
  })
}

resource "aws_iam_policy" "github_actions_backend_terraform" {
  name   = "cloud-resume-v2-backend-terraform-state-and-read"
  policy = local.backend_terraform_read_and_state_policy
}

resource "aws_iam_role_policy_attachment" "github_actions_backend_plan" {
  role       = aws_iam_role.github_actions_backend_plan.name
  policy_arn = aws_iam_policy.github_actions_backend_terraform.arn
}

resource "aws_iam_role_policy_attachment" "github_actions_backend_deploy" {
  role       = aws_iam_role.github_actions_backend_deploy.name
  policy_arn = aws_iam_policy.github_actions_backend_terraform.arn
}

# Only the environment-approved deployment identity can upload code, and only
# to this Lambda. The plan identity has no Lambda write permission.
resource "aws_iam_role_policy" "github_actions_backend_deploy" {
  name = "cloud-resume-v2-update-visitor-code"
  role = aws_iam_role.github_actions_backend_deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["lambda:UpdateFunctionCode"]
      Resource = "arn:aws:lambda:ap-southeast-2:665514296439:function:cloud-resume-v2-visitor-function"
    }]
  })
}
