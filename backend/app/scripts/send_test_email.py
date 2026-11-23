"""Send one test email with the SMTP settings in .env, to check they work.

    python -m app.scripts.send_test_email you@example.com

Prints what went wrong if it fails (wrong host, login refused, sender not
verified...). Nothing is written to the database.
"""

import smtplib
import sys

from app.core.config import settings
from app.services import email as email_service


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 1 or "@" not in args[0]:
        print("Usage: python -m app.scripts.send_test_email you@example.com", file=sys.stderr)
        return 2
    if not settings.EMAIL_ENABLED:
        print("EMAIL_ENABLED is false in .env. Set it to true first.", file=sys.stderr)
        return 1
    if not (settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD):
        print("SMTP_HOST, SMTP_USER and SMTP_PASSWORD must all be set in .env.", file=sys.stderr)
        return 1

    print(f"Sending from {settings.EMAIL_FROM} through {settings.SMTP_HOST}:{settings.SMTP_PORT} ...")
    try:
        email_service._send(
            args[0],
            "Zener ID test email",
            "This is a test from your Zener ID backend. Password reset emails will arrive like this one.",
        )
    except smtplib.SMTPAuthenticationError:
        print("The server refused the login: check SMTP_USER and SMTP_PASSWORD (for SendGrid: user 'apikey', password the API key).", file=sys.stderr)
        return 1
    except (OSError, smtplib.SMTPException) as error:
        print(f"Sending failed: {error}", file=sys.stderr)
        return 1
    print(f"Sent to {args[0]}. If it is not in the inbox, look in spam.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
