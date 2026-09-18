"""Sensitive-data redaction and structured logging tests."""

import json
import logging

from app.core.logging import JSONFormatter, redact_sensitive


def test_sensitive_values_are_redacted() -> None:
    value = (
        "Bearer abc.def-123 user@example.com +91 9876543210 "
        "https://example.test/file?X-Amz-Signature=secret-value&x=1"
    )

    redacted = redact_sensitive(value)

    assert "abc.def-123" not in redacted
    assert "user@example.com" not in redacted
    assert "9876543210" not in redacted
    assert "secret-value" not in redacted
    assert "Bearer [REDACTED]" in redacted
    assert "[EMAIL]" in redacted
    assert "[PHONE]" in redacted


def test_json_formatter_includes_safe_request_metadata() -> None:
    record = logging.LogRecord(
        name="forhire",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="request_completed for user@example.com",
        args=(),
        exc_info=None,
    )
    record.request_id = "req_test"
    record.method = "GET"
    record.route = "/api/v1/health/live"
    record.status_code = 200
    record.duration_ms = 1.25

    payload = json.loads(JSONFormatter().format(record))

    assert payload["message"] == "request_completed for [EMAIL]"
    assert payload["request_id"] == "req_test"
    assert payload["method"] == "GET"
    assert payload["route"] == "/api/v1/health/live"
    assert payload["status_code"] == 200
    assert payload["duration_ms"] == 1.25
