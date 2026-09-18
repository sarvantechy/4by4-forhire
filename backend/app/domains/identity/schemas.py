"""Identity API request and response schemas."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class EmailRegistrationRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    display_name: str = Field(min_length=2, max_length=100)


class EmailVerificationRequest(BaseModel):
    challenge_id: UUID
    code: str = Field(pattern=r"^\d{6}$")
    client_type: Literal["mobile", "customer_web"] = "customer_web"
    device_label: str | None = Field(default=None, max_length=160)


class EmailLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    client_type: Literal["mobile", "customer_web"] = "customer_web"
    device_label: str | None = Field(default=None, max_length=160)


class MobileOTPRequest(BaseModel):
    mobile_number: str

    @field_validator("mobile_number")
    @classmethod
    def normalize_mobile(cls, value: str) -> str:
        digits = "".join(character for character in value if character.isdigit())
        if len(digits) == 10 and digits[0] in "6789":
            return f"+91{digits}"
        if len(digits) == 12 and digits.startswith("91") and digits[2] in "6789":
            return f"+{digits}"
        raise ValueError("Enter a valid Indian mobile number")


class MobileOTPVerificationRequest(BaseModel):
    challenge_id: UUID
    code: str = Field(pattern=r"^\d{6}$")
    display_name: str | None = Field(default=None, min_length=2, max_length=100)
    client_type: Literal["mobile", "customer_web"] = "mobile"
    device_label: str | None = Field(default=None, max_length=160)


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class ChallengeResponse(BaseModel):
    challenge_id: UUID
    expires_in_seconds: int
    message: str


class UserResponse(BaseModel):
    id: UUID
    display_name: str
    preferred_language: str
    status: str


class ProfileUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=100)
    preferred_language: Literal["en", "ta"] | None = None
    home_locality: str | None = Field(default=None, max_length=120)


class AddressRequest(BaseModel):
    label: str = Field(min_length=2, max_length=60)
    address_line_1: str = Field(min_length=3, max_length=180)
    address_line_2: str | None = Field(default=None, max_length=180)
    locality: str = Field(min_length=2, max_length=120)
    district: str = Field(min_length=2, max_length=120)
    state: str = Field(min_length=2, max_length=120)
    postal_code: str = Field(pattern=r"^\d{6}$")


class AddressResponse(AddressRequest):
    id: UUID


class SessionTokensResponse(BaseModel):
    access_token: str | None = None
    refresh_token: str | None = None
    csrf_token: str | None = None
    token_type: Literal["bearer"] = "bearer"
    expires_in_seconds: int
    user: UserResponse


class SessionResponse(BaseModel):
    id: UUID
    client_type: str
    device_label: str | None
    expires_at: str
    revoked: bool
