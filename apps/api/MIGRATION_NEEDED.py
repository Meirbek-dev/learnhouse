"""Add database indexes for exam performance

Revision ID: exam_indexes_001
Revises:
Create Date: 2025-12-31

IMPORTANT: This migration needs to be created using Alembic.

Run this command from the API directory:
```bash
cd apps/api
alembic revision -m "add exam performance indexes"
```

Then add the following to the generated migration file:
"""

# TODO: Create actual Alembic migration file
# Location: apps/api/migrations/versions/XXXX_add_exam_performance_indexes.py

def upgrade():
    """
    Add indexes for exam module performance optimization
    """
    # Index for exam attempt lookups by exam and user
    op.create_index(
        'idx_exam_attempt_exam_user',
        'exam_attempt',
        ['exam_id', 'user_id']
    )

    # Index for attempt UUID lookups
    op.create_index(
        'idx_exam_attempt_uuid',
        'exam_attempt',
        ['attempt_uuid'],
        unique=True
    )

    # Index for user attempts queries (get_user_attempts)
    op.create_index(
        'idx_exam_attempt_user_created',
        'exam_attempt',
        ['user_id', 'creation_date']
    )

    # Index for question lookups
    op.create_index(
        'idx_question_exam_order',
        'question',
        ['exam_id', 'order_index']
    )

    # Index for exam activity lookups
    op.create_index(
        'idx_exam_activity',
        'exam',
        ['activity_id']
    )


def downgrade():
    """
    Remove indexes
    """
    op.drop_index('idx_exam_attempt_exam_user', 'exam_attempt')
    op.drop_index('idx_exam_attempt_uuid', 'exam_attempt')
    op.drop_index('idx_exam_attempt_user_created', 'exam_attempt')
    op.drop_index('idx_question_exam_order', 'question')
    op.drop_index('idx_exam_activity', 'exam')
