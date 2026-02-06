import logging
from datetime import datetime
from typing import Literal

from fastapi import HTTPException, Request
from sqlmodel import Session, select
from src.services.permissions import get_permission_service
from ulid import ULID

from src.db.organizations import Organization
from src.db.permissions.enums import Action, ResourceType
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup, UserGroupCreate, UserGroupRead, UserGroupUpdate
from src.db.users import AnonymousUser, InternalUser, PublicUser, User, UserRead


async def create_usergroup(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    usergroup_create: UserGroupCreate,
) -> UserGroupRead:
    usergroup = UserGroup.model_validate(usergroup_create)

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.CREATE,
        resource=ResourceType.USERGROUP,
        resource_id=None,
    )

    # Check if Organization exists
    statement = select(Organization).where(Organization.id == usergroup_create.org_id)
    org = db_session.exec(statement).first()

    if not org or org.id is None:
        raise HTTPException(
            status_code=400,
            detail="Organization does not exist",
        )

    # Complete the object
    usergroup.usergroup_uuid = f"usergroup_{ULID()}"
    usergroup.creation_date = str(datetime.now())
    usergroup.update_date = str(datetime.now())
    usergroup.creator_id = current_user.id

    # Save the object
    db_session.add(usergroup)
    db_session.commit()
    db_session.refresh(usergroup)

    return UserGroupRead.model_validate(usergroup)


async def read_usergroup_by_id(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    usergroup_id: int,
) -> UserGroupRead:
    statement = select(UserGroup).where(UserGroup.id == usergroup_id)
    usergroup = db_session.exec(statement).first()

    if not usergroup:
        raise HTTPException(
            status_code=404,
            detail="UserGroup not found",
        )

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.READ,
        resource=ResourceType.USERGROUP,
        resource_id=usergroup.usergroup_uuid,
    )

    return UserGroupRead.model_validate(usergroup)


async def get_users_linked_to_usergroup(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    usergroup_id: int,
) -> list[UserRead]:
    statement = select(UserGroup).where(UserGroup.id == usergroup_id)
    usergroup = db_session.exec(statement).first()

    if not usergroup:
        raise HTTPException(
            status_code=404,
            detail="UserGroup not found",
        )

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.READ,
        resource=ResourceType.USERGROUP,
        resource_id=usergroup.usergroup_uuid,
    )

    statement = select(UserGroupUser).where(UserGroupUser.usergroup_id == usergroup_id)
    usergroup_users = db_session.exec(statement).all()

    user_ids = [usergroup_user.user_id for usergroup_user in usergroup_users]

    # get users
    users = []
    for user_id in user_ids:
        statement = select(User).where(User.id == user_id)
        user = db_session.exec(statement).first()
        users.append(user)

    return [UserRead.model_validate(user) for user in users]


async def read_usergroups_by_org_id(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    org_id: int,
) -> list[UserGroupRead]:
    statement = select(UserGroup).where(UserGroup.org_id == org_id)
    usergroups = db_session.exec(statement).all()

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.READ,
        resource=ResourceType.USERGROUP,
        resource_id=None,
    )

    return [UserGroupRead.model_validate(usergroup) for usergroup in usergroups]


async def get_usergroups_by_resource(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    resource_uuid: str,
) -> list[UserGroupRead]:
    statement = select(UserGroupResource).where(
        UserGroupResource.resource_uuid == resource_uuid
    )
    usergroup_resources = db_session.exec(statement).all()

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.READ,
        resource=ResourceType.USERGROUP,
        resource_id=None,
    )

    usergroup_ids = [usergroup.usergroup_id for usergroup in usergroup_resources]

    # get usergroups
    usergroups = []
    for usergroup_id in usergroup_ids:
        statement = select(UserGroup).where(UserGroup.id == usergroup_id)
        usergroup = db_session.exec(statement).first()
        usergroups.append(usergroup)

    return [UserGroupRead.model_validate(usergroup) for usergroup in usergroups]


async def update_usergroup_by_id(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    usergroup_id: int,
    usergroup_update: UserGroupUpdate,
) -> UserGroupRead:
    statement = select(UserGroup).where(UserGroup.id == usergroup_id)
    usergroup = db_session.exec(statement).first()

    if not usergroup:
        raise HTTPException(
            status_code=404,
            detail="UserGroup not found",
        )

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.USERGROUP,
        resource_id=usergroup.usergroup_uuid,
    )

    usergroup.name = usergroup_update.name
    usergroup.description = usergroup_update.description
    usergroup.update_date = str(datetime.now())

    db_session.add(usergroup)
    db_session.commit()
    db_session.refresh(usergroup)

    return UserGroupRead.model_validate(usergroup)


async def delete_usergroup_by_id(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    usergroup_id: int,
) -> str:
    statement = select(UserGroup).where(UserGroup.id == usergroup_id)
    usergroup = db_session.exec(statement).first()

    if not usergroup:
        raise HTTPException(
            status_code=404,
            detail="UserGroup not found",
        )

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.DELETE,
        resource=ResourceType.USERGROUP,
        resource_id=usergroup.usergroup_uuid,
    )

    db_session.delete(usergroup)
    db_session.commit()

    return "UserGroup deleted successfully"


async def add_users_to_usergroup(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser | InternalUser,
    usergroup_id: int,
    user_ids: str,
) -> str:
    statement = select(UserGroup).where(UserGroup.id == usergroup_id)
    usergroup = db_session.exec(statement).first()

    if not usergroup:
        raise HTTPException(
            status_code=404,
            detail="UserGroup not found",
        )

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.CREATE,
        resource=ResourceType.USERGROUP,
        resource_id=usergroup.usergroup_uuid,
    )

    user_ids_array = user_ids.split(",")

    for user_id_str in user_ids_array:
        try:
            user_id = int(user_id_str.strip())
        except ValueError:
            logging.exception(f"Invalid user_id format: {user_id_str}")
            continue

        statement = select(User).where(User.id == user_id)
        user = db_session.exec(statement).first()

        # Check if User is already Linked to UserGroup
        statement = select(UserGroupUser).where(
            UserGroupUser.usergroup_id == usergroup_id,
            UserGroupUser.user_id == user_id,
        )
        usergroup_user = db_session.exec(statement).first()

        if usergroup_user:
            logging.error(f"User with id {user_id} already exists in UserGroup")
            continue

        if user:
            # Add user to UserGroup
            if user.id is not None:
                usergroup_obj = UserGroupUser(
                    usergroup_id=usergroup_id,
                    user_id=user.id,
                    org_id=usergroup.org_id,
                    creation_date=str(datetime.now()),
                    update_date=str(datetime.now()),
                )

                db_session.add(usergroup_obj)
                db_session.commit()
                db_session.refresh(usergroup_obj)
        else:
            logging.error(f"User with id {user_id} not found")

    return "Users added to UserGroup successfully"


async def remove_users_from_usergroup(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    usergroup_id: int,
    user_ids: str,
) -> str:
    statement = select(UserGroup).where(UserGroup.id == usergroup_id)
    usergroup = db_session.exec(statement).first()

    if not usergroup:
        raise HTTPException(
            status_code=404,
            detail="UserGroup not found",
        )

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.DELETE,
        resource=ResourceType.USERGROUP,
        resource_id=usergroup.usergroup_uuid,
    )

    user_ids_array = user_ids.split(",")

    for user_id_str in user_ids_array:
        try:
            user_id = int(user_id_str.strip())
        except ValueError:
            logging.exception(f"Invalid user_id format: {user_id_str}")
            continue

        statement = select(UserGroupUser).where(
            UserGroupUser.user_id == user_id, UserGroupUser.usergroup_id == usergroup_id
        )
        usergroup_user = db_session.exec(statement).first()

        if usergroup_user:
            db_session.delete(usergroup_user)
            db_session.commit()
        else:
            logging.error(f"User with id {user_id} not found in UserGroup")

    return "Users removed from UserGroup successfully"


async def add_resources_to_usergroup(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    usergroup_id: int,
    resources_uuids: str,
) -> str:
    statement = select(UserGroup).where(UserGroup.id == usergroup_id)
    usergroup = db_session.exec(statement).first()

    if not usergroup:
        raise HTTPException(
            status_code=404,
            detail="UserGroup not found",
        )

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.CREATE,
        resource=ResourceType.USERGROUP,
        resource_id=usergroup.usergroup_uuid,
    )

    resources_uuids_array = resources_uuids.split(",")

    for resource_uuid in resources_uuids_array:
        # Check if a link between UserGroup and Resource already exists
        statement = select(UserGroupResource).where(
            UserGroupResource.usergroup_id == usergroup_id,
            UserGroupResource.resource_uuid == resource_uuid,
        )
        usergroup_resource = db_session.exec(statement).first()

        if usergroup_resource:
            logging.error(f"Resource {resource_uuid} already exists in UserGroup")
            continue

        # TODO : Find a way to check if resource really exists
        usergroup_obj = UserGroupResource(
            usergroup_id=usergroup_id,
            resource_uuid=resource_uuid,
            org_id=usergroup.org_id,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )

        db_session.add(usergroup_obj)
        db_session.commit()
        db_session.refresh(usergroup_obj)

    return "Resources added to UserGroup successfully"


async def remove_resources_from_usergroup(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    usergroup_id: int,
    resources_uuids: str,
) -> str:
    statement = select(UserGroup).where(UserGroup.id == usergroup_id)
    usergroup = db_session.exec(statement).first()

    if not usergroup:
        raise HTTPException(
            status_code=404,
            detail="UserGroup not found",
        )

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.DELETE,
        resource=ResourceType.USERGROUP,
        resource_id=usergroup.usergroup_uuid,
    )

    resources_uuids_array = resources_uuids.split(",")

    for resource_uuid in resources_uuids_array:
        statement = select(UserGroupResource).where(
            UserGroupResource.resource_uuid == resource_uuid
        )
        usergroup_resource = db_session.exec(statement).first()

        if usergroup_resource:
            db_session.delete(usergroup_resource)
            db_session.commit()
        else:
            logging.error(f"resource with uuid {resource_uuid} not found in UserGroup")

    return "Resources removed from UserGroup successfully"
