"""V2 contract checks with a mocked SDK; no credentials or AWS calls."""
import importlib.util
import json
from pathlib import Path
from types import ModuleType
import unittest
from unittest.mock import Mock, patch

SOURCE = Path(__file__).resolve().parents[1] / "lambda-v2" / "lambda_function.py"


class V2HandlerTests(unittest.TestCase):
    def load_handler(self, environment):
        self.table = Mock()
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

    def test_missing_table_variable_fails_instead_of_using_v1(self):
        with self.assertRaisesRegex(KeyError, "TABLE_NAME"):
            self.load_handler({})

    def test_get_reads_v2_without_updating(self):
        module = self.load_handler({"TABLE_NAME": "test-v2-table"})
        self.table.get_item.return_value = {"Item": {"count": 8}}
        result = module.lambda_handler(
            {"requestContext": {"http": {"method": "GET"}}}, None
        )
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(json.loads(result["body"]), {"count": 8})
        self.table.get_item.assert_called_once_with(
            Key={"id": "visitors"}, ConsistentRead=True
        )
        self.table.update_item.assert_not_called()

    def test_missing_counter_returns_404_without_creating_item(self):
        module = self.load_handler({"TABLE_NAME": "test-v2-table"})
        self.table.get_item.return_value = {}
        result = module.lambda_handler(
            {"requestContext": {"http": {"method": "GET"}}}, None
        )
        self.assertEqual(result["statusCode"], 404)
        self.table.update_item.assert_not_called()

    def test_post_keeps_atomic_increment_and_existing_item_condition(self):
        module = self.load_handler({"TABLE_NAME": "test-v2-table"})
        self.table.update_item.return_value = {"Attributes": {"count": 9}}
        result = module.lambda_handler(
            {"requestContext": {"http": {"method": "POST"}}}, None
        )
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(json.loads(result["body"])["count"], 9)
        self.table.update_item.assert_called_once_with(
            Key={"id": "visitors"},
            UpdateExpression="SET #counter = #counter + :inc",
            ConditionExpression="attribute_exists(#pk)",
            ExpressionAttributeNames={"#counter": "count", "#pk": "id"},
            ExpressionAttributeValues={":inc": 1},
            ReturnValues="UPDATED_NEW",
        )
        self.table.get_item.assert_not_called()


if __name__ == "__main__":
    unittest.main()
