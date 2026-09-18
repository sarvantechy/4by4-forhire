"""Identity notification provider interfaces."""

import smtplib
from email.message import EmailMessage
from typing import Protocol


class VerificationCodeSender(Protocol):
    """Deliver a verification code without exposing it to API callers."""

    def send(self, *, destination: str, code: str, purpose: str) -> None: ...


class UnconfiguredVerificationCodeSender:
    """Fail closed until an approved provider is configured."""

    def send(self, *, destination: str, code: str, purpose: str) -> None:
        del destination, code, purpose
        raise RuntimeError("Verification provider is not configured")


class SMTPVerificationCodeSender:
    """Deliver local or production email through configured SMTP."""

    def __init__(self, *, host: str, port: int, from_email: str) -> None:
        self.host = host
        self.port = port
        self.from_email = from_email

    def send(self, *, destination: str, code: str, purpose: str) -> None:
        recipient = destination
        if destination.startswith("+91"):
            recipient = f"{destination[1:]}@sms.forhire.local"
        message = EmailMessage()
        message["From"] = self.from_email
        message["To"] = recipient
        message["Subject"] = "Your 4by4 For Hire verification code"
        message.set_content(
            f"Your verification code for {purpose.replace('_', ' ')} is {code}. "
            "Do not share this code."
        )
        with smtplib.SMTP(self.host, self.port, timeout=10) as client:
            client.send_message(message)
