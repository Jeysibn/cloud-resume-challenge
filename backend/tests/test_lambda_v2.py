"""V2 visitor analytics checks; all DynamoDB calls are in-memory or mocked."""

import copy
import hashlib
import hmac
import importlib.util
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Lock
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import boto3
from botocore.stub import Stubber
from botocore.exceptions import ClientError

SOURCE = Path(__file__).resolve().parents[1] / "lambda-v2" / "lambda_function.py"
ENV = {
    "TABLE_NAME": "test-v2-table",
    "VISITOR_ID_HMAC_SECRET": "test-secret",
    "VISIT_WINDOW_SECONDS": "86400",
    "VISITOR_RETENTION_SECONDS": "7776000",
}
VISITOR_ID = "8f14e45f-ea8d-4e9b-8e5d-2b3f9d822f10"


class TransactionCanceled(Exception):
    def __init__(self, reasons):
        self.response = {"CancellationReasons": reasons}


class AtomicDynamoDB:
    """Locked fake implementing just the handler's atomic DynamoDB operations."""

    def __init__(self, count):
        self.count = count
        self.records = {}
        self.lock = Lock()
        self.fail_next_transaction = False
        self.commit_reset_before_next_reset = False

    def get_item(self, Key, ConsistentRead):
        with self.lock:
            if Key["id"] == "visitors":
                return {} if self.count is None else {"Item": {"count": self.count}}
            record = self.records.get(Key["id"])
            return {} if record is None else {"Item": copy.deepcopy(record)}

    def update_item(self, Key, **kwargs):
        with self.lock:
            item = self.records.get(Key["id"])
            values = kwargs["ExpressionAttributeValues"]
            if (
                item is None
                or item["active_until"] <= values[":now"]
                or item["active_until"] != values[":previous_active"]
                or item["last_seen_at"] != values[":previous_last"]
            ):
                raise ClientError(
                    {"Error": {"Code": "ConditionalCheckFailedException"}},
                    "UpdateItem",
                )
            item["last_seen_at"] = values[":seen"]
            item["active_until"] = values[":active"]
            item["expires_at"] = values[":expiry"]
            item["is_returning"] = values[":true"]
            item["page_loads"] += values[":one"]
            return {}

    def transact_write_items(self, TransactItems, ClientRequestToken):
        if len(ClientRequestToken) != 32:
            raise AssertionError("DynamoDB transaction idempotency token must be a UUID")
        with self.lock:
            if self.fail_next_transaction:
                self.fail_next_transaction = False
                raise RuntimeError("temporary DynamoDB failure")
            first, aggregate = TransactItems
            aggregate_key = aggregate["Update"]["Key"]["id"]["S"]
            if aggregate_key != "visitors" or self.count is None:
                raise TransactionCanceled([
                    {"Code": "None"}, {"Code": "ConditionalCheckFailed"}
                ])

            if "Put" in first:
                action = first["Put"]
                raw = action["Item"]
                key = raw["id"]["S"]
                values = action.get("ExpressionAttributeValues", {})
                now = int(values.get(":now", {"N": "0"})["N"])
                expression = action["ConditionExpression"]
                existing = self.records.get(key)
                if "attribute_not_exists(#id)" in expression:
                    allowed = existing is None
                else:
                    observed_expiry = action["ExpressionAttributeValues"].get(":previous_expiry")
                    allowed = (
                        existing is not None
                        and existing.get("expires_at", 0) <= now
                        and observed_expiry is not None
                        and existing.get("expires_at") == int(observed_expiry["N"])
                    )
                if not allowed:
                    raise TransactionCanceled([
                        {"Code": "ConditionalCheckFailed"}, {"Code": "None"}
                    ])
                replacement = {
                    "id": key,
                    "first_seen_at": int(raw["first_seen_at"]["N"]),
                    "last_seen_at": int(raw["last_seen_at"]["N"]),
                    "active_until": int(raw["active_until"]["N"]),
                    "page_loads": int(raw["page_loads"]["N"]),
                    "counted_visits": int(raw["counted_visits"]["N"]),
                    "is_returning": raw["is_returning"]["BOOL"],
                    "expires_at": int(raw["expires_at"]["N"]),
                }
                if self.commit_reset_before_next_reset and ":previous_expiry" in values:
                    self.commit_reset_before_next_reset = False
                    self.records[key] = replacement
                    self.count += 1
                    raise TransactionCanceled([
                        {"Code": "ConditionalCheckFailed"}, {"Code": "None"}
                    ])
                self.records[key] = replacement
            else:
                action = first["Update"]
                key = action["Key"]["id"]["S"]
                item = self.records.get(key)
                now = int(action["ExpressionAttributeValues"][":now"]["N"])
                if (
                    item is None
                    or item.get("active_until", 0) > now
                    or item.get("last_seen_at", 0) > now
                ):
                    raise TransactionCanceled([
                        {"Code": "ConditionalCheckFailed"}, {"Code": "None"}
                    ])
                item["last_seen_at"] = now
                item["active_until"] = int(
                    action["ExpressionAttributeValues"][":active"]["N"]
                )
                item["expires_at"] = int(
                    action["ExpressionAttributeValues"][":expiry"]["N"]
                )
                item["page_loads"] += 1
                item["counted_visits"] += 1
                item["is_returning"] = True

            self.count += 1


class V2HandlerTests(unittest.TestCase):
    def load_handler(self, environment=None):
        env = ENV.copy() if environment is None else environment
        self.client = Mock()
        self.client.exceptions = SimpleNamespace(
            TransactionCanceledException=TransactionCanceled
        )
        self.table = Mock()
        self.table.name = env["TABLE_NAME"]
        self.table.meta = SimpleNamespace(client=self.client)
        resource = Mock()
        resource.Table.return_value = self.table
        fake_boto3 = ModuleType("boto3")
        fake_boto3.resource = Mock(return_value=resource)
        fake_boto3.client = Mock(return_value=self.client)
        spec = importlib.util.spec_from_file_location("v2_lambda", SOURCE)
        module = importlib.util.module_from_spec(spec)
        with patch.dict("sys.modules", {"boto3": fake_boto3}), patch.dict(
            "os.environ", env, clear=True
        ):
            spec.loader.exec_module(module)
        return module

    @staticmethod
    def post_event(visitor_id=VISITOR_ID):
        event = {"requestContext": {"http": {"method": "POST"}}}
        if visitor_id is not ...:
            event["body"] = json.dumps({"visitorId": visitor_id})
        return event

    def use_atomic_fake(self, count):
        fake = AtomicDynamoDB(count)
        self.client.transact_write_items.side_effect = fake.transact_write_items
        self.table.get_item.side_effect = fake.get_item
        self.table.update_item.side_effect = fake.update_item
        return fake

    def post_at(self, module, timestamp, visitor_id=VISITOR_ID):
        with patch.object(module.time, "time", return_value=timestamp):
            return module.lambda_handler(self.post_event(visitor_id), None)

    def payload(self, result):
        return json.loads(result["body"])

    def test_first_visit_increments_history_and_stores_only_hmac(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(41)
        result = self.post_at(module, 1_800_000_000)
        digest = hmac.new(b"test-secret", VISITOR_ID.encode(), hashlib.sha256).hexdigest()
        item = fake.records[f"visitor#{digest}"]
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(self.payload(result), {
            "counted": True, "count": 42, "returning": False
        })
        self.assertEqual(item, {
            "id": f"visitor#{digest}",
            "first_seen_at": 1_800_000_000,
            "last_seen_at": 1_800_000_000,
            "active_until": 1_800_086_400,
            "page_loads": 1,
            "counted_visits": 1,
            "is_returning": False,
            "expires_at": 1_807_776_000,
        })
        self.assertNotIn(VISITOR_ID, repr(item))
        self.assertEqual(result["headers"]["cache-control"], "no-store, max-age=0")

    def test_transaction_uses_serialized_dynamodb_client_request(self):
        session = boto3.Session(
            aws_access_key_id="test-access-key",
            aws_secret_access_key="test-secret-key",
            region_name="ap-southeast-2",
        )
        resource = session.resource("dynamodb")
        client = session.client("dynamodb")
        with patch("boto3.resource", return_value=resource), patch(
            "boto3.client", return_value=client
        ), patch.dict("os.environ", ENV, clear=True):
            spec = importlib.util.spec_from_file_location("v2_lambda_wire", SOURCE)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

        module.table.get_item = Mock(side_effect=[{}, {"Item": {"count": 43}}])
        digest = hmac.new(b"test-secret", VISITOR_ID.encode(), hashlib.sha256).hexdigest()
        expected = {
            "ClientRequestToken": "a" * 32,
            "TransactItems": [
                {
                    "Put": {
                        "TableName": ENV["TABLE_NAME"],
                        "Item": {
                            "id": {"S": f"visitor#{digest}"},
                            "first_seen_at": {"N": "1700000000"},
                            "last_seen_at": {"N": "1700000000"},
                            "active_until": {"N": "1700086400"},
                            "page_loads": {"N": "1"},
                            "counted_visits": {"N": "1"},
                            "is_returning": {"BOOL": False},
                            "expires_at": {"N": "1707776000"},
                        },
                        "ConditionExpression": "attribute_not_exists(#id)",
                        "ExpressionAttributeNames": {"#id": "id"},
                    }
                },
                {
                    "Update": {
                        "TableName": ENV["TABLE_NAME"],
                        "Key": {"id": {"S": "visitors"}},
                        "UpdateExpression": "SET #count = #count + :one",
                        "ConditionExpression": "attribute_exists(#id)",
                        "ExpressionAttributeNames": {"#count": "count", "#id": "id"},
                        "ExpressionAttributeValues": {":one": {"N": "1"}},
                    }
                },
            ],
        }
        with Stubber(client) as stubber:
            stubber.add_response("transact_write_items", {}, expected)
            with patch.object(module.uuid, "uuid4", return_value=SimpleNamespace(hex="a" * 32)):
                result = self.post_at(module, 1_700_000_000)

        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(self.payload(result)["count"], 43)
        self.assertEqual(module.table.get_item.call_count, 2)
        module.table.get_item.assert_any_call(Key={"id": "visitors"}, ConsistentRead=True)

    def test_active_revisits_do_not_count_and_extend_window_and_retention(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(3)
        first = self.post_at(module, 1_800_000_000)
        second = self.post_at(module, 1_800_000_000 + 8 * 3600)
        third = self.post_at(module, 1_800_000_000 + 31 * 3600)
        item = next(iter(fake.records.values()))
        self.assertEqual([self.payload(x)["counted"] for x in (first, second, third)], [True, False, False])
        self.assertEqual(fake.count, 4)
        self.assertEqual(item["first_seen_at"], 1_800_000_000)
        self.assertEqual(item["last_seen_at"], 1_800_111_600)
        self.assertEqual(item["active_until"], 1_800_198_000)
        self.assertEqual(item["expires_at"], 1_807_887_600)
        self.assertEqual(item["page_loads"], 3)
        self.assertEqual(item["counted_visits"], 1)
        self.assertTrue(item["is_returning"])

    def test_exactly_24_hours_qualifies_but_just_before_does_not(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(0)
        self.post_at(module, 1_800_000_000)
        before = self.post_at(module, 1_800_086_399)
        at_boundary = self.post_at(module, 1_800_172_799)
        self.assertFalse(self.payload(before)["counted"])
        self.assertTrue(self.payload(at_boundary)["counted"])
        self.assertEqual(fake.count, 2)

    def test_24_hour_eligible_visit_within_retention_preserves_history(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(7)
        self.post_at(module, 1_800_000_000)
        item = next(iter(fake.records.values()))
        item["active_until"] = 1_800_000_000
        now = 1_800_086_400
        result = self.post_at(module, now)
        self.assertTrue(self.payload(result)["counted"])
        self.assertTrue(self.payload(result)["returning"])
        self.assertEqual(fake.count, 9)
        self.assertEqual(item["first_seen_at"], 1_800_000_000)
        self.assertEqual(item["expires_at"], now + 7_776_000)

    def test_logically_expired_record_resets_history_at_exact_retention_boundary(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(40)
        self.post_at(module, 1000)
        item = next(iter(fake.records.values()))
        old_expiry = item["expires_at"]
        item.update({
            "first_seen_at": 12,
            "last_seen_at": 1000,
            "active_until": 1001,
            "page_loads": 7,
            "counted_visits": 3,
            "is_returning": True,
            "expires_at": old_expiry,
        })

        result = self.post_at(module, old_expiry)
        item = next(iter(fake.records.values()))

        self.assertTrue(self.payload(result)["counted"])
        self.assertFalse(self.payload(result)["returning"])
        self.assertEqual(fake.count, 42)
        self.assertEqual(item["first_seen_at"], old_expiry)
        self.assertEqual(item["last_seen_at"], old_expiry)
        self.assertEqual(item["active_until"], old_expiry + 86_400)
        self.assertEqual(item["page_loads"], 1)
        self.assertEqual(item["counted_visits"], 1)
        self.assertFalse(item["is_returning"])
        self.assertEqual(item["expires_at"], old_expiry + 7_776_000)
        reset = self.client.transact_write_items.call_args_list[-1].kwargs["TransactItems"]
        reset_put = reset[0]["Put"]
        self.assertIn("#expiry <= :now", reset_put["ConditionExpression"])
        self.assertEqual(
            reset_put["ExpressionAttributeValues"][":previous_expiry"],
            {"N": str(old_expiry)},
        )
        self.assertEqual(reset_put["Item"]["first_seen_at"], {"N": str(old_expiry)})

    def test_record_deleted_by_ttl_before_reset_is_recreated_as_first_visit(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(6)
        self.post_at(module, 1000)
        item = next(iter(fake.records.values()))
        item["expires_at"] = 1001
        item["active_until"] = 1001
        deleted = False
        original_transaction = self.client.transact_write_items.side_effect

        def delete_then_transact(*args, **kwargs):
            nonlocal deleted
            if not deleted and "Put" in kwargs["TransactItems"][0]:
                fake.records.clear()
                deleted = True
            return original_transaction(*args, **kwargs)

        self.client.transact_write_items.side_effect = delete_then_transact
        result = self.post_at(module, 1002)

        record = next(iter(fake.records.values()))
        self.assertTrue(deleted)
        self.assertTrue(self.payload(result)["counted"])
        self.assertFalse(self.payload(result)["returning"])
        self.assertEqual(fake.count, 8)
        self.assertEqual(record["first_seen_at"], 1002)
        self.assertEqual(record["page_loads"], 1)

    def test_record_already_deleted_by_ttl_is_a_fresh_first_visit(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(17)
        self.post_at(module, 1000)
        fake.records.clear()

        result = self.post_at(module, 7_777_000)

        record = next(iter(fake.records.values()))
        self.assertTrue(self.payload(result)["counted"])
        self.assertFalse(self.payload(result)["returning"])
        self.assertEqual(fake.count, 19)
        self.assertEqual(record["first_seen_at"], 7_777_000)
        self.assertEqual(record["page_loads"], 1)
        self.assertEqual(record["counted_visits"], 1)

    def test_concurrent_logical_expiry_resets_increment_aggregate_once(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(10)
        self.post_at(module, 1000)
        item = next(iter(fake.records.values()))
        item.update({"first_seen_at": 1, "last_seen_at": 1000, "active_until": 1001,
                     "page_loads": 5, "counted_visits": 2, "is_returning": True,
                     "expires_at": 1001})

        with ThreadPoolExecutor(max_workers=10) as pool:
            results = list(pool.map(lambda _: self.post_at(module, 1001), range(25)))

        bodies = [self.payload(result) for result in results]
        record = next(iter(fake.records.values()))
        self.assertEqual(sum(body["counted"] for body in bodies), 1)
        self.assertEqual(fake.count, 12)
        self.assertEqual(record["first_seen_at"], 1001)
        self.assertEqual(record["page_loads"], 25)
        self.assertEqual(record["counted_visits"], 1)
        self.assertTrue(record["is_returning"])

    def test_expiry_reset_conflict_rereads_winners_state_without_double_count(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(14)
        self.post_at(module, 1000)
        item = next(iter(fake.records.values()))
        item.update({"first_seen_at": 1, "last_seen_at": 1000, "active_until": 1001,
                     "page_loads": 4, "counted_visits": 2, "is_returning": True,
                     "expires_at": 1001})
        fake.commit_reset_before_next_reset = True

        result = self.post_at(module, 1001)

        record = next(iter(fake.records.values()))
        self.assertFalse(self.payload(result)["counted"])
        self.assertTrue(self.payload(result)["returning"])
        self.assertEqual(fake.count, 16)
        self.assertEqual(record["first_seen_at"], 1001)
        self.assertEqual(record["counted_visits"], 1)
        self.assertEqual(record["page_loads"], 2)

    def test_concurrent_requests_count_first_eligible_visit_once(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(20)
        with ThreadPoolExecutor(max_workers=12) as pool:
            results = list(pool.map(lambda _: self.post_at(module, 1_800_000_000), range(40)))
        bodies = [self.payload(result) for result in results]
        self.assertEqual(sum(body["counted"] for body in bodies), 1)
        self.assertTrue(all(body["count"] == 21 for body in bodies))
        self.assertEqual(fake.count, 21)
        self.assertEqual(len(fake.records), 1)
        self.assertEqual(next(iter(fake.records.values()))["page_loads"], 40)

    def test_concurrent_revisit_at_expiry_counts_once(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(2)
        self.post_at(module, 1_800_000_000)
        with ThreadPoolExecutor(max_workers=10) as pool:
            results = list(pool.map(lambda _: self.post_at(module, 1_800_086_400), range(25)))
        bodies = [self.payload(result) for result in results]
        self.assertEqual(sum(body["counted"] for body in bodies), 1)
        self.assertTrue(all(body["count"] == 4 for body in bodies))
        item = next(iter(fake.records.values()))
        self.assertEqual(item["page_loads"], 26)
        self.assertEqual(item["counted_visits"], 2)

    def test_historical_aggregate_is_read_without_reset(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(1284)
        result = self.post_at(module, 1_800_000_000)
        self.assertEqual(self.payload(result)["count"], 1285)
        self.assertEqual(fake.count, 1285)

    def test_missing_aggregate_cancels_new_visitor_transaction(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(None)
        result = self.post_at(module, 1_800_000_000)
        self.assertEqual(result["statusCode"], 404)
        self.assertEqual(fake.records, {})

    def test_invalid_payloads_are_rejected_without_database_access(self):
        module = self.load_handler()
        events = [
            {"requestContext": {"http": {"method": "POST"}}, "body": "{"},
            {"requestContext": {"http": {"method": "POST"}}, "body": " " * 2049},
            self.post_event("not-a-uuid"),
            self.post_event("00000000-0000-0000-0000-000000000000"),
            {"requestContext": {"http": {"method": "POST"}}, "body": json.dumps({"visitorId": VISITOR_ID, "other": 1})},
        ]
        for event in events:
            self.assertEqual(module.lambda_handler(event, None)["statusCode"], 400)
        self.table.get_item.assert_not_called()
        self.client.transact_write_items.assert_not_called()

    def test_database_failure_returns_503_without_success_claim(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(0)
        fake.fail_next_transaction = True
        result = self.post_at(module, 1_800_000_000)
        self.assertEqual(result["statusCode"], 503)
        self.assertNotIn("counted", self.payload(result))
        self.assertEqual(fake.count, 0)
        self.assertEqual(fake.records, {})

    def test_active_visit_write_failure_returns_503_without_success_claim(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(0)
        self.post_at(module, 1_800_000_000)
        item = next(iter(fake.records.values()))
        before = copy.deepcopy(item)
        self.table.update_item.side_effect = ClientError(
            {"Error": {"Code": "InternalServerError"}}, "UpdateItem"
        )

        result = self.post_at(module, 1_800_000_001)

        self.assertEqual(result["statusCode"], 503)
        self.assertNotIn("counted", self.payload(result))
        self.assertEqual(item, before)
        self.assertEqual(fake.count, 1)

    def test_get_is_consistent_read_and_failures_are_explicit(self):
        module = self.load_handler()
        self.table.get_item.return_value = {"Item": {"count": 11}}
        result = module.lambda_handler({"requestContext": {"http": {"method": "GET"}}}, None)
        self.assertEqual(self.payload(result), {"count": 11, "registrationSupported": True})
        self.table.get_item.assert_called_once_with(Key={"id": "visitors"}, ConsistentRead=True)
        self.table.get_item.side_effect = RuntimeError("unavailable")
        self.assertEqual(module.lambda_handler({"requestContext": {"http": {"method": "GET"}}}, None)["statusCode"], 503)

    def test_legacy_bodyless_post_returns_count_without_tracking(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(91)
        result = self.post_at(module, 1_800_000_000, visitor_id=...)
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(self.payload(result), {"counted": False, "count": 91})
        self.assertEqual(fake.records, {})
        self.client.transact_write_items.assert_not_called()
        self.table.update_item.assert_not_called()

    def test_late_request_cannot_move_seen_or_deadline_backwards(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(12)
        self.post_at(module, 1_800_000_000)
        self.post_at(module, 1_800_000_100)
        item = next(iter(fake.records.values()))
        before = (item["last_seen_at"], item["active_until"], item["expires_at"])

        late = self.post_at(module, 1_800_000_001)

        self.assertEqual(self.payload(late)["counted"], False)
        self.assertEqual(
            (item["last_seen_at"], item["active_until"], item["expires_at"]),
            before,
        )
        self.assertEqual(item["page_loads"], 3)

    def test_missing_secret_and_nonpositive_retention_fail_at_startup(self):
        with self.assertRaises(KeyError):
            self.load_handler({"TABLE_NAME": "table"})
        with self.assertRaisesRegex(ValueError, "positive"):
            self.load_handler({**ENV, "VISITOR_RETENTION_SECONDS": "0"})


if __name__ == "__main__":
    unittest.main()
