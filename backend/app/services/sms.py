"""Text messages, through Africa's Talking or Twilio.

Used to send a person the link to their verification. Which provider is chosen
by SMS_PROVIDER; with none set, SMS is off and asking to send says so plainly
rather than pretending.

Numbers are taken in the international format (+250788123456): both providers
want it, and it is the only form that means the same number everywhere.
"""

import logging
import re

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_E164 = re.compile(r"^\+[1-9]\d{6,14}$")


class SmsNotConfigured(Exception):
    """No provider is set up on this server."""


class SmsFailed(Exception):
    """The provider refused the message or could not be reached."""


def normalise(number: str) -> str | None:
    """'+250 788-123 456' -> '+250788123456'; None if it is not an international number."""
    compact = re.sub(r"[\s\-().]", "", number or "")
    if compact.startswith("00"):
        compact = "+" + compact[2:]
    return compact if _E164.match(compact) else None


def configured() -> bool:
    provider = settings.SMS_PROVIDER.strip().lower()
    if provider == "africastalking":
        return bool(settings.AT_USERNAME and settings.AT_API_KEY)
    if provider == "twilio":
        return bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_FROM)
    return False


def send(to: str, body: str) -> None:
    """Send one text. Raises SmsNotConfigured or SmsFailed; returns once accepted."""
    if not configured():
        raise SmsNotConfigured("SMS is not set up on this server")
    provider = settings.SMS_PROVIDER.strip().lower()
    try:
        if provider == "africastalking":
            _africastalking(to, body)
        else:
            _twilio(to, body)
    except httpx.HTTPError as problem:
        # The message holds a working link: log where it went, never what it said.
        logger.warning("SMS to %s failed: %s", to, problem)
        raise SmsFailed("The SMS provider could not be reached") from problem


def _africastalking(to: str, body: str) -> None:
    sandbox = settings.AT_USERNAME == "sandbox"
    host = "api.sandbox.africastalking.com" if sandbox else "api.africastalking.com"
    form = {"username": settings.AT_USERNAME, "to": to, "message": body}
    if settings.AT_SENDER_ID:
        form["from"] = settings.AT_SENDER_ID
    response = httpx.post(
        f"https://{host}/version1/messaging",
        data=form,
        headers={"apiKey": settings.AT_API_KEY, "Accept": "application/json"},
        timeout=15,
    )
    # 401 is a key they do not know; a bare 403 page comes back when the key and
    # username do not belong together. Either way the fix is in backend/.env.
    if response.status_code in (401, 403):
        logger.warning("Africa's Talking rejected the credentials for username %r (%s)", settings.AT_USERNAME, response.status_code)
        raise SmsFailed(
            "Africa's Talking rejected the username or API key (AT_USERNAME / AT_API_KEY in backend/.env): "
            "a sandbox key only works with AT_USERNAME=sandbox, a live key with that app's username"
        )
    if response.status_code >= 400:
        logger.warning("Africa's Talking refused an SMS to %s: %s %s", to, response.status_code, response.text[:200])
        raise SmsFailed(f"Africa's Talking refused the message: {response.text[:150]}")
    recipients = response.json().get("SMSMessageData", {}).get("Recipients", [])
    if not recipients or recipients[0].get("status") != "Success":
        status = recipients[0].get("status") if recipients else "no recipient"
        logger.warning("Africa's Talking did not send an SMS to %s: %s", to, status)
        raise SmsFailed(f"The SMS provider did not send it ({status})")


def _twilio(to: str, body: str) -> None:
    response = httpx.post(
        f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json",
        data={"To": to, "From": settings.TWILIO_FROM, "Body": body},
        auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
        timeout=15,
    )
    if response.status_code >= 400:
        message = response.json().get("message", "") if response.headers.get("content-type", "").startswith("application/json") else ""
        logger.warning("Twilio refused an SMS to %s: %s %s", to, response.status_code, message)
        raise SmsFailed(f"The SMS provider refused the message{': ' + message if message else ''}")
