"""The emails the service sends, as HTML with a plain-text twin.

Email clients are not browsers: layout is tables, every style is inline, there
is no web font (Manrope and Inter are asked for, with safe fallbacks), and the
logo travels inside the message (a cid: image) so nothing is loaded from a
server and no client blocks it as a remote image.
"""

from dataclasses import dataclass
from html import escape
from pathlib import Path

# Zener ID brand colours.
PINE = "#06302b"  # Deep Pine
EVERGREEN = "#0f5246"
MINT = "#2fe0a8"
PAPER = "#f3f7f2"
INK = "#0b1614"
BODY = "#34413e"
MUTED = "#66746f"
LINE = "#e2e8e5"
TINT = "#e7f5ef"

HEADING_FONT = "Manrope, 'Segoe UI', Helvetica, Arial, sans-serif"
TEXT_FONT = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif"

LOGO_CID = "zenerid-logo"
LOGO_PNG = Path(__file__).with_name("email_assets") / "zenerid-logo-light.png"


@dataclass(frozen=True)
class Email:
    subject: str
    text: str
    html: str
    # Images the HTML refers to as cid:<key>, as PNG bytes.
    images: dict[str, bytes]


def _logo() -> dict[str, bytes]:
    try:
        return {LOGO_CID: LOGO_PNG.read_bytes()}
    except OSError:
        return {}


def _layout(*, preheader: str, content: str, footer: str, has_logo: bool) -> str:
    logo = (
        f'<img src="cid:{LOGO_CID}" width="160" height="24" alt="Zener ID" '
        'style="display:block;border:0;outline:none;width:160px;height:auto;">'
        if has_logo
        else f'<span style="font-family:{HEADING_FONT};font-size:22px;font-weight:800;color:{PAPER};">Zener ID</span>'
    )
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>Zener ID</title>
</head>
<body style="margin:0;padding:0;background:{PAPER};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{PAPER};">{escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{PAPER};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td style="background:{PINE};border-radius:16px 16px 0 0;padding:26px 36px;">{logo}</td>
        </tr>
        <tr>
          <td style="background:#ffffff;border:1px solid {LINE};border-top:0;border-radius:0 0 16px 16px;padding:36px;">
{content}
          </td>
        </tr>
        <tr>
          <td style="padding:22px 12px 0;font-family:{TEXT_FONT};font-size:12px;line-height:18px;color:{MUTED};text-align:center;">
{footer}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>"""


def password_reset(*, link: str, minutes: int, email: str, first_name: str | None = None) -> Email:
    """The email with the link for choosing a new password."""
    greeting = f"Hi {first_name.strip()}," if first_name and first_name.strip() else "Hi,"
    images = _logo()
    href = escape(link, quote=True)

    content = f"""            <h1 style="margin:0 0 18px;font-family:{HEADING_FONT};font-size:24px;line-height:30px;font-weight:800;color:{INK};">Reset your password</h1>
            <p style="margin:0 0 14px;font-family:{TEXT_FONT};font-size:15px;line-height:24px;color:{BODY};">{escape(greeting)}</p>
            <p style="margin:0 0 26px;font-family:{TEXT_FONT};font-size:15px;line-height:24px;color:{BODY};">
              Someone asked to reset the password for the Zener ID account
              <strong style="color:{INK};">{escape(email)}</strong>. Choose a new password with the button below.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;">
              <tr>
                <td align="center" bgcolor="{PINE}" style="border-radius:10px;">
                  <a href="{href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:{TEXT_FONT};font-size:15px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:10px;">Set a new password</a>
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;">
              <tr>
                <td style="background:{TINT};border-left:3px solid {MINT};border-radius:8px;padding:12px 16px;font-family:{TEXT_FONT};font-size:13.5px;line-height:21px;color:{PINE};">
                  The link works <strong>once</strong> and expires in <strong>{minutes} minutes</strong>.
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-family:{TEXT_FONT};font-size:13px;line-height:20px;color:{MUTED};">If the button does not work, copy this address into your browser:</p>
            <p style="margin:0 0 26px;font-family:{TEXT_FONT};font-size:13px;line-height:20px;word-break:break-all;"><a href="{href}" target="_blank" style="color:{EVERGREEN};text-decoration:underline;">{escape(link)}</a></p>
            <hr style="border:0;border-top:1px solid {LINE};margin:0 0 20px;">
            <p style="margin:0;font-family:{TEXT_FONT};font-size:13px;line-height:20px;color:{MUTED};">
              Did not ask for this? Ignore this email: your password stays as it is, and nobody can change it without this link.
            </p>"""

    footer = """            Zener ID · Identity verification and AML screening<br>
            You received this because a password reset was requested for your account."""

    text = (
        f"{greeting}\n\n"
        f"Someone asked to reset the password for the Zener ID account {email}.\n\n"
        f"Open this link to choose a new one (it works once, for {minutes} minutes):\n{link}\n\n"
        "If it was not you, ignore this message and your password stays as it is.\n\n"
        "Zener ID"
    )

    return Email(
        subject="Reset your Zener ID password",
        text=text,
        html=_layout(
            preheader=f"Choose a new password. The link expires in {minutes} minutes.",
            content=content,
            footer=footer,
            has_logo=bool(images),
        ),
        images=images,
    )
