"""Exercise the recovered handler without importing a real SDK or contacting AWS."""
import hashlib
import importlib.util
import json
from decimal import Decimal
from pathlib import Path
from types import ModuleType
import unittest
from unittest.mock import Mock, patch

SOURCE = Path(__file__).resolve().parents[1] / "lambda" / "lambda_function.py"


class VisitorHandlerTests(unittest.TestCase):
    def setUp(self):
        self.table = Mock()
        self.resource = Mock()
        self.resource.Table.return_value = self.table
        self.boto3 = ModuleType("boto3")
        self.boto3.resource = Mock(return_value=self.resource)
        spec = importlib.util.spec_from_file_location("recovered_lambda", SOURCE)
        self.handler_module = importlib.util.module_from_spec(spec)
        # Patch before import: production initializes the DynamoDB resource at import.
        with patch.dict("sys.modules", {"boto3": self.boto3}):
            spec.loader.exec_module(self.handler_module)

    def invoke(self, method):
        return self.handler_module.lambda_handler(
            {"requestContext": {"http": {"method": method}}}, None
        )

    def test_original_resource_and_table_selection(self):
        self.boto3.resource.assert_called_once_with("dynamodb")
        self.resource.Table.assert_called_once_with("cloud-resume-visitor-counter")

    def test_get_reads_consistently_without_increment(self):
        self.table.get_item.return_value = {"Item": {"id": "visitors", "count": Decimal("42")}}
        response = self.invoke("GET")
        self.assertEqual(response, {"statusCode": 200, "body": '{"count": 42}'})
        self.assertIsInstance(json.loads(response["body"])["count"], int)
        self.table.get_item.assert_called_once_with(Key={"id": "visitors"}, ConsistentRead=True)
        self.table.update_item.assert_not_called()

    def test_get_zero(self):
        self.table.get_item.return_value = {"Item": {"count": Decimal("0")}}
        self.assertEqual(json.loads(self.invoke("GET")["body"]), {"count": 0})
        self.table.update_item.assert_not_called()

    def test_get_missing_counter_returns_original_404(self):
        for response in ({}, {"Item": None}):
            with self.subTest(response=response):
                self.table.get_item.return_value = response
                self.assertEqual(self.invoke("GET"), {
                    "statusCode": 404, "body": '{"error": "Visitor counter not found"}'
                })
        self.table.update_item.assert_not_called()

    def test_post_uses_atomic_conditional_increment_and_returns_count(self):
        self.table.update_item.return_value = {"Attributes": {"count": Decimal("43")}}
        response = self.invoke("POST")
        self.assertEqual(response, {
            "statusCode": 200,
            "body": '{"message": "Visitor counter incremented", "count": 43}',
        })
        self.table.update_item.assert_called_once_with(
            Key={"id": "visitors"},
            UpdateExpression="SET #counter = #counter + :inc",
            ConditionExpression="attribute_exists(#pk)",
            ExpressionAttributeNames={"#counter": "count", "#pk": "id"},
            ExpressionAttributeValues={":inc": 1},
            ReturnValues="UPDATED_NEW",
        )
        self.table.get_item.assert_not_called()

    def test_post_does_not_require_request_body(self):
        self.table.update_item.return_value = {"Attributes": {"count": Decimal("1")}}
        self.assertEqual(json.loads(self.invoke("POST")["body"])["count"], 1)
        self.table.update_item.assert_called_once()

    def test_unsupported_methods_return_405_without_database_calls(self):
        for method in ("PUT", "DELETE", "PATCH", "OPTIONS", "HEAD", "get", None):
            with self.subTest(method=method):
                self.assertEqual(self.invoke(method), {
                    "statusCode": 405, "body": '{"error": "Method not allowed"}'
                })
        self.table.get_item.assert_not_called()
        self.table.update_item.assert_not_called()

    def test_missing_http_v2_method_returns_405(self):
        for event in ({}, {"requestContext": {}}, {"httpMethod": "GET"}):
            with self.subTest(event=event):
                response = self.handler_module.lambda_handler(event, None)
                self.assertEqual(response["statusCode"], 405)
        self.table.get_item.assert_not_called()
        self.table.update_item.assert_not_called()

    def test_get_dynamodb_errors_propagate_without_handler_retry(self):
        error = RuntimeError("DynamoDB read failed")
        self.table.get_item.side_effect = error
        with self.assertRaises(RuntimeError) as raised:
            self.invoke("GET")
        self.assertIs(raised.exception, error)
        self.table.get_item.assert_called_once()
        self.table.update_item.assert_not_called()

    def test_post_dynamodb_errors_propagate_without_handler_retry(self):
        error = RuntimeError("Conditional update failed")
        self.table.update_item.side_effect = error
        with self.assertRaises(RuntimeError) as raised:
            self.invoke("POST")
        self.assertIs(raised.exception, error)
        self.table.update_item.assert_called_once()
        self.table.get_item.assert_not_called()

    def test_malformed_stored_count_is_not_converted_to_an_invented_error_response(self):
        self.table.get_item.return_value = {"Item": {"count": "invalid"}}
        with self.assertRaises(ValueError):
            self.invoke("GET")
        self.table.update_item.assert_not_called()

    def test_missing_count_attribute_propagates_key_error(self):
        self.table.get_item.return_value = {"Item": {"id": "visitors"}}
        with self.assertRaises(KeyError):
            self.invoke("GET")


class SourceProvenanceTests(unittest.TestCase):
    def test_recovered_source_matches_recorded_archive_entry(self):
        provenance = json.loads((SOURCE.parents[1] / "source-provenance.json").read_text())
        expected = provenance["files"]["lambda_function.py"]
        source = SOURCE.read_bytes()
        self.assertEqual(len(source), expected["bytes"])
        self.assertEqual(hashlib.sha256(source).hexdigest(), expected["sha256"])


if __name__ == "__main__":
    unittest.main()
