"""Seed realistic demo listings (with photos) across every category.

Idempotent: re-running skips owners/listings that already exist (matched by
mobile number / title+owner). Intended for local development only.

Usage:
    cd backend
    DATABASE_URL=... S3_ENDPOINT_URL=... S3_BUCKET=... S3_ACCESS_KEY_ID=... \
    S3_SECRET_ACCESS_KEY=... SESSION_SECRET=... ../.venv/bin/python scripts/seed_demo_data.py
"""

import io
import random
import re
import secrets
import time
import urllib.request
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from geoalchemy2.elements import WKTElement
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import create_database_engine, create_session_factory
from app.core.storage import ObjectStorage, build_object_storage
from app.domains.bookings.models import Booking, BookingQuote, BookingStatusHistory
from app.domains.catalog.models import (
    Category,
    Listing,
    ListingImage,
    ListingPrice,
    ListingStatusHistory,
)
from app.domains.identity.models import AuthIdentity, User, UserAddress, UserProfile
from app.domains.messaging.models import Conversation

BASE_LAT, BASE_LNG = 8.1833, 77.4119
LOCALITIES = ["Nagercoil", "Kanyakumari", "Marthandam", "Colachel", "Thuckalay", "Kuzhithurai"]

DEMO_MOBILE_NUMBER = "+919999999999"
DEMO_DISPLAY_NAME = "Demo Renter"
IMAGE_CONTENT_TYPE = "image/jpeg"

OWNERS = [
    ("+919000000001", "Arun Kumar"),
    ("+919000000002", "Priya Nair"),
    ("+919000000003", "Suresh Pillai"),
    ("+919000000004", "Meena Raj"),
    ("+919000000005", "Vijay Anand"),
    ("+919000000006", "Divya Menon"),
    ("+919000000007", "Karthik Raja"),
    ("+919000000008", "Lakshmi Devi"),
    ("+919000000009", "Mohan Das"),
    ("+919000000010", "Anjali Varma"),
]


@dataclass
class ListingSeed:
    category_slug: str
    listing_type: str
    title: str
    description: str
    unit: str
    amount_rupees: int
    deposit_rupees: int = 0
    condition: str | None = None
    skill: str | None = None
    photo_count: int = 2
    attributes: dict[str, object] = field(default_factory=dict)


LISTINGS: list[ListingSeed] = [
    # tools-repair
    ListingSeed("tools-repair", "item", "Cordless Drill Kit", "18V drill with two batteries, charger, and carry case. Great for home repairs and small projects.", "day", 500, 1000, condition="good"),
    ListingSeed("tools-repair", "item", "Angle Grinder", "Heavy-duty angle grinder with spare cutting discs, ideal for metal and tile work.", "day", 350, 800, condition="good"),
    ListingSeed("tools-repair", "item", "Complete Tool Box Set", "120-piece hand tool kit covering wrenches, screwdrivers, pliers, and sockets.", "week", 1200, 1500, condition="like_new"),
    # construction-labour
    ListingSeed("construction-labour", "service", "Skilled Mason for Hire", "Experienced mason for brickwork, plastering, and tiling. Own basic tools included.", "hour", 400, skill="Masonry, plastering, tiling"),
    ListingSeed("construction-labour", "item", "Concrete Mixer Machine", "Half-bag electric concrete mixer, well maintained, delivered with basic operating instructions.", "day", 1500, 3000, condition="good"),
    ListingSeed("construction-labour", "service", "Painter - Interior & Exterior", "Professional painting for homes and offices, including surface prep and finishing.", "day", 1200, skill="Interior and exterior painting"),
    # cleaning-home
    ListingSeed("cleaning-home", "service", "Deep House Cleaning Service", "Full home deep-cleaning including kitchen, bathrooms, and floors. Eco-friendly products.", "hour", 250, skill="Deep cleaning, sanitization"),
    ListingSeed("cleaning-home", "item", "Pressure Washer", "Electric pressure washer for driveways, cars, and outdoor furniture.", "day", 600, 1200, condition="good"),
    ListingSeed("cleaning-home", "service", "Sofa & Carpet Shampooing", "On-site sofa, carpet, and mattress shampoo cleaning with quick-dry equipment.", "hour", 300, skill="Upholstery shampooing"),
    # garden-farm
    ListingSeed("garden-farm", "item", "Lawn Mower (Petrol)", "Self-propelled petrol lawn mower, serviced recently, ready to use.", "day", 450, 900, condition="good"),
    ListingSeed("garden-farm", "service", "Gardener for Lawn Maintenance", "Regular lawn mowing, hedge trimming, and garden upkeep.", "hour", 200, skill="Lawn care, landscaping"),
    ListingSeed("garden-farm", "item", "Power Tiller", "Compact power tiller suitable for home gardens and small farm plots.", "day", 900, 2000, condition="fair"),
    # events-functions
    ListingSeed("events-functions", "item", "PA Speaker System with Mic", "Portable PA system with two speakers, mixer, and wireless mic - perfect for small events.", "day", 1800, 3000, condition="good"),
    ListingSeed("events-functions", "service", "Wedding Photographer", "Full-day wedding photography and same-week edited digital album.", "day", 6000, skill="Wedding and event photography"),
    ListingSeed("events-functions", "item", "Tent & Chairs Set (50 seats)", "Function tent with 50 plastic chairs and tables, setup and pickup by owner.", "day", 2500, 5000, condition="good"),
    # electronics-photography
    ListingSeed("electronics-photography", "item", "DSLR Camera with Lens Kit", "Entry-level DSLR with 18-55mm and 55-200mm lenses, extra battery included.", "day", 1200, 5000, condition="like_new"),
    ListingSeed("electronics-photography", "item", "Drone with 4K Camera", "Foldable drone with stabilized 4K camera, two batteries, and carry case.", "day", 2000, 8000, condition="good"),
    ListingSeed("electronics-photography", "service", "Photo & Video Editing", "Professional photo retouching and video editing for events and social media.", "hour", 300, skill="Photo and video post-production"),
    # travel-outdoor
    ListingSeed("travel-outdoor", "item", "Camping Tent (4-person)", "Waterproof 4-person tent, easy setup, includes ground sheet and stakes.", "day", 400, 1000, condition="good"),
    ListingSeed("travel-outdoor", "item", "Mountain Bike", "21-speed mountain bike, recently serviced, suitable for trails and city rides.", "day", 300, 1500, condition="good"),
    ListingSeed("travel-outdoor", "item", "Trekking Backpack 60L", "Rugged 60L trekking backpack with rain cover, ideal for multi-day hikes.", "day", 150, 500, condition="like_new"),
    # home-office
    ListingSeed("home-office", "item", "Ergonomic Office Chair", "Adjustable ergonomic chair with lumbar support, great for long work-from-home hours.", "week", 500, 1500, condition="good"),
    ListingSeed("home-office", "item", "Projector for Presentations", "Full-HD projector with HDMI and screen, ideal for meetings and home theatre.", "day", 700, 2000, condition="good"),
    ListingSeed("home-office", "service", "Home Wifi & Network Setup", "Router setup, wifi optimization, and small office network cabling.", "hour", 350, skill="Networking and wifi setup"),
    # fashion-accessories
    ListingSeed("fashion-accessories", "item", "Bridal Silk Saree", "Elegant handwoven silk saree with matching blouse, dry-cleaned after every use.", "day", 1500, 4000, condition="like_new"),
    ListingSeed("fashion-accessories", "item", "Groom Sherwani Set", "Designer sherwani with dupatta and matching footwear, sizes adjustable.", "day", 2000, 5000, condition="like_new"),
    ListingSeed("fashion-accessories", "item", "Kids Party Costume Set", "Assorted costumes for kids' birthday parties and school events.", "day", 300, 500, condition="good"),
    # labour-work-services
    ListingSeed("labour-work-services", "service", "Experienced Electrician", "10 years of experience in wiring, repairs, and new installations.", "hour", 300, skill="Electrical wiring and repair"),
    ListingSeed("labour-work-services", "service", "Plumber for Repairs & Installation", "Bathroom fittings, pipe repairs, and water tank installation.", "hour", 350, skill="Plumbing repairs and installation"),
    ListingSeed("labour-work-services", "service", "Daily Wage Helper / Loader", "Reliable helper for moving, loading, and general labour work.", "hour", 150, skill="Manual labour and loading"),
    ListingSeed("labour-work-services", "service", "Packers & Movers Team", "Two-to-four person crew for full house or office shifting, including careful packing and safe loading.", "day", 2000, skill="House shifting, packing, loading"),
    ListingSeed("labour-work-services", "service", "Furniture Dismantling & Assembly", "Beds, wardrobes, and modular furniture dismantled before a move and reassembled at the new place.", "hour", 250, skill="Furniture dismantling and assembly"),
    ListingSeed("labour-work-services", "service", "Loading & Unloading Labour", "On-demand labourers for loading and unloading trucks, tempos, and mini vans at a fixed hourly rate.", "hour", 180, skill="Loading and unloading"),
    ListingSeed("labour-work-services", "service", "Daily Wage Farm / Warehouse Labour", "Daily-wage workers for farm harvesting, warehouse stacking, and general godown work.", "day", 600, skill="Farm and warehouse labour"),
    ListingSeed("labour-work-services", "service", "Mini Load Carrier with Driver", "Mini goods vehicle with driver for short-distance shifting of furniture and appliances.", "day", 1800, skill="Local goods transport"),
    # construction-labour (moving equipment)
    ListingSeed("construction-labour", "item", "Hand Trolley / Hydraulic Dolly", "Heavy-duty hand trolley for moving fridges, washing machines, and boxes without straining your back.", "day", 250, 500, condition="good"),
    ListingSeed("construction-labour", "item", "Moving Blankets & Straps Set", "Set of quilted moving blankets with ratchet straps to protect furniture during transport.", "day", 200, 400, condition="good"),
    ListingSeed("construction-labour", "item", "Handcart / Pushcart", "Sturdy four-wheel pushcart for shifting goods around the house, shop, or godown.", "day", 150, 300, condition="fair"),
    ListingSeed("construction-labour", "item", "Packing Boxes & Bubble Wrap Kit", "Bundle of corrugated boxes, bubble wrap, and tape for a full home packing job.", "day", 300, 0, condition="new"),
]

# Listings owned by the demo renter itself, so the demo login also has something to manage
# as an owner (My Listings, edit, chat replies) rather than only acting as a renter.
DEMO_OWNED_LISTINGS: list[ListingSeed] = [
    ListingSeed("tools-repair", "item", "Bosch Cordless Screwdriver Set", "Compact cordless screwdriver with bit set, lightly used, listed by our demo account.", "day", 200, 400, condition="good"),
    ListingSeed("electronics-photography", "item", "Tripod & Ring Light Kit", "Adjustable tripod with a ring light, great for video calls and small photo shoots.", "day", 250, 500, condition="like_new"),
    ListingSeed("labour-work-services", "service", "Handyman for Small Repairs", "General handyman for small household fixes: shelves, curtain rods, and minor carpentry.", "hour", 250, skill="General handyman repairs"),
]


def download_image(seed: str) -> bytes:
    slug = re.sub(r"[^a-z0-9]+", "-", seed.lower()).strip("-")
    request = urllib.request.Request(
        f"https://picsum.photos/seed/{slug}/900/700",
        headers={"User-Agent": "4by4-forhire-seed-script"},
    )
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return response.read()
        except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
            last_error = error
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"Failed to download seed image for '{seed}' after retries") from last_error


def get_or_create_owner(session: Session, mobile_number: str, display_name: str) -> User:
    identity = session.scalar(
        select(AuthIdentity).where(
            AuthIdentity.type == "mobile",
            AuthIdentity.normalized_identifier == mobile_number,
        )
    )
    if identity is not None:
        return identity.user
    user = User()
    user.profile = UserProfile(display_name=display_name)
    user.identities.append(
        AuthIdentity(type="mobile", normalized_identifier=mobile_number, verified_at=datetime.now(UTC))
    )
    session.add(user)
    session.flush()
    return user


def get_or_create_demo_renter(session: Session, storage: ObjectStorage) -> User:
    """A dedicated demo login with a complete profile (home_locality + address + avatar)."""
    renter = get_or_create_owner(session, DEMO_MOBILE_NUMBER, DEMO_DISPLAY_NAME)
    if renter.profile.home_locality is None:
        renter.profile.home_locality = "Nagercoil"
    existing_address = session.scalar(
        select(UserAddress).where(UserAddress.user_id == renter.id)
    )
    if existing_address is None:
        session.add(
            UserAddress(
                user_id=renter.id,
                label="Home",
                address_line_1="12 Beach Road",
                locality="Nagercoil",
                district="Kanyakumari",
                state="Tamil Nadu",
                postal_code="629001",
            )
        )
    if renter.profile.avatar_object_key is None:
        image_bytes = download_image("demo-renter-avatar")
        renter.profile.avatar_object_key = storage.upload(
            file_obj=io.BytesIO(image_bytes),
            content_type=IMAGE_CONTENT_TYPE,
            key_prefix=f"avatars/{renter.id}",
        )
    session.flush()
    return renter


def seed_demo_bookings(session: Session, renter: User, listings: list[Listing]) -> int:
    if not listings:
        return 0
    existing = session.scalar(
        select(Booking).where(Booking.renter_user_id == renter.id)
    )
    if existing is not None:
        return 0

    plans = [
        ("completed", -10, -3),
        ("accepted", 2, 5),
        ("requested", 7, 9),
        ("cancelled", -20, -18),
    ]
    created = 0
    now = datetime.now(UTC)
    for (status, start_offset_days, end_offset_days), listing in zip(
        plans, listings[: len(plans)], strict=False
    ):
        price = listing.prices[0] if listing.prices else None
        if price is None:
            continue
        starts_at = now + timedelta(days=start_offset_days)
        ends_at = now + timedelta(days=end_offset_days)
        quote = BookingQuote(
            listing_id=listing.id,
            renter_user_id=renter.id,
            starts_at=starts_at,
            ends_at=ends_at,
            quantity=1,
            rental_charge_minor=price.amount_minor,
            deposit_minor=price.deposit_minor,
            currency=price.currency,
            expires_at=now + timedelta(days=1),
        )
        session.add(quote)
        session.flush()

        booking = Booking(
            public_number=f"FH-{secrets.token_hex(4).upper()}",
            quote_id=quote.id,
            listing_id=listing.id,
            renter_user_id=renter.id,
            owner_user_id=listing.owner_user_id,
            starts_at=starts_at,
            ends_at=ends_at,
            quantity=1,
            status=status,
            fulfillment_method="pickup",
            rental_charge_minor=price.amount_minor,
            deposit_minor=price.deposit_minor,
            currency=price.currency,
        )
        session.add(booking)
        session.flush()
        session.add(
            BookingStatusHistory(
                booking_id=booking.id,
                from_status=None,
                to_status="requested",
                actor_user_id=renter.id,
                reason_code="seed_demo_data",
            )
        )
        if status != "requested":
            session.add(
                BookingStatusHistory(
                    booking_id=booking.id,
                    from_status="requested",
                    to_status=status,
                    actor_user_id=listing.owner_user_id,
                    reason_code="seed_demo_data",
                )
            )
        session.add(
            Conversation(
                booking_id=booking.id,
                renter_user_id=renter.id,
                owner_user_id=listing.owner_user_id,
            )
        )
        created += 1
    session.commit()
    return created


def seed_demo_owned_listings(
    session: Session,
    demo_renter: User,
    categories: dict[str, Category],
    storage: ObjectStorage,
) -> int:
    """Give the demo login a few listings of its own, so it can also act as an owner."""
    created = 0
    for seed in DEMO_OWNED_LISTINGS:
        category = categories.get(seed.category_slug)
        if category is None:
            continue
        existing = session.scalar(
            select(Listing).where(
                Listing.owner_user_id == demo_renter.id, Listing.title == seed.title
            )
        )
        if existing is not None:
            continue

        latitude, longitude = scattered_point()
        listing = Listing(
            owner_user_id=demo_renter.id,
            category_id=category.id,
            listing_type=seed.listing_type,
            title=seed.title,
            description=seed.description,
            condition=seed.condition or "not_applicable",
            quantity=1,
            attributes={"skill": seed.skill} if seed.skill else dict(seed.attributes),
            status="active",
            pickup_enabled=True,
            delivery_enabled=False,
            public_locality="Nagercoil",
            latitude=latitude,
            longitude=longitude,
            is_seed_data=True,
        )
        listing.public_location = WKTElement(f"POINT({longitude} {latitude})", srid=4326)
        listing.prices = [
            ListingPrice(
                unit=seed.unit,
                amount_minor=seed.amount_rupees * 100,
                deposit_minor=seed.deposit_rupees * 100,
                currency="INR",
            )
        ]
        session.add(listing)
        session.flush()
        session.add(
            ListingStatusHistory(
                listing_id=listing.id,
                from_status=None,
                to_status="active",
                actor_user_id=demo_renter.id,
                reason_code="seed_demo_data",
            )
        )
        for photo_index in range(seed.photo_count):
            image_bytes = download_image(f"{seed.title}-{photo_index}")
            object_key = storage.upload(
                file_obj=io.BytesIO(image_bytes),
                content_type=IMAGE_CONTENT_TYPE,
                key_prefix=f"listings/{listing.id}",
            )
            session.add(
                ListingImage(listing_id=listing.id, object_key=object_key, position=photo_index)
            )
        session.commit()
        created += 1
        print(f"created (demo-owned): {seed.title} ({seed.category_slug}, {seed.listing_type})")
    return created


def scattered_point() -> tuple[float, float]:
    return (
        BASE_LAT + random.uniform(-0.05, 0.05),
        BASE_LNG + random.uniform(-0.05, 0.05),
    )


def main() -> None:
    settings = get_settings()
    engine = create_database_engine(settings)
    session_factory = create_session_factory(engine)
    storage = build_object_storage(settings)

    with session_factory() as session:
        categories = {
            category.slug: category for category in session.scalars(select(Category)).all()
        }
        owners = [
            get_or_create_owner(session, mobile, name) for mobile, name in OWNERS
        ]
        session.commit()

        created = 0
        skipped = 0
        for index, seed in enumerate(LISTINGS):
            category = categories.get(seed.category_slug)
            if category is None:
                print(f"skip (unknown category) {seed.title}")
                continue
            owner = owners[index % len(owners)]
            existing = session.scalar(
                select(Listing).where(
                    Listing.owner_user_id == owner.id, Listing.title == seed.title
                )
            )
            if existing is not None:
                skipped += 1
                continue

            latitude, longitude = scattered_point()
            listing = Listing(
                owner_user_id=owner.id,
                category_id=category.id,
                listing_type=seed.listing_type,
                title=seed.title,
                description=seed.description,
                condition=seed.condition or "not_applicable",
                quantity=1,
                attributes={"skill": seed.skill} if seed.skill else dict(seed.attributes),
                status="active",
                pickup_enabled=True,
                delivery_enabled=False,
                public_locality=random.choice(LOCALITIES),
                latitude=latitude,
                longitude=longitude,
                is_seed_data=True,
            )
            listing.public_location = WKTElement(f"POINT({longitude} {latitude})", srid=4326)
            listing.prices = [
                ListingPrice(
                    unit=seed.unit,
                    amount_minor=seed.amount_rupees * 100,
                    deposit_minor=seed.deposit_rupees * 100,
                    currency="INR",
                )
            ]
            session.add(listing)
            session.flush()
            session.add(
                ListingStatusHistory(
                    listing_id=listing.id,
                    from_status=None,
                    to_status="active",
                    actor_user_id=owner.id,
                    reason_code="seed_demo_data",
                )
            )

            for photo_index in range(seed.photo_count):
                image_bytes = download_image(f"{seed.title}-{photo_index}")
                object_key = storage.upload(
                    file_obj=io.BytesIO(image_bytes),
                    content_type=IMAGE_CONTENT_TYPE,
                    key_prefix=f"listings/{listing.id}",
                )
                session.add(
                    ListingImage(listing_id=listing.id, object_key=object_key, position=photo_index)
                )

            session.commit()
            created += 1
            print(f"created: {seed.title} ({seed.category_slug}, {seed.listing_type})")

        print(f"\nDone. created={created} skipped_existing={skipped}")

        demo_renter = get_or_create_demo_renter(session, storage)
        session.commit()
        demo_owned_created = seed_demo_owned_listings(session, demo_renter, categories, storage)
        seeded_listings = session.scalars(
            select(Listing).where(Listing.owner_user_id.in_([owner.id for owner in owners]))
        ).all()
        bookings_created = seed_demo_bookings(session, demo_renter, list(seeded_listings))
        print(
            f"Demo login: mobile={DEMO_MOBILE_NUMBER} display_name={DEMO_DISPLAY_NAME!r} "
            f"demo_owned_listings_created={demo_owned_created} bookings_created={bookings_created}"
        )


if __name__ == "__main__":
    main()
