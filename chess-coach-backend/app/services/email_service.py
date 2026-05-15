from email.message import EmailMessage
import smtplib

from app.core.config import settings


def _smtp_ready() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM_EMAIL)


def send_verification_email(to_email: str, username: str, verification_url: str) -> None:
    if not _smtp_ready():
        raise RuntimeError("SMTP is not configured")

    message = EmailMessage()
    message["Subject"] = "Confirm your Chess Coach account"
    message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    message["To"] = to_email
    message.set_content(
        "\n".join(
            [
                f"Hi {username},",
                "",
                "Welcome to Chess Coach. Confirm your email address to activate your account:",
                verification_url,
                "",
                "This link expires soon. If you did not create this account, you can ignore this email.",
            ]
        )
    )

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as smtp:
        if settings.SMTP_STARTTLS:
            smtp.starttls()
        if settings.SMTP_USERNAME:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        smtp.send_message(message)
