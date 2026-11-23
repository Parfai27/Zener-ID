"""Where email is sent from, over SMTP.

The original note, from before it was wired up:

Nothing is sent yet. Choosing a provider, owning a sending domain, and passing
its SPF and DKIM checks is a piece of work of its own, and a password reset that
silently fails to arrive is worse than one that was never offered.

Until then this records what would have been sent. The flow around it is real:
the reset token is generated, hashed, stored with an expiry and consumed once,
exactly as it will be when the mail goes out. Turning sending on means filling in
one function.

In development the token is handed back in the response so the flow can be tried
end to end. `check_configuration` refuses to start with that behaviour anywhere
but a developer's machine.
"""

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def _send(to: str, subject: str, body: str) -> None:
    message = EmailMessage()
    message["From"] = settings.EMAIL_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
        if settings.SMTP_STARTTLS:
            server.starttls(context=ssl.create_default_context())
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(message)


def send_password_reset(email: str, code: str) -> bool:
    """Send someone a code for setting a new password. Returns whether it was sent."""
    if not (settings.EMAIL_ENABLED and settings.SMTP_HOST):
        # The token itself is never logged: a log with a working reset link in it
        # is a way into an account.
        logger.info("Password reset requested for %s. Email is off, so nothing was sent.", email)
        return False
    try:
        _send(
            email,
            "Reset your password",
            f"Someone asked to reset the password for this address.\n\n"
            f"Your reset code is: {code}\n\n"
            f"Enter this code in the password reset form. It works once, for "
            f"{settings.PASSWORD_RESET_MINUTES} minutes.\n\n"
            "If it was not you, ignore this message and your password stays as it is.",
        )
    except (OSError, smtplib.SMTPException):
        logger.exception("Could not send the password reset email to %s", email)
        return False
    return True


def send_registration_confirmation(email: str, first_name: str) -> bool:
    """Send the confirmation email immediately after account registration."""
    if not (settings.EMAIL_ENABLED and settings.SMTP_HOST):
        logger.info("Account registered for %s. Email is off, so no confirmation was sent.", email)
        return False
    try:
        dashboard = settings.DASHBOARD_URL.rstrip("/")
        _send(
            email,
            "Welcome to Zener ID",
            f"Hi {first_name},\n\n"
            "Your Zener ID account has been registered successfully.\n\n"
            f"You can now sign in at:\n{dashboard}/login\n\n"
            "If you did not create this account, contact support immediately.",
        )
    except (OSError, smtplib.SMTPException):
        logger.exception("Could not send the registration confirmation email to %s", email)
        return False
    return True


def reveal_token_to_caller() -> bool:
    """Whether the reset token may be returned in the API response.

    True only on a developer's machine, and only while there is no email. It is
    how the reset flow is tested before a provider exists; anywhere else it would
    be a way to take over any account by asking politely.
    """
    return settings.ENVIRONMENT == "development" and not settings.EMAIL_ENABLED
