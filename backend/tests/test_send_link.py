"""Sending a person their verification link by email or SMS, from the dashboard.

Against Postgres in a throwaway schema, like the other API tests, and skipped
when it is not reachable. Nothing leaves the machine: the mail server and the
SMS providers are replaced here.
"""

import uuid

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.db.models import AuditEvent, Verification, VerificationStatus
from app.db.session import get_session
from app.main import app
from app.services import email as email_service
from app.services import sms

PASSWORD = "horse-battery"
COMMON = {"phone": "788123456", "country_code": "+250", "date_of_birth": "1990-01-01", "country": "RW"}
APPLICANT = {
    "first_name": "Jean",
    "last_name": "Mugisha",
    "email": "jean@example.com",
    "phone": "+250 788 000 111",
    "country": "RW",
}


def _reachable() -> bool:
    try:
        create_engine(settings.DATABASE_URL).connect().close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _reachable(), reason="needs the local Postgres")


@pytest.fixture()
def db_session():
    schema = f"test_{uuid.uuid4().hex[:12]}"
    engine = create_engine(settings.DATABASE_URL, connect_args={"options": f"-csearch_path={schema}"})
    admin = create_engine(settings.DATABASE_URL, isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()
        with admin.connect() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


@pytest.fixture()
def client(db_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "EVIDENCE_DIR", str(tmp_path / "evidence"))
    app.dependency_overrides[get_session] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def mail(monkeypatch):
    """Email turned on, with every message kept here instead of sent."""
    sent: list[dict] = []
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.test")
    monkeypatch.setattr(email_service, "_send", lambda to, subject, body: sent.append({"to": to, "subject": subject, "body": body}))
    return sent


def company(client, email="aline@acme.rw") -> dict:
    token = client.post(
        "/v1/auth/register",
        json={"email": email, "password": PASSWORD, "first_name": "Acme", "last_name": "Bank", **COMMON},
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def open_verification(client, headers) -> dict:
    response = client.post("/v1/verifications", json={"services": ["document", "face"], "applicant": APPLICANT}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_the_link_is_emailed_to_the_address_given_when_it_was_opened(client, db_session, mail):
    headers = company(client)
    verification = open_verification(client, headers)

    response = client.post(f"/v1/verifications/{verification['reference']}/send", json={"channel": "email"}, headers=headers)

    assert response.status_code == 200, response.text
    assert response.json() == {"channel": "email", "to": "jean@example.com", "sent": True}
    assert len(mail) == 1
    assert mail[0]["to"] == "jean@example.com"
    assert "Acme Bank" in mail[0]["subject"]
    assert verification["session_url"] in mail[0]["body"]
    assert "Hello Jean" in mail[0]["body"]

    event = db_session.scalar(select(AuditEvent).where(AuditEvent.event_type == "verification.link_sent.email"))
    assert event.payload == {"channel": "email", "to": "jean@example.com"}
    # The link is the person's credential: it is not kept in the log.
    assert verification["session_url"] not in str(event.payload)


def test_another_address_can_be_given(client, mail):
    headers = company(client)
    verification = open_verification(client, headers)

    response = client.post(
        f"/v1/verifications/{verification['reference']}/send",
        json={"channel": "email", "to": "other@example.com"},
        headers=headers,
    )

    assert response.status_code == 200
    assert mail[0]["to"] == "other@example.com"


def test_email_that_is_not_set_up_says_so(client, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_ENABLED", False)
    headers = company(client)
    verification = open_verification(client, headers)

    response = client.post(f"/v1/verifications/{verification['reference']}/send", json={"channel": "email"}, headers=headers)

    assert response.status_code == 503
    assert "Email is not set up" in response.json()["detail"]


def test_a_mail_server_failure_is_reported(client, monkeypatch, mail):
    def refuse(*_):
        raise OSError("connection refused")

    monkeypatch.setattr(email_service, "_send", refuse)
    headers = company(client)
    verification = open_verification(client, headers)

    response = client.post(f"/v1/verifications/{verification['reference']}/send", json={"channel": "email"}, headers=headers)

    assert response.status_code == 502


def test_the_link_is_texted_through_africas_talking(client, monkeypatch):
    calls = []

    def fake_post(url, data=None, headers=None, timeout=None, **_):
        calls.append({"url": url, "data": data, "headers": headers})
        return httpx.Response(
            201,
            json={"SMSMessageData": {"Recipients": [{"status": "Success", "number": data["to"]}]}},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(settings, "SMS_PROVIDER", "africastalking")
    monkeypatch.setattr(settings, "AT_USERNAME", "sandbox")
    monkeypatch.setattr(settings, "AT_API_KEY", "key")
    monkeypatch.setattr(sms.httpx, "post", fake_post)
    headers = company(client)
    verification = open_verification(client, headers)

    response = client.post(f"/v1/verifications/{verification['reference']}/send", json={"channel": "sms"}, headers=headers)

    assert response.status_code == 200, response.text
    # The number as typed ("+250 788 000 111") goes out in international form.
    assert response.json()["to"] == "+250788000111"
    assert calls[0]["url"] == "https://api.sandbox.africastalking.com/version1/messaging"
    assert calls[0]["data"]["to"] == "+250788000111"
    assert verification["session_url"] in calls[0]["data"]["message"]
    assert calls[0]["headers"]["apiKey"] == "key"


def test_the_link_is_texted_through_twilio(client, monkeypatch):
    calls = []

    def fake_post(url, data=None, auth=None, timeout=None, **_):
        calls.append({"url": url, "data": data, "auth": auth})
        return httpx.Response(201, json={"sid": "SM1"}, request=httpx.Request("POST", url))

    monkeypatch.setattr(settings, "SMS_PROVIDER", "twilio")
    monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "AC1")
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "secret")
    monkeypatch.setattr(settings, "TWILIO_FROM", "+15550001111")
    monkeypatch.setattr(sms.httpx, "post", fake_post)
    headers = company(client)
    verification = open_verification(client, headers)

    response = client.post(
        f"/v1/verifications/{verification['reference']}/send",
        json={"channel": "sms", "to": "+250 722 333 444"},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    assert calls[0]["url"].endswith("/Accounts/AC1/Messages.json")
    assert calls[0]["data"]["To"] == "+250722333444"
    assert calls[0]["data"]["From"] == "+15550001111"
    assert calls[0]["auth"] == ("AC1", "secret")


def test_a_provider_refusal_is_reported(client, monkeypatch):
    def refuse(url, **_):
        return httpx.Response(400, json={"message": "The 'To' number is not valid"}, request=httpx.Request("POST", url))

    monkeypatch.setattr(settings, "SMS_PROVIDER", "twilio")
    monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "AC1")
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "secret")
    monkeypatch.setattr(settings, "TWILIO_FROM", "+15550001111")
    monkeypatch.setattr(sms.httpx, "post", refuse)
    headers = company(client)
    verification = open_verification(client, headers)

    response = client.post(f"/v1/verifications/{verification['reference']}/send", json={"channel": "sms"}, headers=headers)

    assert response.status_code == 502
    assert "not valid" in response.json()["detail"]


def test_sms_that_is_not_set_up_says_so(client, monkeypatch):
    monkeypatch.setattr(settings, "SMS_PROVIDER", "")
    headers = company(client)
    verification = open_verification(client, headers)

    response = client.post(f"/v1/verifications/{verification['reference']}/send", json={"channel": "sms"}, headers=headers)

    assert response.status_code == 503
    assert "SMS is not set up" in response.json()["detail"]


def test_a_number_without_a_country_code_is_refused(client, monkeypatch):
    monkeypatch.setattr(settings, "SMS_PROVIDER", "twilio")
    headers = company(client)
    verification = open_verification(client, headers)

    response = client.post(
        f"/v1/verifications/{verification['reference']}/send",
        json={"channel": "sms", "to": "0788123456"},
        headers=headers,
    )

    assert response.status_code == 422
    assert "international format" in response.json()["detail"]


def test_a_decided_verification_is_not_sent(client, db_session, mail):
    headers = company(client)
    verification = open_verification(client, headers)
    row = db_session.scalar(select(Verification).where(Verification.reference == verification["reference"]))
    row.status = VerificationStatus.passed
    db_session.commit()

    response = client.post(f"/v1/verifications/{verification['reference']}/send", json={"channel": "email"}, headers=headers)

    assert response.status_code == 409
    assert mail == []


def test_another_companys_verification_cannot_be_sent(client, mail):
    owner = company(client)
    verification = open_verification(client, owner)
    stranger = company(client, email="eric@other.rw")

    response = client.post(f"/v1/verifications/{verification['reference']}/send", json={"channel": "email"}, headers=stranger)

    assert response.status_code == 404
    assert mail == []


def test_numbers_are_put_in_international_form():
    assert sms.normalise("+250 788-123 456") == "+250788123456"
    assert sms.normalise("00250788123456") == "+250788123456"
    assert sms.normalise("(+250) 788 123 456") == "+250788123456"
    assert sms.normalise("0788123456") is None
    assert sms.normalise("") is None
