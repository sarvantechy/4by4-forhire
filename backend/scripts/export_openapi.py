"""Export the deterministic public OpenAPI contract."""

import json
from pathlib import Path

from app.main import create_app

OUTPUT_PATH = Path(__file__).parents[2] / "packages" / "contracts" / "openapi.json"


def main() -> None:
    """Write the current application schema with stable formatting."""
    schema = create_app().openapi()
    content = json.dumps(schema, indent=2, sort_keys=True, ensure_ascii=True) + "\n"
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(content, encoding="utf-8")


if __name__ == "__main__":
    main()
