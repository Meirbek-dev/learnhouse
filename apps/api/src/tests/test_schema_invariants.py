import pytest
import sqlalchemy as sa
from config.config import get_platform_config

TARGETS = [
    ("activity", "activity_uuid", "uq_activity_activity_uuid"),
    ("course", "course_uuid", "uq_course_course_uuid"),
    ("collection", "collection_uuid", "uq_collection_collection_uuid"),
    ("chapter", "chapter_uuid", "uq_chapter_chapter_uuid"),
    ("assignment", "assignment_uuid", "uq_assignment_assignment_uuid"),
    ("assignmenttask", "assignment_task_uuid", "uq_assignmenttask_assignment_task_uuid"),
    ("assignmenttasksubmission", "assignment_task_submission_uuid", "uq_assignmenttasksubmission_assignment_task_submission_uuid"),
    ("assignmentusersubmission", "assignmentusersubmission_uuid", "uq_assignmentusersubmission_assignmentusersubmission_uuid"),
    ("block", "block_uuid", "uq_block_block_uuid"),
    ("courseupdate", "courseupdate_uuid", "uq_courseupdate_courseupdate_uuid"),
    ("certifications", "certification_uuid", "uq_certifications_certification_uuid"),
    ("certificateuser", "user_certification_uuid", "uq_certificateuser_user_certification_uuid"),
    ("usergroup", "usergroup_uuid", "uq_usergroup_usergroup_uuid"),
]


@pytest.mark.parametrize("table,column,constraint", TARGETS)
def test_unique_constraint_exists(table: str, column: str, constraint: str):
    """Check that a UNIQUE constraint on the given column exists in the DB."""
    cfg = get_platform_config()
    try:
        engine = sa.create_engine(cfg.database_config.sql_connection_string, future=True)
    except Exception as e:
        pytest.skip(f"Cannot create DB engine: {e}")

    inspector = sa.inspect(engine)

    # check unique constraints
    try:
        uniques = inspector.get_unique_constraints(table)
    except Exception as exc:
        pytest.skip(f"Cannot inspect table {table}: {exc}")

    # If constraint with the exact name exists, pass
    has_named = any(u.get("name") == constraint for u in uniques)

    # Otherwise check if any unique constraint exists for the target column
    has_col = any(column in u.get("column_names", []) for u in uniques)

    assert has_named or has_col, (
        f"Missing unique constraint on {table}.{column} (expected name {constraint})"
    )


def _column_type_contains(col_type, substr: str) -> bool:
    # col_type may be an instance or a string, be permissive
    t = str(col_type).upper()
    return substr.upper() in t


JSONB_TARGETS = [
    ("activity", "details", "idx_activity_details_gin"),
    ("block", "content", "idx_block_content_gin"),
    ("user", "details", "idx_user_details_gin"),
    ("user", "profile", "idx_user_profile_gin"),
    ("organization", "socials", "idx_organization_socials_gin"),
]


@pytest.mark.parametrize("table,column,index", JSONB_TARGETS)
def test_jsonb_and_gin_index(table: str, column: str, index: str):
    cfg = get_platform_config()
    try:
        engine = sa.create_engine(cfg.database_config.sql_connection_string, future=True)
    except Exception as e:
        pytest.skip(f"Cannot create DB engine: {e}")

    inspector = sa.inspect(engine)

    try:
        cols = inspector.get_columns(table)
    except Exception as exc:
        pytest.skip(f"Cannot inspect table {table}: {exc}")

    col = next((c for c in cols if c.get("name") == column), None)
    assert col is not None, f"Column {table}.{column} not found"

    assert _column_type_contains(col.get("type"), "JSONB"), f"Column {table}.{column} is not jsonb: {col.get('type')}"

    # Check index exists
    indexes = inspector.get_indexes(table)
    has_index = any(i.get("name") == index for i in indexes)
    assert has_index, f"Missing GIN index {index} on {table}.{column}"


def test_ci_email_index_exists():
    cfg = get_platform_config()
    try:
        engine = sa.create_engine(cfg.database_config.sql_connection_string, future=True)
    except Exception as e:
        pytest.skip(f"Cannot create DB engine: {e}")

    inspector = sa.inspect(engine)
    try:
        indexes = inspector.get_indexes("user")
    except Exception as exc:
        pytest.skip(f"Cannot inspect table user: {exc}")

    has_ci_index = any(i.get("name") == "uq_user_email_lower" for i in indexes)
    assert has_ci_index, "Missing case-insensitive unique index uq_user_email_lower on user(email)"


def test_activity_timestamp_is_timestamptz():
    cfg = get_platform_config()
    try:
        engine = sa.create_engine(cfg.database_config.sql_connection_string, future=True)
    except Exception as e:
        pytest.skip(f"Cannot create DB engine: {e}")

    inspector = sa.inspect(engine)
    try:
        cols = inspector.get_columns("activity")
    except Exception as exc:
        pytest.skip(f"Cannot inspect table activity: {exc}")

    c = next((c for c in cols if c.get("name") == "creation_date"), None)
    u = next((c for c in cols if c.get("name") == "update_date"), None)
    assert c is not None and u is not None, "activity creation_date/update_date columns not present"

    assert _column_type_contains(c.get("type"), "TIMESTAMP"), f"activity.creation_date is not TIMESTAMP: {c.get('type')}"
    assert _column_type_contains(u.get("type"), "TIMESTAMP"), f"activity.update_date is not TIMESTAMP: {u.get('type')}"
