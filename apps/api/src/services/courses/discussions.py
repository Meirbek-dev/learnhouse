from datetime import datetime

from fastapi import HTTPException, Request, status
from sqlmodel import Session, col, select
from ulid import ULID

from src.db.courses.courses import Course
from src.db.courses.discussions import (
    CourseDiscussion,
    CourseDiscussionCreate,
    CourseDiscussionRead,
    CourseDiscussionUpdate,
    DiscussionDislike,
    DiscussionLike,
    DiscussionLikeRead,
    DiscussionStatusEnum,
    DiscussionType,
)
from src.db.organizations import Organization
from src.db.permissions.enums import Action, ResourceType
from src.db.users import AnonymousUser, PublicUser, User
from src.services.permissions import get_permission_service


async def create_discussion(
    request: Request,
    course_uuid: str,
    discussion_object: CourseDiscussionCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> CourseDiscussionRead:
    """Create a new discussion post or reply"""
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to create discussions",
        )

    # Check if org exists
    statement_org = select(Organization).where(
        Organization.id == discussion_object.org_id
    )
    org = db_session.exec(statement_org).first()

    if not org or org.id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Organization does not exist"
        )

    # Check if course exists
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(statement).first()

    if not course or course.id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Course does not exist"
        )

    # RBAC check - users need read access to participate in discussions
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.READ,
        resource=ResourceType.COURSE,
        resource_id=course.course_uuid,
    )

    # If it's a reply, check if parent discussion exists
    if discussion_object.parent_discussion_id:
        parent_statement = select(CourseDiscussion).where(
            CourseDiscussion.id == discussion_object.parent_discussion_id,
            CourseDiscussion.course_id == course.id,
            CourseDiscussion.status == DiscussionStatusEnum.ACTIVE,
        )
        parent_discussion = db_session.exec(parent_statement).first()

        if not parent_discussion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent discussion not found",
            )

    # Generate UUID
    discussion_uuid = f"discussion_{ULID()}"
    discussion_creation_date = str(datetime.now())
    discussion = CourseDiscussion(
        **discussion_object.model_dump(),
        course_id=course.id,
        user_id=current_user.id,
        discussion_uuid=discussion_uuid,
        creation_date=discussion_creation_date,
        update_date=discussion_creation_date,
    )

    db_session.add(discussion)
    db_session.commit()
    db_session.refresh(discussion)

    # Update parent discussion reply count if this is a reply
    if discussion_object.parent_discussion_id:
        parent_update = select(CourseDiscussion).where(
            CourseDiscussion.id == discussion_object.parent_discussion_id
        )
        parent = db_session.exec(parent_update).first()
        if parent:
            parent.replies_count += 1
            db_session.add(parent)
            db_session.commit()

    return await get_discussion_with_details(discussion.id, db_session, current_user)


async def get_discussions_by_course_uuid(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
    include_replies: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[CourseDiscussionRead]:
    """Get discussions for a course"""
    # Check if course exists
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(statement).first()

    if not course or course.id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Course does not exist"
        )

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.READ,
        resource=ResourceType.COURSE,
        resource_id=course.course_uuid,
    )

    # Get main discussions (posts, not replies)
    query = (
        select(CourseDiscussion)
        .where(
            CourseDiscussion.course_id == course.id,
            CourseDiscussion.type == DiscussionType.POST,
            CourseDiscussion.status == DiscussionStatusEnum.ACTIVE,
            CourseDiscussion.parent_discussion_id.is_(None),
        )
        .order_by(col(CourseDiscussion.creation_date).desc())
        .offset(offset)
        .limit(limit)
    )

    discussions = db_session.exec(query).all()

    result = []
    for discussion in discussions:
        discussion_data = await get_discussion_with_details(
            discussion.id, db_session, current_user
        )

        if include_replies:
            # Get replies for this discussion
            replies_query = (
                select(CourseDiscussion)
                .where(
                    CourseDiscussion.parent_discussion_id == discussion.id,
                    CourseDiscussion.status == DiscussionStatusEnum.ACTIVE,
                )
                .order_by(col(CourseDiscussion.creation_date).asc())
            )
            replies = db_session.exec(replies_query).all()

            reply_data = []
            for reply in replies:
                reply_detail = await get_discussion_with_details(
                    reply.id, db_session, current_user
                )
                reply_data.append(reply_detail)

            discussion_data.replies = reply_data

        result.append(discussion_data)

    return result


async def get_discussion_with_details(
    discussion_id: int,
    db_session: Session,
    current_user: PublicUser | AnonymousUser | None = None,
) -> CourseDiscussionRead:
    """Get discussion with user details and like status"""
    # Join discussion with user data
    discussion_query = (
        select(CourseDiscussion, User)
        .join(User, CourseDiscussion.user_id == User.id)
        .where(CourseDiscussion.id == discussion_id)
    )

    result = db_session.exec(discussion_query).first()

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found"
        )

    discussion, user = result

    from src.db.users import UserRead

    user_read = UserRead(
        id=user.id,
        user_uuid=user.user_uuid,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        avatar_image=user.avatar_image,
        bio=user.bio,
        details=user.details,
        profile=user.profile,
    )

    discussion_read = CourseDiscussionRead(**discussion.model_dump())
    discussion_read.user = user_read

    # Check if current user has liked/disliked this discussion
    if current_user and not isinstance(current_user, AnonymousUser):
        like_statement = select(DiscussionLike).where(
            DiscussionLike.discussion_id == discussion.id,
            DiscussionLike.user_id == current_user.id,
        )
        existing_like = db_session.exec(like_statement).first()
        discussion_read.is_liked = existing_like is not None

        dislike_statement = select(DiscussionDislike).where(
            DiscussionDislike.discussion_id == discussion.id,
            DiscussionDislike.user_id == current_user.id,
        )
        existing_dislike = db_session.exec(dislike_statement).first()
        discussion_read.is_disliked = existing_dislike is not None
    else:
        discussion_read.is_liked = False
        discussion_read.is_disliked = False

    return discussion_read


async def update_discussion(
    request: Request,
    discussion_uuid: str,
    discussion_object: CourseDiscussionUpdate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> CourseDiscussionRead:
    """Update a discussion"""
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )

    statement = select(CourseDiscussion).where(
        CourseDiscussion.discussion_uuid == discussion_uuid
    )
    discussion = db_session.exec(statement).first()

    if not discussion or discussion.id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Discussion does not exist"
        )

    # Only the author can edit their discussion
    if discussion.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own discussions",
        )

    # Update fields
    for key, value in discussion_object.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(discussion, key, value)

    discussion.update_date = str(datetime.now())

    db_session.add(discussion)
    db_session.commit()
    db_session.refresh(discussion)

    return await get_discussion_with_details(discussion.id, db_session, current_user)


async def delete_discussion(
    request: Request,
    discussion_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    """Delete a discussion (soft delete)"""
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )

    statement = select(CourseDiscussion).where(
        CourseDiscussion.discussion_uuid == discussion_uuid
    )
    discussion = db_session.exec(statement).first()

    if not discussion or discussion.id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Discussion does not exist"
        )

    # Only the author can delete their discussion
    if discussion.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own discussions",
        )

    # Soft delete
    discussion.status = DiscussionStatusEnum.DELETED
    discussion.update_date = str(datetime.now())

    db_session.add(discussion)
    db_session.commit()

    return {"message": "Discussion deleted successfully"}


async def like_discussion(
    request: Request,
    discussion_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> DiscussionLikeRead:
    """Like a discussion"""
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to like discussions",
        )

    # Find the discussion
    statement = select(CourseDiscussion).where(
        CourseDiscussion.discussion_uuid == discussion_uuid,
        CourseDiscussion.status == DiscussionStatusEnum.ACTIVE,
    )
    discussion = db_session.exec(statement).first()

    if not discussion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found"
        )

    # Check if user already liked this discussion
    existing_like = select(DiscussionLike).where(
        DiscussionLike.discussion_id == discussion.id,
        DiscussionLike.user_id == current_user.id,
    )
    existing = db_session.exec(existing_like).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already liked this discussion",
        )

    # Create like
    like = DiscussionLike(
        discussion_id=discussion.id,
        user_id=current_user.id,
        creation_date=str(datetime.now()),
    )

    db_session.add(like)

    # Update discussion likes count
    discussion.likes_count += 1
    db_session.add(discussion)

    db_session.commit()
    db_session.refresh(like)

    return DiscussionLikeRead(**like.model_dump())


async def unlike_discussion(
    request: Request,
    discussion_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    """Unlike a discussion"""
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )

    # Find the discussion
    statement = select(CourseDiscussion).where(
        CourseDiscussion.discussion_uuid == discussion_uuid,
        CourseDiscussion.status == DiscussionStatusEnum.ACTIVE,
    )
    discussion = db_session.exec(statement).first()

    if not discussion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found"
        )

    # Find the like
    like_statement = select(DiscussionLike).where(
        DiscussionLike.discussion_id == discussion.id,
        DiscussionLike.user_id == current_user.id,
    )
    like = db_session.exec(like_statement).first()

    if not like:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You haven't liked this discussion",
        )

    # Remove like
    db_session.delete(like)

    # Update discussion likes count
    discussion.likes_count = max(0, discussion.likes_count - 1)
    db_session.add(discussion)

    db_session.commit()

    return {"message": "Discussion unliked successfully"}


async def toggle_discussion_like(
    request: Request,
    discussion_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> dict:
    """Toggle like status for a discussion - like if not liked, unlike if liked"""
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to like discussions",
        )

    # Find the discussion
    statement = select(CourseDiscussion).where(
        CourseDiscussion.discussion_uuid == discussion_uuid,
        CourseDiscussion.status == DiscussionStatusEnum.ACTIVE,
    )
    discussion = db_session.exec(statement).first()

    if not discussion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found"
        )

    # Check if user already liked this discussion
    existing_like_statement = select(DiscussionLike).where(
        DiscussionLike.discussion_id == discussion.id,
        DiscussionLike.user_id == current_user.id,
    )
    existing_like = db_session.exec(existing_like_statement).first()

    # Check if user already disliked this discussion
    existing_dislike_statement = select(DiscussionDislike).where(
        DiscussionDislike.discussion_id == discussion.id,
        DiscussionDislike.user_id == current_user.id,
    )
    existing_dislike = db_session.exec(existing_dislike_statement).first()

    if existing_like:
        # Unlike - remove the like
        db_session.delete(existing_like)
        discussion.likes_count = max(0, discussion.likes_count - 1)
        action = "unliked"
        is_liked = False
        is_disliked = existing_dislike is not None
    else:
        # Like - create new like and remove dislike if exists
        if existing_dislike:
            db_session.delete(existing_dislike)
            discussion.dislikes_count = max(0, discussion.dislikes_count - 1)

        like = DiscussionLike(
            discussion_id=discussion.id,
            user_id=current_user.id,
            creation_date=str(datetime.now()),
        )
        db_session.add(like)
        discussion.likes_count += 1
        action = "liked"
        is_liked = True
        is_disliked = False

    db_session.add(discussion)
    db_session.commit()

    return {
        "message": f"Discussion {action} successfully",
        "is_liked": is_liked,
        "is_disliked": is_disliked,
        "likes_count": discussion.likes_count,
        "dislikes_count": discussion.dislikes_count,
    }


async def toggle_discussion_dislike(
    request: Request,
    discussion_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> dict:
    """Toggle dislike status for a discussion - dislike if not disliked, undislike if disliked"""
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to dislike discussions",
        )

    # Find the discussion
    statement = select(CourseDiscussion).where(
        CourseDiscussion.discussion_uuid == discussion_uuid,
        CourseDiscussion.status == DiscussionStatusEnum.ACTIVE,
    )
    discussion = db_session.exec(statement).first()

    if not discussion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found"
        )

    # Check if user already disliked this discussion
    existing_dislike_statement = select(DiscussionDislike).where(
        DiscussionDislike.discussion_id == discussion.id,
        DiscussionDislike.user_id == current_user.id,
    )
    existing_dislike = db_session.exec(existing_dislike_statement).first()

    # Check if user already liked this discussion
    existing_like_statement = select(DiscussionLike).where(
        DiscussionLike.discussion_id == discussion.id,
        DiscussionLike.user_id == current_user.id,
    )
    existing_like = db_session.exec(existing_like_statement).first()

    if existing_dislike:
        # Undislike - remove the dislike
        db_session.delete(existing_dislike)
        discussion.dislikes_count = max(0, discussion.dislikes_count - 1)
        action = "undisliked"
        is_disliked = False
        is_liked = existing_like is not None
    else:
        # Dislike - create new dislike and remove like if exists
        if existing_like:
            db_session.delete(existing_like)
            discussion.likes_count = max(0, discussion.likes_count - 1)

        dislike = DiscussionDislike(
            discussion_id=discussion.id,
            user_id=current_user.id,
            creation_date=str(datetime.now()),
        )
        db_session.add(dislike)
        discussion.dislikes_count += 1
        action = "disliked"
        is_disliked = True
        is_liked = False

    db_session.add(discussion)
    db_session.commit()

    return {
        "message": f"Discussion {action} successfully",
        "is_liked": is_liked,
        "is_disliked": is_disliked,
        "likes_count": discussion.likes_count,
        "dislikes_count": discussion.dislikes_count,
    }


async def get_discussion_replies(
    request: Request,
    discussion_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
    limit: int = 50,
    offset: int = 0,
) -> list[CourseDiscussionRead]:
    """Get replies for a specific discussion"""
    # Find the discussion
    statement = select(CourseDiscussion).where(
        CourseDiscussion.discussion_uuid == discussion_uuid,
        CourseDiscussion.status == DiscussionStatusEnum.ACTIVE,
    )
    discussion = db_session.exec(statement).first()

    if not discussion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found"
        )

    # RBAC check for course access
    course_statement = select(Course).where(Course.id == discussion.course_id)
    course = db_session.exec(course_statement).first()

    if course:
        permission_service = get_permission_service(db_session)

        await permission_service.check(
            user=current_user,
            action=Action.READ,
            resource=ResourceType.COURSE,
            resource_id=course.course_uuid,
        )

    # Get replies
    replies_query = (
        select(CourseDiscussion)
        .where(
            CourseDiscussion.parent_discussion_id == discussion.id,
            CourseDiscussion.status == DiscussionStatusEnum.ACTIVE,
        )
        .order_by(col(CourseDiscussion.creation_date).asc())
        .offset(offset)
        .limit(limit)
    )

    replies = db_session.exec(replies_query).all()

    result = []
    for reply in replies:
        reply_data = await get_discussion_with_details(
            reply.id, db_session, current_user
        )
        result.append(reply_data)

    return result
