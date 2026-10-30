
import json
import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("cloud-resume-visitor-counter")


def lambda_handler(event, context):
    # Identify the HTTP method from API Gateway.
    method = (
        event.get("requestContext", {})
        .get("http", {})
        .get("method")
    )

    # GET: Read the counter without changing it.
    if method == "GET":
        response = table.get_item(
            Key={"id": "visitors"},
            ConsistentRead=True
        )

        item = response.get("Item")

        if item is None:
            return {
                "statusCode": 404,
                "body": json.dumps({
                    "error": "Visitor counter not found"
                })
            }

        return {
            "statusCode": 200,
            "body": json.dumps({
                "count": int(item["count"])
            })
        }

    # POST: Atomically increment the counter.
    if method == "POST":
        response = table.update_item(
            Key={"id": "visitors"},
            UpdateExpression="SET #counter = #counter + :inc",
            ConditionExpression="attribute_exists(#pk)",
            ExpressionAttributeNames={
                "#counter": "count",
                "#pk": "id"
            },
            ExpressionAttributeValues={
                ":inc": 1
            },
            ReturnValues="UPDATED_NEW"
        )

        new_count = int(response["Attributes"]["count"])

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Visitor counter incremented",
                "count": new_count
            })
        }

    return {
        "statusCode": 405,
        "body": json.dumps({
            "error": "Method not allowed"
        })
    }
