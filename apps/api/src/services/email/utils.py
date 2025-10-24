import resend
from pydantic import EmailStr

from config.config import get_platform_config


def send_email(to: EmailStr, subject: str, body: str) -> None:
    print("We don't have email domain configured, so we're not sending emails, duh...")


def future_send_email(to: EmailStr, subject: str, body: str):
    platform_config = get_platform_config()

    params = {
        "from": "Ashyq Bilim <"
        + platform_config.mailing_config.system_email_address
        + ">",
        "to": [to],
        "subject": subject,
        "html": body,
    }

    resend.api_key = platform_config.mailing_config.resend_api_key

    return resend.Emails.send(params)
