"""Fix enum case mismatch - convert UPPERCASE enum values to lowercase to match Python Enums."""
from sqlalchemy import create_engine, text
from config.config import get_platform_config

cfg = get_platform_config()
engine = create_engine(cfg.database_config.sql_connection_string)

print("Fixing RBAC ENUM case mismatch...")
print("=" * 60)

with engine.connect() as conn:
    # First, convert columns to VARCHAR if they're using ENUM types
    print("\n1. Converting enum columns to VARCHAR...")
    try:
        conn.execute(text("ALTER TABLE permissions ALTER COLUMN resource_type TYPE VARCHAR"))
        conn.execute(text("ALTER TABLE permissions ALTER COLUMN action TYPE VARCHAR"))
        conn.execute(text("ALTER TABLE permissions ALTER COLUMN scope TYPE VARCHAR"))
        conn.execute(text("ALTER TABLE resource_permissions ALTER COLUMN resource_type TYPE VARCHAR"))
        conn.commit()
        print("   ✓ Columns converted to VARCHAR")
    except Exception as e:
        print(f"   Already VARCHAR or error: {e}")
        conn.rollback()

    # Drop the enum types if they exist
    print("\n2. Dropping old ENUM types...")
    try:
        conn.execute(text("DROP TYPE IF EXISTS resourcetype CASCADE"))
        conn.execute(text("DROP TYPE IF EXISTS action CASCADE"))
        conn.execute(text("DROP TYPE IF EXISTS scope CASCADE"))
        conn.commit()
        print("   ✓ ENUM types dropped")
    except Exception as e:
        print(f"   Error (may not exist): {e}")
        conn.rollback()

    # Now convert all values to lowercase
    print("\n3. Converting all values to lowercase...")
    result1 = conn.execute(text("UPDATE permissions SET resource_type = LOWER(resource_type) WHERE resource_type != LOWER(resource_type)"))
    result2 = conn.execute(text("UPDATE permissions SET action = LOWER(action) WHERE action != LOWER(action)"))
    result3 = conn.execute(text("UPDATE permissions SET scope = LOWER(scope) WHERE scope != LOWER(scope)"))
    print(f"   ✓ Updated {result1.rowcount} resource_type values")
    print(f"   ✓ Updated {result2.rowcount} action values")
    print(f"   ✓ Updated {result3.rowcount} scope values")
    conn.commit()

    # Verify
    result = conn.execute(text("SELECT COUNT(*) FROM permissions WHERE resource_type != LOWER(resource_type) OR action != LOWER(action) OR scope != LOWER(scope)"))
    count = result.fetchone()[0]
    if count > 0:
        print(f"\n   ⚠ Warning: {count} rows still have uppercase values")
    else:
        print("\n   ✓ All values are now lowercase")

print("\n" + "=" * 60)
print("✓ ENUM case mismatch fixed!")
print("\nColumns are now VARCHAR with lowercase values matching Python Enums.")
