output "website_bucket_name" {
  description = "Upload the frontend build to this V2 bucket."
  value       = aws_s3_bucket.website.id
}

output "cloudfront_url" {
  value = "https://${aws_cloudfront_distribution.website.domain_name}"
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.website.id
}

output "api_invoke_url" {
  description = "V2 API base URL; the counter endpoint is /visits."
  value       = aws_apigatewayv2_api.visitor.api_endpoint
}

output "visitor_table_name" {
  description = "Initialize the visitors item separately after deployment."
  value       = aws_dynamodb_table.visitors.name
}

output "github_actions_role_arn" {
  description = "IAM role used by GitHub Actions to deploy V2"
  value       = aws_iam_role.github_actions_v2.arn
}
