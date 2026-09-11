"""Email sending for GoodCause — OTP delivery via SMTP.

Configuration (set in backend/.env):
    SMTP_HOST      e.g. smtp.gmail.com
    SMTP_PORT      e.g. 587  (TLS) or 465 (SSL)
    SMTP_USER      your sender email address
    SMTP_PASS      App Password or SMTP password
    EMAIL_FROM     display name + address, e.g. "GoodCause <noreply@goodcause.ng>"

If SMTP_HOST is not set the OTP is printed to the server console instead —
this is the default for local development so you can test without any email setup.
"""

import os
import smtplib
import logging
import httpx
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger("goodcause.email")

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", f"goodcause <{SMTP_USER}>") if SMTP_USER else "goodcause <noreply@goodcause.app>"


def _html_template(code: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your GoodCause sign-in code</title>
</head>
<body style="margin:0;padding:0;background:#F7F5F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F2;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background:#C05C3D;padding:32px 40px 28px;">
              <p style="margin:0;font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;">goodcause</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#2C2926;letter-spacing:-0.3px;">Your sign-in code</p>
              <p style="margin:0 0 32px;font-size:15px;color:#5C5954;line-height:1.6;">
                Use the code below to sign in to GoodCause. It expires in <strong>10 minutes</strong>.
              </p>

              <!-- OTP box -->
              <div style="background:#F7F5F2;border-radius:12px;padding:28px;text-align:center;margin:0 0 32px;">
                <p style="margin:0;font-size:42px;font-weight:800;letter-spacing:10px;color:#C05C3D;font-family:'Courier New',monospace;">{code}</p>
              </div>

              <p style="margin:0;font-size:13px;color:#8C8882;line-height:1.6;">
                If you didn't request this code, you can safely ignore this email. Someone may have entered your email address by mistake.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #EDE9E3;padding:20px 40px;">
              <p style="margin:0;font-size:12px;color:#A8A39D;">
                &copy; 2026 GoodCause &mdash; Trust makes generosity go further.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_otp_email(to_email: str, code: str) -> bool:
    """Send a 6-digit OTP to `to_email`. Returns True on success.

    Falls back to console logging if SMTP is not configured — safe for dev.
    """
    if not SMTP_HOST:
        # Dev mode: print to console so you can test without an email service.
        logger.info("=" * 60)
        logger.info(f"[DEV] OTP for {to_email}: {code}")
        logger.info("=" * 60)
        return True

    try:
        # Many cloud providers (Render, DigitalOcean) block outbound SMTP ports (465/587).
        # Since we use Resend, we can bypass this by calling their HTTPS API directly on port 443!
        if "resend.com" in SMTP_HOST:
            headers = {
                "Authorization": f"Bearer {SMTP_PASS}",
                "Content-Type": "application/json"
            }
            data = {
                "from": EMAIL_FROM,
                "to": [to_email],
                "subject": f"{code} is your GoodCause sign-in code",
                "html": _html_template(code)
            }
            # Synchronous HTTP POST request
            with httpx.Client(timeout=10.0) as client:
                r = client.post("https://api.resend.com/emails", headers=headers, json=data)
                r.raise_for_status()
            logger.info(f"OTP email sent to {to_email} via Resend API")
            return True

        # Fallback to standard SMTP for other providers
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"{code} is your GoodCause sign-in code"
        msg["From"] = EMAIL_FROM
        msg["To"] = to_email

        plain = f"Your GoodCause sign-in code is: {code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, ignore this email."
        msg.attach(MIMEText(plain, "plain"))
        msg.attach(MIMEText(_html_template(code), "html"))

        if SMTP_PORT == 465:
            # SSL connection
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.login(SMTP_USER, SMTP_PASS)
                server.sendmail(EMAIL_FROM, to_email, msg.as_string())
        else:
            # TLS (port 587)
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.sendmail(EMAIL_FROM, to_email, msg.as_string())

        logger.info(f"OTP email sent to {to_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send OTP email to {to_email}: {e}")
        # Fallback: print to console so auth isn't completely broken in prod if email fails
        logger.info(f"[FALLBACK] OTP for {to_email}: {code}")
        return False
