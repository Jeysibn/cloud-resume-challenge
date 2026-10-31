terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.71.0"
    }
  }

  backend "s3" {
    bucket              = "cloud-resume-tfstate-665514296439-ap-southeast-2"
    key                 = "cloud-resume-challenge/v2/terraform.tfstate"
    region              = "ap-southeast-2"
    encrypt             = true
    use_lockfile        = true
    allowed_account_ids = ["665514296439"]
  }
}
