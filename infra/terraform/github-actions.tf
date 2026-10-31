
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
