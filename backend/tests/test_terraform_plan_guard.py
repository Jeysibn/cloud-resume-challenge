"""Safety tests for the backend Terraform plan guard."""

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
GUARD_PATH = ROOT / "backend/scripts/guard_terraform_plan.py"
SPEC = importlib.util.spec_from_file_location("guard_terraform_plan", GUARD_PATH)
guard = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = guard
SPEC.loader.exec_module(guard)


class TerraformPlanGuardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.package = Path(self.temp.name) / "backend" / "lambda-v2" / "function.zip"
        self.package.parent.mkdir(parents=True)
        self.package.write_bytes(b"deterministic test ZIP bytes")
        self.package_hash = guard._zip_hash(self.package)
        self.filename = str(self.package.resolve())

    def tearDown(self):
        self.temp.cleanup()

    def plan(self, actions=("update",)):
        before = {
            "function_name": guard.EXPECTED_FUNCTION_NAME,
            "filename": self.filename,
            "source_code_hash": "old-hash" if actions == ("update",) else self.package_hash,
            "memory_size": 128,
            "code_sha256": "old-computed-hash",
        }
        after = dict(before)
        after["source_code_hash"] = self.package_hash
        after["code_sha256"] = "new-computed-hash" if actions == ("update",) else "old-computed-hash"
        return {
            "resource_changes": [{
                "address": guard.EXPECTED_ADDRESS,
                "mode": "managed",
                "change": {
                    "actions": list(actions),
                    "before": before,
                    "after": after,
                    "after_unknown": {"code_sha256": True},
                },
            }],
            "resource_drift": [],
            "output_changes": {},
        }

    def evaluate(self, plan):
        with patch.object(guard, "EXPECTED_PACKAGE", self.package):
            return guard.evaluate_plan(plan, self.package)

    def test_allows_expected_in_place_code_update_and_returns_fingerprint(self):
        result, fingerprint = self.evaluate(self.plan())
        self.assertEqual(result, "UPDATE")
        self.assertRegex(fingerprint, r"^[0-9a-f]{64}$")

    def test_allows_prior_runner_path_for_expected_v2_package(self):
        plan = self.plan()
        plan["resource_changes"][0]["change"]["before"]["filename"] = (
            "/previous/runner/backend/lambda-v2/function.zip"
        )
        self.assertEqual(self.evaluate(plan)[0], "UPDATE")

    def test_same_code_with_only_historical_runner_path_change_is_noop(self):
        plan = self.plan()
        change = plan["resource_changes"][0]["change"]
        change["before"]["filename"] = "/previous/runner/backend/lambda-v2/function.zip"
        change["before"]["source_code_hash"] = self.package_hash
        change["after"]["code_sha256"] = change["before"]["code_sha256"]
        self.assertEqual(self.evaluate(plan), ("NOOP", ""))

    def test_rejects_prior_path_for_different_package(self):
        plan = self.plan()
        plan["resource_changes"][0]["change"]["before"]["filename"] = (
            "/previous/runner/backend/other.zip"
        )
        with self.assertRaisesRegex(guard.PlanRejected, "current Lambda package path"):
            self.evaluate(plan)

    def test_rejects_wrong_hash(self):
        plan = self.plan()
        plan["resource_changes"][0]["change"]["after"]["source_code_hash"] = "wrong"
        with self.assertRaisesRegex(guard.PlanRejected, "does not match"):
            self.evaluate(plan)

    def test_rejects_unexpected_zip_path(self):
        plan = self.plan()
        plan["resource_changes"][0]["change"]["after"]["filename"] = "/tmp/other.zip"
        with self.assertRaisesRegex(guard.PlanRejected, "package path"):
            self.evaluate(plan)

    def test_rejects_unexpected_zip_argument(self):
        other_package = Path(self.temp.name) / "other.zip"
        other_package.write_bytes(b"other bytes")
        with patch.object(guard, "EXPECTED_PACKAGE", self.package):
            with self.assertRaisesRegex(guard.PlanRejected, "not backend/lambda-v2/function.zip"):
                guard.evaluate_plan(self.plan(), other_package)

    def test_rejects_replacement(self):
        plan = self.plan(("delete", "create"))
        with self.assertRaisesRegex(guard.PlanRejected, "replaced, deleted"):
            self.evaluate(plan)

    def test_rejects_deletion(self):
        plan = self.plan(("delete",))
        with self.assertRaisesRegex(guard.PlanRejected, "replaced, deleted"):
            self.evaluate(plan)

    def test_rejects_unrelated_resource_change(self):
        plan = self.plan()
        plan["resource_changes"].append({
            "address": "aws_dynamodb_table.visitors",
            "mode": "managed",
            "change": {"actions": ["update"]},
        })
        with self.assertRaisesRegex(guard.PlanRejected, "more than one"):
            self.evaluate(plan)

    def test_unrelated_change_is_not_misreported_as_noop(self):
        plan = self.plan(("no-op",))
        plan["resource_changes"].append({
            "address": "aws_dynamodb_table.visitors",
            "mode": "managed",
            "change": {"actions": ["update"]},
        })
        with self.assertRaisesRegex(guard.PlanRejected, "unrelated managed resource"):
            self.evaluate(plan)

    def test_rejects_unknown_function_identity(self):
        plan = self.plan()
        plan["resource_changes"][0]["change"]["after_unknown"]["function_name"] = True
        with self.assertRaisesRegex(guard.PlanRejected, "function name is unknown"):
            self.evaluate(plan)

    def test_rejects_missing_verifiable_values(self):
        plan = self.plan()
        plan["resource_changes"][0]["change"]["after"].pop("source_code_hash")
        with self.assertRaisesRegex(guard.PlanRejected, "source hash"):
            self.evaluate(plan)

    def test_rejects_drift_and_output_changes(self):
        plan = self.plan()
        plan["resource_drift"] = [{"change": {"actions": ["update"]}}]
        with self.assertRaisesRegex(guard.PlanRejected, "drift"):
            self.evaluate(plan)
        plan = self.plan()
        plan["output_changes"] = {"api_url": {"actions": ["update"]}}
        with self.assertRaisesRegex(guard.PlanRejected, "output change"):
            self.evaluate(plan)

    def test_accepts_real_noop_as_explicit_result(self):
        self.assertEqual(self.evaluate(self.plan(("no-op",))), ("NOOP", ""))


if __name__ == "__main__":
    unittest.main()
