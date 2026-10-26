import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from backend.core.config import settings

logger = logging.getLogger(__name__)


def smtp_configured() -> bool:
    return all([settings.smtp_host, settings.smtp_user, settings.smtp_password, settings.email_from])


def send_email(to: str, subject: str, html: str) -> bool:
    """Send one HTML email. Returns False (and logs) when SMTP is not configured or
    sending fails; callers treat email as best-effort on top of in-app notifications."""
    if not smtp_configured():
        logger.warning("SMTP not configured — skipping email '%s' to %s", subject, to)
        return False
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.email_from_name} <{settings.email_from}>"
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.email_from, to, msg.as_string())
        logger.info("Email '%s' sent to %s", subject, to)
        return True
    except Exception as exc:
        logger.error("Failed to send email '%s' to %s: %s", subject, to, exc)
        return False


def _build_enrollment_html(
    student_name: str,
    student_number: str,
    student_email: str,
    section_name: str,
    curriculum_name: str,
    password: str,
) -> str:
    first_name = student_name.split()[0] if student_name else "Student"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to AILAS</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4338ca 0%,#6366f1 100%);padding:36px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;background:rgba(255,255,255,0.15);border-radius:14px;margin-bottom:16px;">
                <span style="font-size:28px;line-height:1;">&#127891;</span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.3px;">Welcome to AILAS</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">
                AI-Assisted Learning Analytics System
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">

              <p style="margin:0 0 20px;font-size:16px;color:#1e293b;font-weight:600;">
                Hi {first_name}, you're officially enrolled! &#127881;
              </p>

              <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.7;">
                Your account at <strong>Dalubhasaang Politekniko ng Lungsod ng Baliwag (BTECH)</strong> has been created
                in the AILAS system. You can now log in to view your academic analytics, competency
                scores, and personalized study recommendations.
              </p>

              <!-- Enrollment Details -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;">
                      Enrollment Details
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#64748b;width:40%;">Student Number</td>
                        <td style="padding:5px 0;font-size:13px;color:#1e293b;font-weight:600;font-family:monospace;">{student_number}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#64748b;">Section</td>
                        <td style="padding:5px 0;font-size:13px;color:#1e293b;font-weight:600;">{section_name}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#64748b;">Curriculum</td>
                        <td style="padding:5px 0;font-size:13px;color:#1e293b;font-weight:600;">{curriculum_name}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Credentials -->
              <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#1e293b;">
                Your login credentials
              </p>
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;margin-bottom:8px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#92400e;width:40%;">Email</td>
                        <td style="padding:5px 0;font-size:13px;color:#78350f;font-weight:600;">{student_email}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#92400e;">Initial Password</td>
                        <td style="padding:5px 0;">
                          <span style="font-family:monospace;font-size:18px;font-weight:700;color:#b45309;
                            background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;
                            padding:4px 10px;letter-spacing:2px;">
                            {password}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:10px 14px;background:#fef2f2;border-left:3px solid #f87171;border-radius:0 6px 6px 0;">
                    <p style="margin:0;font-size:12px;color:#b91c1c;line-height:1.5;">
                      &#9888;&#65039; This is a <strong>one-time password</strong>. Please log in and change it immediately
                      from your account settings. Do not share it with anyone.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="http://localhost:5173/login"
                      style="display:inline-block;background:#4338ca;color:#ffffff;font-size:14px;
                        font-weight:600;text-decoration:none;padding:13px 32px;border-radius:10px;">
                      Log In to AILAS &#8594;
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #f1f5f9;text-align:center;">
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
                This email was sent by <strong>AILAS</strong> on behalf of
                <strong>Dalubhasaang Politekniko ng Lungsod ng Baliwag (BTECH)</strong>.<br/>
                If you did not expect this email, please contact your administrator.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_enrollment_welcome(
    student_name: str,
    student_number: str,
    student_email: str,
    section_name: str,
    curriculum_name: str,
    password: str,
) -> None:
    """Send enrollment welcome email with initial password. Silently skips if SMTP is not configured."""
    html = _build_enrollment_html(
        student_name=student_name,
        student_number=student_number,
        student_email=student_email,
        section_name=section_name,
        curriculum_name=curriculum_name,
        password=password,
    )
    send_email(
        student_email,
        f"Welcome to AILAS – Your Enrollment is Confirmed, {student_name.split()[0]}!",
        html,
    )
