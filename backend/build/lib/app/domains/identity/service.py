"""Identity registration, verification, and session services."""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import BinaryIO, NoReturn
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings
from app.core.errors import APIError
from app.core.storage import ObjectStorage
from app.domains.identity.models import (
    AuthIdentity,
    AuthSession,
    OTPChallenge,
    User,
    UserAddress,
    UserProfile,
)
from app.domains.identity.providers import VerificationCodeSender

password_hasher = PasswordHasher()


@dataclass(frozen=True)
class IssuedSession:
    access_token: str
    refresh_token: str
    csrf_token: str | None
    session: AuthSession
    user: User


class IdentityService:
    """Own account and session transactions."""

    def __init__(
        self,
        session: Session,
        settings: Settings,
        code_sender: VerificationCodeSender,
    ) -> None:
        self.session = session
        self.settings = settings
        self.code_sender = code_sender

    def register_email(self, *, email: str, password: str, display_name: str) -> OTPChallenge:
        normalized = email.strip().lower()
        existing = self._identity("email", normalized)
        if existing is not None:
            raise APIError(
                status_code=409,
                code="IDENTITY_ALREADY_EXISTS",
                message="An account already uses this email address.",
            )
        user = User()
        user.profile = UserProfile(display_name=display_name.strip())
        identity = AuthIdentity(
            type="email",
            normalized_identifier=normalized,
            password_hash=password_hasher.hash(password),
        )
        user.identities.append(identity)
        self.session.add(user)
        challenge, code = self._create_challenge(normalized, "email_verification")
        self.code_sender.send(destination=normalized, code=code, purpose="email_verification")
        self.session.commit()
        return challenge

    def request_mobile_otp(self, mobile_number: str) -> OTPChallenge:
        challenge, code = self._create_challenge(mobile_number, "mobile_login")
        self.code_sender.send(destination=mobile_number, code=code, purpose="mobile_login")
        self.session.commit()
        return challenge

    def register_email_direct(
        self,
        *,
        email: str,
        password: str,
        display_name: str,
        client_type: str,
        device_label: str | None,
    ) -> IssuedSession:
        """Create or sign in to an account immediately, skipping OTP (dev only)."""
        self._require_bypass_enabled()
        normalized = email.strip().lower()
        identity = self._identity("email", normalized)
        if identity is not None:
            if identity.password_hash is None:
                self._invalid_credentials()
            try:
                password_hasher.verify(identity.password_hash, password)
            except VerifyMismatchError:
                self._invalid_credentials()
        else:
            user = User()
            user.profile = UserProfile(display_name=display_name.strip())
            identity = AuthIdentity(
                type="email",
                normalized_identifier=normalized,
                password_hash=password_hasher.hash(password),
                verified_at=datetime.now(UTC),
            )
            user.identities.append(identity)
            self.session.add(user)
            self.session.flush()
        issued = self._issue_session(identity.user, client_type, device_label)
        self.session.commit()
        return issued

    def register_or_login_mobile_direct(
        self,
        *,
        mobile_number: str,
        display_name: str | None,
        client_type: str,
        device_label: str | None,
    ) -> IssuedSession:
        """Create or sign in to an account immediately, skipping OTP (dev only)."""
        self._require_bypass_enabled()
        identity = self._identity("mobile", mobile_number)
        if identity is None:
            if not display_name:
                raise APIError(
                    status_code=422,
                    code="DISPLAY_NAME_REQUIRED",
                    message="A display name is required for a new account.",
                )
            user = User()
            user.profile = UserProfile(display_name=display_name.strip())
            identity = AuthIdentity(
                type="mobile",
                normalized_identifier=mobile_number,
                verified_at=datetime.now(UTC),
            )
            user.identities.append(identity)
            self.session.add(user)
            self.session.flush()
        issued = self._issue_session(identity.user, client_type, device_label)
        self.session.commit()
        return issued

    def issue_demo_session(
        self,
        *,
        client_type: str,
        device_label: str | None,
    ) -> IssuedSession:
        demo_mobile_number = self.settings.demo_mobile_number
        if not demo_mobile_number:
            raise APIError(
                status_code=404,
                code="DEMO_LOGIN_UNAVAILABLE",
                message="The demo account is unavailable.",
            )
        identity = self._identity("mobile", demo_mobile_number)
        if identity is None or identity.user.status != "active":
            raise APIError(
                status_code=404,
                code="DEMO_LOGIN_UNAVAILABLE",
                message="The demo account is unavailable.",
            )
        issued = self._issue_session(identity.user, client_type, device_label)
        self.session.commit()
        return issued

    def _require_bypass_enabled(self) -> None:
        if not self.settings.verification_bypass_active:
            raise APIError(
                status_code=403,
                code="VERIFICATION_BYPASS_DISABLED",
                message="Direct registration is disabled in this environment.",
            )

    def verify_email(
        self,
        *,
        challenge_id: UUID,
        code: str,
        client_type: str,
        device_label: str | None,
    ) -> IssuedSession:
        challenge = self._consume_challenge(challenge_id, code, "email_verification")
        identity = self._identity("email", challenge.normalized_identifier)
        if identity is None:
            raise APIError(status_code=404, code="IDENTITY_NOT_FOUND", message="Account not found.")
        identity.verified_at = datetime.now(UTC)
        issued = self._issue_session(identity.user, client_type, device_label)
        self.session.commit()
        return issued

    def verify_mobile(
        self,
        *,
        challenge_id: UUID,
        code: str,
        display_name: str | None,
        client_type: str,
        device_label: str | None,
    ) -> IssuedSession:
        challenge = self._consume_challenge(challenge_id, code, "mobile_login")
        identity = self._identity("mobile", challenge.normalized_identifier)
        if identity is None:
            if not display_name:
                raise APIError(
                    status_code=422,
                    code="DISPLAY_NAME_REQUIRED",
                    message="A display name is required for a new account.",
                )
            user = User()
            user.profile = UserProfile(display_name=display_name.strip())
            identity = AuthIdentity(
                type="mobile",
                normalized_identifier=challenge.normalized_identifier,
                verified_at=datetime.now(UTC),
            )
            user.identities.append(identity)
            self.session.add(user)
            self.session.flush()
        issued = self._issue_session(identity.user, client_type, device_label)
        self.session.commit()
        return issued

    def login_email(
        self,
        *,
        email: str,
        password: str,
        client_type: str,
        device_label: str | None,
    ) -> IssuedSession:
        identity = self._identity("email", email.strip().lower())
        if identity is None or identity.password_hash is None:
            self._invalid_credentials()
        try:
            password_hasher.verify(identity.password_hash, password)
        except VerifyMismatchError:
            self._invalid_credentials()
        if identity.verified_at is None:
            raise APIError(
                status_code=403,
                code="EMAIL_NOT_VERIFIED",
                message="Verify your email address before signing in.",
            )
        issued = self._issue_session(identity.user, client_type, device_label)
        self.session.commit()
        return issued

    def rotate_session(self, refresh_token: str) -> IssuedSession:
        token_hash = self._token_hash(refresh_token)
        auth_session = self.session.scalar(
            select(AuthSession).where(AuthSession.refresh_token_hash == token_hash)
        )
        now = datetime.now(UTC)
        if (
            auth_session is None
            or auth_session.revoked_at is not None
            or auth_session.expires_at <= now
        ):
            raise APIError(
                status_code=401,
                code="SESSION_INVALID",
                message="The session is invalid or expired.",
            )
        auth_session.revoked_at = now
        user = self.session.get(User, auth_session.user_id)
        if user is None:
            raise APIError(
                status_code=401,
                code="SESSION_INVALID",
                message="Session user not found.",
            )
        issued = self._issue_session(user, auth_session.client_type, auth_session.device_label)
        self.session.commit()
        return issued

    def revoke_session(self, session_id: UUID, actor_id: UUID) -> None:
        auth_session = self.session.scalar(
            select(AuthSession).where(
                AuthSession.id == session_id,
                AuthSession.user_id == actor_id,
            )
        )
        if auth_session is None:
            raise APIError(status_code=404, code="SESSION_NOT_FOUND", message="Session not found.")
        if auth_session.revoked_at is None:
            auth_session.revoked_at = datetime.now(UTC)
            self.session.commit()

    def update_profile(
        self,
        user: User,
        *,
        display_name: str | None,
        preferred_language: str | None,
        home_locality: str | None,
    ) -> User:
        if display_name is not None:
            user.profile.display_name = display_name.strip()
        if preferred_language is not None:
            user.preferred_language = preferred_language
        if home_locality is not None:
            user.profile.home_locality = home_locality.strip() or None
        self.session.commit()
        self.session.refresh(user)
        return user

    def create_address(self, user: User, **values: str | None) -> UserAddress:
        address = UserAddress(user_id=user.id, **values)
        self.session.add(address)
        self.session.commit()
        self.session.refresh(address)
        return address

    def update_address(self, user: User, address_id: UUID, **values: str | None) -> UserAddress:
        address = self.session.scalar(
            select(UserAddress).where(
                UserAddress.id == address_id,
                UserAddress.user_id == user.id,
            )
        )
        if address is None:
            raise APIError(status_code=404, code="ADDRESS_NOT_FOUND", message="Address not found.")
        for field, value in values.items():
            setattr(address, field, value)
        self.session.commit()
        self.session.refresh(address)
        return address

    def delete_address(self, user: User, address_id: UUID) -> None:
        address = self.session.scalar(
            select(UserAddress).where(
                UserAddress.id == address_id,
                UserAddress.user_id == user.id,
            )
        )
        if address is None:
            raise APIError(status_code=404, code="ADDRESS_NOT_FOUND", message="Address not found.")
        self.session.delete(address)
        self.session.commit()

    def deactivate_account(self, user: User, *, storage: ObjectStorage) -> None:
        from app.domains.catalog.models import Listing, ListingStatusHistory, SellerHeader
        from app.domains.stores.models import ListingStoreHistory, Store, StoreStatusHistory

        now = datetime.now(UTC)
        object_keys: set[str] = set()
        identifiers = [identity.normalized_identifier for identity in user.identities]

        listings = list(
            self.session.scalars(
                select(Listing)
                .options(selectinload(Listing.images))
                .where(Listing.owner_user_id == user.id)
            ).unique()
        )
        for listing in listings:
            if listing.status not in {"archived", "removed"}:
                previous_status = listing.status
                listing.status = "archived"
                self.session.add(
                    ListingStatusHistory(
                        listing_id=listing.id,
                        from_status=previous_status,
                        to_status="archived",
                        actor_user_id=user.id,
                        reason_code="account_deactivated",
                    )
                )
            if listing.store_id is not None:
                self.session.add(
                    ListingStoreHistory(
                        listing_id=listing.id,
                        from_store_id=listing.store_id,
                        to_store_id=None,
                        actor_user_id=user.id,
                        reason_code="account_deactivated",
                    )
                )
                listing.store_id = None
            object_keys.update(image.object_key for image in listing.images)
            listing.images.clear()
            listing.public_location = None
            listing.latitude = None
            listing.longitude = None
            listing.public_locality = "Unavailable"
            listing.version += 1

        stores = list(self.session.scalars(select(Store).where(Store.owner_user_id == user.id)))
        for store in stores:
            if store.status != "archived":
                previous_status = store.status
                store.status = "archived"
                self.session.add(
                    StoreStatusHistory(
                        store_id=store.id,
                        from_status=previous_status,
                        to_status="archived",
                        actor_user_id=user.id,
                        reason_code="account_deactivated",
                    )
                )
            if store.logo_object_key:
                object_keys.add(store.logo_object_key)
            if store.cover_object_key:
                object_keys.add(store.cover_object_key)
            store.display_name = "Deleted store"
            store.description = ""
            store.public_locality = "Unavailable"
            store.operating_hours = {}
            store.logo_object_key = None
            store.cover_object_key = None
            store.version += 1

        if user.profile.avatar_object_key:
            object_keys.add(user.profile.avatar_object_key)
        user.profile.display_name = "Deleted user"
        user.profile.avatar_object_key = None
        user.profile.home_locality = None
        user.status = "deactivated"
        user.deactivated_at = now

        for auth_session in self.session.scalars(
            select(AuthSession).where(AuthSession.user_id == user.id)
        ):
            if auth_session.revoked_at is None:
                auth_session.revoked_at = now

        self.session.execute(delete(UserAddress).where(UserAddress.user_id == user.id))
        self.session.execute(delete(SellerHeader).where(SellerHeader.user_id == user.id))
        self.session.execute(delete(AuthIdentity).where(AuthIdentity.user_id == user.id))
        if identifiers:
            self.session.execute(
                delete(OTPChallenge).where(
                    OTPChallenge.normalized_identifier.in_(identifiers)
                )
            )

        for object_key in object_keys:
            storage.delete(object_key)

        self.session.commit()

    def update_avatar(
        self,
        user: User,
        *,
        storage: ObjectStorage,
        file_obj: BinaryIO,
        content_type: str,
    ) -> User:
        previous_key = user.profile.avatar_object_key
        object_key = storage.upload(
            file_obj=file_obj,
            content_type=content_type,
            key_prefix=f"avatars/{user.id}",
        )
        user.profile.avatar_object_key = object_key
        self.session.commit()
        self.session.refresh(user)
        if previous_key:
            storage.delete(previous_key)
        return user

    def _identity(self, identity_type: str, identifier: str) -> AuthIdentity | None:
        return self.session.scalar(
            select(AuthIdentity).where(
                AuthIdentity.type == identity_type,
                AuthIdentity.normalized_identifier == identifier,
            )
        )

    def _create_challenge(self, identifier: str, purpose: str) -> tuple[OTPChallenge, str]:
        code = f"{secrets.randbelow(1_000_000):06d}"
        challenge = OTPChallenge(
            purpose=purpose,
            normalized_identifier=identifier,
            code_hash=self._code_hash(identifier, code),
            attempts=0,
            max_attempts=self.settings.otp_max_attempts,
            expires_at=datetime.now(UTC) + timedelta(minutes=self.settings.otp_ttl_minutes),
        )
        self.session.add(challenge)
        self.session.flush()
        return challenge, code

    def _consume_challenge(self, challenge_id: UUID, code: str, purpose: str) -> OTPChallenge:
        challenge = self.session.get(OTPChallenge, challenge_id, with_for_update=True)
        now = datetime.now(UTC)
        if challenge is None or challenge.purpose != purpose:
            raise APIError(status_code=400, code="OTP_INVALID", message="The code is invalid.")
        if challenge.consumed_at is not None:
            raise APIError(
                status_code=409,
                code="OTP_ALREADY_USED",
                message="The code was already used.",
            )
        if challenge.expires_at <= now or challenge.attempts >= challenge.max_attempts:
            raise APIError(status_code=400, code="OTP_EXPIRED", message="The code has expired.")
        if not hmac.compare_digest(
            challenge.code_hash,
            self._code_hash(challenge.normalized_identifier, code),
        ):
            challenge.attempts += 1
            self.session.commit()
            raise APIError(status_code=400, code="OTP_INVALID", message="The code is invalid.")
        challenge.consumed_at = now
        return challenge

    def _issue_session(
        self,
        user: User,
        client_type: str,
        device_label: str | None,
    ) -> IssuedSession:
        now = datetime.now(UTC)
        refresh_token = secrets.token_urlsafe(48)
        csrf_token = secrets.token_urlsafe(32) if client_type == "customer_web" else None
        auth_session = AuthSession(
            user_id=user.id,
            client_type=client_type,
            refresh_token_hash=self._token_hash(refresh_token),
            csrf_token_hash=self._token_hash(csrf_token) if csrf_token else None,
            device_label=device_label,
            expires_at=now + timedelta(days=self.settings.refresh_token_ttl_days),
        )
        self.session.add(auth_session)
        self.session.flush()
        access_token = jwt.encode(
            {
                "sub": str(user.id),
                "sid": str(auth_session.id),
                "iat": now,
                "exp": now + timedelta(minutes=self.settings.access_token_ttl_minutes),
            },
            self.settings.session_secret,
            algorithm="HS256",
        )
        return IssuedSession(access_token, refresh_token, csrf_token, auth_session, user)

    def _code_hash(self, identifier: str, code: str) -> str:
        return hmac.new(
            self.settings.session_secret.encode(),
            f"{identifier}:{code}".encode(),
            hashlib.sha256,
        ).hexdigest()

    @staticmethod
    def _token_hash(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    @staticmethod
    def _invalid_credentials() -> NoReturn:
        raise APIError(
            status_code=401,
            code="INVALID_CREDENTIALS",
            message="The email or password is incorrect.",
        )
