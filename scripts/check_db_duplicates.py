"""Simple helper to list duplicates for target columns before running migrations.
Run from repository root: python scripts/check_db_duplicates.py
"""
import sqlalchemy as sa
from config.config import get_platform_config

TARGETS = [
    ("activity", "activity_uuid"),
    ("course", "course_uuid"),
    ("collection", "collection_uuid"),
    ("chapter", "chapter_uuid"),
    ("assignment", "assignment_uuid"),
    ("assignmenttask", "assignment_task_uuid"),
    ("assignmenttasksubmission", "assignment_task_submission_uuid"),
    ("assignmentusersubmission", "assignmentusersubmission_uuid"),
    ("block", "block_uuid"),
    ("courseupdate", "courseupdate_uuid"),
    ("certifications", "certification_uuid"),
    ("certificateuser", "user_certification_uuid"),
    ("usergroup", "usergroup_uuid"),
]


def main():
    cfg = get_platform_config()
    engine = sa.create_engine(cfg.database_config.sql_connection_string)
    conn = engine.connect()

    for table, column in TARGETS:
        stmt = sa.text(f"SELECT {column} as val, count(*) as c FROM {table} GROUP BY {column} HAVING count(*) > 1")
        res = conn.execute(stmt).fetchall()
        if res:
            print(f"DUPLICATES in {table}.{column}:")
            for r in res:
                print(" ", r)

    # check email duplicates ignoring case
    stmt = sa.text("SELECT lower(email) as e, count(*) as c FROM \"user\" GROUP BY lower(email) HAVING count(*) > 1")
    res = conn.execute(stmt).fetchall()
    if res:
        print("DUPLICATE EMAILS (case-insensitive):")
        for r in res:
            print(" ", r)


if __name__ == "__main__":
    main()
