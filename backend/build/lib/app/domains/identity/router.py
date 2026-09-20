"""Identity and account API routes."""

import io
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import APIError
from app.core.storage import ObjectStorage, get_object_storage
from app.domains.identity.dependencies import ActorContext, require_actor, require_csrf
from app.domains.identity.models import AuthSession, User, UserAddress
from app.domains.identity.providers import (
    SMTPVerificationCodeSender,
    UnconfiguredVerificationCodeSender,
    VerificationCodeSender,
)
from app.domains.identity.schemas import (
    AddressRequest,
    AddressResponse,
    ChallengeResponse,
    EmailDirectRegisterRequest,
    EmailLoginRequest,
    EmailRegistrationRequest,
    EmailVerificationRequest,
    MobileDirectRegisterRequest,
    MobileOTPRequest,
    MobileOTPVerificationRequest,
    ProfileUpdateRequest,
    RefreshRequest,
    SessionResponse,
    SessionTokensResponse,
    UserResponse,
)
from app.domains.identity.service import IdentityService, IssuedSession

router = APIRouter(prefix="/auth", tags=["identity"])

ALLOWED_AVATAR_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_AVATAR_BYTES = 4 * 1024 * 1024


def get_code_sender(request: Request) -> VerificationCodeSender:
    settings = request.app.state.settings
    if settings.smtp_host:
        return SMTPVerificationCodeSender(
            host=settings.smtp_host,
            port=settings.smtp_port,
            from_email=settings.verification_from_email,
        )
    return UnconfiguredVerificationCodeSender()


def get_identity_service(
    request: Request,
    db: Session = Depends(get_db),
    code_sender: VerificationCodeSender = Depends(get_code_sender),
) -> IdentityService:
    return IdentityService(db, request.app.state.settings, code_sender)


def _user_response(user: User, db: Session) -> UserResponse:
    email = next(
        (
            identity.normalized_identifier
            for identity in user.identities
            if identity.type == "email"
        ),
        None,
    )
    mobile_number = next(
        (
            identity.normalized_identifier
            for identity in user.identities
            if identity.type == "mobile"
        ),
        None,
    )
    address_count = db.scalar(
        select(func.count()).select_from(UserAddress).where(UserAddress.user_id == user.id)
    ) or 0
    home_locality = user.profile.home_locality
    avatar_url = (
        get_object_storage().presigned_url(user.profile.avatar_object_key)
        if user.profile.avatar_object_key
        else None
    )
    return UserResponse(
        id=user.id,
        display_name=user.profile.display_name,
        preferred_language=user.preferred_language,
        status=user.status,
        email=email,
        mobile_number=mobile_number,
        home_locality=home_locality,
        avatar_url=avatar_url,
        address_count=address_count,
        profile_complete=bool(home_locality) and address_count > 0,
    )


def _session_response(
    issued: IssuedSession,
    response: Response,
    service: IdentityService,
) -> SessionTokensResponse:
    user_response = _user_response(issued.user, service.session)
    if issued.session.client_type == "customer_web":
        response.set_cookie(
            "forhire_refresh",
            issued.refresh_token,
            httponly=True,
            secure=service.settings.secure_cookies,
            samesite="strict",
            max_age=service.settings.refresh_token_ttl_days * 24 * 60 * 60,
            path="/api/v1/auth",
        )
        response.set_cookie(
            "forhire_access",
            issued.access_token,
            httponly=True,
            secure=service.settings.secure_cookies,
            samesite="strict",
            max_age=service.settings.access_token_ttl_minutes * 60,
            path="/api/v1",
        )
        return SessionTokensResponse(
            csrf_token=issued.csrf_token,
            expires_in_seconds=service.settings.access_token_ttl_minutes * 60,
            user=user_response,
        )
    return SessionTokensResponse(
        access_token=issued.access_token,
        refresh_token=issued.refresh_token,
        expires_in_seconds=service.settings.access_token_ttl_minutes * 60,
        user=user_response,
    )


@router.post("/email/register", status_code=202)
def register_email(
    payload: EmailRegistrationRequest,
    service: IdentityService = Depends(get_identity_service),
) -> ChallengeResponse:
    try:
        challenge = service.register_email(**payload.model_dump())
    except RuntimeError as error:
        raise APIError(
            status_code=503,
            code="VERIFICATION_PROVIDER_UNAVAILABLE",
            message="Email verification is temporarily unavailable.",
        ) from error
    return ChallengeResponse(
        challenge_id=challenge.id,
        expires_in_seconds=service.settings.otp_ttl_minutes * 60,
        message="Verification instructions were sent if delivery is configured.",
    )


@router.post("/email/verify")
def verify_email(
    payload: EmailVerificationRequest,
    response: Response,
    service: IdentityService = Depends(get_identity_service),
) -> SessionTokensResponse:
    return _session_response(service.verify_email(**payload.model_dump()), response, service)


@router.post("/email/register-direct")
def register_email_direct(
    payload: EmailDirectRegisterRequest,
    response: Response,
    service: IdentityService = Depends(get_identity_service),
) -> SessionTokensResponse:
    """Dev-only shortcut: create or sign in to an account with no OTP step."""
    issued = service.register_email_direct(**payload.model_dump())
    return _session_response(issued, response, service)


@router.post("/login")
def login_email(
    payload: EmailLoginRequest,
    response: Response,
    service: IdentityService = Depends(get_identity_service),
) -> SessionTokensResponse:
    return _session_response(service.login_email(**payload.model_dump()), response, service)


@router.post("/mobile/request-otp", status_code=202)
def request_mobile_otp(
    payload: MobileOTPRequest,
    service: IdentityService = Depends(get_identity_service),
) -> ChallengeResponse:
    try:
        challenge = service.request_mobile_otp(payload.mobile_number)
    except RuntimeError as error:
        raise APIError(
            status_code=503,
            code="VERIFICATION_PROVIDER_UNAVAILABLE",
            message="Mobile verification is temporarily unavailable.",
        ) from error
    return ChallengeResponse(
        challenge_id=challenge.id,
        expires_in_seconds=service.settings.otp_ttl_minutes * 60,
        message="A verification code was sent.",
    )


@router.post("/mobile/verify-otp")
def verify_mobile_otp(
    payload: MobileOTPVerificationRequest,
    response: Response,
    service: IdentityService = Depends(get_identity_service),
) -> SessionTokensResponse:
    return _session_response(service.verify_mobile(**payload.model_dump()), response, service)


@router.post("/mobile/register-direct")
def register_mobile_direct(
    payload: MobileDirectRegisterRequest,
    response: Response,
    service: IdentityService = Depends(get_identity_service),
) -> SessionTokensResponse:
    """Dev-only shortcut: create or sign in to an account with no OTP step."""
    issued = service.register_or_login_mobile_direct(**payload.model_dump())
    return _session_response(issued, response, service)


@router.post("/token/refresh")
def refresh_session(
    payload: RefreshRequest,
    request: Request,
    response: Response,
    service: IdentityService = Depends(get_identity_service),
) -> SessionTokensResponse:
    token = payload.refresh_token or request.cookies.get("forhire_refresh")
    if not token:
        raise APIError(status_code=401, code="SESSION_INVALID", message="Refresh token required.")
    return _session_response(service.rotate_session(token), response, service)


@router.post("/logout", status_code=204)
def logout(
    response: Response,
    actor: ActorContext = Depends(require_csrf),
    service: IdentityService = Depends(get_identity_service),
) -> None:
    service.revoke_session(actor.session.id, actor.user.id)
    response.delete_cookie("forhire_refresh", path="/api/v1/auth")
    response.delete_cookie("forhire_access", path="/api/v1")


@router.get("/sessions")
def list_sessions(
    actor: ActorContext = Depends(require_actor),
    db: Session = Depends(get_db),
) -> list[SessionResponse]:
    sessions = db.scalars(
        select(AuthSession)
        .where(AuthSession.user_id == actor.user.id)
        .order_by(AuthSession.created_at.desc())
    ).all()
    now = datetime.now(UTC)
    return [
        SessionResponse(
            id=item.id,
            client_type=item.client_type,
            device_label=item.device_label,
            expires_at=item.expires_at.isoformat(),
            revoked=item.revoked_at is not None or item.expires_at <= now,
        )
        for item in sessions
    ]


@router.delete("/sessions/{session_id}", status_code=204)
def revoke_session(
    session_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: IdentityService = Depends(get_identity_service),
) -> None:
    service.revoke_session(session_id, actor.user.id)


@router.get("/me")
def current_user(
    actor: ActorContext = Depends(require_actor),
    db: Session = Depends(get_db),
) -> UserResponse:
    return _user_response(actor.user, db)


@router.patch("/me")
def update_current_user(
    payload: ProfileUpdateRequest,
    actor: ActorContext = Depends(require_csrf),
    service: IdentityService = Depends(get_identity_service),
) -> UserResponse:
    user = service.update_profile(actor.user, **payload.model_dump())
    return _user_response(user, service.session)


@router.delete("/me", status_code=204)
def deactivate_current_user(
    response: Response,
    actor: ActorContext = Depends(require_csrf),
    service: IdentityService = Depends(get_identity_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> None:
    service.deactivate_account(actor.user, storage=storage)
    response.delete_cookie("forhire_refresh", path="/api/v1/auth")
    response.delete_cookie("forhire_access", path="/api/v1")


def _address_response(address: UserAddress) -> AddressResponse:
    return AddressResponse(
        id=address.id,
        label=address.label,
        address_line_1=address.address_line_1,
        address_line_2=address.address_line_2,
        locality=address.locality,
        district=address.district,
        state=address.state,
        postal_code=address.postal_code,
    )


@router.get("/me/addresses")
def list_addresses(
    actor: ActorContext = Depends(require_actor),
    db: Session = Depends(get_db),
) -> list[AddressResponse]:
    addresses = db.scalars(
        select(UserAddress)
        .where(UserAddress.user_id == actor.user.id)
        .order_by(UserAddress.created_at.desc())
    ).all()
    return [_address_response(address) for address in addresses]


@router.post("/me/addresses", status_code=201)
def create_address(
    payload: AddressRequest,
    actor: ActorContext = Depends(require_csrf),
    service: IdentityService = Depends(get_identity_service),
) -> AddressResponse:
    return _address_response(service.create_address(actor.user, **payload.model_dump()))


@router.put("/me/addresses/{address_id}")
def update_address(
    address_id: UUID,
    payload: AddressRequest,
    actor: ActorContext = Depends(require_csrf),
    service: IdentityService = Depends(get_identity_service),
) -> AddressResponse:
    return _address_response(
        service.update_address(actor.user, address_id, **payload.model_dump())
    )


@router.delete("/me/addresses/{address_id}", status_code=204)
def delete_address(
    address_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: IdentityService = Depends(get_identity_service),
) -> None:
    service.delete_address(actor.user, address_id)


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    actor: ActorContext = Depends(require_csrf),
    db: Session = Depends(get_db),
    service: IdentityService = Depends(get_identity_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> UserResponse:
    if file.content_type not in ALLOWED_AVATAR_CONTENT_TYPES:
        raise APIError(
            status_code=422,
            code="AVATAR_TYPE_INVALID",
            message="Photos must be JPEG, PNG, or WEBP.",
        )
    contents = await file.read(MAX_AVATAR_BYTES + 1)
    if len(contents) > MAX_AVATAR_BYTES:
        raise APIError(
            status_code=413,
            code="AVATAR_TOO_LARGE",
            message="Photo must be 4 MB or smaller.",
        )
    user = service.update_avatar(
        actor.user,
        storage=storage,
        file_obj=io.BytesIO(contents),
        content_type=file.content_type,
    )
    return _user_response(user, db)
