"""PostgreSQL-backed identity API integration tests."""

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
def identity_client() -> tuple[TestClient, RecordingCodeSender]:
    assert TEST_DATABASE_URL is not None
    engine = create_engine(TEST_DATABASE_URL)
    table_names = (
        "moderation_actions, platform_staff, reports, disputes, reviews, "
        "payment_acknowledgements, condition_reports, handover_confirmations, "
        "handover_challenges, fulfillments, "
        "messages, conversations, inventory_allocations, booking_status_history, bookings, "
        "booking_quotes, availability_blocks, listing_status_history, listing_prices, listings, "
        "seller_headers, "
        "auth_sessions, otp_challenges, auth_identities, user_addresses, user_profiles, users"
    )
    with engine.begin() as connection:
        connection.execute(text(f"TRUNCATE TABLE {table_names} CASCADE"))

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
        connection.execute(text(f"TRUNCATE TABLE {table_names} CASCADE"))
    engine.dispose()


def test_email_registration_web_cookie_and_csrf(
    identity_client: tuple[TestClient, RecordingCodeSender],
) -> None:
    client, sender = identity_client

    registration = client.post(
        "/api/v1/auth/email/register",
        json={
            "email": "Owner@Example.com",
            "password": "correct-horse-battery-staple",
            "display_name": "Kumar Tools",
        },
    )

    assert registration.status_code == 202
    assert sender.sent[-1].destination == "owner@example.com"
    verification = client.post(
        "/api/v1/auth/email/verify",
        json={
            "challenge_id": registration.json()["challenge_id"],
            "code": sender.sent[-1].code,
            "client_type": "customer_web",
            "device_label": "Integration browser",
        },
    )
    assert verification.status_code == 200
    assert verification.json()["access_token"] is None
    assert verification.json()["refresh_token"] is None
    assert verification.cookies.get("forhire_access")
    csrf_token = verification.json()["csrf_token"]

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["display_name"] == "Kumar Tools"

    denied_logout = client.post("/api/v1/auth/logout")
    assert denied_logout.status_code == 403
    assert denied_logout.json()["error"]["code"] == "CSRF_INVALID"

    logout = client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf_token})
    assert logout.status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401


def test_mobile_otp_refresh_rotation_and_replay_denial(
    identity_client: tuple[TestClient, RecordingCodeSender],
) -> None:
    client, sender = identity_client

    requested = client.post(
        "/api/v1/auth/mobile/request-otp",
        json={"mobile_number": "98765 43210"},
    )
    assert requested.status_code == 202
    assert sender.sent[-1].destination == "+919876543210"

    verified = client.post(
        "/api/v1/auth/mobile/verify-otp",
        json={
            "challenge_id": requested.json()["challenge_id"],
            "code": sender.sent[-1].code,
            "display_name": "Anu Rentals",
            "client_type": "mobile",
            "device_label": "Android test device",
        },
    )
    assert verified.status_code == 200
    access_token = verified.json()["access_token"]
    refresh_token = verified.json()["refresh_token"]

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me.status_code == 200
    assert me.json()["display_name"] == "Anu Rentals"

    updated = client.patch(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"display_name": "Anu Tool Rentals", "preferred_language": "ta"},
    )
    assert updated.status_code == 200
    assert updated.json()["display_name"] == "Anu Tool Rentals"
    assert updated.json()["preferred_language"] == "ta"

    address = client.post(
        "/api/v1/auth/me/addresses",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "label": "Workshop",
            "address_line_1": "12 Market Road",
            "locality": "Nagercoil",
            "district": "Kanyakumari",
            "state": "Tamil Nadu",
            "postal_code": "629001",
        },
    )
    assert address.status_code == 201
    addresses = client.get(
        "/api/v1/auth/me/addresses",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert addresses.status_code == 200
    assert addresses.json()[0]["label"] == "Workshop"

    rotated = client.post(
        "/api/v1/auth/token/refresh",
        json={"refresh_token": refresh_token},
    )
    assert rotated.status_code == 200
    assert rotated.json()["refresh_token"] != refresh_token

    replay = client.post(
        "/api/v1/auth/token/refresh",
        json={"refresh_token": refresh_token},
    )
    assert replay.status_code == 401
    assert replay.json()["error"]["code"] == "SESSION_INVALID"


def test_demo_session_uses_only_configured_existing_identity(
    identity_client: tuple[TestClient, RecordingCodeSender],
) -> None:
    client, sender = identity_client
    unavailable = client.post(
        "/api/v1/auth/demo",
        json={"client_type": "mobile", "device_label": "Internal test"},
    )
    assert unavailable.status_code == 404
    assert unavailable.json()["error"]["code"] == "DEMO_LOGIN_UNAVAILABLE"

    requested = client.post(
        "/api/v1/auth/mobile/request-otp",
        json={"mobile_number": "+919999999999"},
    )
    verified = client.post(
        "/api/v1/auth/mobile/verify-otp",
        json={
            "challenge_id": requested.json()["challenge_id"],
            "code": sender.sent[-1].code,
            "display_name": "Demo Renter",
            "client_type": "mobile",
        },
    )
    demo_user_id = verified.json()["user"]["id"]

    demo = client.post(
        "/api/v1/auth/demo",
        json={"client_type": "mobile", "device_label": "Internal test"},
    )
    assert demo.status_code == 200
    assert demo.json()["user"]["id"] == demo_user_id
    assert demo.json()["access_token"]
    assert demo.json()["refresh_token"]


def test_account_deactivation_removes_personal_data_and_public_inventory(
    identity_client: tuple[TestClient, RecordingCodeSender],
) -> None:
    client, sender = identity_client
    requested = client.post(
        "/api/v1/auth/mobile/request-otp",
        json={"mobile_number": "9876543211"},
    )
    verified = client.post(
        "/api/v1/auth/mobile/verify-otp",
        json={
            "challenge_id": requested.json()["challenge_id"],
            "code": sender.sent[-1].code,
            "display_name": "Deletion Test",
            "client_type": "mobile",
        },
    )
    access_token = verified.json()["access_token"]
    refresh_token = verified.json()["refresh_token"]
    headers = {"Authorization": f"Bearer {access_token}"}
    user_id = verified.json()["user"]["id"]

    address = client.post(
        "/api/v1/auth/me/addresses",
        headers=headers,
        json={
            "label": "Home",
            "address_line_1": "12 Privacy Street",
            "locality": "Nagercoil",
            "district": "Kanyakumari",
            "state": "Tamil Nadu",
            "postal_code": "629001",
        },
    )
    assert address.status_code == 201
    listing = client.post(
        "/api/v1/listings",
        headers=headers,
        json={
            "category_id": "10000000-0000-0000-0000-000000000003",
            "title": "Deletion test listing",
            "description": "This listing must become unavailable after deletion.",
            "condition": "good",
            "quantity": 1,
            "pickup_enabled": True,
            "delivery_enabled": False,
            "public_locality": "Nagercoil",
            "prices": [{"unit": "day", "amount_minor": 10000}],
        },
    )
    listing_id = listing.json()["id"]
    assert client.post(f"/api/v1/listings/{listing_id}/publish", headers=headers).status_code == 200

    deleted = client.delete("/api/v1/auth/me", headers=headers)
    assert deleted.status_code == 204
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    assert client.post(
        "/api/v1/auth/token/refresh", json={"refresh_token": refresh_token}
    ).status_code == 401
    assert client.get(f"/api/v1/listings/{listing_id}").status_code == 404

    assert TEST_DATABASE_URL is not None
    engine = create_engine(TEST_DATABASE_URL)
    with engine.connect() as connection:
        account = connection.execute(
            text(
                "SELECT u.status, u.deactivated_at, p.display_name, p.home_locality "
                "FROM users u JOIN user_profiles p ON p.user_id = u.id WHERE u.id = :user_id"
            ),
            {"user_id": user_id},
        ).one()
        assert account.status == "deactivated"
        assert account.deactivated_at is not None
        assert account.display_name == "Deleted user"
        assert account.home_locality is None
        assert connection.execute(
            text("SELECT count(*) FROM auth_identities WHERE user_id = :user_id"),
            {"user_id": user_id},
        ).scalar_one() == 0
        assert connection.execute(
            text("SELECT count(*) FROM user_addresses WHERE user_id = :user_id"),
            {"user_id": user_id},
        ).scalar_one() == 0
        listing_row = connection.execute(
            text(
                "SELECT status, public_locality, latitude, longitude "
                "FROM listings WHERE id = :listing_id"
            ),
            {"listing_id": listing_id},
        ).one()
        assert listing_row.status == "archived"
        assert listing_row.public_locality == "Unavailable"
        assert listing_row.latitude is None
        assert listing_row.longitude is None
    engine.dispose()


def test_listing_lifecycle_visibility_and_risk_review(
    identity_client: tuple[TestClient, RecordingCodeSender],
) -> None:
    client, sender = identity_client
    requested = client.post(
        "/api/v1/auth/mobile/request-otp",
        json={"mobile_number": "9123456789"},
    )
    verified = client.post(
        "/api/v1/auth/mobile/verify-otp",
        json={
            "challenge_id": requested.json()["challenge_id"],
            "code": sender.sent[-1].code,
            "display_name": "Catalog Owner",
            "client_type": "mobile",
        },
    )
    headers = {"Authorization": f"Bearer {verified.json()['access_token']}"}

    created = client.post(
        "/api/v1/listings",
        headers=headers,
        json={
            "category_id": "10000000-0000-0000-0000-000000000003",
            "title": "Pressure washer",
            "description": "Clean pressure washer with hose and spray attachments.",
            "condition": "good",
            "quantity": 1,
            "pickup_enabled": True,
            "delivery_enabled": False,
            "public_locality": "Nagercoil",
            "latitude": 8.1833,
            "longitude": 77.4119,
            "prices": [{"unit": "day", "amount_minor": 60000, "deposit_minor": 100000}],
        },
    )
    assert created.status_code == 201
    assert created.json()["status"] == "draft"
    owner_detail = client.get(
        f"/api/v1/listings/{created.json()['id']}", headers=headers
    )
    assert owner_detail.status_code == 200
    assert owner_detail.json()["status"] == "draft"

    other_requested = client.post(
        "/api/v1/auth/mobile/request-otp",
        json={"mobile_number": "9123456790"},
    )
    other_verified = client.post(
        "/api/v1/auth/mobile/verify-otp",
        json={
            "challenge_id": other_requested.json()["challenge_id"],
            "code": sender.sent[-1].code,
            "display_name": "Other User",
            "client_type": "mobile",
        },
    )
    other_headers = {
        "Authorization": f"Bearer {other_verified.json()['access_token']}"
    }
    assert (
        client.get(
            f"/api/v1/listings/{created.json()['id']}", headers=other_headers
        ).status_code
        == 404
    )
    assert client.get(f"/api/v1/listings/{created.json()['id']}").status_code == 404

    invalid_fulfillment = client.patch(
        f"/api/v1/listings/{created.json()['id']}",
        headers=headers,
        json={
            "delivery_enabled": False,
            "pickup_enabled": False,
            "version": created.json()["version"],
        },
    )
    assert invalid_fulfillment.status_code == 422
    assert invalid_fulfillment.json()["error"]["code"] == "LISTING_FULFILLMENT_REQUIRED"

    updated = client.patch(
        f"/api/v1/listings/{created.json()['id']}",
        headers=headers,
        json={
            "condition": "like_new",
            "delivery_enabled": True,
            "latitude": 8.19,
            "longitude": 77.42,
            "prices": [
                {
                    "unit": "day",
                    "amount_minor": 65000,
                    "deposit_minor": 75000,
                    "currency": "INR",
                }
            ],
            "quantity": 2,
            "version": created.json()["version"],
        },
    )
    assert updated.status_code == 200
    assert updated.json()["condition"] == "like_new"
    assert updated.json()["delivery_enabled"] is True
    assert updated.json()["latitude"] == 8.19
    assert updated.json()["longitude"] == 77.42
    assert updated.json()["prices"][0]["unit"] == "day"
    assert updated.json()["prices"][0]["amount_minor"] == 65000
    assert updated.json()["quantity"] == 2

    published = client.post(f"/api/v1/listings/{created.json()['id']}/publish", headers=headers)
    assert published.status_code == 200
    assert published.json()["status"] == "active"
    self_quote = client.post(
        f"/api/v1/listings/{created.json()['id']}/quotes",
        headers=headers,
        json={
            "starts_at": "2026-10-10T04:30:00Z",
            "ends_at": "2026-10-11T04:30:00Z",
            "quantity": 1,
            "unit": "day",
        },
    )
    assert self_quote.status_code == 409
    assert self_quote.json()["error"]["code"] == "SELF_BOOKING_DENIED"
    search = client.get(
        "/api/v1/listings",
        params={"q": "pressure", "latitude": 8.18, "longitude": 77.41},
    )
    assert search.status_code == 200
    assert [item["title"] for item in search.json()] == ["Pressure washer"]

    controlled = client.post(
        "/api/v1/listings",
        headers=headers,
        json={
            "category_id": "10000000-0000-0000-0000-000000000001",
            "title": "Cordless drill kit",
            "description": "Cordless drill kit with charger and common drill bits.",
            "condition": "good",
            "quantity": 1,
            "pickup_enabled": True,
            "delivery_enabled": False,
            "public_locality": "Nagercoil",
            "prices": [{"unit": "day", "amount_minor": 35000}],
        },
    )
    held = client.post(f"/api/v1/listings/{controlled.json()['id']}/publish", headers=headers)
    assert held.status_code == 200
    assert held.json()["status"] == "active"
    assert client.get(f"/api/v1/listings/{controlled.json()['id']}").status_code == 200


def test_owner_approval_allocation_and_private_messages(
    identity_client: tuple[TestClient, RecordingCodeSender],
) -> None:
    client, sender = identity_client

    def create_mobile_user(mobile: str, name: str) -> dict[str, str]:
        challenge = client.post(
            "/api/v1/auth/mobile/request-otp", json={"mobile_number": mobile}
        )
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

    owner_headers = create_mobile_user("9000000001", "Booking Owner")
    renter_headers = create_mobile_user("9000000002", "Booking Renter")
    second_renter_headers = create_mobile_user("9000000003", "Second Renter")
    listing = client.post(
        "/api/v1/listings",
        headers=owner_headers,
        json={
            "category_id": "10000000-0000-0000-0000-000000000003",
            "title": "Wet and dry vacuum",
            "description": "Commercial wet and dry vacuum with extension pipe.",
            "condition": "good",
            "quantity": 1,
            "pickup_enabled": True,
            "delivery_enabled": False,
            "public_locality": "Nagercoil",
            "prices": [{"unit": "day", "amount_minor": 45000}],
        },
    )
    listing_id = listing.json()["id"]
    published = client.post(
        f"/api/v1/listings/{listing_id}/publish", headers=owner_headers
    )
    assert published.status_code == 200

    inquiry = client.post(
        f"/api/v1/listings/{listing_id}/messages",
        headers=renter_headers,
        json={
            "client_message_id": "20000000-0000-0000-0000-000000000000",
            "body": "Is this available after 10 AM?",
        },
    )
    assert inquiry.status_code == 201

    quote_payload = {
        "starts_at": "2026-10-10T04:30:00Z",
        "ends_at": "2026-10-12T04:30:00Z",
        "quantity": 1,
        "unit": "day",
    }
    quote = client.post(
        f"/api/v1/listings/{listing_id}/quotes",
        headers=renter_headers,
        json=quote_payload,
    )
    booking = client.post(
        "/api/v1/bookings",
        headers=renter_headers,
        json={"quote_id": quote.json()["id"], "fulfillment_method": "pickup"},
    )
    booking_id = booking.json()["id"]
    assert booking.json()["status"] == "requested"
    booking_messages = client.get(
        f"/api/v1/bookings/{booking_id}/messages", headers=renter_headers
    )
    assert booking_messages.status_code == 200
    assert [item["body"] for item in booking_messages.json()] == [
        "Is this available after 10 AM?"
    ]

    blocked = client.post(
        f"/api/v1/bookings/{booking_id}/messages",
        headers=renter_headers,
        json={
            "client_message_id": "20000000-0000-0000-0000-000000000001",
            "body": "Call me at 9876543210",
        },
    )
    assert blocked.status_code == 422
    assert blocked.json()["error"]["code"] == "MESSAGE_PRIVATE_CONTACT_BLOCKED"
    message_payload = {
        "client_message_id": "20000000-0000-0000-0000-000000000002",
        "body": "Can I collect this after 10 AM?",
    }
    first_message = client.post(
        f"/api/v1/bookings/{booking_id}/messages",
        headers=renter_headers,
        json=message_payload,
    )
    repeated_message = client.post(
        f"/api/v1/bookings/{booking_id}/messages",
        headers=renter_headers,
        json=message_payload,
    )
    assert first_message.json()["id"] == repeated_message.json()["id"]

    accepted = client.post(f"/api/v1/bookings/{booking_id}/accept", headers=owner_headers)
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"

    second_quote = client.post(
        f"/api/v1/listings/{listing_id}/quotes",
        headers=second_renter_headers,
        json=quote_payload,
    )
    second_booking = client.post(
        "/api/v1/bookings",
        headers=second_renter_headers,
        json={"quote_id": second_quote.json()["id"], "fulfillment_method": "pickup"},
    )
    conflict = client.post(
        f"/api/v1/bookings/{second_booking.json()['id']}/accept",
        headers=owner_headers,
    )
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "BOOKING_AVAILABILITY_CHANGED"


def test_handover_return_trust_and_staff_moderation(
    identity_client: tuple[TestClient, RecordingCodeSender],
) -> None:
    client, sender = identity_client

    def create_mobile_user(mobile: str, name: str) -> tuple[dict[str, str], str]:
        challenge = client.post(
            "/api/v1/auth/mobile/request-otp", json={"mobile_number": mobile}
        )
        verified = client.post(
            "/api/v1/auth/mobile/verify-otp",
            json={
                "challenge_id": challenge.json()["challenge_id"],
                "code": sender.sent[-1].code,
                "display_name": name,
                "client_type": "mobile",
            },
        )
        headers = {"Authorization": f"Bearer {verified.json()['access_token']}"}
        actor_id = client.get("/api/v1/auth/me", headers=headers).json()["id"]
        return headers, actor_id

    owner_headers, owner_id = create_mobile_user("9000000011", "Handover Owner")
    renter_headers, _ = create_mobile_user("9000000012", "Handover Renter")
    listing = client.post(
        "/api/v1/listings",
        headers=owner_headers,
        json={
            "category_id": "10000000-0000-0000-0000-000000000003",
            "title": "Portable carpet cleaner",
            "description": "Portable carpet cleaner with upholstery attachment and clean tank.",
            "condition": "good",
            "quantity": 1,
            "pickup_enabled": True,
            "delivery_enabled": False,
            "public_locality": "Nagercoil",
            "prices": [{"unit": "day", "amount_minor": 50000, "deposit_minor": 75000}],
        },
    )
    listing_id = listing.json()["id"]
    assert client.post(
        f"/api/v1/listings/{listing_id}/publish", headers=owner_headers
    ).status_code == 200
    quote = client.post(
        f"/api/v1/listings/{listing_id}/quotes",
        headers=renter_headers,
        json={
            "starts_at": "2026-11-10T04:30:00Z",
            "ends_at": "2026-11-12T04:30:00Z",
            "quantity": 1,
            "unit": "day",
        },
    )
    booking = client.post(
        "/api/v1/bookings",
        headers=renter_headers,
        json={"quote_id": quote.json()["id"], "fulfillment_method": "pickup"},
    )
    booking_id = booking.json()["id"]
    accepted = client.post(f"/api/v1/bookings/{booking_id}/accept", headers=owner_headers)
    assert accepted.json()["status"] == "accepted"

    schedule = client.put(
        f"/api/v1/bookings/{booking_id}/fulfillment",
        headers=owner_headers,
        json={
            "scheduled_at": "2026-11-10T05:00:00Z",
            "private_instructions": "Use the side entrance.",
        },
    )
    assert schedule.status_code == 200
    assert schedule.json()["status"] == "scheduled"
    handover_condition = client.post(
        f"/api/v1/bookings/{booking_id}/condition-reports",
        headers=owner_headers,
        json={
            "phase": "handover",
            "checklist": {"tank_clean": True, "attachments": 2},
            "notes": "Demonstrated operation to renter.",
        },
    )
    assert handover_condition.status_code == 201
    handover = client.post(
        f"/api/v1/bookings/{booking_id}/handover/challenge", headers=owner_headers
    )
    handover_payload = {
        "challenge_id": handover.json()["challenge_id"],
        "code": handover.json()["code"],
    }
    owner_confirmation = client.post(
        f"/api/v1/bookings/{booking_id}/challenge/confirm",
        headers=owner_headers,
        json=handover_payload,
    )
    assert owner_confirmation.json()["status"] == "ready_for_handover"
    renter_confirmation = client.post(
        f"/api/v1/bookings/{booking_id}/challenge/confirm",
        headers=renter_headers,
        json=handover_payload,
    )
    assert renter_confirmation.json()["status"] == "active"

    owner_payment = client.post(
        f"/api/v1/bookings/{booking_id}/payment-at-pickup/acknowledge",
        headers=owner_headers,
        json={"disagreement": False},
    )
    renter_payment = client.post(
        f"/api/v1/bookings/{booking_id}/payment-at-pickup/acknowledge",
        headers=renter_headers,
        json={"disagreement": False},
    )
    assert owner_payment.status_code == renter_payment.status_code == 201

    initiated = client.post(
        f"/api/v1/bookings/{booking_id}/return/initiate", headers=renter_headers
    )
    assert initiated.json()["status"] == "return_pending"
    return_condition = client.post(
        f"/api/v1/bookings/{booking_id}/condition-reports",
        headers=renter_headers,
        json={
            "phase": "return",
            "checklist": {"tank_clean": True, "attachments": 2},
            "notes": "Cleaned after use.",
        },
    )
    assert return_condition.status_code == 201
    returned = client.post(
        f"/api/v1/bookings/{booking_id}/return/challenge", headers=owner_headers
    )
    return_payload = {
        "challenge_id": returned.json()["challenge_id"],
        "code": returned.json()["code"],
    }
    client.post(
        f"/api/v1/bookings/{booking_id}/challenge/confirm",
        headers=owner_headers,
        json=return_payload,
    )
    inspected = client.post(
        f"/api/v1/bookings/{booking_id}/challenge/confirm",
        headers=renter_headers,
        json=return_payload,
    )
    assert inspected.json()["status"] == "inspection"
    completed = client.post(
        f"/api/v1/bookings/{booking_id}/inspection/accept", headers=owner_headers
    )
    assert completed.json()["status"] == "completed"

    review = client.post(
        f"/api/v1/bookings/{booking_id}/reviews",
        headers=renter_headers,
        json={"rating": 5, "text": "Accurate listing and smooth pickup."},
    )
    assert review.status_code == 201
    dispute = client.post(
        f"/api/v1/bookings/{booking_id}/disputes",
        headers=renter_headers,
        json={
            "type": "payment_disagreement",
            "description": "The offline deposit return needs staff review.",
        },
    )
    assert dispute.json()["status"] == "open"
    report = client.post(
        "/api/v1/reports",
        headers=renter_headers,
        json={
            "target_type": "listing",
            "target_id": listing_id,
            "reason": "Review requested",
            "description": "Please review this completed rental listing.",
        },
    )
    assert report.status_code == 201
    denied = client.get("/api/v1/admin/reports", headers=renter_headers)
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "STAFF_REQUIRED"

    assert TEST_DATABASE_URL is not None
    engine = create_engine(TEST_DATABASE_URL)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO platform_staff (user_id, role, active) "
                "VALUES (:user_id, 'moderator', true)"
            ),
            {"user_id": owner_id},
        )
    reports = client.get("/api/v1/admin/reports", headers=owner_headers)
    assert reports.status_code == 200
    assert reports.json()[0]["id"] == report.json()["id"]
    moderation = client.post(
        f"/api/v1/admin/listings/{listing_id}/moderate",
        headers=owner_headers,
        json={"action": "remove", "reason": "Manual review completed."},
    )
    assert moderation.json()["status"] == "removed"
    with engine.connect() as connection:
        audit_count = connection.scalar(
            text(
                "SELECT count(*) FROM moderation_actions "
                "WHERE target_id = :listing_id AND actor_user_id = :actor_id"
            ),
            {"listing_id": listing_id, "actor_id": owner_id},
        )
    engine.dispose()
    assert audit_count == 1
