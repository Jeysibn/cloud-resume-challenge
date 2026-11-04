
import hashlib
import hmac
import ipaddress
import json
import os
import time
import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])
ip_hash_secret = os.environ["IP_HASH_SECRET"].encode("utf-8")
visit_ttl_seconds = int(os.environ.get("VISIT_TTL_SECONDS", "86400"))
if visit_ttl_seconds <= 0:
    raise ValueError("VISIT_TTL_SECONDS must be a positive integer")


def json_response(status_code, payload):
    return {"statusCode": status_code, "body": json.dumps(payload)}


def current_count():
    response = table.get_item(Key={"id": "visitors"}, ConsistentRead=True)
    item = response.get("Item")
    if item is None:
        return None
    return int(item["count"])


def visitor_ip_key(source_ip):
    address = ipaddress.ip_address(source_ip)
    if address.version == 6:
        address = ipaddress.ip_network(f"{address}/64", strict=False)
    digest = hmac.new(ip_hash_secret, str(address).encode("ascii"), hashlib.sha256).hexdigest()
    return f"ip#{digest}"


def lambda_handler(event, context):
    # Identify the HTTP method from API Gateway.
    method = (
        event.get("requestContext", {})
        .get("http", {})
        .get("method")
    )

    # GET: Read the counter without changing it.
    if method == "GET":
        count = current_count()
        if count is None:
            return json_response(404, {"error": "Visitor counter not found"})
        return json_response(200, {"count": count})

    # POST: Count this IP once per TTL window and atomically increment the total.
    if method == "POST":
        source_ip = event.get("requestContext", {}).get("http", {}).get("sourceIp")
        if not isinstance(source_ip, str):
            return json_response(400, {"error": "A valid source IP is required"})
        try:
            ip_key = visitor_ip_key(source_ip)
        except ValueError:
            return json_response(400, {"error": "A valid source IP is required"})

        now = int(time.time())
        transaction = {
            "TransactItems": [
                {
                    "Put": {
                        "TableName": table.name,
                        "Item": {
                            "id": {"S": ip_key},
                            "expires_at": {"N": str(now + visit_ttl_seconds)},
                        },
                        "ConditionExpression": "attribute_not_exists(#id) OR #exp <= :now",
                        "ExpressionAttributeNames": {"#id": "id", "#exp": "expires_at"},
                        "ExpressionAttributeValues": {":now": {"N": str(now)}},
                    }
                },
                {
                    "Update": {
                        "TableName": table.name,
                        "Key": {"id": {"S": "visitors"}},
                        "UpdateExpression": "SET #count = #count + :inc",
                        "ConditionExpression": "attribute_exists(#id)",
                        "ExpressionAttributeNames": {"#count": "count", "#id": "id"},
                        "ExpressionAttributeValues": {":inc": {"N": "1"}},
                    }
                },
            ]
        }

        try:
            table.meta.client.transact_write_items(**transaction)
        except table.meta.client.exceptions.TransactionCanceledException as error:
            reasons = error.response.get("CancellationReasons", [])
            if reasons and reasons[0].get("Code") == "ConditionalCheckFailed":
                count = current_count()
                if count is None:
                    return json_response(404, {"error": "Visitor counter not found"})
                return json_response(200, {"counted": False, "count": count})
            if len(reasons) > 1 and reasons[1].get("Code") == "ConditionalCheckFailed":
                return json_response(404, {"error": "Visitor counter not found"})
            raise

        count = current_count()
        if count is None:
            return json_response(404, {"error": "Visitor counter not found"})
        return json_response(200, {"counted": True, "count": count})

    return json_response(405, {"error": "Method not allowed"})
