import logging
import random
import string
from datetime import datetime, timezone

from fastapi import HTTPException, Request, status
from sqlmodel import Session, select
from ulid import ULID

from src.core.timezone import now as tz_now
from src.db.courses.certifications import (
    CertificateUser,
    CertificateUserRead,
    CertificationCreate,
    CertificationRead,
    Certifications,
    CertificationUpdate,
)
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.courses import Course
from src.db.permissions.enums import Action, ResourceType
from src.db.trail_steps import TrailStep
from src.db.users import AnonymousUser, PublicUser
from src.services.gamification import StreakType, XPSource
from src.services.gamification import service as gamification_service
from src.services.permissions import get_permission_service

logger = logging.getLogger(__name__)

####################################################
# CRUD
####################################################


async def create_certification(
    request: Request,
    certification_object: CertificationCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> CertificationRead:
    """Create a new certification for a course"""

    # Check if course exists
    statement = select(Course).where(Course.id == certification_object.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    permission_service = get_permission_service(db_session)
    await permission_service.check(
        user=current_user,
        action=Action.CREATE,
        resource=ResourceType.CERTIFICATE,
        resource_id=course.course_uuid,
    )

    # Create certification
    certification = Certifications(
        course_id=certification_object.course_id,
        config=certification_object.config or {},
        certification_uuid=str(f"certification_{ULID()}"),
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    # Insert certification in DB
    db_session.add(certification)
    db_session.commit()
    db_session.refresh(certification)

    return CertificationRead(**certification.model_dump())


async def get_certification(
    request: Request,
    certification_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> CertificationRead:
    """Get a single certification by certification_id"""

    statement = select(Certifications).where(
        Certifications.certification_uuid == certification_uuid
    )
    certification = db_session.exec(statement).first()

    if not certification:
        raise HTTPException(
            status_code=404,
            detail="Certification not found",
        )

    # Get course for RBAC check
    statement = select(Course).where(Course.id == certification.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    permission_service = get_permission_service(db_session)
    await permission_service.check(
        user=current_user,
        action=Action.READ,
        resource=ResourceType.CERTIFICATE,
        resource_id=course.course_uuid,
    )

    return CertificationRead(**certification.model_dump())


async def get_certifications_by_course(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> list[CertificationRead]:
    """Get all certifications for a course"""

    # Get course for RBAC check
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    permission_service = get_permission_service(db_session)
    await permission_service.check(
        user=current_user,
        action=Action.READ,
        resource=ResourceType.CERTIFICATE,
        resource_id=course_uuid,
    )

    # Get certifications for this course
    statement = select(Certifications).where(Certifications.course_id == course.id)
    certifications = db_session.exec(statement).all()

    return [
        CertificationRead(**certification.model_dump())
        for certification in certifications
    ]


async def update_certification(
    request: Request,
    certification_uuid: str,
    certification_object: CertificationUpdate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> CertificationRead:
    """Update a certification"""

    statement = select(Certifications).where(
        Certifications.certification_uuid == certification_uuid
    )
    certification = db_session.exec(statement).first()

    if not certification:
        raise HTTPException(
            status_code=404,
            detail="Certification not found",
        )

    # Get course for RBAC check
    statement = select(Course).where(Course.id == certification.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    permission_service = get_permission_service(db_session)
    await permission_service.check(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.CERTIFICATE,
        resource_id=course.course_uuid,
    )

    # Update only the fields that were passed in
    for var, value in vars(certification_object).items():
        if value is not None:
            setattr(certification, var, value)

    # Update the update_date
    certification.update_date = str(datetime.now())

    db_session.add(certification)
    db_session.commit()
    db_session.refresh(certification)

    return CertificationRead(**certification.model_dump())


async def delete_certification(
    request: Request,
    certification_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> dict:
    """Delete a certification"""

    statement = select(Certifications).where(
        Certifications.certification_uuid == certification_uuid
    )
    certification = db_session.exec(statement).first()

    if not certification:
        raise HTTPException(
            status_code=404,
            detail="Certification not found",
        )

    # Get course for RBAC check
    statement = select(Course).where(Course.id == certification.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    permission_service = get_permission_service(db_session)
    await permission_service.check(
        user=current_user,
        action=Action.DELETE,
        resource=ResourceType.CERTIFICATE,
        resource_id=course.course_uuid,
    )

    db_session.delete(certification)
    db_session.commit()

    return {"detail": "Certification deleted successfully"}


####################################################
# Certificate User Functions
####################################################


async def create_certificate_user(
    request: Request,
    user_id: int,
    certification_id: int,
    db_session: Session,
    current_user: PublicUser | AnonymousUser | None = None,
    idempotency_key: str | None = None,
) -> CertificateUserRead:
    """
    Create a certificate user link with enhanced idempotency and race condition protection.

    SECURITY NOTES:
    - This function should only be called by authorized users (course owners, instructors, or system)
    - When called from check_course_completion_and_create_certificate, it's a system operation
    - When called directly, requires proper RBAC checks

    Args:
        request: FastAPI request object
        user_id: ID of user receiving certificate
        certification_id: ID of certification
        db_session: Database session
        current_user: Current user (if called directly)
        idempotency_key: Optional key for duplicate prevention

    Returns:
        CertificateUserRead: Created or existing certificate

    Raises:
        HTTPException: If validation fails or database error occurs
    """

    # Check if certification exists
    statement = select(Certifications).where(Certifications.id == certification_id)
    certification = db_session.exec(statement).first()

    if not certification:
        raise HTTPException(
            status_code=404,
            detail="Certification not found",
        )

    # SECURITY: If current_user is provided, perform RBAC check
    if current_user:
        # Get course for RBAC check
        statement = select(Course).where(Course.id == certification.course_id)
        course = db_session.exec(statement).first()

        if not course:
            raise HTTPException(
                status_code=404,
                detail="Course not found",
            )

        # Require course ownership or instructor role for creating certificates
        permission_service = get_permission_service(db_session)
        await permission_service.check(
            user=current_user,
            action=Action.CREATE,
            resource=ResourceType.CERTIFICATE,
            resource_id=course.course_uuid,
        )

    now = tz_now()

    try:
        # First check if certificate already exists (without lock)
        check_stmt = select(CertificateUser).where(
            CertificateUser.user_id == user_id,
            CertificateUser.certification_id == certification_id,
        )
        existing_cert = db_session.exec(check_stmt).first()
        if existing_cert:
            logger.info(
                f"Certificate already exists for user {user_id} and certification {certification_id}"
            )
            return CertificateUserRead.model_validate(existing_cert)

        # Get user to extract user_uuid
        from src.db.users import User

        user_stmt = select(User).where(User.id == user_id)
        user = db_session.exec(user_stmt).first()

        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found",
            )

        # Generate unique certificate UUID with better collision resistance and idempotency
        current_year = now.year
        current_month = now.month
        current_day = now.day

        # Extract last 4 characters from user_uuid for uniqueness
        user_uuid_short = user.user_uuid[-4:] if user.user_uuid else "USER"

        # Generate deterministic prefix if idempotency_key provided, otherwise random
        if idempotency_key:
            # Use hash of idempotency key for deterministic but unique prefix
            import hashlib

            prefix_hash = hashlib.md5(idempotency_key.encode()).hexdigest()[:2].upper()
        else:
            # Generate random 2-letter prefix
            prefix_hash = "".join(random.choices(string.ascii_uppercase, k=2))

        # Use timestamp for better uniqueness
        timestamp_suffix = f"{int(now.timestamp())}"[-6:]  # Last 6 digits of timestamp

        user_certification_uuid = f"{prefix_hash}-{current_year}{current_month:02d}{current_day:02d}-{user_uuid_short}-{timestamp_suffix}"

        # Create certificate user with enhanced data
        certificate_data = {
            "user_id": user_id,
            "certification_id": certification_id,
            "user_certification_uuid": user_certification_uuid,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        certificate_user = CertificateUser(**certificate_data)

        try:
            db_session.add(certificate_user)
            db_session.flush()  # Ensure it's written and constraints are checked
            logger.info(
                f"Successfully created certificate {user_certification_uuid} for user {user_id} "
                f"and certification {certification_id}"
            )

        except Exception as db_exc:
            # Handle unique constraint violations gracefully
            if "unique" in str(db_exc).lower() or "duplicate" in str(db_exc).lower():
                # Race condition occurred, try to get the existing certificate
                db_session.rollback()

                retry_stmt = select(CertificateUser).where(
                    CertificateUser.user_id == user_id,
                    CertificateUser.certification_id == certification_id,
                )
                existing_cert = db_session.exec(retry_stmt).first()

                if existing_cert:
                    logger.info(
                        f"Certificate already exists (race condition detected) for user {user_id} and certification {certification_id}"
                    )
                    return CertificateUserRead.model_validate(existing_cert)

            # Re-raise if it's not a uniqueness violation
            raise

        # Explicitly commit the transaction to ensure it's persisted
        db_session.commit()
        logger.info(
            f"Certificate transaction committed for user {user_id} and certification {certification_id}"
        )

        return CertificateUserRead.model_validate(certificate_user)

    except Exception as exc:
        db_session.rollback()
        logger.error(
            f"Failed to create certificate for user {user_id} and certification {certification_id}: {exc}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create certificate: {exc!s}",
        ) from exc


async def get_user_certificates_for_course(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> list[dict]:
    """Get all certificates for a user in a specific course with certification details"""

    # Accept both raw id and 'course_'-prefixed UUIDs
    if not course_uuid.startswith("course_"):
        course_uuid = f"course_{course_uuid}"

    # Check if course exists
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check with graceful fallback for learners retrieving their own certificates
    try:
        permission_service = get_permission_service(db_session)
        await permission_service.check(
            user=current_user,
            action=Action.READ,
            resource=ResourceType.CERTIFICATE,
            resource_id=course_uuid,
        )
    except HTTPException as exc:
        if exc.status_code != status.HTTP_403_FORBIDDEN:
            raise

    # Proactively ensure a certificate exists if the course is fully completed.
    # This is idempotent and guarantees the UI sees the certificate once all steps are done.
    try:
        completion_result = await check_course_completion_and_create_certificate(
            request=request,
            user_id=current_user.id,
            course_id=course.id,
            db_session=db_session,
        )
        logger.debug(
            f"Certificate check/creation result for user {current_user.id} in course {course_uuid}: {completion_result}"
        )
    except Exception as err:
        # Don't fail the request on certificate creation errors; just log and proceed to list.
        logger.error(
            f"check_course_completion_and_create_certificate failed during get_user_certificates_for_course: {err}",
            exc_info=True,
        )

    # Get all certifications for this course
    statement = select(Certifications).where(Certifications.course_id == course.id)
    certifications = db_session.exec(statement).all()

    if not certifications:
        return []

    # Get all certificate users for this user and these certifications
    certification_ids = [cert.id for cert in certifications if cert.id]
    if not certification_ids:
        return []

    # Query certificate users for this user and these certifications
    result = []
    for cert_id in certification_ids:
        statement = select(CertificateUser).where(
            CertificateUser.user_id == current_user.id,
            CertificateUser.certification_id == cert_id,
        )
        cert_user = db_session.exec(statement).first()
        if cert_user:
            # Get the associated certification
            statement = select(Certifications).where(Certifications.id == cert_id)
            certification = db_session.exec(statement).first()

            result.append(
                {
                    "certificate_user": CertificateUserRead(**cert_user.model_dump()),
                    "certification": CertificationRead(**certification.model_dump())
                    if certification
                    else None,
                    "course": {
                        "id": course.id,
                        "course_uuid": course.course_uuid,
                        "name": course.name,
                        "description": course.description,
                        "thumbnail_image": course.thumbnail_image,
                    },
                }
            )

    logger.info(
        f"Found {len(result)} certificates for user {current_user.id} in course {course_uuid}. "
        f"Certification IDs checked: {certification_ids}"
    )

    return result


async def check_course_completion_and_create_certificate(
    request: Request,
    user_id: int,
    course_id: int,
    db_session: Session,
    idempotency_key: str | None = None,
) -> bool:
    """
    Check if all activities in a course are completed and create certificate if so.
    Enhanced with server-authoritative XP awarding and better idempotency.

    SECURITY NOTES:
    - This function is called by the system when activities are completed
    - It should only create certificates for users who have actually completed the course
    - The function is called from mark_activity_as_done_for_user which already has RBAC checks

    Args:
        request: FastAPI request object
        user_id: User ID completing the course
        course_id: Course ID being completed
        db_session: Database session
        idempotency_key: Optional idempotency key to prevent duplicate certificates

    Returns:
        bool: True if course completion was processed (certificate created/existed or XP awarded), False otherwise
    """

    # Get the user object for gamification
    from src.db.users import User

    user_statement = select(User).where(User.id == user_id)
    user = db_session.exec(user_statement).first()

    if not user:
        return False

    # Get the course to find org_id
    course_statement = select(Course).where(Course.id == course_id)
    course = db_session.exec(course_statement).first()

    if not course:
        return False

    # Get all activities in the course
    statement = select(ChapterActivity).where(ChapterActivity.course_id == course_id)
    course_activities = db_session.exec(statement).all()

    if not course_activities:
        return False  # No activities in course

    # Get all completed activities for this user in this course
    statement = select(TrailStep).where(
        TrailStep.user_id == user_id,
        TrailStep.course_id == course_id,
        TrailStep.complete,
    )
    completed_activities = db_session.exec(statement).all()

    # Check if all activities are completed
    if len(completed_activities) >= len(course_activities):
        logger.info(
            f"Course {course_id} ({course.course_uuid}) completed by user {user_id}: "
            f"{len(completed_activities)}/{len(course_activities)} activities"
        )

        # Always award XP for course completion (idempotent), regardless of certificate availability
        try:
            gamification_service.on_course_completed(
                db=db_session,
                user_id=user_id,
                org_id=course.org_id,
                course_id=course_id,
                source_id=str(course_id),
                idempotency_key=f"course_{course_id}_{user_id}",
            )
        except Exception as xp_error:
            # Log the error but don't fail subsequent certificate logic
            logger.exception(
                f"Failed to award XP for course completion (user_id: {user_id}, course_id: {course_id}): {xp_error}"
            )

        # Then attempt to create a certificate if the course has certification configured
        statement = select(Certifications).where(Certifications.course_id == course_id)
        certification = db_session.exec(statement).first()

        if certification and certification.id:
            logger.info(
                f"Found certification config (id={certification.id}) for course {course_id}, creating certificate for user {user_id}"
            )
            try:
                # Generate idempotency key if not provided
                if not idempotency_key:
                    idempotency_key = (
                        f"course_completion_{user_id}_{course_id}_{course.course_uuid}"
                    )

                await create_certificate_user(
                    request=request,
                    user_id=user_id,
                    certification_id=certification.id,
                    db_session=db_session,
                    idempotency_key=idempotency_key,
                )

                return True

            except HTTPException as cert_error:
                # Handle certificate creation errors gracefully
                if (
                    cert_error.status_code == 400
                    or "already" in str(cert_error.detail).lower()
                ):
                    # Certificate already exists, which is fine for idempotency
                    return True
                # Re-raise unexpected errors
                raise

            except Exception as general_error:
                # Log unexpected errors but don't fail silently
                print(
                    f"Unexpected error during course completion (user_id: {user_id}, course_id: {course_id}): {general_error}"
                )
                raise
        else:
            # No certification configured for this course — course completion still processed
            logger.warning(
                f"No certification found for course {course_id} ({course.course_uuid}). "
                f"User {user_id} completed the course but no certificate will be issued."
            )
            return True
    else:
        # Course not yet completed
        completed_count = len(completed_activities)
        total_count = len(course_activities)
        logger.debug(
            f"Course {course_id} not completed by user {user_id}: {completed_count}/{total_count} activities finished"
        )

    return False


async def get_certificate_by_user_certification_uuid(
    request: Request,
    user_certification_uuid: str,
    current_user: PublicUser | AnonymousUser | None,
    db_session: Session,
) -> dict:
    """Get a certificate by user_certification_uuid with certification details"""

    # Get certificate user by user_certification_uuid
    statement = select(CertificateUser).where(
        CertificateUser.user_certification_uuid == user_certification_uuid
    )
    certificate_user = db_session.exec(statement).first()

    if not certificate_user:
        raise HTTPException(
            status_code=404,
            detail="Certificate not found",
        )

    # Get the associated certification
    statement = select(Certifications).where(
        Certifications.id == certificate_user.certification_id
    )
    certification = db_session.exec(statement).first()

    if not certification:
        raise HTTPException(
            status_code=404,
            detail="Certification not found",
        )

    # Get course information
    statement = select(Course).where(Course.id == certification.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # No RBAC check - allow anyone to access certificates by UUID

    return {
        "certificate_user": CertificateUserRead(**certificate_user.model_dump()),
        "certification": CertificationRead(**certification.model_dump()),
        "course": {
            "id": course.id,
            "course_uuid": course.course_uuid,
            "name": course.name,
            "description": course.description,
            "thumbnail_image": course.thumbnail_image,
        },
    }


async def get_all_user_certificates(
    request: Request,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> list[dict]:
    """Get all certificates for the current user with complete linked information"""

    # Get all certificate users for this user
    statement = select(CertificateUser).where(
        CertificateUser.user_id == current_user.id
    )
    certificate_users = db_session.exec(statement).all()

    if not certificate_users:
        return []

    result = []
    for cert_user in certificate_users:
        # Get the associated certification
        statement = select(Certifications).where(
            Certifications.id == cert_user.certification_id
        )
        certification = db_session.exec(statement).first()

        if not certification:
            continue

        # Get course information
        statement = select(Course).where(Course.id == certification.course_id)
        course = db_session.exec(statement).first()

        if not course:
            continue

        # Get user information
        from src.db.users import User

        statement = select(User).where(User.id == cert_user.user_id)
        user = db_session.exec(statement).first()

        result.append(
            {
                "certificate_user": CertificateUserRead(**cert_user.model_dump()),
                "certification": CertificationRead(**certification.model_dump()),
                "course": {
                    "id": course.id,
                    "course_uuid": course.course_uuid,
                    "name": course.name,
                    "description": course.description,
                    "thumbnail_image": course.thumbnail_image,
                },
                "user": {
                    "id": user.id if user else None,
                    "user_uuid": user.user_uuid if user else None,
                    "username": user.username if user else None,
                    "email": user.email if user else None,
                    "first_name": user.first_name if user else None,
                    "last_name": user.last_name if user else None,
                }
                if user
                else None,
            }
        )

    return result
