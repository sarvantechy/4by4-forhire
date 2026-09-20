"""PostgreSQL-backed store domain integration tests."""

import io
import os
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.core.config import Settings
from app.domains.identity.router import get_code_sender
from app.main import create_app

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL is required for PostgreSQL integration tests",
)

STANDARD_CATEGORY_ID = "10000000-0000-0000-0000-000000000003"

TABLE_NAMES = (
    "listing_store_history, store_status_history, stores, "
    "moderation_actions, platform_staff, reports, disputes, reviews, "
    "payment_acknowledgements, condition_reports, handover_confirmations, "
    "handover_challenges, fulfillments, "
    "messages, conversations, inventory_allocations, booking_status_history, bookings, "
    "booking_quotes, availability_blocks, listing_status_history, listing_prices, listings, "
    "seller_headers, "
    "auth_sessions, otp_challenges, auth_identities, user_addresses, user_profiles, users"
)


@dataclass
class SentCode:
    destination: str
    code: str
    purpose: str


class RecordingCodeSender:
    def __init__(self) -> None:
        self.sent: list[SentCode] = []

    def send(self, *, destination: str, code: str, purpose: str) -> None:
        self.sent.append(SentCode(destination, code, purpose))


@pytest.fixture
def store_client() -> tuple[TestClient, RecordingCodeSender]:
    assert TEST_DATABASE_URL is not None
    engine = create_engine(TEST_DATABASE_URL)
    with engine.begin() as connection:
        connection.execute(text(f"TRUNCATE TABLE {TABLE_NAMES} CASCADE"))

    sender = RecordingCodeSender()
    settings = Settings(
        app_env="test",
        database_url=TEST_DATABASE_URL,
        session_secret="integration-session-secret-at-least-32-characters",
        _env_file=None,
    )
    application = create_app(settings)
    application.dependency_overrides[get_code_sender] = lambda: sender
    with TestClient(application) as client:
        yield client, sender

    with engine.begin() as connection:
        connection.execute(text(f"TRUNCATE TABLE {TABLE_NAMES} CASCADE"))
    engine.dispose()


def _create_mobile_user(
    client: TestClient, sender: RecordingCodeSender, mobile: str, name: str
) -> dict[str, str]:
    challenge = client.post("/api/v1/auth/mobile/request-otp", json={"mobile_number": mobile})
    verified = client.post(
        "/api/v1/auth/mobile/verify-otp",
        json={
            "challenge_id": challenge.json()["challenge_id"],
            "code": sender.sent[-1].code,
            "display_name": name,
            "client_type": "mobile",
        },
    )
    return {"Authorization": f"Bearer {verified.json()['access_token']}"}


def _create_store(client: TestClient, headers: dict[str, str], display_name: str) -> dict:
    response = client.post(
        "/api/v1/me/stores",
        headers=headers,
        json={
            "display_name": display_name,
            "description": "Rental tools and equipment for the local area.",
            "public_locality": "Nagercoil",
        },
    )
    assert response.status_code == 201
    return response.json()


def _create_listing(
    client: TestClient, headers: dict[str, str], *, title: str, store_id: str | None = None
) -> dict:
    payload = {
        "category_id": STANDARD_CATEGORY_ID,
        "title": title,
        "description": "A well maintained rental item ready for pickup.",
        "condition": "good",
        "quantity": 1,
        "pickup_enabled": True,
        "delivery_enabled": False,
        "public_locality": "Nagercoil",
        "prices": [{"unit": "day", "amount_minor": 40000}],
    }
    if store_id is not None:
        payload["store_id"] = store_id
    response = client.post("/api/v1/listings", headers=headers, json=payload)
    assert response.status_code == 201
    return response.json()


def test_store_creation_limit_and_slug_uniqueness(
    store_client: tuple[TestClient, RecordingCodeSender],
) -> None:
    client, sender = store_client
    owner_headers = _create_mobile_user(client, sender, "9100000001", "Store Owner")

    first = _create_store(client, owner_headers, "Nagercoil Tool Rentals")
    second = _create_store(client, owner_headers, "Nagercoil Tool Rentals")
    assert first["slug"] != second["slug"]
    assert first["slug"] == "nagercoil-tool-rentals"
    assert second["slug"] == "nagercoil-tool-rentals-2"

    for index in range(3, 6):
        _create_store(client, owner_headers, f"Store Number {index}")

    listing = client.get("/api/v1/me/stores", headers=owner_headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 5

    over_limit = client.post(
        "/api/v1/me/stores",
        headers=owner_headers,
        json={
            "display_name": "One Store Too Many",
            "description": "",
            "public_locality": "Nagercoil",
        },
    )
    assert over_limit.status_code == 409
    assert over_limit.json()["error"]["code"] == "STORE_LIMIT_REACHED"


def test_store_cross_user_authorization_denied(
    store_client: tuple[TestClient, RecordingCodeSender],
) -> None:
    client, sender = store_client
    owner_headers = _create_mobile_user(client, sender, "9100000011", "Store Owner A")
    other_headers = _create_mobile_user(client, sender, "9100000012", "Store Owner B")
    store = _create_store(client, owner_headers, "Owner A Rentals")
    store_id = store["id"]

    assert client.get(f"/api/v1/me/stores/{store_id}", headers=other_headers).status_code == 403
    assert (
        client.patch(
            f"/api/v1/me/stores/{store_id}",
            headers=other_headers,
            json={"display_name": "Hijacked", "version": 1},
        ).status_code
        == 403
    )
    assert (
        client.post(f"/api/v1/me/stores/{store_id}/pause", headers=other_headers).status_code
        == 403
    )
    assert (
        client.post(f"/api/v1/me/stores/{store_id}/archive", headers=other_headers).status_code
        == 403
    )

    listing = _create_listing(client, owner_headers, title="Owner A Ladder")
    denied_assignment = client.put(
        f"/api/v1/me/listings/{listing['id']}/store",
        headers=other_headers,
        json={"store_id": store_id, "listing_version": listing["version"]},
    )
    assert denied_assignment.status_code == 403


def test_listing_create_respects_store_status(
    store_client: tuple[TestClient, RecordingCodeSender],
) -> None:
    client, sender = store_client
    owner_headers = _create_mobile_user(client, sender, "9100000021", "Store Publisher")
    store = _create_store(client, owner_headers, "Publisher Store")

    listing = _create_listing(
        client, owner_headers, title="Store Ladder", store_id=store["id"]
    )
    assert listing["store"]["id"] == store["id"]
    assert listing["store"]["slug"] == store["slug"]

    client.post(f"/api/v1/me/stores/{store['id']}/pause", headers=owner_headers)
    rejected = client.post(
        "/api/v1/listings",
        headers=owner_headers,
        json={
            "category_id": STANDARD_CATEGORY_ID,
            "title": "Second Store Ladder",
            "description": "Another rental item ready for pickup.",
            "condition": "good",
            "quantity": 1,
            "pickup_enabled": True,
            "delivery_enabled": False,
            "public_locality": "Nagercoil",
            "prices": [{"unit": "day", "amount_minor": 40000}],
            "store_id": store["id"],
        },
    )
    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "STORE_TRANSITION_DENIED"


def test_listing_assignment_move_detach_and_idempotency(
    store_client: tuple[TestClient, RecordingCodeSender],
) -> None:
    client, sender = store_client
    owner_headers = _create_mobile_user(client, sender, "9100000031", "Assignment Owner")
    store_one = _create_store(client, owner_headers, "First Store")
    store_two = _create_store(client, owner_headers, "Second Store")
    listing = _create_listing(client, owner_headers, title="Movable Drill")

    moved = client.put(
        f"/api/v1/me/listings/{listing['id']}/store",
        headers=owner_headers,
        json={"store_id": store_one["id"], "listing_version": listing["version"]},
    )
    assert moved.status_code == 200
    assert moved.json()["store"]["id"] == store_one["id"]
    version_after_move = moved.json()["version"]

    repeated = client.put(
        f"/api/v1/me/listings/{listing['id']}/store",
        headers=owner_headers,
        json={"store_id": store_one["id"], "listing_version": version_after_move},
    )
    assert repeated.status_code == 200
    assert repeated.json()["version"] == version_after_move

    stale = client.put(
        f"/api/v1/me/listings/{listing['id']}/store",
        headers=owner_headers,
        json={"store_id": store_two["id"], "listing_version": 1},
    )
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "LISTING_VERSION_CONFLICT"

    moved_again = client.put(
        f"/api/v1/me/listings/{listing['id']}/store",
        headers=owner_headers,
        json={"store_id": store_two["id"], "listing_version": version_after_move},
    )
    assert moved_again.status_code == 200
    assert moved_again.json()["store"]["id"] == store_two["id"]
    version_after_second_move = moved_again.json()["version"]

    detached = client.put(
        f"/api/v1/me/listings/{listing['id']}/store",
        headers=owner_headers,
        json={"store_id": None, "listing_version": version_after_second_move},
    )
    assert detached.status_code == 200
    assert detached.json()["store"] is None


def test_store_pause_resume_public_visibility(
    store_client: tuple[TestClient, RecordingCodeSender],
) -> None:
    client, sender = store_client
    owner_headers = _create_mobile_user(client, sender, "9100000041", "Visibility Owner")
    store = _create_store(client, owner_headers, "Visibility Store")
    listing = _create_listing(
        client, owner_headers, title="Visible Generator", store_id=store["id"]
    )
    client.post(f"/api/v1/listings/{listing['id']}/publish", headers=owner_headers)

    visible = client.get(f"/api/v1/stores/{store['slug']}")
    assert visible.status_code == 200
    listings = client.get(f"/api/v1/stores/{store['slug']}/listings")
    assert listings.status_code == 200
    assert [item["title"] for item in listings.json()] == ["Visible Generator"]
    assert client.get(f"/api/v1/listings/{listing['id']}").status_code == 200

    paused = client.post(f"/api/v1/me/stores/{store['id']}/pause", headers=owner_headers)
    assert paused.status_code == 200
    assert client.get(f"/api/v1/stores/{store['slug']}").status_code == 404
    assert client.get(f"/api/v1/listings/{listing['id']}").status_code == 404
    owner_view = client.get(
        f"/api/v1/me/stores/{store['id']}/listings", headers=owner_headers
    )
    assert owner_view.status_code == 200
    assert len(owner_view.json()) == 1

    resumed = client.post(f"/api/v1/me/stores/{store['id']}/resume", headers=owner_headers)
    assert resumed.status_code == 200
    assert client.get(f"/api/v1/stores/{store['slug']}").status_code == 200
    assert client.get(f"/api/v1/listings/{listing['id']}").status_code == 200


def test_store_archive_detaches_listings_atomically_and_idempotent(
    store_client: tuple[TestClient, RecordingCodeSender],
) -> None:
    client, sender = store_client
    owner_headers = _create_mobile_user(client, sender, "9100000051", "Archive Owner")
    store = _create_store(client, owner_headers, "Archive Store")
    listing = _create_listing(
        client, owner_headers, title="Archived Store Mower", store_id=store["id"]
    )
    published = client.post(f"/api/v1/listings/{listing['id']}/publish", headers=owner_headers)
    assert published.status_code == 200

    archived = client.post(f"/api/v1/me/stores/{store['id']}/archive", headers=owner_headers)
    assert archived.status_code == 200
    assert archived.json()["status"] == "archived"

    detail = client.get(f"/api/v1/listings/{listing['id']}")
    assert detail.status_code == 200
    assert detail.json()["store"] is None
    assert detail.json()["status"] == "active"

    repeated_archive = client.post(
        f"/api/v1/me/stores/{store['id']}/archive", headers=owner_headers
    )
    assert repeated_archive.status_code == 200
    assert repeated_archive.json()["version"] == archived.json()["version"]


def test_store_media_type_and_size_validation(
    store_client: tuple[TestClient, RecordingCodeSender],
) -> None:
    client, sender = store_client
    owner_headers = _create_mobile_user(client, sender, "9100000061", "Media Owner")
    store = _create_store(client, owner_headers, "Media Store")

    invalid_type = client.post(
        f"/api/v1/me/stores/{store['id']}/logo",
        headers=owner_headers,
        files={"file": ("logo.txt", io.BytesIO(b"not-an-image"), "text/plain")},
    )
    assert invalid_type.status_code == 422
    assert invalid_type.json()["error"]["code"] == "STORE_MEDIA_TYPE_INVALID"

    oversized = client.post(
        f"/api/v1/me/stores/{store['id']}/logo",
        headers=owner_headers,
        files={
            "file": (
                "logo.png",
                io.BytesIO(b"0" * (8 * 1024 * 1024 + 1)),
                "image/png",
            )
        },
    )
    assert oversized.status_code == 413
    assert oversized.json()["error"]["code"] == "STORE_MEDIA_TOO_LARGE"
