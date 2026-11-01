# Independent V2 resources. The existing V1 application is not referenced here.
locals {
  name = "cloud-resume-v2"
}

data "aws_caller_identity" "current" {}

# Private website storage; frontend files will be deployed by GitHub Actions.
resource "aws_s3_bucket" "website" {
  bucket = "${local.name}-website-${data.aws_caller_identity.current.account_id}-ap-southeast-2"
}

resource "aws_s3_bucket_public_access_block" "website" {
  bucket                  = aws_s3_bucket.website.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "website" {
  bucket = aws_s3_bucket.website.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "website" {
  bucket = aws_s3_bucket.website.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_cloudfront_origin_access_control" "website" {
  name                              = "${local.name}-website"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Look up an AWS-managed policy, rather than copying a V1 configuration ID.
data "aws_cloudfront_cache_policy" "website" {
  name = "Managed-CachingOptimized"
}

resource "aws_cloudfront_distribution" "website" {
  aliases             = ["jeysibn.dev", "www.jeysibn.dev"]
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  http_version        = "http2"
  price_class         = "PriceClass_All"
  comment             = "Cloud Resume Challenge V2"

  origin {
    domain_name              = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id                = "v2-website"
    origin_access_control_id = aws_cloudfront_origin_access_control.website.id
  }

  default_cache_behavior {
    target_origin_id       = "v2-website"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.website.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = "arn:aws:acm:us-east-1:665514296439:certificate/83269c59-3920-44ea-9035-567ff8088000"
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.website.arn}/*"
      Condition = {
        StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.website.arn }
      }
    }]
  })
}

# Counter data is initialized separately after deployment, not by Terraform.
resource "aws_dynamodb_table" "visitors" {
  name         = "${local.name}-visitor-counter"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"
  attribute {
    name = "id"
    type = "S"
  }
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.name}-visitor-function"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/apigateway/${local.name}-visitor-api"
  retention_in_days = 14
}

resource "aws_iam_role" "lambda" {
  name = "${local.name}-lambda-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambda" {
  name = "${local.name}-visitor-access"
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
        Resource = aws_dynamodb_table.visitors.arn
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.lambda.arn}:*"
      }
    ]
  })
}

resource "aws_lambda_function" "visitor" {
  function_name    = "${local.name}-visitor-function"
  role             = aws_iam_role.lambda.arn
  filename         = "${path.module}/../../backend/lambda-v2/function.zip"
  source_code_hash = filebase64sha256("${path.module}/../../backend/lambda-v2/function.zip")
  runtime          = "python3.14"
  handler          = "lambda_function.lambda_handler"
  architectures    = ["x86_64"]
  memory_size      = 128
  timeout          = 3
  publish          = false

  environment {
    variables = { TABLE_NAME = aws_dynamodb_table.visitors.name }
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.lambda.name
  }

  depends_on = [aws_iam_role_policy.lambda]
}

resource "aws_apigatewayv2_api" "visitor" {
  name          = "${local.name}-visitor-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_credentials = false
    allow_headers     = ["content-type"]
    allow_methods     = ["GET", "POST"]
    allow_origins = [
      "https://${aws_cloudfront_distribution.website.domain_name}",
      "https://jeysibn.dev",
      "https://www.jeysibn.dev"
    ]
  }
}

# Each public method has its own Lambda proxy integration.
# Both integrations use POST internally to invoke Lambda.
resource "aws_apigatewayv2_integration" "visitor" {
  for_each               = toset(["GET", "POST"])
  api_id                 = aws_apigatewayv2_api.visitor.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.visitor.arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000
}

resource "aws_apigatewayv2_route" "visitor" {
  for_each           = toset(["GET", "POST"])
  api_id             = aws_apigatewayv2_api.visitor.id
  route_key          = "${each.key} /visits"
  authorization_type = "NONE"
  target             = "integrations/${aws_apigatewayv2_integration.visitor[each.key].id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.visitor.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 5
    throttling_rate_limit  = 2
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn
    format = jsonencode({
      requestId = "$context.requestId"
      method    = "$context.httpMethod"
      route     = "$context.routeKey"
      status    = "$context.status"
      latencyMs = "$context.responseLatency"
    })
  }
}

resource "aws_lambda_permission" "api" {
  statement_id  = "AllowV2VisitorApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.visitor.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.visitor.execution_arn}/*/*/visits"
}
