import os
from typing import Literal

import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException

from config.config import get_openu_config


def ensure_directory_exists(directory: str) -> None:
    if not os.path.exists(directory):
        os.makedirs(directory)


async def upload_content(
    directory: str,
    type_of_dir: Literal["orgs", "users"],
    uuid: str,  # org_uuid or user_uuid
    file_binary: bytes,
    file_and_format: str,
    allowed_formats: list[str] | None = None,
) -> None:
    # Get OpenU Config
    openu_config = get_openu_config()

    file_format = file_and_format.split(".")[-1].strip().lower()

    # Get content delivery method
    content_delivery = openu_config.hosting_config.content_delivery.type

    # Check if format file is allowed
    if allowed_formats and file_format not in allowed_formats:
        raise HTTPException(
            status_code=400,
            detail=f"File format {file_format} not allowed",
        )

    ensure_directory_exists(f"content/{type_of_dir}/{uuid}/{directory}")

    if content_delivery == "filesystem":
        # upload file to server
        with open(
            f"content/{type_of_dir}/{uuid}/{directory}/{file_and_format}",
            "wb",
        ) as f:
            f.write(file_binary)
            f.close()

    elif content_delivery == "s3api":
        # Upload to server then to s3 (AWS Keys are stored in environment variables and are loaded by boto3)
        # TODO: Improve implementation of this
        print("Uploading to s3...")
        s3 = boto3.client(
            "s3",
            endpoint_url=openu_config.hosting_config.content_delivery.s3api.endpoint_url,
        )

        # Upload file to server
        with open(
            f"content/{type_of_dir}/{uuid}/{directory}/{file_and_format}",
            "wb",
        ) as f:
            f.write(file_binary)
            f.close()

        print("Uploading to s3 using boto3...")
        try:
            s3.upload_file(
                f"content/{type_of_dir}/{uuid}/{directory}/{file_and_format}",
                "openu-media",
                f"content/{type_of_dir}/{uuid}/{directory}/{file_and_format}",
            )
        except ClientError as e:
            print(e)

        print("Checking if file exists in s3...")
        try:
            s3.head_object(
                Bucket="openu-media",
                Key=f"content/{type_of_dir}/{uuid}/{directory}/{file_and_format}",
            )
            print("File upload successful!")
        except Exception as e:
            print(f"An error occurred: {e!s}")
