import os
from typing import Literal

from fastapi import HTTPException, UploadFile

from src.security.file_validation import validate_upload


def ensure_directory_exists(directory: str) -> None:
    # Use exist_ok to avoid race conditions in concurrent environments
    os.makedirs(directory, exist_ok=True)


async def upload_file(
    file: UploadFile,
    directory: str,
    type_of_dir: Literal["orgs", "users"],
    uuid: str,
    allowed_types: list[str],
    filename_prefix: str,
    max_size: int | None = None,
) -> str:
    """
    Secure file upload with validation.

    Args:
        file: The uploaded file
        directory: Target directory (e.g., "logos", "avatars")
        type_of_dir: "orgs" or "users"
        uuid: Organization or user UUID
        allowed_types: List of allowed file types ('image', 'video', 'document')
        filename_prefix: Prefix for the generated filename
        max_size: Maximum file size in bytes (optional)

    Returns:
        The saved filename
    """
    from ulid import ULID

    from src.security.file_validation import get_safe_filename

    # Validate the file
    _, content = validate_upload(file, allowed_types, max_size)

    # Generate safe filename
    filename = get_safe_filename(file.filename, f"{ULID()}_{filename_prefix}")

    # Save the file
    await upload_content(
        directory=directory,
        type_of_dir=type_of_dir,
        uuid=uuid,
        file_binary=content,
        file_and_format=filename,
        allowed_formats=None,  # Already validated
    )

    return filename


async def upload_content(
    directory: str,
    type_of_dir: Literal["orgs", "users"],
    uuid: str,  # org_uuid or user_uuid
    file_binary: bytes,
    file_and_format: str,
    allowed_formats: list[str] | None = None,
) -> None:
    file_format = file_and_format.rsplit(".", maxsplit=1)[-1].strip().lower()

    # Check if format file is allowed
    if allowed_formats and file_format not in allowed_formats:
        raise HTTPException(
            status_code=400,
            detail=f"File format {file_format} not allowed",
        )

    ensure_directory_exists(f"content/{type_of_dir}/{uuid}/{directory}")

    with open(
        f"content/{type_of_dir}/{uuid}/{directory}/{file_and_format}",
        "wb",
    ) as f:
        f.write(file_binary)
        f.close()
