"""Email sending for GoodCause — Brand-aligned OTP & Welcome delivery via Resend / SMTP.

Configuration (set in backend/.env):
    SMTP_HOST      e.g. smtp.resend.com
    SMTP_PORT      e.g. 587 (TLS) or 465 (SSL)
    SMTP_USER      resend
    SMTP_PASS      Resend API Key
    EMAIL_FROM     goodcause <noreply@goodcause.app>
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
EMAIL_FROM = os.environ.get("EMAIL_FROM", "goodcause <noreply@goodcause.app>")

# ─── Brand Colors & HTML Templates ────────────────────────────────────────────

BRAND_GREEN = "#02A95C"
DARK_TEXT = "#1F2937"
MUTED_TEXT = "#6B7280"
BG_COLOR = "#F4F5F7"


def _otp_html_template(code: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your goodcause sign-in code</title>
</head>
<body style="margin:0;padding:0;background-color:{BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:{BG_COLOR};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" maxWidth="500" cellpadding="0" cellspacing="0" style="max-width:500px;background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.06);border:1px solid #E5E7EB;">
          
          <!-- Header -->
          <tr>
            <td style="background-color:{BRAND_GREEN};padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#FFFFFF;letter-spacing:-1px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">goodcause</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 36px 32px;">
              <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:{DARK_TEXT};letter-spacing:-0.4px;">Your Sign-In Verification Code</h2>
              <p style="margin:0 0 28px;font-size:15px;color:{MUTED_TEXT};line-height:1.6;">
                Use the verification code below to complete your sign-in to <strong>goodcause</strong>. This code is valid for <strong>10 minutes</strong>.
              </p>

              <!-- OTP Code Display -->
              <div style="background-color:#F0FDF4;border:2px dashed {BRAND_GREEN};border-radius:16px;padding:24px;text-align:center;margin:0 0 28px;">
                <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:{BRAND_GREEN};font-family:'Courier New',monospace;display:inline-block;">{code}</span>
              </div>

              <p style="margin:0;font-size:13px;color:{MUTED_TEXT};line-height:1.5;">
                If you did not request this verification code, please ignore this email or reach out to our team at <a href="mailto:support@goodcause.app" style="color:{BRAND_GREEN};text-decoration:none;font-weight:600;">support@goodcause.app</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #F3F4F6;padding:24px 36px;background-color:#FAFAFA;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.5;">
                &copy; 2026 <strong>goodcause</strong> &mdash; Trust makes generosity go further.<br/>
                <a href="https://goodcause.app/privacy.html" style="color:#9CA3AF;text-decoration:underline;">Privacy Policy</a> &bull; <a href="https://goodcause.app" style="color:#9CA3AF;text-decoration:underline;">Visit goodcause.app</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _welcome_html_template(name: str) -> str:
    display_name = name.strip().split()[0] if name and name.strip() else "Friend"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to goodcause!</title>
</head>
<body style="margin:0;padding:0;background-color:{BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:{BG_COLOR};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" maxWidth="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.06);border:1px solid #E5E7EB;">
          
          <!-- Header -->
          <tr>
            <td style="background-color:{BRAND_GREEN};padding:36px 40px;text-align:center;">
              <h1 style="margin:0 0 8px;font-size:32px;font-weight:800;color:#FFFFFF;letter-spacing:-1px;">goodcause</h1>
              <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.9);font-weight:500;">Welcome to your community for help & giving 💚</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 36px;">
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:{DARK_TEXT};letter-spacing:-0.5px;">Welcome, {display_name}! 👋</h2>
              <p style="margin:0 0 20px;font-size:15px;color:{DARK_TEXT};line-height:1.6;">
                We are thrilled to welcome you to <strong>goodcause</strong>. You're joining a community built on a simple belief: <em>when thousands of us come together to share what we can, lives are transformed.</em>
              </p>

              <!-- Feature Cards -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 16px;background-color:#F9FAFB;border-radius:12px;margin-bottom:8px;">
                    <strong style="color:{BRAND_GREEN};font-size:15px;">💚 Discover Verified Causes</strong>
                    <p style="margin:4px 0 0;font-size:13px;color:{MUTED_TEXT};line-height:1.5;">Support medical care, education, emergency relief, and community stories near you.</p>
                  </td>
                </tr>
                <tr><td style="height:10px;"></td></tr>
                <tr>
                  <td style="padding:14px 16px;background-color:#F9FAFB;border-radius:12px;">
                    <strong style="color:{BRAND_GREEN};font-size:15px;">✨ Start Your Own Campaign</strong>
                    <p style="margin:4px 0 0;font-size:13px;color:{MUTED_TEXT};line-height:1.5;">Need support for a cause close to your heart? Launch a campaign in under 2 minutes.</p>
                  </td>
                </tr>
              </table>

              <!-- Call to Action Button -->
              <div style="text-align:center;margin:32px 0 24px;">
                <a href="https://goodcause.app" style="background-color:{BRAND_GREEN};color:#FFFFFF;padding:16px 36px;border-radius:30px;font-size:16px;font-weight:700;text-decoration:none;display:inline-block;box-shadow:0 4px 14px rgba(2,169,92,0.3);">
                  Explore goodcause.app
                </a>
              </div>

              <p style="margin:24px 0 0;font-size:14px;color:{MUTED_TEXT};line-height:1.6;text-align:center;">
                Thank you for being someone's <strong>goodcause</strong>.<br/>
                <em>The goodcause Team</em>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #F3F4F6;padding:24px 36px;background-color:#FAFAFA;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.5;">
                &copy; 2026 <strong>goodcause</strong> &mdash; Trust makes generosity go further.<br/>
                Need assistance? Reply directly or email <a href="mailto:support@goodcause.app" style="color:{BRAND_GREEN};text-decoration:none;">support@goodcause.app</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


# ─── Sending Logic via Resend API / SMTP ──────────────────────────────────────

def _send_email_payload(to_email: str, subject: str, html_content: str, text_content: str) -> bool:
    if not SMTP_HOST:
        logger.info("=" * 60)
        logger.info(f"[DEV EMAIL] To: {to_email} | Subject: {subject}")
        logger.info("=" * 60)
        return True

    try:
        if "resend.com" in SMTP_HOST:
            headers = {
                "Authorization": f"Bearer {SMTP_PASS}",
                "Content-Type": "application/json"
            }
            data = {
                "from": EMAIL_FROM,
                "to": [to_email],
                "subject": subject,
                "html": html_content
            }
            with httpx.Client(timeout=10.0) as client:
                r = client.post("https://api.resend.com/emails", headers=headers, json=data)
                r.raise_for_status()
            logger.info(f"Email '{subject}' sent to {to_email} via Resend API")
            return True

        # Fallback to standard SMTP
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = EMAIL_FROM
        msg["To"] = to_email

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.login(SMTP_USER, SMTP_PASS)
                server.sendmail(EMAIL_FROM, to_email, msg.as_string())
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.sendmail(EMAIL_FROM, to_email, msg.as_string())

        logger.info(f"Email '{subject}' sent to {to_email} via SMTP")
        return True

    except Exception as e:
        logger.error(f"Failed to send email '{subject}' to {to_email}: {e}")
        return False


def send_otp_email(to_email: str, code: str) -> bool:
    """Send branded 6-digit OTP code to user."""
    subject = f"{code} is your goodcause verification code"
    text = f"Your goodcause verification code is: {code}\n\nThis code expires in 10 minutes."
    return _send_email_payload(to_email, subject, _otp_html_template(code), text)


def send_welcome_email(to_email: str, name: str = "") -> bool:
    """Send warm, intuitive welcome email to new users upon first sign-up."""
    display_name = name.strip().split()[0] if name and name.strip() else "Friend"
    subject = f"Welcome to goodcause, {display_name}! 💚"
    text = f"Welcome to goodcause, {display_name}!\n\nWe're thrilled to have you join our community. Discover verified causes and start your giving journey today at https://goodcause.app"
    return _send_email_payload(to_email, subject, _welcome_html_template(name), text)
