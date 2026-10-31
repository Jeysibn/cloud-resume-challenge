"""Build the same ZIP bytes for the same handler bytes, without AWS access."""
import base64
import hashlib
from pathlib import Path
from zipfile import ZIP_STORED, ZipFile, ZipInfo


def main():
    directory = Path(__file__).resolve().parent
    source = (directory / "lambda_function.py").read_bytes()
    package = directory / "function.zip"
    entry = ZipInfo("lambda_function.py", date_time=(1980, 1, 1, 0, 0, 0))
    entry.create_system = 3
    entry.external_attr = 0o100644 << 16
    entry.compress_type = ZIP_STORED
    with ZipFile(package, "w") as archive:
        archive.writestr(entry, source)
    with ZipFile(package) as archive:
        assert archive.testzip() is None
        assert archive.namelist() == ["lambda_function.py"]
        assert archive.read("lambda_function.py") == source
    digest = base64.b64encode(hashlib.sha256(package.read_bytes()).digest()).decode()
    print(f"Verified package: {package}")
    print(f"Base64 SHA-256: {digest}")


if __name__ == "__main__":
    main()
