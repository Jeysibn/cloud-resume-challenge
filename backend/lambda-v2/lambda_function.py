"""Public aggregate visitor counter with private, anonymous browser records."""

import hashlib
import hmac
import json
import os
import re
import time
import uuid

import boto3
from botocore.exceptions import ClientError


dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])
dynamodb_client = boto3.client("dynamodb")
visitor_id_hmac_secret = os.environ["VISITOR_ID_HMAC_SECRET"].encode("utf-8")
visit_window_seconds = int(os.environ.get("VISIT_WINDOW_SECONDS", "86400"))
visitor_retention_seconds = int(os.environ.get("VISITOR_RETENTION_SECONDS", "7776000"))
if visit_window_seconds <= 0 or visitor_retention_seconds < visit_window_seconds:
    raise ValueError("Visitor retention must be positive and at least as long as the visit window")

MAX_BODY_BYTES = 2048
UUID_V4_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)
MAX_CONFLICT_RETRIES = 5


def json_response(status_code, payload):
    return {
        "statusCode": status_code,
        "headers": {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store, max-age=0",
            "pragma": "no-cache",
        },
        "body": json.dumps(payload),
    }


def current_count():
    response = table.get_item(Key={"id": "visitors"}, ConsistentRead=True)
    item = response.get("Item")
    if item is None:
        return None
    return int(item["count"])


def visitor_key(visitor_id):
    digest = hmac.new(
        visitor_id_hmac_secret, visitor_id.encode("ascii"), hashlib.sha256
    ).hexdigest()
    return f"visitor#{digest}"


def request_visitor_id(event):
    body = event.get("body")
    if not isinstance(body, str):
        return None
    try:
        if len(body.encode("utf-8")) > MAX_BODY_BYTES:
            return None
    except UnicodeEncodeError:
        return None
    try:
        payload = json.loads(body)
    except (ValueError, UnicodeEncodeError):
        return None
    if not isinstance(payload, dict) or set(payload) != {"visitorId"}:
        return None
    value = payload["visitorId"]
    if not isinstance(value, str) or not UUID_V4_PATTERN.fullmatch(value):
        return None
    try:
        parsed = uuid.UUID(value)
    except ValueError:
        return None
    return value if parsed.version == 4 and str(parsed) == value else None


def _transaction_canceled(error):
    return isinstance(
        error, dynamodb_client.exceptions.TransactionCanceledException
    )


def _cancellation_reasons(error):
    return error.response.get("CancellationReasons", [])


def _transact_write_items(transaction):
    # SDK retries with the same idempotency token cannot double-apply a commit
    # whose first response was lost. A new attempt after a conditional conflict
    # receives a fresh token because it may have a different outcome.
    dynamodb_client.transact_write_items(
        ClientRequestToken=uuid.uuid4().hex, **transaction
    )


def _new_visitor_transaction(key, now):
    return {
        "TransactItems": [
            {
                "Put": {
                    "TableName": table.name,
                    "Item": {
                        "id": {"S": key},
                        "first_seen_at": {"N": str(now)},
                        "last_seen_at": {"N": str(now)},
                        "active_until": {"N": str(now + visit_window_seconds)},
                        "page_loads": {"N": "1"},
                        "counted_visits": {"N": "1"},
                        "is_returning": {"BOOL": False},
                        "expires_at": {"N": str(now + visitor_retention_seconds)},
                    },
                    "ConditionExpression": "attribute_not_exists(#id)",
                    "ExpressionAttributeNames": {"#id": "id"},
                }
            },
            {
                "Update": {
                    "TableName": table.name,
                    "Key": {"id": {"S": "visitors"}},
                    "UpdateExpression": "SET #count = #count + :one",
                    "ConditionExpression": "attribute_exists(#id)",
                    "ExpressionAttributeNames": {"#count": "count", "#id": "id"},
                    "ExpressionAttributeValues": {":one": {"N": "1"}},
                }
            },
        ]
    }


def _expired_visitor_transaction(key, now, item):
    observed_expiry = item.get("expires_at")
    put = {
        "TableName": table.name,
        "Item": {
            "id": {"S": key},
            "first_seen_at": {"N": str(now)},
            "last_seen_at": {"N": str(now)},
            "active_until": {"N": str(now + visit_window_seconds)},
            "page_loads": {"N": "1"},
            "counted_visits": {"N": "1"},
            "is_returning": {"BOOL": False},
            "expires_at": {"N": str(now + visitor_retention_seconds)},
        },
        "ExpressionAttributeNames": {"#id": "id", "#expiry": "expires_at"},
    }
    if observed_expiry is None:
        put["ConditionExpression"] = "attribute_exists(#id) AND attribute_not_exists(#expiry)"
    else:
        put["ConditionExpression"] = (
            "attribute_exists(#id) AND #expiry <= :now AND #expiry = :previous_expiry"
        )
        put["ExpressionAttributeValues"] = {
            ":now": {"N": str(now)},
            ":previous_expiry": {"N": str(int(observed_expiry))},
        }
    return {
        "TransactItems": [
            {"Put": put},
            {
                "Update": {
                    "TableName": table.name,
                    "Key": {"id": {"S": "visitors"}},
                    "UpdateExpression": "SET #count = #count + :one",
                    "ConditionExpression": "attribute_exists(#id)",
                    "ExpressionAttributeNames": {"#count": "count", "#id": "id"},
                    "ExpressionAttributeValues": {":one": {"N": "1"}},
                }
            },
        ]
    }


def _active_visit_update(key, now, item):
    last_seen_at = int(item.get("last_seen_at", now))
    active_until = int(item.get("active_until", 0))
    seen_at = max(now, last_seen_at)
    next_active_until = max(active_until, seen_at + visit_window_seconds)
    expires_at = seen_at + visitor_retention_seconds
    return table.update_item(
        Key={"id": key},
        UpdateExpression=(
            "SET #first = if_not_exists(#first, :now), #last = :seen, "
            "#active = :active, #expiry = :expiry, #returning = :true "
            "ADD #loads :one"
        ),
        ConditionExpression=(
            "#active > :now AND #active = :previous_active "
            "AND #last = :previous_last"
        ),
        ExpressionAttributeNames={
            "#first": "first_seen_at",
            "#last": "last_seen_at",
            "#active": "active_until",
            "#expiry": "expires_at",
            "#returning": "is_returning",
            "#loads": "page_loads",
        },
        ExpressionAttributeValues={
            ":now": now,
            ":seen": seen_at,
            ":active": next_active_until,
            ":expiry": expires_at,
            ":previous_active": active_until,
            ":previous_last": last_seen_at,
            ":true": True,
            ":one": 1,
        },
    )


def _eligible_visit_transaction(key, now):
    return {
        "TransactItems": [
            {
                "Update": {
                    "TableName": table.name,
                    "Key": {"id": {"S": key}},
                    "UpdateExpression": (
                        "SET #first = if_not_exists(#first, :now), #last = :now, "
                        "#active = :active, #expiry = :expiry, #returning = :true "
                        "ADD #loads :one, #counted :one"
                    ),
                    "ConditionExpression": (
                        "attribute_exists(#id) AND "
                        "(attribute_not_exists(#active) OR #active <= :now) AND "
                        "(attribute_not_exists(#last) OR #last <= :now)"
                    ),
                    "ExpressionAttributeNames": {
                        "#id": "id",
                        "#first": "first_seen_at",
                        "#last": "last_seen_at",
                        "#active": "active_until",
                        "#expiry": "expires_at",
                        "#returning": "is_returning",
                        "#loads": "page_loads",
                        "#counted": "counted_visits",
                    },
                    "ExpressionAttributeValues": {
                        ":now": {"N": str(now)},
                        ":active": {"N": str(now + visit_window_seconds)},
                        ":expiry": {"N": str(now + visitor_retention_seconds)},
                        ":true": {"BOOL": True},
                        ":one": {"N": "1"},
                    },
                }
            },
            {
                "Update": {
                    "TableName": table.name,
                    "Key": {"id": {"S": "visitors"}},
                    "UpdateExpression": "SET #count = #count + :one",
                    "ConditionExpression": "attribute_exists(#id)",
                    "ExpressionAttributeNames": {"#count": "count", "#id": "id"},
                    "ExpressionAttributeValues": {":one": {"N": "1"}},
                }
            },
        ]
    }


def register_visitor(visitor_id, now):
    key = visitor_key(visitor_id)
    for _ in range(MAX_CONFLICT_RETRIES):
        response = table.get_item(Key={"id": key}, ConsistentRead=True)
        item = response.get("Item")
        if item is None:
            try:
                _transact_write_items(_new_visitor_transaction(key, now))
                return True, False
            except Exception as error:
                if not _transaction_canceled(error):
                    raise
                reasons = _cancellation_reasons(error)
                if len(reasons) > 1 and reasons[1].get("Code") == "ConditionalCheckFailed":
                    raise CounterMissingError from error
                if reasons and reasons[0].get("Code") == "ConditionalCheckFailed":
                    continue
                raise

        active_until = int(item.get("active_until", 0))
        expires_at = int(item.get("expires_at", 0))
        if expires_at <= now:
            try:
                _transact_write_items(_expired_visitor_transaction(key, now, item))
                return True, False
            except Exception as error:
                if not _transaction_canceled(error):
                    raise
                reasons = _cancellation_reasons(error)
                if len(reasons) > 1 and reasons[1].get("Code") == "ConditionalCheckFailed":
                    raise CounterMissingError from error
                if reasons and reasons[0].get("Code") == "ConditionalCheckFailed":
                    continue
                raise

        if active_until > now:
            try:
                _active_visit_update(key, now, item)
                return False, True
            except ClientError as error:
                if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                    continue
                raise

        try:
            _transact_write_items(_eligible_visit_transaction(key, now))
            return True, True
        except Exception as error:
            if not _transaction_canceled(error):
                raise
            reasons = _cancellation_reasons(error)
            if len(reasons) > 1 and reasons[1].get("Code") == "ConditionalCheckFailed":
                raise CounterMissingError from error
            if reasons and reasons[0].get("Code") == "ConditionalCheckFailed":
                continue
            raise
    raise VisitorConflictError


class CounterMissingError(Exception):
    pass


class VisitorConflictError(Exception):
    pass


def lambda_handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method")
    if method == "GET":
        try:
            count = current_count()
        except Exception:
            return json_response(503, {"error": "Visitor count is temporarily unavailable"})
        if count is None:
            return json_response(404, {"error": "Visitor counter not found"})
        return json_response(
            200, {"count": count, "registrationSupported": True}
        )

    if method != "POST":
        return json_response(405, {"error": "Method not allowed"})

    body = event.get("body")
    if body is None or body == "":
        try:
            count = current_count()
        except Exception:
            return json_response(503, {"error": "Visitor count is temporarily unavailable"})
        if count is None:
            return json_response(404, {"error": "Visitor counter not found"})
        # Deliberately maintained read-only compatibility for old clients;
        # it creates no IP-derived or browser-derived visitor records.
        return json_response(200, {"counted": False, "count": count})

    visitor_id = request_visitor_id(event)
    if visitor_id is None:
        return json_response(400, {"error": "A valid visitor ID is required"})

    now = int(time.time())
    try:
        counted, returning = register_visitor(visitor_id, now)
        count = current_count()
    except CounterMissingError:
        return json_response(404, {"error": "Visitor counter not found"})
    except VisitorConflictError:
        return json_response(503, {"error": "Visitor registration is temporarily unavailable"})
    except Exception:
        return json_response(503, {"error": "Visitor registration is temporarily unavailable"})

    if count is None:
        return json_response(404, {"error": "Visitor counter not found"})
    return json_response(
        200,
        {"counted": counted, "count": count, "returning": returning},
    )
