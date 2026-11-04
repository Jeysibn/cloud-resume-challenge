"""V2 contract checks with a mocked SDK; no credentials or AWS calls."""
import hashlib
import hmac
import importlib.util
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import Mock, patch

SOURCE = Path(__file__).resolve().parents[1] / "lambda-v2" / "lambda_function.py"
ENV = {"TABLE_NAME": "test-v2-table", "IP_HASH_SECRET": "test-secret"}


class TransactionCanceled(Exception):
    def __init__(self, reasons):
        self.response = {"CancellationReasons": reasons}


class ClientError(Exception):
    pass


class AtomicDynamoDB:
    """Small, locked transaction fake for concurrency and persistence checks."""
    def __init__(self, count):
        self.count = count
        self.ip_records = {}
        self.lock = Lock()

    def transact_write_items(self, TransactItems):
        put, update = (action["Put"] if "Put" in action else action["Update"]
                       for action in TransactItems)
        ip_key = put["Item"]["id"]["S"]
        now = int(put["ExpressionAttributeValues"][":now"]["N"])
        expires_at = int(put["Item"]["expires_at"]["N"])
        with self.lock:
            duplicate = self.ip_records.get(ip_key, 0) > now
            missing_counter = self.count is None
            if duplicate or missing_counter:
                raise TransactionCanceled([
                    {"Code": "ConditionalCheckFailed" if duplicate else "None"},
                    {"Code": "ConditionalCheckFailed" if missing_counter else "None"},
                ])
            self.ip_records[ip_key] = expires_at
            self.count += int(update["ExpressionAttributeValues"][":inc"]["N"])

    def get_item(self, Key, ConsistentRead):
        with self.lock:
            if Key["id"] != "visitors" or self.count is None:
                return {}
            return {"Item": {"count": self.count}}


class V2HandlerTests(unittest.TestCase):
    def load_handler(self, environment=None):
        environment = ENV.copy() if environment is None else environment
        self.table = Mock()
        self.table.name = environment["TABLE_NAME"]
        self.client = Mock()
        self.table.meta = SimpleNamespace(
            client=self.client,
        )
        self.client.exceptions = SimpleNamespace(
            TransactionCanceledException=TransactionCanceled
        )
        resource = Mock()
        resource.Table.return_value = self.table
        boto3 = ModuleType("boto3")
        boto3.resource = Mock(return_value=resource)
        spec = importlib.util.spec_from_file_location("v2_lambda", SOURCE)
        module = importlib.util.module_from_spec(spec)
        with patch.dict("sys.modules", {"boto3": boto3}), patch.dict(
            "os.environ", environment, clear=True
        ):
            spec.loader.exec_module(module)
        resource.Table.assert_called_once_with(environment["TABLE_NAME"])
        return module

    @staticmethod
    def post_event(source_ip="203.0.113.7", headers=None):
        event = {"requestContext": {"http": {"method": "POST"}}}
        if source_ip is not ...:
            event["requestContext"]["http"]["sourceIp"] = source_ip
        if headers is not None:
            event["headers"] = headers
        return event

    def assert_count_response(self, result, count, counted):
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(json.loads(result["body"]), {"counted": counted, "count": count})

    def use_atomic_fake(self, count):
        fake = AtomicDynamoDB(count)
        self.client.transact_write_items.side_effect = fake.transact_write_items
        self.table.get_item.side_effect = fake.get_item
        return fake

    def test_missing_table_or_secret_fails_loudly(self):
        with self.assertRaisesRegex(KeyError, "TABLE_NAME"):
            self.load_handler({})
        with self.assertRaisesRegex(KeyError, "IP_HASH_SECRET"):
            self.load_handler({"TABLE_NAME": "test-v2-table"})

    def test_get_reads_counter_consistently_without_writing(self):
        module = self.load_handler()
        self.table.get_item.return_value = {"Item": {"count": 8}}
        result = module.lambda_handler(
            {"requestContext": {"http": {"method": "GET"}}}, None
        )
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(json.loads(result["body"]), {"count": 8})
        self.table.get_item.assert_called_once_with(
            Key={"id": "visitors"}, ConsistentRead=True
        )
        self.client.transact_write_items.assert_not_called()

    def test_missing_counter_get_returns_404(self):
        module = self.load_handler()
        self.table.get_item.return_value = {}
        result = module.lambda_handler(
            {"requestContext": {"http": {"method": "GET"}}}, None
        )
        self.assertEqual(result["statusCode"], 404)
        self.client.transact_write_items.assert_not_called()

    def test_first_visit_is_counted_atomically_and_stores_only_hmac(self):
        module = self.load_handler()
        self.table.get_item.return_value = {"Item": {"count": 9}}
        with patch.object(module.time, "time", return_value=1_700_000_000):
            result = module.lambda_handler(self.post_event(), None)

        self.assert_count_response(result, 9, True)
        args = self.client.transact_write_items.call_args.kwargs
        self.assertEqual(len(args["TransactItems"]), 2)
        put, update = args["TransactItems"]
        digest = hmac.new(b"test-secret", b"203.0.113.7", hashlib.sha256).hexdigest()
        self.assertEqual(put["Put"]["Item"], {
            "id": {"S": f"ip#{digest}"}, "expires_at": {"N": "1700086400"}
        })
        self.assertEqual(put["Put"]["ConditionExpression"],
                         "attribute_not_exists(#id) OR #exp <= :now")
        self.assertEqual(put["Put"]["ExpressionAttributeValues"][":now"], {"N": "1700000000"})
        self.assertEqual(update["Update"]["Key"], {"id": {"S": "visitors"}})
        self.assertEqual(update["Update"]["UpdateExpression"], "SET #count = #count + :inc")
        self.assertEqual(update["Update"]["ConditionExpression"], "attribute_exists(#id)")
        self.assertEqual(update["Update"]["ExpressionAttributeValues"][":inc"], {"N": "1"})
        self.assertNotIn("203.0.113.7", repr(args))
        self.table.get_item.assert_called_once_with(
            Key={"id": "visitors"}, ConsistentRead=True
        )

    def test_repeat_visit_returns_unchanged_count(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(9)
        first = module.lambda_handler(self.post_event(), None)
        second = module.lambda_handler(self.post_event(), None)
        self.assert_count_response(first, 10, True)
        self.assert_count_response(second, 10, False)
        self.assertEqual(fake.count, 10)

    def test_concurrent_requests_from_one_ip_increment_once(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(25)
        with ThreadPoolExecutor(max_workers=12) as pool:
            results = list(pool.map(
                lambda _: module.lambda_handler(self.post_event(), None), range(40)
            ))

        payloads = [json.loads(result["body"]) for result in results]
        self.assertEqual(sum(payload["counted"] for payload in payloads), 1)
        self.assertTrue(all(payload["count"] == 26 for payload in payloads))
        self.assertEqual(fake.count, 26)
        self.assertEqual(len(fake.ip_records), 1)

    def test_expired_record_is_replaceable_at_current_time(self):
        module = self.load_handler({**ENV, "VISIT_TTL_SECONDS": "120"})
        fake = self.use_atomic_fake(10)
        digest = hmac.new(b"test-secret", b"203.0.113.7", hashlib.sha256).hexdigest()
        fake.ip_records[f"ip#{digest}"] = 1_700_000_099
        with patch.object(module.time, "time", return_value=1_700_000_100):
            result = module.lambda_handler(self.post_event(), None)
        self.assert_count_response(result, 11, True)
        put = self.client.transact_write_items.call_args.kwargs["TransactItems"][0]["Put"]
        self.assertEqual(put["ExpressionAttributeValues"][":now"], {"N": "1700000100"})
        self.assertEqual(put["Item"]["expires_at"], {"N": "1700000220"})
        self.assertEqual(fake.count, 11)
        self.assertEqual(fake.ip_records[f"ip#{digest}"], 1_700_000_220)

    def test_ipv6_addresses_in_same_64_share_digest(self):
        module = self.load_handler()
        self.table.get_item.return_value = {"Item": {"count": 1}}
        for address in ("2001:db8:abcd:12::1", "2001:db8:abcd:12:ffff::9"):
            module.lambda_handler(self.post_event(address), None)
        puts = [call.kwargs["TransactItems"][0]["Put"]["Item"]["id"]["S"]
                for call in self.client.transact_write_items.call_args_list]
        digest = hmac.new(b"test-secret", b"2001:db8:abcd:12::/64", hashlib.sha256).hexdigest()
        self.assertEqual(puts, [f"ip#{digest}", f"ip#{digest}"])

    def test_missing_or_invalid_source_ip_returns_400_without_writes(self):
        module = self.load_handler()
        for event in (self.post_event(source_ip=...), self.post_event("not an ip")):
            result = module.lambda_handler(event, None)
            self.assertEqual(result["statusCode"], 400)
        self.client.transact_write_items.assert_not_called()
        self.table.get_item.assert_not_called()

    def test_forwarded_for_header_is_ignored(self):
        module = self.load_handler()
        self.table.get_item.return_value = {"Item": {"count": 4}}
        module.lambda_handler(self.post_event(headers={"x-forwarded-for": "198.51.100.88"}), None)
        item_id = self.client.transact_write_items.call_args.kwargs["TransactItems"][0]["Put"]["Item"]["id"]["S"]
        digest = hmac.new(b"test-secret", b"203.0.113.7", hashlib.sha256).hexdigest()
        self.assertEqual(item_id, f"ip#{digest}")

    def test_missing_counter_cancels_transaction_without_partial_ip_write(self):
        module = self.load_handler()
        fake = self.use_atomic_fake(None)
        result = module.lambda_handler(self.post_event(), None)
        self.assertEqual(result["statusCode"], 404)
        self.assertEqual(json.loads(result["body"]), {"error": "Visitor counter not found"})
        self.table.get_item.assert_not_called()
        # DynamoDB transaction atomicity means the first Put is rolled back.
        self.assertEqual(len(self.client.transact_write_items.call_args.kwargs["TransactItems"]), 2)
        self.assertEqual(fake.ip_records, {})
        self.table.put_item.assert_not_called()
        self.table.update_item.assert_not_called()

    def test_unknown_cancellation_reason_and_other_errors_propagate(self):
        module = self.load_handler()
        for error in (
            TransactionCanceled([{"Code": "None"}, {"Code": "None"}]),
            ClientError("AWS client error"),
        ):
            self.client.transact_write_items.side_effect = error
            with self.assertRaises(type(error)):
                module.lambda_handler(self.post_event(), None)

    def test_invalid_ttl_is_rejected_at_import(self):
        for value in ("0", "-1", "one-day"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.load_handler({**ENV, "VISIT_TTL_SECONDS": value})

    def test_other_methods_return_405(self):
        module = self.load_handler()
        result = module.lambda_handler({"requestContext": {"http": {"method": "PUT"}}}, None)
        self.assertEqual(result["statusCode"], 405)
        self.client.transact_write_items.assert_not_called()


if __name__ == "__main__":
    unittest.main()
