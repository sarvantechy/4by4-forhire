"""Public legal and account-deletion information pages."""

from html import escape

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

router = APIRouter(include_in_schema=False)

_STYLE = """
body{font-family:Arial,sans-serif;color:#17211f;background:#f6f8f7;margin:0;line-height:1.6}
main{max-width:760px;margin:0 auto;padding:32px 20px 64px}h1{font-size:30px}h2{margin-top:28px}
a{color:#087f75}section{background:#fff;border:1px solid #dce4e1;padding:20px;margin:16px 0}
"""


def _page(title: str, body: str) -> HTMLResponse:
    return HTMLResponse(
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        f"<title>{escape(title)} | 4by4 For Hire</title><style>{_STYLE}</style>"
        f"</head><body><main><h1>{escape(title)}</h1>{body}</main></body></html>"
    )


@router.get("/privacy", response_class=HTMLResponse)
def privacy_policy(request: Request) -> HTMLResponse:
    email = escape(request.app.state.settings.privacy_contact_email)
    return _page(
        "Privacy Policy",
        f"""
        <p><strong>Effective date:</strong> 20 September 2026</p>
        <p>4by4 For Hire is operated by 4by4softwares in Tamil Nadu, India. This policy explains
        how the marketplace handles personal information.</p>
        <section><h2>Information we collect</h2><ul>
        <li>Account details such as email address or mobile number and display name.</li>
        <li>Approximate and precise location when you choose location-based features.</li>
        <li>Listing, profile, and condition photos that you upload.</li>
        <li>Listings, bookings, offers, in-app messages, reviews, reports, and dispute
        evidence.</li>
        <li>Security and operational records needed to protect accounts and operate the
        service.</li>
        </ul></section>
        <section><h2>How information is used</h2><p>We use this information to authenticate
        users, show nearby listings, process owner-approved rental requests, provide messaging,
        prevent abuse, investigate disputes, and operate and secure the service. The MVP records
        offline payment acknowledgements but does not process or store card details.</p></section>
        <section><h2>Sharing and service providers</h2><p>Information is shared only as needed
        with authorized booking participants, service operators, or infrastructure providers.
        MapTiler and OpenStreetMap data support maps; AWS supports hosting and private object
        storage. We do not sell personal information.</p></section>
        <section><h2>Retention and deletion</h2><p>You can delete your account from Edit Profile.
        Login identifiers, saved addresses, profile and listing media are removed, and listings
        and stores are hidden. Booking, payment acknowledgement, message, safety, dispute, and
        audit records may be retained where required for legal obligations, fraud prevention,
        dispute handling, and marketplace safety.</p></section>
        <section><h2>Security and choices</h2><p>We use access controls, private storage,
        encrypted transport, and revocable sessions. You may manage profile information,
        addresses, signed-in devices, and account deletion in the app.</p></section>
        <p>Privacy questions: <a href="mailto:{email}">{email}</a></p>
        <p><a href="/account-deletion">Account deletion instructions</a></p>
        """,
    )


@router.get("/account-deletion", response_class=HTMLResponse)
def account_deletion(request: Request) -> HTMLResponse:
    email = escape(request.app.state.settings.privacy_contact_email)
    return _page(
        "Delete Your 4by4 For Hire Account",
        f"""
        <p>4by4 For Hire users can request deletion directly in the mobile application.</p>
        <section><h2>Delete in the app</h2><ol>
        <li>Sign in to 4by4 For Hire.</li><li>Open <strong>Account</strong>.</li>
        <li>Select <strong>Edit profile</strong>.</li>
        <li>Scroll to <strong>Delete account</strong>.</li>
        <li>Review the notice and confirm <strong>Delete account</strong>.</li>
        </ol><p>Access is deactivated immediately and all sessions are revoked.</p></section>
        <section><h2>What is deleted</h2><p>Email/mobile login identifiers, saved addresses,
        profile photo, listing/store media, and public profile details are removed or anonymized.
        Listings and stores are hidden from public access.</p></section>
        <section><h2>What may be retained</h2><p>Booking, message, payment acknowledgement,
        review, report, dispute, and audit records may be retained where required for legal,
        fraud-prevention, safety, and dispute-resolution purposes.</p></section>
        <p>If you cannot access the app, contact <a href="mailto:{email}">{email}</a> from the
        email address or mobile number associated with the account.</p>
        <p><a href="/privacy">Read the Privacy Policy</a></p>
        """,
    )