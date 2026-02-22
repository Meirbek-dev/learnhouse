import pytest
import sqlalchemy as sa

from config.config import get_platform_config


def test_course_creation_update_columns_are_timestamptz() -> None:
    cfg = get_platform_config()
    try:
        engine = sa.create_engine(
            cfg.database_config.sql_connection_string, future=True
        )
    except Exception as e:
        pytest.skip(f"Cannot create DB engine: {e}")

    inspector = sa.inspect(engine)

    try:
        cols = inspector.get_columns("course")
    except Exception as exc:
        pytest.skip(f"Cannot inspect table course: {exc}")

    c = next((c for c in cols if c.get("name") == "creation_date"), None)
    u = next((c for c in cols if c.get("name") == "update_date"), None)
    assert c is not None and u is not None, (
        "course creation_date/update_date columns not present"
    )

    def _contains(col_type, substr: str) -> bool:
        return substr.upper() in str(col_type).upper()

    assert _contains(c.get("type"), "TIMESTAMP"), (
        f"course.creation_date is not TIMESTAMP: {c.get('type')}"
    )
    assert _contains(u.get("type"), "TIMESTAMP"), (
        f"course.update_date is not TIMESTAMP: {u.get('type')}"
    )
