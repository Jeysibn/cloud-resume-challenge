"""Allow only the expected in-place update of the V2 visitor Lambda code."""

import base64
import hashlib
import json
import sys
from pathlib import Path


EXPECTED_ADDRESS = "aws_lambda_function.visitor"
EXPECTED_FUNCTION_NAME = "cloud-resume-v2-visitor-function"
EXPECTED_PACKAGE = Path(__file__).resolve().parents[1] / "lambda-v2" / "function.zip"
VERIFIED_ATTRIBUTES = {"function_name", "filename", "source_code_hash"}
COMPUTED_ATTRIBUTES = {
    "code_sha256",
    "last_modified",
    "qualified_arn",
    "qualified_invoke_arn",
    "source_code_size",
}


class PlanRejected(ValueError):
    """Raised when a plan is not safe to apply as a backend code deployment."""


def reject(message):
    raise PlanRejected(message)


def _zip_hash(package):
    return base64.b64encode(hashlib.sha256(package.read_bytes()).digest()).decode("ascii")


def _has_unknown(unknown, key):
    return isinstance(unknown, dict) and bool(unknown.get(key))


def _normalized_filename(value):
    if not isinstance(value, str) or not value:
        reject("the planned Lambda package filename is missing or invalid")
    return Path(value).resolve()


def _is_expected_package_suffix(path):
    return path.parts[-3:] == ("backend", "lambda-v2", "function.zip")


def evaluate_plan(plan, package_path=EXPECTED_PACKAGE):
    """Return (NOOP|UPDATE, safe fingerprint), raising PlanRejected otherwise."""
    if not isinstance(plan, dict):
        reject("Terraform plan JSON is not an object")
    package = Path(package_path).resolve()
    if package != EXPECTED_PACKAGE.resolve():
        reject("the supplied ZIP is not backend/lambda-v2/function.zip")
    if not package.is_file():
        reject("the expected Lambda ZIP does not exist")
    package_hash = _zip_hash(package)

    if plan.get("errored"):
        reject("Terraform marked the plan as errored")
    if plan.get("deferred_changes"):
        reject("Terraform returned deferred changes that cannot be verified")

    resource_changes = plan.get("resource_changes", [])
    resource_drift = plan.get("resource_drift", [])
    output_changes = plan.get("output_changes", {})
    if not isinstance(resource_changes, list) or not all(isinstance(item, dict) for item in resource_changes):
        reject("Terraform resource changes are missing or malformed")
    if not isinstance(resource_drift, list) or not all(isinstance(item, dict) for item in resource_drift):
        reject("Terraform drift information is missing or malformed")
    if not isinstance(output_changes, dict) or not all(isinstance(item, dict) for item in output_changes.values()):
        reject("Terraform output changes are missing or malformed")
    for item in resource_changes + resource_drift:
        if not isinstance(item.get("change"), dict):
            reject("Terraform resource change values cannot be verified")

    drift = [
        item for item in resource_drift
        if item.get("change", {}).get("actions") != ["no-op"]
    ]
    if drift:
        reject("Terraform detected infrastructure drift")

    if any(item.get("actions") != ["no-op"] for item in output_changes.values()):
        reject("Terraform proposed an output change")

    changes = [
        item for item in resource_changes
        if item.get("mode") == "managed"
        and item.get("change", {}).get("actions") != ["no-op"]
    ]
    if len(changes) > 1:
        reject("the plan changes more than one managed resource")

    # Even a no-op must prove that this exact Lambda already points to this ZIP.
    lambda_entries = [
        item for item in resource_changes
        if item.get("address") == EXPECTED_ADDRESS and item.get("mode") == "managed"
    ]
    if len(lambda_entries) != 1:
        reject("the plan does not contain exactly one aws_lambda_function.visitor")
    entry = lambda_entries[0]
    change = entry.get("change") or {}
    actions = change.get("actions")
    if actions not in (["no-op"], ["update"]):
        reject("the Lambda would be replaced, deleted, created, or otherwise changed unsafely")
    if change.get("importing") or entry.get("deposed"):
        reject("imports and deposed Lambda instances are forbidden")

    before = change.get("before")
    after = change.get("after")
    unknown = change.get("after_unknown")
    before_unknown = change.get("before_unknown")
    if unknown is None:
        unknown = {}
    if before_unknown is None:
        before_unknown = {}
    if not isinstance(before, dict) or not isinstance(after, dict):
        reject("the planned Lambda values are missing")
    if not isinstance(unknown, dict) or not isinstance(before_unknown, dict):
        reject("Terraform's unknown-value markers cannot be verified")
    before_filename = _normalized_filename(before.get("filename"))
    after_filename = _normalized_filename(after.get("filename"))
    if not _is_expected_package_suffix(before_filename):
        reject("the current Lambda package path is not the V2 function.zip location")
    if after_filename != EXPECTED_PACKAGE.resolve():
        reject("the planned Lambda package path is not backend/lambda-v2/function.zip")

    for values, label in ((before, "current"), (after, "planned")):
        if values.get("function_name") != EXPECTED_FUNCTION_NAME:
            reject(f"the {label} Lambda function name is not the expected V2 function")
        if _has_unknown(unknown if label == "planned" else before_unknown, "function_name"):
            reject(f"the {label} Lambda function name is unknown")
        if _has_unknown(unknown if label == "planned" else before_unknown, "filename"):
            reject(f"the {label} Lambda package path is unknown")
        if _has_unknown(unknown if label == "planned" else before_unknown, "source_code_hash"):
            reject(f"the {label} Lambda source hash is unknown")

    if after.get("source_code_hash") != package_hash:
        reject("the planned Lambda source hash does not match the workflow ZIP")

    if actions == ["no-op"]:
        if changes:
            reject("the plan includes an unrelated managed resource change beside a no-op Lambda")
        if before.get("source_code_hash") != package_hash:
            reject("the no-op plan does not match the current Lambda package hash")
        return "NOOP", ""

    if len(changes) != 1 or changes[0] is not entry:
        reject("the plan includes an unrelated managed resource change")
    if change.get("actions") != ["update"]:
        reject("the Lambda code change must be an in-place update")

    changed = {
        key for key in before.keys() | after.keys()
        if before.get(key) != after.get(key)
    }
    unexpected = changed - VERIFIED_ATTRIBUTES - COMPUTED_ATTRIBUTES
    if unexpected:
        reject(f"unexpected Lambda attributes changed: {', '.join(sorted(unexpected))}")
    if (
        before.get("source_code_hash") == package_hash
        and before_filename != after_filename
        and changed == {"filename"}
    ):
        # Terraform can remember an absolute path from an older runner. The
        # code hash proves the bytes are already deployed; do not upload them
        # again just to rewrite that historical path in remote state.
        return "NOOP", ""
    if "source_code_hash" not in changed:
        reject("the Lambda source_code_hash did not change")

    safe_fields = {
        "address": EXPECTED_ADDRESS,
        "actions": actions,
        "function_name": EXPECTED_FUNCTION_NAME,
        "filename": "backend/lambda-v2/function.zip",
        "prior_filename": str(before_filename),
        "prior_source_code_hash": before.get("source_code_hash"),
        "source_code_hash": package_hash,
        "changed_attributes": sorted(changed - COMPUTED_ATTRIBUTES),
    }
    fingerprint = hashlib.sha256(
        json.dumps(safe_fields, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return "UPDATE", fingerprint


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 2:
        reject("usage: guard_terraform_plan.py PLAN.json backend/lambda-v2/function.zip")
    try:
        plan = json.loads(Path(args[0]).read_text(encoding="utf-8"))
        result, fingerprint = evaluate_plan(plan, args[1])
    except (OSError, json.JSONDecodeError) as error:
        reject(f"cannot read the Terraform plan safely ({type(error).__name__})")
    except PlanRejected as error:
        reject(str(error))
    if result == "NOOP":
        print("NOOP")
    else:
        print(f"UPDATE {fingerprint}")


if __name__ == "__main__":
    try:
        main()
    except PlanRejected as error:
        print(f"Backend Terraform plan rejected: {error}", file=sys.stderr)
        raise SystemExit(1)
